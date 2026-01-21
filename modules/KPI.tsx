
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Unit, KPI_KEYS, KPIKey, Role, KPIRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';
import { Database, RefreshCw, Settings as SettingsIcon, Users, CheckCircle, PieChart as PieChartIcon, AlertOctagon, Download, Filter, Zap, Loader2, Table, ChevronRight, Import } from 'lucide-react';
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
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterKey, setFilterKey] = useState<KPIKey>('fiber');
  const [kpiRecords, setKpiRecords] = useState<KPIRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Config riêng biệt cho mode hiện tại (lưu vào localStorage với key mode)
  const [dsConfig, setDsConfig] = useState<any>(() => {
    const saved = localStorage.getItem(`ds_config_v3_${mode}`);
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

  // Tự động đồng bộ mỗi 10 phút (nếu bật)
  useEffect(() => {
    let timer: any;
    if (dsConfig.autoSync && dsConfig.url && dsConfig.mapping.id) {
      timer = setInterval(() => handleSync(true), 600000);
    }
    return () => clearInterval(timer);
  }, [dsConfig, selectedMonth]);

  const handleReadData = async () => {
    if (!dsConfig.url) return alert("Vui lòng nhập URL Google Sheet CSV!");
    setIsReading(true);
    setAvailableColumns([]);
    try {
      const res = await fetch(dsConfig.url);
      const csv = await res.text();
      const wb = XLSX.read(csv, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws);
      if (raw.length > 0) {
        setAvailableColumns(Object.keys(raw[0]));
        setRawRows(raw);
        alert(`Đã đọc ${raw.length} dòng dữ liệu. Vui lòng kiểm tra Mapping bên dưới.`);
      } else {
        alert("File không có dữ liệu hoặc không đúng định dạng!");
      }
    } catch (e) { 
      console.error("Read error:", e); 
      alert("Lỗi khi đọc file. Kiểm tra xem link đã được chia sẻ Public và có đúng định dạng CSV chưa (đuôi /export?format=csv).");
    }
    finally { setIsReading(false); }
  };

  const handleSync = async (isAuto = false) => {
    let rowsToProcess = rawRows;
    if (isAuto || rowsToProcess.length === 0) {
      if (!dsConfig.url) return;
      setIsSyncing(true);
      try {
        const res = await fetch(dsConfig.url);
        const csv = await res.text();
        const wb = XLSX.read(csv, { type: 'string' });
        rowsToProcess = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } catch (e) { 
        console.error("Sync error:", e); 
        setIsSyncing(false);
        return;
      }
    }

    if (!dsConfig.mapping.id) {
      if (!isAuto) alert("Chưa thiết lập cột Định danh trong phần Mapping!");
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);
    try {
      for (const row of rowsToProcess) {
        const entityId = String(row[dsConfig.mapping.id] || '');
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
      }
      fetchKpis();
      if (!isAuto) alert("Đồng bộ dữ liệu thành công!");
    } catch (e) { 
      console.error("Final sync error:", e); 
      if (!isAuto) alert("Lỗi khi ghi dữ liệu.");
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
            <input type="month" className="border-2 rounded-2xl px-5 py-2 font-black text-sm bg-slate-50 outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            {isSyncing && <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase animate-pulse"><Zap size={14}/> Cloud Syncing...</div>}
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-[20px] border">
          <button onClick={() => setActiveTab('eval')} className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Đánh giá kết quả</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('config')} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><SettingsIcon size={18}/></button>
          )}
        </div>
      </div>

      {activeTab === 'eval' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><CheckCircle size={18} className="text-green-500"/> Top 5 Xuất sắc nhất</h3>
                <select className="border-2 rounded-xl px-4 py-1.5 text-[10px] font-black text-blue-600 bg-white" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                  {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'black', fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="percent" barSize={18} radius={[0, 10, 10, 0]}>
                    {chartData.slice(0, 5).map((e, i) => <Cell key={i} fill={e.percent >= 100 ? '#22c55e' : '#3b82f6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2"><AlertOctagon size={18} className="text-red-500"/> Top 5 Cần cố gắng</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[...chartData].sort((a,b)=>a.percent-b.percent).slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'black', fill: '#64748b'}} />
                  <Tooltip cursor={{fill: '#fff1f2'}} />
                  <Bar dataKey="percent" fill="#ef4444" barSize={18} radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Báo cáo chi tiết: {KPI_KEYS[filterKey]}</h3>
              <button onClick={fetchKpis} className="text-blue-600 hover:rotate-180 transition-all duration-700"><RefreshCw size={20}/></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="p-5">Đối tượng</th>
                    <th className="p-5 text-right">Kế hoạch giao</th>
                    <th className="p-5 text-right">Kết quả thực hiện</th>
                    <th className="p-5 text-center">Tỷ lệ (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold">
                  {chartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-5 text-slate-700 font-black">{item.name}</td>
                      <td className="p-5 text-right font-mono text-slate-400">{item.target.toLocaleString('vi-VN')}</td>
                      <td className="p-5 text-right font-mono text-blue-600">{item.actual.toLocaleString('vi-VN')}</td>
                      <td className="p-5 text-center">
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black inline-block min-w-[70px] ${item.percent >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {item.percent}%
                        </div>
                      </td>
                    </tr>
                  ))}
                  {chartData.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black italic">Dữ liệu tháng này chưa được cập nhật.</td></tr>}
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
              <h3 className="text-2xl font-black text-slate-800">Cấu hình Import Cloud (Mode: {mode === 'group' ? 'Tập thể' : 'Cá nhân'})</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Google Sheet Automation Engine</p>
            </div>
          </div>
          
          <div className="space-y-8">
            {/* Bước 1: Nhập link và Đọc dữ liệu */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">1</div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đường dẫn Google Sheet (Public CSV)</label>
              </div>
              <div className="flex gap-4">
                <input 
                  className="flex-1 border-2 p-5 rounded-[24px] bg-slate-50 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv" 
                  value={dsConfig.url} 
                  onChange={e => setDsConfig({...dsConfig, url: e.target.value})} 
                />
                <button 
                  onClick={handleReadData} 
                  disabled={isReading || !dsConfig.url} 
                  className="bg-slate-800 text-white px-8 py-4 rounded-[20px] font-black text-xs uppercase shadow-xl hover:bg-black flex items-center gap-3 disabled:opacity-50"
                >
                  {isReading ? <Loader2 className="animate-spin" size={18}/> : <Table size={18}/>} Đọc dữ liệu
                </button>
              </div>
            </div>
            
            {/* Bước 2: Thiết lập Mapping */}
            {availableColumns.length > 0 && (
              <div className="bg-blue-50 p-8 rounded-[36px] border-2 border-blue-100 space-y-6 animate-fade-in shadow-inner">
                <div className="flex items-center justify-between border-b border-blue-200 pb-4">
                  <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2"><Filter size={16}/> 2. Ánh xạ dữ liệu (Mapping)</h4>
                  <span className="text-[9px] font-bold text-blue-500 bg-white px-3 py-1 rounded-full border border-blue-200">Tìm thấy {availableColumns.length} cột</span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black text-blue-400 uppercase">Cột Định danh ({mode === 'personal' ? 'Mã HRM' : 'Mã Đơn vị'})</label>
                    <select 
                      className="w-full border-2 p-3 rounded-xl font-bold text-xs bg-white outline-none focus:border-blue-500" 
                      value={dsConfig.mapping.id || ""} 
                      onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, id: e.target.value}})}
                    >
                      <option value="">-- Chọn cột định danh --</option>
                      {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  
                  {Object.keys(KPI_KEYS).map(k => (
                    <React.Fragment key={k}>
                      <div className="space-y-1.5 border-l-4 border-blue-300 pl-4 bg-white/50 p-3 rounded-r-xl">
                        <label className="text-[9px] font-black text-blue-600 uppercase mb-1 block truncate" title={KPI_KEYS[k as KPIKey]}>{KPI_KEYS[k as KPIKey]} (Kế hoạch)</label>
                        <select 
                          className="w-full border-2 p-2.5 rounded-xl font-bold text-[11px] bg-white outline-none" 
                          value={dsConfig.mapping[`${k}_t`] || ""} 
                          onChange={e => setDsConfig({...dsConfig, mapping: {...dsConfig.mapping, [`${k}_t`]: e.target.value}})}
                        >
                          <option value="">-- Cột kế hoạch --</option>
                          {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5 border-l-4 border-green-300 pl-4 bg-white/50 p-3 rounded-r-xl">
                        <label className="text-[9px] font-black text-green-700 uppercase mb-1 block truncate" title={KPI_KEYS[k as KPIKey]}>{KPI_KEYS[k as KPIKey]} (Thực hiện)</label>
                        <select 
                          className="w-full border-2 p-2.5 rounded-xl font-bold text-[11px] bg-white outline-none" 
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

            {/* Bước 3: Lưu và Thực thi */}
            <div className="flex flex-col gap-6 pt-4">
              <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[24px] border-2 border-slate-200">
                <input type="checkbox" id="autoSyncCheck" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" checked={dsConfig.autoSync} onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} />
                <label htmlFor="autoSyncCheck" className="text-sm font-black text-slate-700 cursor-pointer">Kích hoạt đồng bộ tự động 10 phút/lần (Yêu cầu lưu cấu hình Mapping)</label>
              </div>
              
              <div className="flex justify-end gap-5">
                <button 
                  onClick={() => { 
                    localStorage.setItem(`ds_config_v3_${mode}`, JSON.stringify(dsConfig)); 
                    alert(`Đã lưu cấu hình mapping cho KPI ${mode === 'group' ? 'Tập thể' : 'Cá nhân'}.`); 
                  }} 
                  className="px-8 py-4 font-black text-slate-400 hover:text-slate-800 transition-colors uppercase text-xs"
                >
                  Lưu cấu hình Mapping
                </button>
                <button 
                  onClick={() => handleSync(false)} 
                  disabled={isSyncing || !dsConfig.mapping.id} 
                  className="bg-blue-600 text-white px-12 py-4 rounded-[24px] font-black text-xs uppercase shadow-2xl shadow-blue-100 hover:bg-blue-700 flex items-center gap-3 transition-all disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={18}/> : <Import size={18}/>} Bắt đầu Import vào Firebase
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
