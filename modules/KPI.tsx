
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Unit, KPI_KEYS, KPIKey, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
// Added CheckCircle to imports to fix "Cannot find name 'CheckCircle'" error
import { Download, FileUp, Filter, AlertOctagon, FileSpreadsheet, ClipboardPaste, Save, RefreshCw, Check, Database, ArrowRightLeft, Users, Settings as SettingsIcon, Trash2, Edit, X, Clock, Loader2, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/firebaseClient';

interface KPIProps {
  users: User[];
  units: Unit[];
  currentUser: User;
  mode: 'personal' | 'group';
}

interface DataSourceConfig {
    url: string;
    lastSync: string;
    autoSync: boolean;
    mapping: { [key: string]: string }; 
}

const KPI: React.FC<KPIProps> = ({ users, units, currentUser, mode }) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'eval' | 'config' | 'manage'>('eval'); 
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterKey, setFilterKey] = useState<KPIKey>('fiber');
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dsConfig, setDsConfig] = useState<DataSourceConfig>({ 
    url: '', 
    lastSync: '', 
    autoSync: false, 
    mapping: {} 
  });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = currentUser.hrmCode === 'ADMIN' || currentUser.canManageUsers;

  const ID_KEY = mode === 'personal' ? 'HRM_CODE' : 'UNIT_CODE';
  const CONFIG_STORAGE_KEY = mode === 'personal' ? 'kpi_config_p_fb' : 'kpi_config_g_fb';

  // --- TẢI DỮ LIỆU TỪ FIREBASE ---
  const fetchKpisFromDb = useCallback(async () => {
    setIsLoading(true);
    try {
        const data = await dbClient.getAll('kpis');
        const filtered = (data as any[]).filter(item => item.type === mode);

        const formatted = filtered.map(item => {
            const safeTargets = item.targets || {};
            if (mode === 'personal') {
                const user = users.find(u => u.hrmCode === item.entity_id);
                return {
                    hrmCode: item.entity_id,
                    fullName: user?.fullName || `Nhân sự ${item.entity_id}`,
                    unitId: user?.unitId || '',
                    targets: safeTargets
                };
            } else {
                const unit = units.find(u => u.code === item.entity_id);
                return {
                    unitCode: item.entity_id,
                    unitName: unit?.name || `Đơn vị ${item.entity_id}`,
                    targets: safeTargets
                };
            }
        });
        setKpiData(formatted);
    } catch (e) {
        console.error("Lỗi tải KPI:", e);
    } finally {
        setIsLoading(false);
    }
  }, [mode, users, units]);

  useEffect(() => {
    fetchKpisFromDb();
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
        try { setDsConfig(JSON.parse(savedConfig)); } catch (e) {}
    }
  }, [mode, fetchKpisFromDb, CONFIG_STORAGE_KEY]);

  // --- TỰ ĐỘNG ĐỒNG BỘ 10 PHÚT/LẦN ---
  useEffect(() => {
      let interval: any;
      if (dsConfig.autoSync && dsConfig.url && isAdmin) {
          console.log(`[KPI] Đã bật chế độ tự động đồng bộ cho ${mode}`);
          interval = setInterval(() => {
              handleSyncData(false);
          }, 600000); // 10 phút
      }
      return () => {
          if (interval) clearInterval(interval);
      };
  }, [dsConfig.autoSync, dsConfig.url, isAdmin, mode]);

  const saveKpiToDb = async (processedData: any[]) => {
      setIsLoading(true);
      try {
          for (const item of processedData) {
              const entityId = mode === 'personal' ? item.hrmCode : item.unitCode;
              const docId = `${mode}_${entityId}`;
              await dbClient.upsert('kpis', docId, {
                  entity_id: entityId,
                  type: mode,
                  targets: item.targets || {},
                  updated_at: new Date().toISOString()
              });
          }
          await fetchKpisFromDb();
      } catch (e) {
          alert("Lỗi khi lưu Database: " + (e as any).message);
      } finally {
          setIsLoading(false);
      }
  };

  const calculateAggregations = useCallback((data: any[]) => {
      if (mode !== 'group') return data;
      let currentData = [...data];
      const rootUnits = units.filter(u => u.parentId === null || u.level === 0);

      rootUnits.forEach(root => {
          const getDescendantIds = (parentId: string): string[] => {
              const children = units.filter(u => u.parentId === parentId);
              let ids = children.map(c => c.id);
              children.forEach(c => { ids = [...ids, ...getDescendantIds(c.id)]; });
              return ids;
          };

          const descendantCodes = units.filter(u => getDescendantIds(root.id).includes(u.id)).map(u => u.code);
          const totals: any = {};
          (Object.keys(KPI_KEYS) as KPIKey[]).forEach(key => totals[key] = { target: 0, actual: 0 });

          currentData.forEach(record => {
              if (descendantCodes.includes(record.unitCode)) {
                  (Object.keys(KPI_KEYS) as KPIKey[]).forEach(key => {
                      const t = record.targets?.[key] || { target: 0, actual: 0 };
                      totals[key].target += Number(t.target || 0);
                      totals[key].actual += Number(t.actual || 0);
                  });
              }
          });

          const rootRecordIndex = currentData.findIndex(r => r.unitCode === root.code);
          const rootRecord = { unitCode: root.code, unitName: root.name, targets: totals };
          if (rootRecordIndex >= 0) currentData[rootRecordIndex] = rootRecord;
          else currentData.push(rootRecord);
      });
      return currentData;
  }, [units, mode]);

  const handleSyncData = useCallback(async (isManual = false) => {
      if (!dsConfig.url) return;
      setIsSyncing(true);
      try {
          const response = await fetch(dsConfig.url);
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const rawData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

          const transformedData = rawData.map(row => {
              const newRow: any = {};
              Object.entries(dsConfig.mapping).forEach(([sysKey, sheetHeader]) => {
                  if (sheetHeader && row[sheetHeader as string] !== undefined) {
                      newRow[sysKey] = row[sheetHeader as string];
                  }
              });
              return newRow;
          });

          await processImportData(transformedData, false);
          
          const now = new Date().toLocaleString('vi-VN');
          setDsConfig(prev => {
              const updated = { ...prev, lastSync: now };
              localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
              return updated;
          });
          if (isManual) alert("Đồng bộ thành công dữ liệu từ Google Sheet lên Firebase!");
      } catch (e) { 
          console.error("Sync Error:", e);
          if (isManual) alert("Lỗi đồng bộ: " + (e as any).message); 
      } finally { setIsSyncing(false); }
  }, [dsConfig, CONFIG_STORAGE_KEY]);

  const processImportData = async (jsonData: any[], showAlert = true) => {
      if (!jsonData.length) return;
      let newList = [...kpiData];

      jsonData.forEach((row: any) => {
          const idValue = String(row[ID_KEY] || '').trim();
          if (!idValue) return;

          let targetIndex = -1;
          if (mode === 'personal') targetIndex = newList.findIndex(k => k.hrmCode === idValue);
          else targetIndex = newList.findIndex(k => k.unitCode === idValue);

          const newTargets: any = targetIndex >= 0 ? { ...newList[targetIndex].targets } : {};

          (Object.keys(KPI_KEYS) as KPIKey[]).forEach(key => {
              const tKey = `${key.toUpperCase()}_TARGET`;
              const aKey = `${key.toUpperCase()}_ACTUAL`;
              
              const cleanNum = (val: any) => {
                  if (val === undefined || val === null || val === '') return 0;
                  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]+/g, "");
                  const num = Number(cleaned);
                  return isNaN(num) || !isFinite(num) ? 0 : num;
              };

              if (row[tKey] !== undefined) newTargets[key] = { ...(newTargets[key] || {}), target: cleanNum(row[tKey]) };
              if (row[aKey] !== undefined) newTargets[key] = { ...(newTargets[key] || {}), actual: cleanNum(row[aKey]) };
          });

          const record = mode === 'personal' ? 
            { hrmCode: idValue, fullName: users.find(u => u.hrmCode === idValue)?.fullName || idValue, targets: newTargets } : 
            { unitCode: idValue, unitName: units.find(u => u.code === idValue)?.name || idValue, targets: newTargets };

          if (targetIndex >= 0) newList[targetIndex] = record;
          else newList.push(record);
      });

      const aggregated = calculateAggregations(newList);
      await saveKpiToDb(aggregated);
  };

  // --- LOGIC HIỂN THỊ AN TOÀN (KHÔNG GÂY LỖI TRẮNG MÀN HÌNH) ---
  const filteredData = kpiData.filter(item => {
      if (mode === 'group') return true;
      if (filterUnit !== 'all') {
          const u = users.find(u => u.hrmCode === item.hrmCode);
          return u?.unitId === filterUnit;
      }
      return true;
  });

  const subTotal = filteredData.reduce((acc, curr) => {
      const t = curr.targets?.[filterKey] || { target: 0, actual: 0 };
      acc.target += Number(t.target || 0);
      acc.actual += Number(t.actual || 0);
      return acc;
  }, { target: 0, actual: 0 });
  
  const subTotalPercent = subTotal.target > 0 ? (subTotal.actual / subTotal.target) * 100 : 0;

  // Validate chart data to avoid NaN/Infinity
  const chartData = filteredData.map(item => {
      const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
      const targetVal = Number(t.target || 0);
      const actualVal = Number(t.actual || 0);
      let pct = targetVal > 0 ? (actualVal / targetVal) * 100 : 0;
      if (isNaN(pct) || !isFinite(pct)) pct = 0;
      
      return { 
        name: mode === 'personal' ? (item.fullName || 'N/A') : (item.unitName || 'N/A'), 
        percent: Math.round(pct) 
      };
  }).sort((a, b) => b.percent - a.percent);

  return (
    <div className="space-y-6 animate-fade-in">
       {/* LOADING OVERLAY */}
       {isLoading && <div className="fixed top-0 left-0 w-full h-1 bg-vnpt-blue animate-pulse z-[100]"></div>}

       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {mode === 'group' ? <Users className="text-blue-600"/> : <ArrowRightLeft className="text-green-600"/>}
                {mode === 'group' ? 'KPI Tập thể' : 'KPI Cá nhân'}
            </h2>
            <p className="text-xs text-slate-400 font-medium">Lưu trữ: Firebase Firestore (Free vĩnh viễn)</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner border border-slate-300">
            <button onClick={() => setActiveTab('eval')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('plan')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Nhập liệu</button>
            {isAdmin && (
                <>
                    <button onClick={() => setActiveTab('manage')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Dữ liệu</button>
                    <button onClick={() => setActiveTab('config')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><SettingsIcon size={16}/></button>
                </>
            )}
          </div>
       </div>

       {activeTab === 'eval' && (
         <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold"><Filter size={16} /> Lọc:</div>
                    {mode === 'personal' && (
                        <select className="border rounded-lg px-3 py-1.5 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                            <option value="all">-- Tất cả đơn vị --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-bold outline-none focus:ring-2 focus:ring-blue-500" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                   <Clock size={14}/> {isSyncing ? "Đang đồng bộ..." : `Cập nhật: ${dsConfig.lastSync || 'Chưa rõ'}`}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
                 <h3 className="font-bold text-xs mb-4 text-green-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle size={14}/> Top Xuất sắc nhất</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: '#f0fdf4'}} />
                        <Bar dataKey="percent" barSize={15} radius={[0,4,4,0]}>
                            {chartData.slice(0, 5).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.percent >= 100 ? '#22c55e' : entry.percent >= 80 ? '#eab308' : '#3b82f6'} />
                            ))}
                        </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
                 <h3 className="font-bold text-xs mb-4 text-red-600 uppercase tracking-widest flex items-center gap-2"><AlertOctagon size={14}/> Top Cần cố gắng</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={[...chartData].sort((a,b)=>a.percent - b.percent).slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: '#fef2f2'}} />
                        <Bar dataKey="percent" fill="#ef4444" barSize={15} radius={[0,4,4,0]} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">Bảng số liệu chi tiết: {KPI_KEYS[filterKey]}</h3>
                    <div className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-mono font-bold uppercase">{filterKey}</div>
               </div>
               <div className="overflow-x-auto max-h-[450px]">
                 <table className="w-full text-xs text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                     <tr>
                       <th className="p-4 border-b">Tên đối tượng</th>
                       <th className="p-4 border-b">Định danh</th>
                       <th className="p-4 border-b text-right">Chỉ tiêu (Target)</th>
                       <th className="p-4 border-b text-right">Thực hiện (Actual)</th>
                       <th className="p-4 border-b text-center">% Hoàn thành</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {filteredData.length > 0 ? filteredData.map((item, idx) => {
                         const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
                         let pct = t.target > 0 ? (t.actual / t.target) * 100 : 0;
                         if (isNaN(pct) || !isFinite(pct)) pct = 0;

                         return (
                           <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                             <td className="p-4 font-bold text-slate-800">{mode === 'personal' ? item.fullName : item.unitName}</td>
                             <td className="p-4 font-mono text-slate-400">{mode === 'personal' ? item.hrmCode : item.unitCode}</td>
                             <td className="p-4 text-right font-mono text-slate-500">{Number(t.target || 0).toLocaleString('vi-VN')}</td>
                             <td className="p-4 text-right font-mono font-bold text-blue-700">{Number(t.actual || 0).toLocaleString('vi-VN')}</td>
                             <td className="p-4 text-center">
                                 <div className={`px-2 py-1 rounded text-[10px] font-bold text-white inline-block w-14 ${pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {pct.toFixed(1)}%
                                 </div>
                             </td>
                           </tr>
                         )
                     }) : (
                        <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">Dữ liệu đang được tải hoặc chưa được nạp...</td></tr>
                     )}
                   </tbody>
                   <tfoot className="bg-slate-900 text-white font-bold sticky bottom-0 z-10">
                       <tr>
                           <td className="p-4 text-[10px] uppercase tracking-wider">TỔNG CỘNG (PHÂN VÙNG ĐANG LỌC)</td>
                           <td className="p-4"></td>
                           <td className="p-4 text-right font-mono">{subTotal.target.toLocaleString('vi-VN')}</td>
                           <td className="p-4 text-right font-mono text-blue-300">{subTotal.actual.toLocaleString('vi-VN')}</td>
                           <td className="p-4 text-center">
                               <div className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] shadow-inner">
                                   {subTotalPercent.toFixed(1)}%
                               </div>
                           </td>
                       </tr>
                   </tfoot>
                 </table>
               </div>
            </div>
         </div>
       )}

       {/* TAB: CẤU HÌNH ĐỒNG BỘ */}
       {activeTab === 'config' && isAdmin && (
           <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 max-w-3xl mx-auto">
               <div className="flex items-center gap-3 border-b pb-4">
                   <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                       <Database size={32}/>
                   </div>
                   <div>
                       <h3 className="font-bold text-xl">Đồng bộ Google Sheet lên Firebase Cloud</h3>
                       <p className="text-xs text-slate-500">Cấu hình lấy dữ liệu từ link CSV đã Public của Google Sheets.</p>
                   </div>
               </div>
               
               <div className="space-y-6">
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">URL Google Sheet (Định dạng CSV)</label>
                       <div className="flex gap-2">
                            <input type="text" className="flex-1 border-2 rounded-xl p-3 outline-none focus:border-blue-500 transition-all" placeholder="Nhập link pub?output=csv..." value={dsConfig.url} onChange={e => setDsConfig({...dsConfig, url: e.target.value})} />
                            <button onClick={async () => {
                                if (!dsConfig.url) return alert("Vui lòng nhập link!");
                                setIsCheckingLink(true);
                                try {
                                    const res = await fetch(dsConfig.url);
                                    if (!res.ok) throw new Error();
                                    const csv = await res.text();
                                    const wb = XLSX.read(csv, { type: 'string' });
                                    const firstSheet = wb.Sheets[wb.SheetNames[0]];
                                    const data = XLSX.utils.sheet_to_json(firstSheet)[0];
                                    if (data) {
                                        setSheetHeaders(Object.keys(data as any));
                                        alert("Kết nối Google Sheet thành công! Hãy thực hiện ánh xạ cột.");
                                    }
                                } catch(e) { alert("Lỗi kết nối link CSV. Hãy đảm bảo bạn đã 'Publish to web' đúng định dạng CSV."); }
                                setIsCheckingLink(false);
                            }} className="bg-slate-800 text-white px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-colors">
                                {isCheckingLink ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>} Kiểm tra
                            </button>
                       </div>
                   </div>

                   <div className="flex items-center gap-4 p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl shadow-inner">
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="autoSync" className="sr-only peer" checked={dsConfig.autoSync} onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <label htmlFor="autoSync" className="text-sm font-bold text-blue-900 cursor-pointer select-none flex-1">
                            Tự động đồng bộ dữ liệu mỗi 10 phút một lần (Auto-sync Cloud)
                        </label>
                        <div className="text-blue-400"><Clock size={20}/></div>
                   </div>
               </div>
               
               {sheetHeaders.length > 0 && (
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-fade-in">
                       <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><ArrowRightLeft size={16} className="text-blue-500"/> Thiết lập Ánh xạ cột</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                           {[
                               {k: ID_KEY, l: mode === 'personal' ? 'Mã HRM' : 'Mã Đơn vị'},
                               ...Object.keys(KPI_KEYS).flatMap(k => [
                                   {k: `${k.toUpperCase()}_TARGET`, l: `[${k}] Chỉ tiêu`},
                                   {k: `${k.toUpperCase()}_ACTUAL`, l: `[${k}] Thực hiện`}
                               ])
                           ].map(f => (
                               <div key={f.k} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                                   <div className="text-[10px] font-bold text-slate-500">{f.l}</div>
                                   <select className="flex-1 max-w-[150px] border rounded p-1.5 text-[10px] bg-white" value={dsConfig.mapping[f.k] || ''} onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [f.k]: e.target.value}})}>
                                       <option value="">-- Bỏ qua --</option>
                                       {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                   </select>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
               
               <div className="flex justify-end gap-3 pt-6 border-t">
                   <button onClick={() => { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(dsConfig)); alert("Đã lưu cấu hình ánh xạ cục bộ."); }} className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50">Lưu cấu hình</button>
                   <button onClick={() => handleSyncData(true)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all">
                       {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Đồng bộ Database Cloud Ngay
                   </button>
               </div>
           </div>
       )}

       {/* TAB: NHẬP LIỆU (EXCEL/PASTE) */}
       {activeTab === 'plan' && (
           <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-inner">
                <div className="bg-blue-50 p-6 rounded-full text-blue-600 mb-6"><FileUp size={64}/></div>
                <h3 className="text-2xl font-bold mb-4 text-slate-800">Nhập dữ liệu nhanh cho {mode === 'personal' ? 'Cá nhân' : 'Đơn vị'}</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md text-center">Hỗ trợ nạp dữ liệu hàng loạt từ file Excel (.xlsx) hoặc dán trực tiếp từ Clipboard.</p>
                <div className="flex gap-4">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={e => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const reader = new FileReader();
                         reader.onload = (evt) => {
                             const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]);
                             processImportData(data);
                         };
                         reader.readAsBinaryString(file);
                    }} />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"><FileSpreadsheet size={24}/> Chọn file Excel</button>
                    <button onClick={() => setPasteModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 active:scale-95 transition-all"><ClipboardPaste size={24}/> Dán dữ liệu</button>
                </div>
           </div>
       )}

       {/* TAB: QUẢN LÝ DỮ LIỆU TRÊN CLOUD */}
       {activeTab === 'manage' && isAdmin && (
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Dữ liệu trên Firebase Cloud ({kpiData.length} bản ghi)</h3>
                    <button onClick={fetchKpisFromDb} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"><RefreshCw size={12}/> Refresh</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-600 font-bold">
                       <tr>
                           <th className="p-4">Đối tượng</th>
                           <th className="p-4">Mã</th>
                           <th className="p-4 text-center">KPI đã nạp</th>
                           <th className="p-4 text-right">Thao tác</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y">
                       {kpiData.map((item, i) => {
                           const id = mode === 'personal' ? item.hrmCode : item.unitCode;
                           const name = mode === 'personal' ? item.fullName : item.unitName;
                           const count = Object.keys(item.targets || {}).length;
                           return (
                               <tr key={i} className="hover:bg-slate-50 transition-colors">
                                   <td className="p-4 font-bold text-slate-800">{name}</td>
                                   <td className="p-4 font-mono text-xs text-slate-400">{id}</td>
                                   <td className="p-4 text-center">
                                       <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{count} chỉ tiêu</span>
                                   </td>
                                   <td className="p-4 text-right">
                                       <button onClick={async () => {
                                           if (!confirm(`Xóa toàn bộ dữ liệu của '${name}'?`)) return;
                                           await dbClient.delete('kpis', `${mode}_${id}`);
                                           fetchKpisFromDb();
                                       }} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                   </td>
                               </tr>
                           )
                       })}
                       {kpiData.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic">Database trống.</td></tr>}
                   </tbody>
                 </table>
               </div>
           </div>
       )}

       {/* MODAL: PASTE DATA */}
       {pasteModalOpen && (
           <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white w-full max-w-xl rounded-3xl p-8 shadow-2xl animate-zoom-in">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-2xl text-slate-800">Dán từ bảng tính</h3>
                       <button onClick={() => setPasteModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
                   </div>
                   <p className="text-xs text-slate-500 mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100 italic">
                       * Lưu ý: Copy cả dòng tiêu đề (Header) từ Excel để hệ thống nhận diện cột.
                   </p>
                   <textarea className="w-full h-80 border-2 rounded-2xl p-4 font-mono text-[11px] bg-slate-50 outline-none focus:border-blue-500 transition-all shadow-inner" placeholder={`Mã\tFiber_Target\tFiber_Actual\nVNPT_01\t100\t80\n...`} value={pasteContent} onChange={e => setPasteContent(e.target.value)}></textarea>
                   <div className="flex justify-end gap-3 mt-8">
                       <button onClick={() => setPasteModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Hủy bỏ</button>
                       <button onClick={() => {
                           const rows = pasteContent.trim().split('\n');
                           if (rows.length < 2) return alert("Vui lòng bao gồm cả dòng tiêu đề.");
                           const headers = rows[0].split('\t').map(h => h.trim());
                           const data = rows.slice(1).map(r => {
                               const obj: any = {};
                               const cells = r.split('\t');
                               headers.forEach((h, i) => obj[h] = cells[i]?.trim());
                               return obj;
                           });
                           processImportData(data);
                           setPasteModalOpen(false);
                           setPasteContent('');
                       }} className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold shadow-xl hover:bg-blue-700 transition-all">Cập nhật Database</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KPI;
