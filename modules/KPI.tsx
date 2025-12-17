
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Unit, KPI_KEYS, KPIKey, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, FileUp, Filter, AlertOctagon, FileSpreadsheet, ClipboardPaste, Save, RefreshCw, Check, Database, ArrowRightLeft, Users, Settings as SettingsIcon, Trash2, Edit, X, Clock, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabaseClient';

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

  const isAdmin = currentUser.hrmCode === 'ADMIN';
  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].some(r => currentUser.title.includes(r));
  const canViewGroup = isAdmin || isLeader;

  const ID_KEY = mode === 'personal' ? 'HRM_CODE' : 'UNIT_CODE';
  const ID_LABEL = mode === 'personal' ? 'Mã nhân viên' : 'Mã đơn vị';
  const CONFIG_STORAGE_KEY = mode === 'personal' ? 'kpi_config_p' : 'kpi_config_g';

  const systemFields = [
      { key: ID_KEY, label: ID_LABEL, required: true },
      ...(Object.keys(KPI_KEYS) as (keyof typeof KPI_KEYS)[]).map(k => ({ key: `${k.toUpperCase()}_TARGET`, label: `[${k.toUpperCase()}] Chỉ tiêu`, required: false })),
      ...(Object.keys(KPI_KEYS) as (keyof typeof KPI_KEYS)[]).map(k => ({ key: `${k.toUpperCase()}_ACTUAL`, label: `[${k.toUpperCase()}] Thực hiện`, required: false })),
  ];

  // --- TẢI DỮ LIỆU TỪ DATABASE ---
  const fetchKpisFromDb = useCallback(async () => {
    setIsLoading(true);
    try {
        const { data, error } = await supabase.from('kpis').select('*').eq('type', mode);
        if (error) throw error;

        const formatted = (data || []).map(item => {
            const safeTargets = item.targets || {};
            if (mode === 'personal') {
                const user = users.find(u => u.hrmCode === item.entity_id);
                return {
                    hrmCode: item.entity_id,
                    fullName: user?.fullName || `N/A (${item.entity_id})`,
                    unitId: user?.unitId || '',
                    targets: safeTargets
                };
            } else {
                const unit = units.find(u => u.code === item.entity_id);
                return {
                    unitCode: item.entity_id,
                    unitName: unit?.name || `N/A (${item.entity_id})`,
                    targets: safeTargets
                };
            }
        });
        setKpiData(formatted);
    } catch (e) {
        console.error("Lỗi tải KPI từ Database:", e);
    } finally {
        setIsLoading(false);
    }
  }, [mode, users, units]);

  useEffect(() => {
    fetchKpisFromDb();
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
        try {
            setDsConfig(JSON.parse(savedConfig));
        } catch (e) {
            console.error("Lỗi parse config:", e);
        }
    }
  }, [mode, fetchKpisFromDb, CONFIG_STORAGE_KEY]);

  // --- LƯU DỮ LIỆU VÀO DATABASE ---
  const saveKpiToDb = async (processedData: any[]) => {
      setIsLoading(true);
      try {
          const payload = processedData.map(item => ({
              entity_id: mode === 'personal' ? item.hrmCode : item.unitCode,
              type: mode,
              targets: item.targets || {},
              updated_at: new Date().toISOString()
          }));

          const { error } = await supabase.from('kpis').upsert(payload, { onConflict: 'entity_id, type' });
          if (error) throw error;
          
          await fetchKpisFromDb();
      } catch (e) {
          console.error("Lỗi lưu Database:", e);
          alert("Lỗi khi lưu vào Database: " + (e as any).message);
      } finally {
          setIsLoading(false);
      }
  };

  // --- TỔNG HỢP DỮ LIỆU (AGGREGATION) ---
  const calculateAggregations = useCallback((data: any[]) => {
      if (mode !== 'group') return data;
      let currentData = [...data];
      const rootUnits = units.filter(u => u.parentId === null);

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

  // --- ĐỒNG BỘ DỮ LIỆU ---
  const handleSyncData = useCallback(async (isManual = false) => {
      if (!dsConfig.url) { 
        if (isManual) alert("Vui lòng cấu hình URL Google Sheet trước."); 
        return; 
      }
      setIsSyncing(true);
      try {
          const response = await fetch(dsConfig.url);
          if (!response.ok) throw new Error("Không thể kết nối tới URL Google Sheet.");
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawData: any[] = XLSX.utils.sheet_to_json(ws);

          if (Object.keys(rawData).length === 0) throw new Error("File rỗng hoặc sai định dạng.");
          if (Object.keys(dsConfig.mapping).length === 0) { 
              if (isManual) alert("Chưa cấu hình ánh xạ (Mapping) các cột."); 
              return; 
          }

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

          if (isManual) alert("Đồng bộ thành công và đã lưu vào Database!");
      } catch (e) { 
          console.error("Sync Error:", e);
          if (isManual) alert("Lỗi khi đồng bộ: " + (e as any).message); 
      } finally { 
          setIsSyncing(false); 
      }
  }, [dsConfig, CONFIG_STORAGE_KEY]);

  // --- AUTO SYNC LOGIC (10 PHÚT/LẦN) ---
  useEffect(() => {
      let intervalId: any;
      if (dsConfig.url && dsConfig.autoSync) {
          console.log("Kích hoạt chế độ tự động đồng bộ (10 phút/lần)");
          intervalId = setInterval(() => {
              handleSyncData(false);
          }, 600000); // 10 phút = 600,000 ms
      }
      return () => {
          if (intervalId) clearInterval(intervalId);
      };
  }, [dsConfig.url, dsConfig.autoSync, handleSyncData]);

  const checkConnection = async () => {
      if (!dsConfig.url) return alert("Vui lòng nhập URL CSV Google Sheet");
      setIsCheckingLink(true);
      try {
          const response = await fetch(dsConfig.url);
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (data.length > 0) {
              setSheetHeaders(Object.keys(data[0]));
              alert("Kết nối thành công! Hãy chọn các cột tương ứng bên dưới.");
          }
      } catch (e) { 
          alert("Lỗi: Không thể đọc file. Hãy đảm bảo link đã được 'Chia sẻ lên web' (Publish to web) ở định dạng CSV."); 
      } finally { 
          setIsCheckingLink(false); 
      }
  };

  const processImportData = async (jsonData: any[], showAlert = true) => {
      if (!jsonData.length) return;
      let newList = [...kpiData];

      jsonData.forEach((row: any) => {
          const idValue = String(row[ID_KEY] || '').trim();
          if (!idValue) return;

          let targetIndex = -1;
          let entityName = '';
          let entityUnitId = '';

          if (mode === 'personal') {
              targetIndex = newList.findIndex(k => k.hrmCode === idValue);
              const user = users.find(u => u.hrmCode === idValue);
              if (!user) return;
              entityName = user.fullName;
              entityUnitId = user.unitId;
          } else {
              targetIndex = newList.findIndex(k => k.unitCode === idValue);
              const unit = units.find(u => u.code === idValue);
              if (!unit) return;
              entityName = unit.name;
          }

          const currentTargets = (targetIndex >= 0 ? newList[targetIndex].targets : {}) || {};
          const newTargets: any = { ...currentTargets };

          (Object.keys(KPI_KEYS) as KPIKey[]).forEach(key => {
              const tKey = `${key.toUpperCase()}_TARGET`;
              const aKey = `${key.toUpperCase()}_ACTUAL`;
              
              const cleanNum = (val: any) => {
                  if (val === undefined || val === null || val === '') return 0;
                  // Loại bỏ dấu phẩy và ký tự không phải số, giữ lại dấu chấm và dấu trừ
                  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]+/g, "");
                  const num = Number(cleaned);
                  return isNaN(num) ? 0 : num;
              };

              if (row[tKey] !== undefined) {
                  newTargets[key] = { ...(newTargets[key] || {}), target: cleanNum(row[tKey]) };
              }
              if (row[aKey] !== undefined) {
                  newTargets[key] = { ...(newTargets[key] || {}), actual: cleanNum(row[aKey]) };
              }
          });

          const record = mode === 'personal' ? 
            { hrmCode: idValue, fullName: entityName, unitId: entityUnitId, targets: newTargets } : 
            { unitCode: idValue, unitName: entityName, targets: newTargets };

          if (targetIndex >= 0) newList[targetIndex] = record;
          else newList.push(record);
      });

      const aggregated = calculateAggregations(newList);
      await saveKpiToDb(aggregated);
      if (showAlert) alert("Dữ liệu đã được lưu thành công!");
  };

  // --- RENDERING LOGIC ---
  const filteredData = kpiData.filter(item => {
      if (mode === 'group') return true;
      if (filterUnit !== 'all') {
          const unit = units.find(u => u.id === item.unitId);
          if (item.unitId !== filterUnit && unit?.parentId !== filterUnit) return false;
      }
      return true;
  });

  // TÍNH TOÁN SUB-TOTAL AN TOÀN
  const subTotal = filteredData.reduce((acc, curr) => {
      const t = curr.targets?.[filterKey] || { target: 0, actual: 0 };
      acc.target += Number(t.target || 0);
      acc.actual += Number(t.actual || 0);
      return acc;
  }, { target: 0, actual: 0 });
  const subTotalPercent = subTotal.target > 0 ? (subTotal.actual / subTotal.target) * 100 : 0;

  // CHUẨN BỊ DỮ LIỆU BIỂU ĐỒ AN TOÀN (NGĂN CHẶN NaN)
  const chartData = filteredData.map(item => {
      const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
      const targetVal = Number(t.target || 0);
      const actualVal = Number(t.actual || 0);
      let percent = 0;
      if (targetVal > 0) {
          percent = (actualVal / targetVal) * 100;
      }
      // Ngăn chặn NaN hoặc Infinity
      if (isNaN(percent) || !isFinite(percent)) percent = 0;
      
      return { 
        name: mode === 'personal' ? (item.fullName || 'N/A') : (item.unitName || 'N/A'), 
        percent: Math.round(percent) 
      };
  }).sort((a, b) => b.percent - a.percent);

  const top5 = chartData.slice(0, 5);
  const bottom5 = [...chartData].sort((a, b) => a.percent - b.percent).slice(0, 5);

  if (mode === 'group' && !canViewGroup) {
      return <div className="p-8 text-center bg-white rounded-xl shadow-sm border text-red-500">Bạn không có quyền xem KPI Tập thể.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
       {isLoading && <div className="fixed top-0 left-0 w-full h-1 bg-blue-600 animate-pulse z-[100]"></div>}
       
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {mode === 'group' ? <Users className="text-blue-600"/> : <ArrowRightLeft className="text-green-600"/>}
                {mode === 'group' ? 'KPI Tập thể' : 'KPI Cá nhân'}
            </h2>
            <p className="text-sm text-slate-500 italic">Dữ liệu được quản trị tập trung tại Database Supabase.</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setActiveTab('eval')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('plan')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Nhập liệu</button>
            {isAdmin && (
                <>
                    <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Quản lý</button>
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}><SettingsIcon size={16}/></button>
                </>
            )}
          </div>
       </div>

       {/* TAB: ĐÁNH GIÁ (BIỂU ĐỒ & BẢNG) */}
       {activeTab === 'eval' && (
         <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold"><Filter size={16} /> Lọc:</div>
                    {mode === 'personal' && (
                        <select className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                            <option value="all">-- Tất cả đơn vị --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium outline-none focus:ring-2 focus:ring-blue-500" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                   <Clock size={14}/> {isSyncing ? "Đang đồng bộ..." : `Cập nhật: ${dsConfig.lastSync || 'Chưa rõ'}`}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[300px]">
                 <h3 className="font-bold text-sm mb-4 text-green-700 uppercase tracking-wider">Top 5 {mode === 'personal' ? 'Nhân viên' : 'Đơn vị'} Dẫn đầu</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top5} layout="vertical" margin={{left: 20, right: 30}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide domain={[0, 100]} />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                            <Tooltip cursor={{fill: '#f0fdf4'}} formatter={(v: any) => [`${v}%`, 'Hoàn thành']} />
                            <Bar dataKey="percent" fill="#22c55e" barSize={18} radius={[0,4,4,0]} label={{ position: 'right', fill: '#666', fontSize: 10, formatter: (val: number) => `${val}%` }} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[300px]">
                 <h3 className="font-bold text-sm mb-4 text-red-600 uppercase tracking-wider">Top 5 Cần cố gắng</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bottom5} layout="vertical" margin={{left: 20, right: 30}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide domain={[0, 100]} />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                            <Tooltip cursor={{fill: '#fef2f2'}} formatter={(v: any) => [`${v}%`, 'Hoàn thành']} />
                            <Bar dataKey="percent" fill="#ef4444" barSize={18} radius={[0,4,4,0]} label={{ position: 'right', fill: '#666', fontSize: 10, formatter: (val: number) => `${val}%` }} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Biểu chi tiết: {KPI_KEYS[filterKey]}</h3>
                    <div className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono font-bold">{filterKey.toUpperCase()}</div>
               </div>
               <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                 <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                     <tr>
                       <th className="p-4 border-b">Đối tượng</th>
                       <th className="p-4 border-b w-32">Mã định danh</th>
                       <th className="p-4 border-b text-right">Kế hoạch</th>
                       <th className="p-4 border-b text-right">Thực hiện</th>
                       <th className="p-4 border-b text-center w-32">% Hoàn thành</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {filteredData.length > 0 ? filteredData.map((item, idx) => {
                         const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
                         const targetVal = Number(t.target || 0);
                         const actualVal = Number(t.actual || 0);
                         const pct = targetVal > 0 ? (actualVal / targetVal) * 100 : 0;
                         const isRoot = mode === 'group' && units.find(u => u.code === item.unitCode)?.parentId === null;

                         return (
                           <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isRoot ? 'bg-blue-50/50 font-semibold' : ''}`}>
                             <td className="p-4">
                                {mode === 'personal' ? (item.fullName || 'N/A') : (item.unitName || 'N/A')}
                             </td>
                             <td className="p-4 font-mono text-xs text-slate-400">{mode === 'personal' ? item.hrmCode : item.unitCode}</td>
                             <td className="p-4 text-right font-mono">{targetVal.toLocaleString('vi-VN')}</td>
                             <td className="p-4 text-right font-mono font-bold text-blue-700">{actualVal.toLocaleString('vi-VN')}</td>
                             <td className="p-4 text-center">
                                 <div className={`px-2 py-1 rounded text-[11px] font-bold text-white inline-block w-16 ${pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {pct.toFixed(1)}%
                                 </div>
                             </td>
                           </tr>
                         )
                     }) : (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chưa có dữ liệu cho mục này.</td></tr>
                     )}
                   </tbody>
                   <tfoot className="bg-slate-900 text-white font-bold sticky bottom-0">
                       <tr>
                           <td className="p-4 text-xs tracking-wider">TỔNG CỘNG (SUBTOTAL)</td>
                           <td className="p-4"></td>
                           <td className="p-4 text-right font-mono">{subTotal.target.toLocaleString('vi-VN')}</td>
                           <td className="p-4 text-right font-mono text-blue-300">{subTotal.actual.toLocaleString('vi-VN')}</td>
                           <td className="p-4 text-center">
                               <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
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

       {/* TAB: CẤU HÌNH (ADMIN ONLY) */}
       {activeTab === 'config' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
               <div className="flex items-center gap-3 border-b pb-4">
                   <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Database size={24}/></div>
                   <div>
                       <h3 className="font-bold text-lg">Cấu hình Đồng bộ Google Sheet</h3>
                       <p className="text-xs text-slate-500">Kết nối Google Sheet định dạng CSV để tự động hóa việc nhập liệu.</p>
                   </div>
               </div>
               
               <div className="space-y-4">
                   <div>
                       <label className="block text-sm font-bold text-slate-600 mb-2">URL Google Sheet (Dạng CSV)</label>
                       <div className="flex gap-2">
                            <input type="text" className="flex-1 border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập link CSV (Publish to web)..." value={dsConfig.url} onChange={e => setDsConfig({...dsConfig, url: e.target.value})} />
                            <button onClick={checkConnection} disabled={isCheckingLink} className="bg-slate-800 text-white px-4 rounded-lg font-bold flex items-center gap-2">
                                {isCheckingLink ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>} Kiểm tra
                            </button>
                       </div>
                   </div>

                   {/* AUTO SYNC TOGGLE */}
                   <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <input 
                            type="checkbox" 
                            id="autoSync" 
                            className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                            checked={dsConfig.autoSync} 
                            onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} 
                        />
                        <label htmlFor="autoSync" className="text-sm font-bold text-blue-800 cursor-pointer select-none">
                            Tự động đồng bộ dữ liệu mỗi 10 phút một lần
                        </label>
                        <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-bold ml-auto">AUTO-MODE</span>
                   </div>
               </div>
               
               {sheetHeaders.length > 0 && (
                   <div className="bg-slate-50 p-4 rounded-xl border">
                       <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><ArrowRightLeft size={16}/> Thiết lập ánh xạ cột</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {systemFields.map(f => (
                               <div key={f.key} className="flex items-center justify-between gap-4 p-2 bg-white rounded border">
                                   <div className="text-xs font-bold text-slate-600">{f.label}</div>
                                   <select className="flex-1 max-w-[150px] border rounded p-1.5 text-[10px] bg-slate-50" value={dsConfig.mapping[f.key] || ''} onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [f.key]: e.target.value}})}>
                                       <option value="">-- Bỏ qua --</option>
                                       {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                   </select>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
               
               <div className="flex items-center gap-4 pt-4 border-t">
                   <button onClick={() => { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(dsConfig)); alert("Đã lưu cấu hình ánh xạ."); }} className="bg-white border text-slate-700 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">
                       <Save size={18}/> Lưu cấu hình
                   </button>
                   <button onClick={() => handleSyncData(true)} disabled={isSyncing || !dsConfig.url} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md">
                       {isSyncing ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Đồng bộ ngay lên Database
                   </button>
               </div>
           </div>
       )}

       {/* TAB: NHẬP LIỆU (EXCEL/PASTE) */}
       {activeTab === 'plan' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
                    <FileUp size={48} className="text-blue-600 mb-4" />
                    <h3 className="text-xl font-bold mb-6">Nhập dữ liệu nhanh</h3>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <input type="file" ref={fileInputRef} onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                const bstr = evt.target?.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                                processImportData(data);
                            };
                            reader.readAsBinaryString(file);
                        }} className="hidden" accept=".xlsx, .xls" />
                        <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><FileSpreadsheet size={20}/> Nhập file Excel</button>
                        <button onClick={() => setPasteModalOpen(true)} className="bg-white border-2 border-slate-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><ClipboardPaste size={20}/> Dán từ bảng tính</button>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-orange-600"><AlertOctagon size={20}/> Hướng dẫn cấu trúc file</h4>
                    <div className="space-y-3 text-sm text-slate-600">
                        <div className="p-2 bg-white rounded border">Cột ID: <b>{ID_KEY}</b></div>
                        <div className="p-2 bg-white rounded border">Cột chỉ tiêu: <b>TENCHI_TARGET</b></div>
                        <div className="p-2 bg-white rounded border">Cột thực hiện: <b>TENCHI_ACTUAL</b></div>
                        <p className="text-[11px] italic mt-2">* TENCHI bao gồm: FIBER, MYTV, MESH, CAMERA, MOBILE_PTM, MOBILE_REV, CHANNEL_DBL...</p>
                    </div>
                </div>
           </div>
       )}

       {/* TAB: QUẢN LÝ */}
       {activeTab === 'manage' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center font-bold">Quản lý bản ghi Database ({kpiData.length})</div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 font-bold">
                       <tr>
                           <th className="p-4">Đối tượng</th>
                           <th className="p-4">Mã định danh</th>
                           <th className="p-4 text-center">Số chỉ tiêu</th>
                           <th className="p-4 text-right">Thao tác</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y">
                       {kpiData.map((item, i) => {
                           const id = mode === 'personal' ? item.hrmCode : item.unitCode;
                           const name = mode === 'personal' ? item.fullName : item.unitName;
                           const count = Object.keys(item.targets || {}).length;
                           return (
                               <tr key={i} className="hover:bg-slate-50">
                                   <td className="p-4 font-medium">{name}</td>
                                   <td className="p-4 font-mono text-xs">{id}</td>
                                   <td className="p-4 text-center"><span className="bg-slate-200 px-2 py-0.5 rounded text-[10px]">{count} KPI</span></td>
                                   <td className="p-4 text-right">
                                       <button onClick={async () => {
                                           if (!confirm(`Xóa toàn bộ KPI của '${name}'?`)) return;
                                           const { error } = await supabase.from('kpis').delete().eq('entity_id', id).eq('type', mode);
                                           if (!error) fetchKpisFromDb();
                                       }} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                                   </td>
                               </tr>
                           )
                       })}
                   </tbody>
                 </table>
               </div>
           </div>
       )}

       {/* PASTE MODAL */}
       {pasteModalOpen && (
           <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-hidden animate-zoom-in">
                   <h3 className="font-bold text-xl mb-4">Dán dữ liệu trực tiếp</h3>
                   <textarea className="w-full h-80 border rounded-xl p-4 font-mono text-[11px] bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder={`Mã\tChỉ tiêu\tThực hiện\nVNPT01\t100\t80\n...`} value={pasteContent} onChange={e => setPasteContent(e.target.value)}></textarea>
                   <div className="flex justify-end gap-3 mt-6">
                       <button onClick={() => setPasteModalOpen(false)} className="px-5 py-2 text-slate-600 font-bold">Đóng</button>
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
                       }} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold">Cập nhật Database</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KPI;
