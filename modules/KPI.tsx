
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Unit, KPI_KEYS, KPIKey, Role, KPIRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';
import { Database, RefreshCw, Settings as SettingsIcon, Users, CheckCircle, PieChart as PieChartIcon, AlertOctagon, Download, Filter, Zap, Loader2, Table, Import } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/firebaseClient';

interface KPIProps {
  users: User[];
  units: Unit[];
  currentUser: User;
  mode: 'personal' | 'group';
}

const KPI: React.FC<KPIProps> = ({ users, units, currentUser, mode }) => {
  const [activeTab, setActiveTab] = useState<'eval' | 'config'>('eval'); 
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterKey, setFilterKey] = useState<KPIKey>('fiber');
  const [kpiRecords, setKpiRecords] = useState<KPIRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  const [dsConfig, setDsConfig] = useState<any>(() => {
    const saved = localStorage.getItem(`ds_config_v4_${mode}`);
    return saved ? JSON.parse(saved) : { url: "", mapping: {}, autoSync: false };
  });

  const isAdmin = currentUser.username === 'admin';

  const fetchKpis = useCallback(async () => {
    try {
      const all = await dbClient.getAll('kpis');
      const filtered = (all as KPIRecord[]).filter(r => r.period === selectedMonth && r.type === mode);
      setKpiRecords(filtered);
    } catch (e) { console.error(e); }
  }, [selectedMonth, mode]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const handleReadData = async () => {
    if (!dsConfig.url) return alert("Vui lòng nhập URL Google Sheet CSV!");
    setIsReading(true);
    setAvailableColumns([]);
    try {
      let finalUrl = dsConfig.url.trim();
      if (finalUrl.includes('/edit')) {
        finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
        setDsConfig(prev => ({ ...prev, url: finalUrl }));
      }

      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error("Không thể tải file. Hãy chắc chắn link đã được Share Public.");
      
      const csv = await res.text();
      const wb = XLSX.read(csv, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws);
      
      if (raw.length > 0) {
        setAvailableColumns(Object.keys(raw[0]));
        setRawRows(raw);
        alert(`Đã đọc xong cấu hình cột. Vui lòng thực hiện Mapping ở Bước 2 bên dưới.`);
      } else {
        alert("File trống hoặc không có tiêu đề cột!");
      }
    } catch (e: any) { 
      alert("Lỗi: " + e.message);
    }
    finally { setIsReading(false); }
  };

  const handleSync = async () => {
    if (!dsConfig.mapping.id) return alert("Vui lòng thiết lập cột Định danh trong Mapping!");
    
    let rowsToProcess = rawRows;
    if (rowsToProcess.length === 0) {
      setIsSyncing(true);
      try {
        const res = await fetch(dsConfig.url);
        const csv = await res.text();
        const wb = XLSX.read(csv, { type: 'string' });
        rowsToProcess = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } catch (e) { 
        setIsSyncing(false);
        return alert("Không thể tải dữ liệu để import. Hãy thử 'Đọc dữ liệu' trước.");
      }
    }

    setIsSyncing(true);
    try {
      let count = 0;
      for (const row of rowsToProcess) {
        const entityId = String(row[dsConfig.mapping.id] || '').trim();
        if (!entityId) continue;
        
        const targets: any = {};
        Object.keys(KPI_KEYS).forEach(k => {
          targets[k] = {
            target: Number(row[dsConfig.mapping[`${k}_t`]] || 0),
            actual: Number(row[dsConfig.mapping[`${k}_a`]] || 0)
          };
        });

        const docId = `${mode}_${selectedMonth}_${entityId}`;
        await dbClient.upsert('kpis', docId, {
          period: selectedMonth,
          entityId,
          type: mode,
          targets
        });
        count++;
      }
      fetchKpis();
      alert(`Đã import thành công ${count} dòng KPI.`);
    } catch (e) { 
      alert("Lỗi khi import vào Database Cloud.");
    }
    finally { setIsSyncing(false); }
  };

  const chartData = useMemo(() => {
    return kpiRecords.map(r => {
      const t = r.targets[filterKey] || { target: 0, actual: 0 };
      const name = mode === 'personal' ? (users.find(u => u.hrmCode === r.entityId)?.fullName || r.entityId) : (units.find(u => u.code === r.entityId)?.name || r.entityId);
      const pct = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return { name, percent: Math.round(pct), actual: t.actual, target: t.target };
    }).sort((a,b) => b.percent - a.percent);
  }, [kpiRecords, filterKey, mode, users, units]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            {mode === 'group' ? <PieChartIcon className="text-blue-600" size={32}/> : <Users className="text-blue-600" size={32}/>}
            KPI {mode === 'group' ? 'TẬP THỂ' : 'CÁ NHÂN'}
          </h2>
          <div className="flex items-center gap-4 mt-3">
            <input type="month" className="border-2 rounded-2xl px-5 py-2 font-black text-sm bg-slate-50 outline-none" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-[20px] border">
          <button onClick={() => setActiveTab('eval')} className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>KẾT QUẢ</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('config')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`} title="Cấu hình Cloud Sync"><SettingsIcon size={18}/></button>
          )}
        </div>
      </div>

      {activeTab === 'eval' ? (
        <div className="space-y-8">
           <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-xs uppercase flex items-center gap-4">
                 BÁO CÁO THÁNG {selectedMonth}
                 <select className="border-2 rounded-xl px-4 py-1.5 text-[10px] font-black text-blue-600 bg-white" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                  {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </h3>
              <button onClick={fetchKpis} className="text-blue-600"><RefreshCw size={20}/></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase border-b">
                  <tr>
                    <th className="p-5">Đối tượng</th>
                    <th className="p-5 text-right">Kế hoạch</th>
                    <th className="p-5 text-right">Thực hiện</th>
                    <th className="p-5 text-center">Tỷ lệ (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold">
                  {chartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30">
                      <td className="p-5 text-slate-700 font-black">{item.name}</td>
                      <td className="p-5 text-right font-mono">{item.target.toLocaleString()}</td>
                      <td className="p-5 text-right font-mono text-blue-600">{item.actual.toLocaleString()}</td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.percent >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {item.percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[48px] shadow-sm border p-12 max-w-4xl mx-auto space-y-8 animate-zoom-in">
          <div className="flex items-center gap-6 border-b pb-8">
            <div className="bg-blue-600 p-5 rounded-[32px] text-white shadow-2xl"><Database size={40}/></div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Cấu hình Import Cloud</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Google Sheet Automation (Mode: {mode === 'group' ? 'Tập thể' : 'Cá nhân'})</p>
            </div>
          </div>
          
          <div className="space-y-10">
            {/* BƯỚC 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">1</div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-widest">Link Google Sheet CSV (Public)</label>
              </div>
              <div className="flex gap-4">
                <input 
                  className="flex-1 border-2 p-5 rounded-[24px] bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv" 
                  value={dsConfig.url} 
                  onChange={e => setDsConfig({...dsConfig, url: e.target.value})} 
                />
                <button 
                  onClick={handleReadData} 
                  disabled={isReading || !dsConfig.url} 
                  className="bg-slate-800 text-white px-8 py-4 rounded-[20px] font-black text-xs uppercase hover:bg-black flex items-center gap-3 transition-all"
                >
                  {isReading ? <Loader2 className="animate-spin" size={18}/> : <Table size={18}/>} ĐỌC DỮ LIỆU
                </button>
              </div>
            </div>
            
            {/* BƯỚC 2: CHỈ HIỆN KHI ĐÃ ĐỌC XONG CỘT */}
            {availableColumns.length > 0 && (
              <div className="bg-blue-50 p-10 rounded-[40px] border-2 border-blue-100 space-y-8 animate-fade-in">
                <div className="flex items-center justify-between border-b border-blue-200 pb-4">
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-3"><Filter size={18}/> 2. Ánh xạ trường dữ liệu (Mapping)</h4>
                  <span className="text-[10px] font-black text-blue-600 bg-white px-4 py-1 rounded-full border">Đã đọc {availableColumns.length} cột</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase">Cột Định danh ({mode === 'personal' ? 'Mã HRM' : 'Mã Đơn vị'})</label>
                    <select 
                      className="w-full border-2 p-4 rounded-2xl font-bold text-sm bg-white outline-none" 
                      value={dsConfig.mapping.id || ""} 
                      onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, id: e.target.value}})}
                    >
                      <option value="">-- Chọn cột định danh --</option>
                      {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  
                  {Object.keys(KPI_KEYS).map(k => (
                    <React.Fragment key={k}>
                      <div className="space-y-2 bg-white/60 p-4 rounded-3xl border border-blue-50">
                        <label className="text-[9px] font-black text-blue-600 uppercase mb-2 block truncate">{KPI_KEYS[k as KPIKey]} (Kế hoạch)</label>
                        <select 
                          className="w-full border-2 p-3 rounded-xl font-bold text-xs bg-white outline-none" 
                          value={dsConfig.mapping[`${k}_t`] || ""} 
                          onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [`${k}_t`]: e.target.value}})}
                        >
                          <option value="">-- Cột kế hoạch --</option>
                          {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2 bg-white/60 p-4 rounded-3xl border border-green-50">
                        <label className="text-[9px] font-black text-green-700 uppercase mb-2 block truncate">{KPI_KEYS[k as KPIKey]} (Thực hiện)</label>
                        <select 
                          className="w-full border-2 p-3 rounded-xl font-bold text-xs bg-white outline-none" 
                          value={dsConfig.mapping[`${k}_a`] || ""} 
                          onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [`${k}_a`]: e.target.value}})}
                        >
                          <option value="">-- Cột thực hiện --</option>
                          {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* BƯỚC 3 */}
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center gap-4 p-8 bg-slate-50 rounded-[32px] border-2">
                <input type="checkbox" id="auto" className="w-6 h-6 rounded-lg" checked={dsConfig.autoSync} onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} />
                <label htmlFor="auto" className="text-sm font-black text-slate-700 cursor-pointer">Tự động đồng bộ mỗi 10 phút (Yêu cầu phải Lưu cấu hình bên dưới)</label>
              </div>
              <div className="flex justify-end gap-5">
                <button 
                  onClick={() => { localStorage.setItem(`ds_config_v4_${mode}`, JSON.stringify(dsConfig)); alert("Đã lưu cấu hình."); }} 
                  className="px-8 py-4 font-black text-slate-400 hover:text-slate-800 uppercase text-xs"
                >
                  Lưu cấu hình Mapping
                </button>
                <button 
                  onClick={handleSync} 
                  disabled={isSyncing || !dsConfig.mapping.id} 
                  className="bg-blue-600 text-white px-12 py-5 rounded-[24px] font-black text-xs uppercase shadow-2xl hover:bg-blue-700 flex items-center gap-3 transition-all"
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Import size={18}/>} BẮT ĐẦU IMPORT CLOUD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPI;
