
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Unit, KPI_KEYS, KPIKey, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, FileUp, Filter, AlertOctagon, FileSpreadsheet, ClipboardPaste, Save, RefreshCw, Check, Database, ArrowRightLeft, Users, Settings as SettingsIcon, Trash2, Edit, X, Clock, Loader2 } from 'lucide-react';
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
  const CONFIG_STORAGE_KEY = mode === 'personal' ? 'kpi_config_p' : 'kpi_config_g';

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

  const saveKpiToDb = async (processedData: any[]) => {
      setIsLoading(true);
      try {
          for (const item of processedData) {
              const entityId = mode === 'personal' ? item.hrmCode : item.unitCode;
              const id = `${mode}_${entityId}`;
              await dbClient.upsert('kpis', id, {
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
          if (isManual) alert("Đồng bộ thành công!");
      } catch (e) { 
          if (isManual) alert("Lỗi đồng bộ: " + (e as any).message); 
      } finally { setIsSyncing(false); }
  }, [dsConfig, CONFIG_STORAGE_KEY]);

  // AUTO SYNC - 10 PHÚT/LẦN
  useEffect(() => {
      let interval: any;
      if (isAdmin && dsConfig.autoSync && dsConfig.url) {
          console.log("Kích hoạt tự động đồng bộ KPI (10 phút)");
          interval = setInterval(() => handleSyncData(false), 600000); 
      }
      return () => clearInterval(interval);
  }, [dsConfig.autoSync, dsConfig.url, isAdmin, handleSyncData]);

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

  const chartData = filteredData.map(item => {
      const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
      const pct = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return { 
        name: mode === 'personal' ? (item.fullName || 'N/A') : (item.unitName || 'N/A'), 
        percent: Math.round(isNaN(pct) ? 0 : pct) 
      };
  }).sort((a, b) => b.percent - a.percent);

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {mode === 'group' ? <Users className="text-blue-600"/> : <ArrowRightLeft className="text-green-600"/>}
                {mode === 'group' ? 'KPI Tập thể' : 'KPI Cá nhân'}
            </h2>
            <p className="text-xs text-slate-400 italic">Database: Firebase Firestore (Free Tier)</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-lg shadow-inner">
            <button onClick={() => setActiveTab('eval')} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('plan')} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}>Nhập liệu</button>
            {isAdmin && (
                <>
                    <button onClick={() => setActiveTab('manage')} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}>Quản lý</button>
                    <button onClick={() => setActiveTab('config')} className={`px-5 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}><SettingsIcon size={16}/></button>
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
                        <select className="border rounded-lg px-3 py-1.5 text-sm bg-slate-50 outline-none" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                            <option value="all">-- Tất cả đơn vị --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-bold outline-none" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                   <Clock size={12}/> {isSyncing ? "Đang đồng bộ..." : `Cập nhật: ${dsConfig.lastSync || 'Chưa rõ'}`}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
                 <h3 className="font-bold text-xs mb-4 text-green-600 uppercase tracking-widest">Top Xuất sắc nhất</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: '#f0fdf4'}} />
                        <Bar dataKey="percent" fill="#22c55e" barSize={15} radius={[0,4,4,0]} label={{ position: 'right', fontSize: 10, formatter: (v:any)=>`${v}%` }} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
                 <h3 className="font-bold text-xs mb-4 text-red-600 uppercase tracking-widest">Top Cần cố gắng</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={[...chartData].sort((a,b)=>a.percent - b.percent).slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: '#fef2f2'}} />
                        <Bar dataKey="percent" fill="#ef4444" barSize={15} radius={[0,4,4,0]} label={{ position: 'right', fontSize: 10, formatter: (v:any)=>`${v}%` }} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">Chi tiết: {KPI_KEYS[filterKey]}</h3>
                    <div className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-mono font-bold uppercase">{filterKey}</div>
               </div>
               <div className="overflow-x-auto max-h-[400px]">
                 <table className="w-full text-xs text-left">
                   <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                     <tr>
                       <th className="p-4 border-b">Tên đối tượng</th>
                       <th className="p-4 border-b">Định danh</th>
                       <th className="p-4 border-b text-right">Kế hoạch</th>
                       <th className="p-4 border-b text-right">Thực hiện</th>
                       <th className="p-4 border-b text-center">% Hoàn thành</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {filteredData.map((item, idx) => {
                         const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
                         const pct = t.target > 0 ? (t.actual / t.target) * 100 : 0;
                         return (
                           <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                             <td className="p-4 font-bold text-slate-800">{mode === 'personal' ? item.fullName : item.unitName}</td>
                             <td className="p-4 font-mono text-slate-400">{mode === 'personal' ? item.hrmCode : item.unitCode}</td>
                             <td className="p-4 text-right font-mono text-slate-500">{t.target.toLocaleString()}</td>
                             <td className="p-4 text-right font-mono font-bold text-blue-700">{t.actual.toLocaleString()}</td>
                             <td className="p-4 text-center">
                                 <div className={`px-2 py-1 rounded text-[10px] font-bold text-white inline-block w-14 ${pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {pct.toFixed(1)}%
                                 </div>
                             </td>
                           </tr>
                         )
                     })}
                   </tbody>
                   <tfoot className="bg-slate-900 text-white font-bold sticky bottom-0">
                       <tr>
                           <td className="p-4 text-[10px] uppercase">TỔNG CỘNG (SUBTOTAL)</td>
                           <td className="p-4"></td>
                           <td className="p-4 text-right font-mono">{subTotal.target.toLocaleString()}</td>
                           <td className="p-4 text-right font-mono text-blue-300">{subTotal.actual.toLocaleString()}</td>
                           <td className="p-4 text-center">
                               <div className="bg-blue-600 text-white px-2 py-1 rounded text-[10px]">
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

       {activeTab === 'config' && isAdmin && (
           <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 max-w-3xl mx-auto">
               <div className="flex items-center gap-3 border-b pb-4">
                   <Database className="text-blue-600" size={32}/>
                   <div>
                       <h3 className="font-bold text-xl">Đồng bộ Google Sheet</h3>
                       <p className="text-xs text-slate-500 italic">Dữ liệu từ Google Sheet sẽ được cập nhật trực tiếp lên Firebase Cloud.</p>
                   </div>
               </div>
               
               <div className="space-y-6">
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">URL Google Sheet (Định dạng CSV)</label>
                       <div className="flex gap-2">
                            <input type="text" className="flex-1 border-2 rounded-xl p-3 outline-none focus:border-blue-500" value={dsConfig.url} onChange={e => setDsConfig({...dsConfig, url: e.target.value})} />
                            <button onClick={async () => {
                                setIsCheckingLink(true);
                                try {
                                    const res = await fetch(dsConfig.url);
                                    const csv = await res.text();
                                    const wb = XLSX.read(csv, { type: 'string' });
                                    setSheetHeaders(Object.keys(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])[0] as any));
                                    alert("Kết nối Google Sheet thành công!");
                                } catch(e) { alert("Lỗi kết nối link CSV"); }
                                setIsCheckingLink(false);
                            }} className="bg-slate-800 text-white px-6 rounded-xl font-bold">Kiểm tra</button>
                       </div>
                   </div>

                   <div className="flex items-center gap-4 p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                        <input type="checkbox" id="autoSync" className="w-6 h-6 text-blue-600 cursor-pointer" checked={dsConfig.autoSync} onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} />
                        <label htmlFor="autoSync" className="text-sm font-bold text-blue-900 cursor-pointer select-none flex-1">
                            Tự động đồng bộ dữ liệu mỗi 10 phút một lần (Chạy ngầm)
                        </label>
                        <Clock className="text-blue-400"/>
                   </div>
               </div>
               
               <div className="flex justify-end gap-3 pt-6">
                   <button onClick={() => { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(dsConfig)); alert("Đã lưu cấu hình."); }} className="bg-white border-2 text-slate-700 px-6 py-3 rounded-xl font-bold">Lưu cấu hình</button>
                   <button onClick={() => handleSyncData(true)} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                       {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Đồng bộ Database Cloud
                   </button>
               </div>
           </div>
       )}

       {activeTab === 'plan' && (
           <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <FileUp size={64} className="text-blue-600 mb-6" />
                <h3 className="text-2xl font-bold mb-4">Nhập dữ liệu nhanh (Excel/Paste)</h3>
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
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl flex items-center gap-2"><FileSpreadsheet/> Chọn file Excel</button>
                    <button onClick={() => setPasteModalOpen(true)} className="bg-white border-2 text-slate-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-2"><ClipboardPaste/> Dán từ Clipboard</button>
                </div>
           </div>
       )}
    </div>
  );
};

export default KPI;
