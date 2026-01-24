
import React, { useState, useMemo, useEffect } from 'react';
import { User, Unit, KPIRecord, KPIDefinition } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Smartphone, Settings, Loader2, Table, Filter, Import, Save, Database, Plus, X, Edit3, Trash2, Target, Users, UserCheck, RefreshCw } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';
import * as XLSX from 'xlsx';

interface MobileOpsProps {
  kpis: KPIRecord[]; mobileData: any[]; units: Unit[]; users: User[]; currentUser: User; kpiDefinitions: KPIDefinition[]; onRefresh: () => void;
}

const DATA_CONFIG_STRUCTURE = {
  'Di động hiện hữu': [
    { key: 'autocall_group', title: 'AutoCall (Tập thể)' },
    { key: 'autocall_personal', title: 'AutoCall (Cá nhân)' }
  ],
  'Kênh nội bộ': [
    { key: 'internal_group', title: 'Kênh nội bộ (Tập thể)' },
    { key: 'internal_personal', title: 'Kênh nội bộ (Cá nhân)' }
  ],
  'Kênh ngoài': [
    { key: 'external_group', title: 'Kênh ngoài (Tập thể)' },
    { key: 'external_personal', title: 'Kênh ngoài (Cá nhân)' }
  ]
};

const MobileOps: React.FC<MobileOpsProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'ptm' | 'existing' | 'internal' | 'external' | 'config'>('ptm');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [mobileKpiDefs, setMobileKpiDefs] = useState<KPIDefinition[]>([]);
  const [autocallTargets, setAutocallTargets] = useState({ ckn: 0, ckd: 0, package: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const isAdmin = props.currentUser.username === 'admin';

  const fetchData = async () => {
    const [defs, targets] = await Promise.all([dbClient.getAll('mobile_kpi_definitions'), dbClient.getById('mobile_targets', selectedMonth)]);
    setMobileKpiDefs(defs as KPIDefinition[]);
    setAutocallTargets(targets?.autocall || { ckn: 0, ckd: 0, package: 0 });
  };
  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleSyncMobileData = async () => {
    const month = prompt("Nhập tháng cần đồng bộ (YYYY-MM):", selectedMonth);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        if (month) alert("Định dạng tháng không hợp lệ!");
        return;
    }
    setIsSyncing(true);
    try {
        const allDataKeys = Object.values(DATA_CONFIG_STRUCTURE).flat().map(c => c.key);
        let totalSynced = 0;
        for (const key of allDataKeys) {
            const config = await dbClient.getById('mobile_data_configs', `${key}_${month}`);
            if (!config?.url) continue;
            let finalUrl = config.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl); if (!res.ok) continue;
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (rows.length > 0) {
                await dbClient.upsert('mobile_imported_data', `${key}_${month}`, { period: month, dataType: key, data: rows, mapping: config.mapping });
                totalSynced += rows.length;
            }
        }
        alert(`Đồng bộ hoàn tất! Tổng cộng ${totalSynced} dòng dữ liệu cho tháng ${month}.`);
        props.onRefresh();
    } catch (e) { alert("Có lỗi xảy ra trong quá trình đồng bộ."); console.error(e); }
    finally { setIsSyncing(false); }
  };
  
  const renderTabContent = () => {
    switch(activeTab) {
      case 'ptm': return <PtmTab {...props} selectedMonth={selectedMonth} />;
      case 'existing': return <ExistingMobileTab {...props} mobileKpiDefs={mobileKpiDefs} autocallTargets={autocallTargets} selectedMonth={selectedMonth} />;
      case 'internal': return <InternalChannelTab {...props} mobileKpiDefs={mobileKpiDefs} selectedMonth={selectedMonth} />;
      case 'external': return <ExternalChannelTab {...props} mobileKpiDefs={mobileKpiDefs} selectedMonth={selectedMonth} />;
      case 'config': return isAdmin ? <ConfigTab {...props} mobileKpiDefs={mobileKpiDefs} onRefreshData={fetchData} selectedMonth={selectedMonth} /> : null;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div><h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3"><Smartphone className="text-blue-600" size={36}/> QUẢN TRỊ CTHĐ DI ĐỘNG</h2><p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Phân tích & Đánh giá hiệu quả các chương trình</p></div>
        <div className="flex items-center gap-4">
            <input type="month" className="border-2 rounded-2xl px-5 py-2.5 font-black text-sm bg-white outline-none focus:border-blue-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            <button onClick={handleSyncMobileData} disabled={isSyncing} className="bg-blue-50 text-blue-700 p-3 rounded-2xl hover:bg-blue-100 transition-all disabled:opacity-50"><RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''}/></button>
        </div>
      </div>
      <div className="flex border-b overflow-x-auto"><TabButton id="ptm" label="Di động PTM" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="existing" label="Di động hiện hữu" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="internal" label="Kênh nội bộ" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="external" label="Kênh ngoài" activeTab={activeTab} setActiveTab={setActiveTab} />{isAdmin && <TabButton id="config" label="Cấu hình" icon={<Settings size={14} />} activeTab={activeTab} setActiveTab={setActiveTab} />}</div>
      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
};

// TABS
const PtmTab: React.FC<MobileOpsProps & { selectedMonth: string }> = ({ kpis, units, selectedMonth }) => {
  const ptmKpiData = useMemo(() => {
    const records = kpis.filter(r => r.period === selectedMonth && r.type === 'group'); if (records.length === 0) return { ptm: [], rev: [] };
    const process = (kpiId: string) => {
      let totalTarget = 0, totalActual = 0;
      const unitData = units.filter(u => u.includeInMobileReport === true && u.name !== 'Trung tâm CSKH').map(unit => {
        const record = records.find(r => r.entityId === unit.code); const target = record?.targets?.[kpiId]?.target || 0; const actual = record?.targets?.[kpiId]?.actual || 0; totalTarget += target; totalActual += actual;
        return { name: unit.name, target, actual, percent: target > 0 ? Math.round((actual / target) * 100) : 0 };
      });
      return [{ name: 'Tổng VNPT Quảng Ninh', target: totalTarget, actual: totalActual, percent: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0 }, ...unitData];
    };
    return { ptm: process('mobile_ptm'), rev: process('mobile_rev') };
  }, [kpis, units, selectedMonth]);
  return (<div className="grid grid-cols-1 xl:grid-cols-2 gap-12"><StatDisplay title="Sản lượng di động PTM" data={ptmKpiData.ptm} unit="TB" color="#3b82f6" /><StatDisplay title="Doanh thu di động PTM" data={ptmKpiData.rev} unit="VNĐ" color="#8b5cf6" /></div>);
};

const ExistingMobileTab: React.FC<MobileOpsProps & { selectedMonth: string, mobileKpiDefs: KPIDefinition[], autocallTargets: any }> = ({ mobileData, selectedMonth, mobileKpiDefs, autocallTargets }) => {
  const data = useMemo(() => {
      const imported = mobileData.find(d => d.period === selectedMonth && d.dataType === 'autocall_group'); if (!imported?.data || !imported.mapping) return null;
      const actuals = { ckn: 0, ckd: 0, package: 0 };
      const cknDef = mobileKpiDefs.find(d => d.dataSource === 'autocall_group' && d.id.includes('ckn')); const ckdDef = mobileKpiDefs.find(d => d.dataSource === 'autocall_group' && d.id.includes('ckd')); const pkgDef = mobileKpiDefs.find(d => d.dataSource === 'autocall_group' && d.id.includes('package'));
      imported.data.forEach((row: any) => {
          if (cknDef) actuals.ckn += Number(row[imported.mapping[cknDef.id]] || 0);
          if (ckdDef) actuals.ckd += Number(row[imported.mapping[ckdDef.id]] || 0);
          if (pkgDef) actuals.package += Number(row[imported.mapping[pkgDef.id]] || 0);
      });
      return { actuals };
  }, [mobileData, selectedMonth, mobileKpiDefs]);
  if (!data) return <DataPlaceholder message="Không có dữ liệu AutoCall cho tháng này."/>;
  return (<div className="space-y-12"><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Doanh thu gia hạn, bán gói kênh AutoCall</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCardWithProgress title="DT Gia hạn gói CKN" actual={data.actuals.ckn} target={autocallTargets.ckn} unit="VNĐ" color="#3b82f6" /><StatCardWithProgress title="DT Gia hạn gói CKD" actual={data.actuals.ckd} target={autocallTargets.ckd} unit="VNĐ" color="#8b5cf6" /><StatCardWithProgress title="DT Bán gói" actual={data.actuals.package} target={autocallTargets.package} unit="VNĐ" color="#10b981" /><StatCardWithProgress title="Tổng Doanh thu" actual={data.actuals.ckn + data.actuals.ckd + data.actuals.package} target={autocallTargets.ckn + autocallTargets.ckd + autocallTargets.package} unit="VNĐ" color="#ef4444" /></div></div>);
};

const InternalChannelTab: React.FC<MobileOpsProps & { selectedMonth: string, mobileKpiDefs: KPIDefinition[] }> = ({ mobileData, selectedMonth, mobileKpiDefs, users }) => {
    const internalData = useMemo(() => {
        const imported = mobileData.find(d => d.period === selectedMonth && d.dataType === 'internal_personal');
        if (!imported?.data || !imported.mapping) return null;
        const revenueKpi = mobileKpiDefs.find(k => k.dataSource === 'internal_personal' && k.id.includes('revenue'));
        const hrmCodeKpi = mobileKpiDefs.find(k => k.dataSource === 'internal_personal' && k.id.includes('hrm_code'));
        if (!revenueKpi || !hrmCodeKpi) return { tiers: [], details: [] };
        
        const tiers = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
        const details = imported.data.map((row: any) => {
            const revenue = Number(row[imported.mapping[revenueKpi.id]] || 0);
            if (revenue < 5000000) tiers.tier1++; else if (revenue < 10000000) tiers.tier2++; else if (revenue < 15000000) tiers.tier3++; else tiers.tier4++;
            const hrmCode = row[imported.mapping[hrmCodeKpi.id]];
            const user = users.find(u => u.hrmCode === hrmCode);
            return { name: user ? user.fullName : hrmCode, revenue };
        }).sort((a,b) => b.revenue - a.revenue);

        const tierDataForChart = [{ name: '< 5 triệu', 'Số lượng NVKD': tiers.tier1 }, { name: '5 - <10 triệu', 'Số lượng NVKD': tiers.tier2 }, { name: '10 - <15 triệu', 'Số lượng NVKD': tiers.tier3 }, { name: '>= 15 triệu', 'Số lượng NVKD': tiers.tier4 }];
        return { tiers: tierDataForChart, details };
    }, [mobileData, selectedMonth, mobileKpiDefs, users]);
    if (!internalData) return <DataPlaceholder message="Không có dữ liệu kênh nội bộ cho tháng này."/>;
    return (<div className="space-y-12"><div className="grid grid-cols-1 xl:grid-cols-2 gap-12"><div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-6"><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Phân loại NVKD theo Doanh thu</h3><ResponsiveContainer width="100%" height={300}><BarChart data={internalData.tiers} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={10} fontWeight="bold" /><YAxis allowDecimals={false}/><Tooltip /><Bar dataKey="Số lượng NVKD" fill="#8884d8" /></BarChart></ResponsiveContainer></div><div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-6"><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Chi tiết Doanh thu theo NVKD</h3><div className="overflow-y-auto max-h-[300px]"><table className="w-full text-xs"><thead><tr className="font-black text-slate-400 uppercase"><th className="p-2 text-left">Tên NVKD</th><th className="p-2 text-right">Doanh thu (VNĐ)</th></tr></thead><tbody className="font-bold divide-y">{internalData.details.map((item, i) => (<tr key={i}><td className="p-2">{item.name}</td><td className="p-2 text-right font-mono">{item.revenue.toLocaleString()}</td></tr>))}</tbody></table></div></div></div></div>);
};

const ExternalChannelTab: React.FC<MobileOpsProps & { selectedMonth: string, mobileKpiDefs: KPIDefinition[] }> = ({ mobileData, selectedMonth, mobileKpiDefs }) => {
    const externalData = useMemo(() => {
        const imported = mobileData.find(d => d.period === selectedMonth && d.dataType === 'external_group');
        if (!imported?.data || !imported.mapping) return null;
        const nameKpi = mobileKpiDefs.find(k => k.dataSource === 'external_group' && k.id.includes('name'));
        const revenueKpi = mobileKpiDefs.find(k => k.dataSource === 'external_group' && k.id.includes('revenue'));
        const subsKpi = mobileKpiDefs.find(k => k.dataSource === 'external_group' && k.id.includes('subs'));
        if (!nameKpi) return [];
        return imported.data.map((row: any) => ({ name: row[imported.mapping[nameKpi.id]] || 'N/A', revenue: revenueKpi ? Number(row[imported.mapping[revenueKpi.id]] || 0) : 0, subs: subsKpi ? Number(row[imported.mapping[subsKpi.id]] || 0) : 0, })).sort((a,b) => b.revenue - a.revenue);
    }, [mobileData, selectedMonth, mobileKpiDefs]);
    if (!externalData) return <DataPlaceholder message="Không có dữ liệu kênh ngoài cho tháng này."/>;
    return (<div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-6"><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Hiệu quả các điểm bán kênh ngoài</h3><div className="overflow-y-auto max-h-[500px]"><table className="w-full text-xs"><thead><tr className="font-black text-slate-400 uppercase"><th className="p-2 text-left">Tên điểm bán / Kênh</th><th className="p-2 text-right">Sản lượng PTM</th><th className="p-2 text-right">Doanh thu (VNĐ)</th></tr></thead><tbody className="font-bold divide-y">{externalData.map((item, i) => (<tr key={i}><td className="p-2">{item.name}</td><td className="p-2 text-right font-mono">{item.subs.toLocaleString()}</td><td className="p-2 text-right font-mono">{item.revenue.toLocaleString()}</td></tr>))}</tbody></table></div></div>);
};

const ConfigTab: React.FC<MobileOpsProps & { mobileKpiDefs: KPIDefinition[], onRefreshData: () => void, selectedMonth: string }> = ({ onRefresh, selectedMonth, mobileKpiDefs, onRefreshData }) => {
  const [autocallTargets, setAutocallTargets] = useState({ ckn: 0, ckd: 0, package: 0 });
  useEffect(() => { const fetchTargets = async () => { const t = await dbClient.getById('mobile_targets', selectedMonth); setAutocallTargets(t?.autocall || { ckn: 0, ckd: 0, package: 0 }); }; fetchTargets(); }, [selectedMonth]);
  const handleSaveTargets = async () => { await dbClient.upsert('mobile_targets', selectedMonth, { autocall: autocallTargets }); alert("Đã lưu kế hoạch AutoCall!"); onRefreshData(); };
  return (
      <div className="space-y-12">
          {Object.entries(DATA_CONFIG_STRUCTURE).map(([sectionTitle, configs]) => (
              <div key={sectionTitle} className="bg-white rounded-[48px] shadow-sm border p-12 space-y-8">
                  <h3 className="text-2xl font-black text-slate-800 uppercase">{sectionTitle}</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {configs.map(cfg => (<DataSourceConfig key={cfg.key} dataSourceKey={cfg.key} title={cfg.title} kpiDefs={mobileKpiDefs.filter(d => d.dataSource === cfg.key)} selectedMonth={selectedMonth} onRefresh={onRefresh} onRefreshDefs={onRefreshData} />))}
                  </div>
              </div>
          ))}
          <div className="bg-white rounded-[48px] shadow-sm border p-12 space-y-8"><div className="flex items-center gap-6 border-b pb-8"><div className="bg-teal-600 p-5 rounded-[32px] text-white"><Target size={40}/></div><div><h3 className="text-2xl font-black text-slate-800 uppercase">Kế hoạch Doanh thu AutoCall</h3><p className="text-xs text-slate-400 font-bold uppercase mt-1">Tháng: {selectedMonth}</p></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><InputField type="number" label="DT Gia hạn CKN (VNĐ)" value={autocallTargets.ckn} onChange={v => setAutocallTargets(d => ({...d, ckn: Number(v)}))} /><InputField type="number" label="DT Gia hạn CKD (VNĐ)" value={autocallTargets.ckd} onChange={v => setAutocallTargets(d => ({...d, ckd: Number(v)}))} /><InputField type="number" label="DT Bán gói (VNĐ)" value={autocallTargets.package} onChange={v => setAutocallTargets(d => ({...d, package: Number(v)}))} /></div><div className="text-right"><button onClick={handleSaveTargets} className="bg-teal-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-teal-600">Lưu Kế hoạch</button></div></div>
      </div>
  );
};

// REUSABLE & HELPER COMPONENTS
const DataSourceConfig: React.FC<{dataSourceKey: string, title: string, kpiDefs: KPIDefinition[], selectedMonth: string, onRefresh: ()=>void, onRefreshDefs: ()=>void}> = ({dataSourceKey, title, kpiDefs, selectedMonth, onRefresh, onRefreshDefs}) => {
    const [config, setConfig] = useState<any>({}); const [columns, setColumns] = useState<string[]>([]); const [isReading, setIsReading] = useState(false); const [isSyncing, setIsSyncing] = useState(false); const [isDefModalOpen, setIsDefModalOpen] = useState(false); const [editingDef, setEditingDef] = useState<Partial<KPIDefinition> | null>(null);
    useEffect(()=>{ const fetcher = async () => { const c = await dbClient.getById('mobile_data_configs', `${dataSourceKey}_${selectedMonth}`); setConfig(c || {}); setColumns([]); }; fetcher(); }, [dataSourceKey, selectedMonth]);
    const handleRead = async () => { if (!config.url) return; setIsReading(true); try { let finalUrl = config.url.trim(); if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv'; const res = await fetch(finalUrl); const csv = await res.text(); const wb = XLSX.read(csv, { type: 'string' }); const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); if(rows.length>0) setColumns(Object.keys(rows[0])); else alert("File rỗng"); } catch (e) { alert("Lỗi đọc file"); } finally { setIsReading(false); } };
    const handleSaveConfig = async () => { try { await dbClient.upsert('mobile_data_configs', `${dataSourceKey}_${selectedMonth}`, { period: selectedMonth, dataType: dataSourceKey, url: config.url, mapping: config.mapping }); alert(`Đã lưu cấu hình link cho ${title} thành công!`); } catch (e) { alert("Lỗi khi lưu cấu hình."); console.error(e); }};
    const handleSync = async () => { if (!config.url) return; setIsSyncing(true); try { let finalUrl = config.url.trim(); if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv'; const res = await fetch(finalUrl); const csv = await res.text(); const wb = XLSX.read(csv, { type: 'string' }); const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); await dbClient.upsert('mobile_imported_data', `${dataSourceKey}_${selectedMonth}`, { period: selectedMonth, dataType: dataSourceKey, data: rows, mapping: config.mapping }); onRefresh(); alert(`Đồng bộ ${rows.length} dòng thành công!`); } catch (e) { alert("Lỗi đồng bộ."); } finally { setIsSyncing(false); } };
    return (<div className="bg-slate-50 border rounded-[32px] p-8 space-y-6"><h4 className="text-base font-black text-slate-700 uppercase">{title}</h4><div><input placeholder="URL Google Sheet (CSV)..." value={config.url || ''} onChange={e => setConfig({...config, url: e.target.value})} className="w-full border p-3 rounded-xl font-mono text-xs" /><div className="flex justify-end gap-2 mt-2"><button onClick={handleRead} disabled={isReading||!config.url} className="bg-slate-700 text-white text-[9px] font-black px-4 py-2 rounded-lg">{isReading?<Loader2 className="animate-spin"/>:'Đọc Cột'}</button><button onClick={handleSaveConfig} className="text-slate-400 text-[9px] font-black px-4 py-2 rounded-lg">Lưu Link</button></div></div>{columns.length > 0 && (<div className="space-y-2"><label className="text-[10px] font-black uppercase">Ánh xạ dữ liệu:</label>{kpiDefs.map(def => <div key={def.id} className="grid grid-cols-2 items-center gap-2"><span className="text-[10px] font-bold truncate">{def.name}</span><select className="w-full border p-1 rounded-md text-[10px]" value={config.mapping?.[def.id] || ''} onChange={e => setConfig({...config, mapping: {...(config.mapping || {}), [def.id]: e.target.value}})}><option value="">-- Chọn --</option>{columns.map(c => <option key={c} value={c}>{c}</option>)}</select></div>)}</div>)}<div className="border-t pt-4 space-y-3"><div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase">Bộ chỉ tiêu:</label><button onClick={()=>{setEditingDef({dataSource: dataSourceKey}); setIsDefModalOpen(true);}} className="bg-green-100 text-green-700 p-1 rounded-full"><Plus size={12}/></button></div>{kpiDefs.map(def => <KpiDefItem key={def.id} def={def} onEdit={() => {setEditingDef(def); setIsDefModalOpen(true);}} onDelete={async () => { if(confirm("Xóa?")){await dbClient.delete('mobile_kpi_definitions', def.id); onRefreshDefs();}}}/>)}</div><button onClick={handleSync} disabled={isSyncing || !config.url} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">{isSyncing?<Loader2 className="animate-spin"/>:<Import size={14}/>}Đồng bộ dữ liệu</button>{isDefModalOpen && <KpiDefModal def={editingDef} onSave={onRefreshDefs} onClose={() => setIsDefModalOpen(false)} allDefs={kpiDefs} />}</div>);
};
const TabButton: React.FC<{ id: string, label: string, activeTab: string, setActiveTab: (id: string) => void, icon?: React.ReactElement }> = ({ id, label, activeTab, setActiveTab, icon }) => (<button onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 px-6 py-3 text-sm font-black transition-all border-b-2 ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{icon} {label}</button>);
const StatDisplay: React.FC<{ title: string, data: any[], unit: string, color: string }> = ({ title, data, unit, color }) => (<div className="bg-white p-8 rounded-[32px] shadow-sm border space-y-6"><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3><div className="space-y-2 max-h-[450px] overflow-y-auto">{data.length > 1 ? data.map((item, idx) => (<div key={idx} className={`p-2.5 rounded-xl ${item.name.includes('Tổng') ? 'bg-slate-100' : ''}`}><div className="flex justify-between items-center mb-1.5"><span className={`text-[11px] font-black truncate pr-4 ${item.name.includes('Tổng') ? 'text-blue-600' : 'text-slate-700'}`}>{item.name}</span><span className="text-[10px] font-bold text-slate-500">{item.actual.toLocaleString()} / <span className="text-slate-400">{item.target.toLocaleString()}</span></span></div><div className="flex items-center gap-2"><div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(item.percent, 100)}%`, backgroundColor: color }} /></div><span className="font-black text-xs" style={{ color }}>{item.percent}%</span></div></div>)) : <DataPlaceholder message="Không có dữ liệu."/>}</div></div>);
const InputField: React.FC<{label: string, value: any, onChange: (v: string) => void, type?: string}> = ({label, value, onChange, type='text'}) => (<div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label><input type={type} className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold" value={value} onChange={e => onChange(e.target.value)} /></div>);
const DataPlaceholder: React.FC<{message: string}> = ({message}) => (<div className="text-center text-slate-400 italic p-10 bg-white rounded-3xl border">{message}</div>);
const StatCardWithProgress: React.FC<{ title: string, actual: number, target: number, unit: string, color: string }> = ({ title, actual, target, unit, color }) => { const percent = target > 0 ? Math.round((actual / target) * 100) : 0; const isCurrency = unit === 'VNĐ'; const displayActual = isCurrency ? (actual / 1000000).toFixed(2) + 'tr' : actual.toLocaleString(); const displayTarget = isCurrency ? (target / 1000000).toFixed(2) + 'tr' : target.toLocaleString(); return (<div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4"><div className="flex justify-between items-start"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4><div className={`font-black text-lg`} style={{ color }}>{percent}%</div></div><div><div className="text-2xl font-black text-slate-800">{displayActual}</div><div className="text-[10px] font-mono text-slate-400">KH: {displayTarget}</div></div><div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} /></div></div>); };
const KpiDefItem: React.FC<{def: KPIDefinition, onEdit:()=>void, onDelete:()=>void}> = ({def, onEdit, onDelete}) => (<div className="flex items-center justify-between p-2 bg-white rounded-lg border group text-[10px]"><span className="font-bold text-slate-800 truncate pr-2">{def.name}</span><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onEdit} className="p-1 hover:bg-slate-100 rounded text-blue-600"><Edit3 size={12}/></button><button onClick={onDelete} className="p-1 hover:bg-slate-100 rounded text-red-500"><Trash2 size={12}/></button></div></div>);
const KpiDefModal: React.FC<{def: Partial<KPIDefinition>|null, onClose:()=>void, onSave:()=>void, allDefs: KPIDefinition[]}> = ({def, onClose, onSave, allDefs}) => {
    const [formData, setFormData] = useState<Partial<KPIDefinition>|null>(null); const [isProcessing, setIsProcessing] = useState(false); useEffect(() => { setFormData(def); }, [def]); if (!formData) return null;
    const handleSave = async () => { if (!formData.id || !formData.name) return alert("Mã và Tên là bắt buộc."); if (!def?.id && allDefs.some(d => d.id === formData.id)) return alert(`Mã "${formData.id}" đã tồn tại.`); setIsProcessing(true); try { await dbClient.upsert('mobile_kpi_definitions', formData.id, formData); onSave(); onClose(); } catch (e) { alert("Lỗi khi lưu."); } finally { setIsProcessing(false); } };
    return (<div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl border"><div className="p-8 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{def?.id ? 'CẬP NHẬT' : 'TẠO MỚI'} CHỈ TIÊU</h3><button onClick={onClose} className="p-2 hover:bg-red-50 rounded-full"><X/></button></div><div className="p-10 space-y-6"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mã (Key)</label><input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-mono text-xs" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/\s/g, '_')})} disabled={!!def?.id} /></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên</label><input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div><div className="grid grid-cols-2 gap-5"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Đơn vị</label><input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold" value={formData.unit || ''} onChange={e => setFormData({...formData, unit: e.target.value})} /></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nguồn</label><input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-mono text-xs" value={formData.dataSource || ''} disabled /></div></div></div><div className="p-8 border-t bg-slate-50 flex justify-end gap-4"><button onClick={onClose} className="px-8 py-3 text-slate-400 font-black text-xs uppercase">Hủy</button><button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center gap-2">{isProcessing ? <Loader2 className="animate-spin"/> : <Save/>} LƯU</button></div></div></div>);
}

export default MobileOps;
