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
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [kpiData, setKpiData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dsConfig, setDsConfig] = useState<DataSourceConfig>({ url: '', lastSync: '', autoSync: true, mapping: {} });
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
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k.toUpperCase()}_TARGET`, label: `[${k.toUpperCase()}] Chỉ tiêu`, required: false })),
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k.toUpperCase()}_ACTUAL`, label: `[${k.toUpperCase()}] Thực hiện`, required: false })),
  ];

  // --- TẢI DỮ LIỆU TỪ DATABASE ---
  const fetchKpisFromDb = useCallback(async () => {
    setIsLoading(true);
    try {
        const { data, error } = await supabase.from('kpis').select('*').eq('type', mode);
        if (error) throw error;

        const formatted = (data || []).map(item => {
            if (mode === 'personal') {
                const user = users.find(u => u.hrmCode === item.entity_id);
                return {
                    hrmCode: item.entity_id,
                    fullName: user?.fullName || 'N/A',
                    unitId: user?.unitId || '',
                    targets: item.targets
                };
            } else {
                const unit = units.find(u => u.code === item.entity_id);
                return {
                    unitCode: item.entity_id,
                    unitName: unit?.name || 'N/A',
                    targets: item.targets
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
    if (savedConfig) setDsConfig(JSON.parse(savedConfig));
  }, [mode, fetchKpisFromDb, CONFIG_STORAGE_KEY]);

  // --- LƯU DỮ LIỆU VÀO DATABASE ---
  const saveKpiToDb = async (processedData: any[]) => {
      setIsLoading(true);
      try {
          const payload = processedData.map(item => ({
              entity_id: mode === 'personal' ? item.hrmCode : item.unitCode,
              type: mode,
              targets: item.targets,
              updated_at: new Date().toISOString()
          }));

          const { error } = await supabase.from('kpis').upsert(payload, { onConflict: 'entity_id, type' });
          if (error) throw error;
          
          await fetchKpisFromDb();
      } catch (e) {
          alert("Lỗi khi lưu vào Database: " + (e as any).message);
      } finally {
          setIsLoading(false);
      }
  };

  // --- AGGREGATION LOGIC (TỔNG HỢP CHO ĐƠN VỊ CHA) ---
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
          Object.keys(KPI_KEYS).forEach(key => totals[key] = { target: 0, actual: 0 });

          currentData.forEach(record => {
              if (descendantCodes.includes(record.unitCode)) {
                  Object.keys(KPI_KEYS).forEach(key => {
                      const t = record.targets[key] || { target: 0, actual: 0 };
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

  // --- GOOGLE SHEET SYNC LOGIC ---
  const handleSyncData = useCallback(async (isManual = false) => {
      if (!dsConfig.url) { if (isManual) alert("Chưa cấu hình URL."); return; }
      setIsSyncing(true);
      try {
          const response = await fetch(dsConfig.url);
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawData: any[] = XLSX.utils.sheet_to_json(ws);

          if (Object.keys(dsConfig.mapping).length === 0) { if (isManual) alert("Chưa mapping."); return; }

          const transformedData = rawData.map(row => {
              const newRow: any = {};
              Object.entries(dsConfig.mapping).forEach(([sysKey, sheetHeader]) => {
                  if (sheetHeader && row[sheetHeader] !== undefined) {
                      newRow[sysKey] = row[sheetHeader];
                  }
              });
              return newRow;
          });

          await processImportData(transformedData, false);
          setDsConfig(prev => {
              const newC = { ...prev, lastSync: new Date().toLocaleString() };
              localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newC));
              return newC;
          });
          if (isManual) alert("Đồng bộ thành công!");
      } catch (e) { alert("Lỗi đồng bộ: " + (e as any).message); } finally { setIsSyncing(false); }
  }, [dsConfig, CONFIG_STORAGE_KEY]);

  useEffect(() => {
      if (!dsConfig.url || !dsConfig.autoSync) return;
      const intervalId = setInterval(() => handleSyncData(false), 600000); 
      return () => clearInterval(intervalId);
  }, [dsConfig.url, dsConfig.autoSync, handleSyncData]);

  const checkConnection = async () => {
      if (!dsConfig.url) return alert("Nhập URL CSV");
      setIsCheckingLink(true);
      try {
          const response = await fetch(dsConfig.url);
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (data.length > 0) {
              setSheetHeaders(Object.keys(data[0]));
              alert("Kết nối thành công!");
          }
      } catch (e) { alert("Không thể đọc file. Hãy đảm bảo link đã 'Publish to web' dạng CSV."); } finally { setIsCheckingLink(false); }
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

          const targets: any = targetIndex >= 0 ? { ...newList[targetIndex].targets } : {};
          // Explicitly cast Object.keys(KPI_KEYS) to KPIKey[] to resolve "Type 'unknown' cannot be used as an index type" error.
          (Object.keys(KPI_KEYS) as KPIKey[]).forEach(key => {
              const tKey = `${key.toUpperCase()}_TARGET`;
              const aKey = `${key.toUpperCase()}_ACTUAL`;
              // Đảm bảo ép kiểu số chính xác, lọc bỏ ký tự lạ
              if (row[tKey] !== undefined) targets[key] = { ...targets[key], target: Number(String(row[tKey]).replace(/[^0-9.-]+/g,"")) || 0 };
              if (row[aKey] !== undefined) targets[key] = { ...targets[key], actual: Number(String(row[aKey]).replace(/[^0-9.-]+/g,"")) || 0 };
          });

          const record = mode === 'personal' ? 
            { hrmCode: idValue, fullName: entityName, unitId: entityUnitId, targets } : 
            { unitCode: idValue, unitName: entityName, targets };

          if (targetIndex >= 0) newList[targetIndex] = record;
          else newList.push(record);
      });

      const aggregated = calculateAggregations(newList);
      await saveKpiToDb(aggregated);
      if (showAlert) alert("Dữ liệu đã được cập nhật vào Database!");
  };

  // --- XỬ LÝ UI ---
  const filteredData = kpiData.filter(item => {
      if (mode === 'group') return true;
      if (filterUnit !== 'all') {
          const unit = units.find(u => u.id === item.unitId);
          if (item.unitId !== filterUnit && unit?.parentId !== filterUnit) return false;
      }
      return true;
  });

  // TÍNH TOÁN SUB-TOTAL
  const subTotal = filteredData.reduce((acc, curr) => {
      const t = curr.targets?.[filterKey] || { target: 0, actual: 0 };
      acc.target += Number(t.target || 0);
      acc.actual += Number(t.actual || 0);
      return acc;
  }, { target: 0, actual: 0 });
  const subTotalPercent = subTotal.target > 0 ? (subTotal.actual / subTotal.target) * 100 : 0;

  const chartData = filteredData.map(item => {
      const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
      const percent = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return { name: mode === 'personal' ? item.fullName : item.unitName, percent: Math.round(percent) };
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
            <p className="text-sm text-slate-500">Dữ liệu được đồng bộ trực tuyến và lưu trữ bảo mật trên máy chủ.</p>
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

       {/* EVALUATION TAB */}
       {activeTab === 'eval' && (
         <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold"><Filter size={16} /> Lọc:</div>
                    {mode === 'personal' && (
                        <select className="border rounded-lg px-3 py-1.5 text-sm outline-none" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                            <option value="all">-- Tất cả đơn vị --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}
                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="text-xs text-slate-500 italic">Cập nhật lần cuối: {dsConfig.lastSync || 'Chưa rõ'}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-64">
                 <h3 className="font-bold text-sm mb-4 text-green-700">Top Xuất sắc</h3>
                 <ResponsiveContainer width="100%" height="80%">
                   <BarChart data={top5} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} /><Tooltip /><Bar dataKey="percent" fill="#22c55e" barSize={15} radius={[0,4,4,0]} /></BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-64">
                 <h3 className="font-bold text-sm mb-4 text-red-600">Thấp nhất</h3>
                 <ResponsiveContainer width="100%" height="80%">
                   <BarChart data={bottom5} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} /><Tooltip /><Bar dataKey="percent" fill="#ef4444" barSize={15} radius={[0,4,4,0]} /></BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <div className="p-4 border-b bg-slate-50 font-bold text-slate-800">Chi tiết số liệu: {KPI_KEYS[filterKey]}</div>
               <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                     <tr>
                       <th className="p-3 bg-slate-100">{mode === 'personal' ? 'Nhân viên' : 'Đơn vị'}</th>
                       <th className="p-3 bg-slate-100 text-right">Kế hoạch</th>
                       <th className="p-3 bg-slate-100 text-right">Thực hiện</th>
                       <th className="p-3 bg-slate-100 text-center">% Hoàn thành</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {filteredData.map((item, idx) => {
                         const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
                         const pct = t.target > 0 ? (t.actual / t.target) * 100 : 0;
                         return (
                           <tr key={idx} className="hover:bg-slate-50">
                             <td className="p-3 font-medium">{mode === 'personal' ? item.fullName : item.unitName}</td>
                             <td className="p-3 text-right font-mono">{t.target.toLocaleString()}</td>
                             <td className="p-3 text-right font-mono font-bold text-blue-700">{t.actual.toLocaleString()}</td>
                             <td className="p-3 text-center">
                                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${pct >= 100 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {pct.toFixed(1)}%
                                 </span>
                             </td>
                           </tr>
                         )
                     })}
                   </tbody>
                   <tfoot className="bg-blue-50 font-bold text-blue-900 border-t-2 border-blue-200 sticky bottom-0">
                       <tr>
                           <td className="p-3 uppercase">Tổng cộng (Subtotal)</td>
                           <td className="p-3 text-right font-mono">{subTotal.target.toLocaleString()}</td>
                           <td className="p-3 text-right font-mono">{subTotal.actual.toLocaleString()}</td>
                           <td className="p-3 text-center">
                               <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                                   {subTotalPercent.toFixed(1)}%
                               </span>
                           </td>
                       </tr>
                   </tfoot>
                 </table>
               </div>
            </div>
         </div>
       )}

       {/* CONFIG TAB */}
       {activeTab === 'config' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border overflow-hidden p-6 space-y-6">
               <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Database className="text-blue-600"/> Liên kết Google Sheet</h3>
               <div className="flex gap-2">
                   <input type="text" className="flex-1 border rounded-lg p-2.5" placeholder="URL CSV (Publish to web)..." value={dsConfig.url} onChange={e => setDsConfig({...dsConfig, url: e.target.value})} />
                   <button onClick={checkConnection} className="bg-slate-800 text-white px-4 rounded-lg font-bold flex items-center gap-2">
                       {isCheckingLink ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>} Đọc tiêu đề
                   </button>
               </div>
               
               {sheetHeaders.length > 0 && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                       {systemFields.map(f => (
                           <div key={f.key} className="flex items-center gap-4 bg-slate-50 p-2 rounded border">
                               <div className="w-1/2 text-sm font-bold">{f.label}</div>
                               <select className="flex-1 border rounded p-1.5 text-xs bg-white" value={dsConfig.mapping[f.key] || ''} onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [f.key]: e.target.value}})}>
                                   <option value="">-- Chọn cột --</option>
                                   {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                               </select>
                           </div>
                       ))}
                   </div>
               )}
               
               <div className="flex items-center gap-4 border-t pt-4">
                   <button onClick={() => { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(dsConfig)); alert("Đã lưu cấu hình."); }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                       <Save size={18}/> Lưu cấu hình
                   </button>
                   <button onClick={() => handleSyncData(true)} disabled={isSyncing} className="bg-white border border-blue-600 text-blue-600 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                       {isSyncing ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Đồng bộ Database
                   </button>
               </div>
           </div>
       )}

       {/* MANAGE & PLAN Tabs (Giữ nguyên cấu trúc nhưng dùng saveKpiToDb) */}
       {activeTab === 'plan' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                    <FileUp size={48} className="mx-auto text-blue-600 mb-4" />
                    <h3 className="text-xl font-bold mb-6">Nhập dữ liệu nhanh</h3>
                    <div className="flex flex-col gap-3">
                        <input type="file" ref={fileInputRef} onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                                processImportData(data);
                            };
                            reader.readAsBinaryString(file);
                        }} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><FileSpreadsheet size={20}/> Chọn Excel</button>
                        <button onClick={() => setPasteModalOpen(true)} className="bg-white border-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><ClipboardPaste size={20}/> Paste từ Sheet</button>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold mb-4 flex items-center gap-2"><AlertOctagon size={20} className="text-orange-500"/> Quy tắc nhập liệu</h4>
                    <ul className="text-sm space-y-2 text-slate-600 list-disc pl-5">
                        <li>Bắt buộc cột: <b>{ID_KEY}</b></li>
                        <li>Chỉ tiêu: <b>TENCHI_TARGET</b> (VD: FIBER_TARGET)</li>
                        <li>Thực hiện: <b>TENCHI_ACTUAL</b> (VD: FIBER_ACTUAL)</li>
                        <li>Hệ thống tự động cộng dồn cho đơn vị cha.</li>
                        <li>Dữ liệu sẽ được lưu trực tiếp vào Supabase Database.</li>
                    </ul>
                </div>
           </div>
       )}

       {activeTab === 'manage' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
               <div className="p-4 border-b bg-slate-50 font-bold">Quản lý bản ghi ({kpiData.length})</div>
               <table className="w-full text-sm">
                   <thead className="bg-slate-100 font-bold">
                       <tr><th className="p-3">ID</th><th className="p-3">Đối tượng</th><th className="p-3 text-right">Thao tác</th></tr>
                   </thead>
                   <tbody>
                       {kpiData.map((item, i) => (
                           <tr key={i} className="border-b">
                               <td className="p-3 font-mono">{mode === 'personal' ? item.hrmCode : item.unitCode}</td>
                               <td className="p-3">{mode === 'personal' ? item.fullName : item.unitName}</td>
                               <td className="p-3 text-right">
                                   <button onClick={async () => {
                                       if (!confirm("Xóa bản ghi này khỏi Database?")) return;
                                       const id = mode === 'personal' ? item.hrmCode : item.unitCode;
                                       const { error } = await supabase.from('kpis').delete().eq('entity_id', id).eq('type', mode);
                                       if (!error) fetchKpisFromDb();
                                   }} className="text-red-500 p-1"><Trash2 size={16}/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
       )}

       {/* PASTE MODAL */}
       {pasteModalOpen && (
           <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-xl rounded-xl p-6">
                   <h3 className="font-bold text-lg mb-4">Paste dữ liệu</h3>
                   <textarea className="w-full h-64 border rounded p-3 font-mono text-xs bg-slate-50" placeholder="Copy từ Excel/Google Sheet..." value={pasteContent} onChange={e => setPasteContent(e.target.value)}></textarea>
                   <div className="flex justify-end gap-2 mt-4">
                       <button onClick={() => setPasteModalOpen(false)} className="px-4 py-2">Hủy</button>
                       <button onClick={() => {
                           const rows = pasteContent.trim().split('\n');
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
                       }} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Cập nhật Database</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KPI;