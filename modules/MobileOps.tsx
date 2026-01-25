
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { User, Unit } from '../types';
import { Smartphone, Users, TrendingUp, Settings, Loader2, Database, Table, Filter, Save, Import, RefreshCw } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, LabelList, CartesianGrid, Legend } from 'recharts';

interface MobileOpsConfig {
  id: string; 
  type: 'subscribers' | 'revenue';
  period: string; // YYYY-MM
  url: string;
  mapping?: {
    unitCodeCol: string;
    targetCol: string;
    actualCol: string;
  };
}

interface MobileOpsProps {
  currentUser: User;
  units: Unit[];
  onRefresh: () => void;
}

const MobileKpiView: React.FC<{
    type: 'subscribers' | 'revenue',
    title: string,
    currentUser: User,
    units: Unit[],
    onRefreshParent: () => void;
}> = ({ type, title, currentUser, units, onRefreshParent }) => {
    const [activeTab, setActiveTab] = useState('eval');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [config, setConfig] = useState<Partial<MobileOpsConfig>>({});
    const [importedData, setImportedData] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [sheetColumns, setSheetColumns] = useState<string[]>([]);

    const isAdmin = currentUser.username === 'admin';

    const fetchData = useCallback(async () => {
        setIsLoadingData(true);
        const configId = `${type}_${selectedMonth}`;
        const dataId = `${type}_${selectedMonth}`;
        
        const [configData, importedResult] = await Promise.all([
            dbClient.getById('mobile_ops_configs', configId),
            dbClient.getById('mobile_ops_data', dataId)
        ]);

        setConfig(configData || { type, period: selectedMonth, url: '', mapping: {} });
        setImportedData(importedResult?.data || []);
        setIsLoadingData(false);
    }, [type, selectedMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const chartData = useMemo(() => {
        if (!config.mapping || !config.mapping.unitCodeCol || importedData.length === 0) return [];
        const { unitCodeCol, targetCol, actualCol } = config.mapping;
        
        return units
            .filter(u => u.level > 0)
            .map(unit => {
                const row = importedData.find(d => String(d[unitCodeCol]) === String(unit.code));
                const target = Number(row?.[targetCol] || 0);
                const actual = Number(row?.[actualCol] || 0);
                const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
                return {
                    name: unit.name,
                    target,
                    actual,
                    percent,
                };
            })
            .filter(d => d.target > 0 || d.actual > 0)
            .sort((a, b) => (b?.percent || 0) - (a?.percent || 0));
    }, [units, importedData, config]);

    // Cấu hình màu sắc dựa trên loại báo cáo
    const barColors = type === 'revenue' 
        ? { plan: '#FED7AA', actual: '#F97316', label: '#EA580C' } // Cam (Doanh thu)
        : { plan: '#BAE6FD', actual: '#0068FF', label: '#0068FF' }; // Xanh (Thuê bao)

    const handleReadSheet = async () => {
        if (!config.url) return alert("Vui lòng nhập URL Google Sheet.");
        setIsProcessing(true);
        try {
            let finalUrl = config.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error("Không thể tải file.");
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (rows.length > 0) {
                setSheetColumns(Object.keys(rows[0]));
                alert("Đã đọc thành công các cột. Vui lòng ánh xạ.");
            } else {
                alert("File rỗng hoặc không có dữ liệu.");
            }
        } catch (e) {
            alert("Lỗi đọc file: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSaveConfig = async () => {
        const configId = `${type}_${selectedMonth}`;
        await dbClient.upsert('mobile_ops_configs', configId, { ...config, id: configId, type, period: selectedMonth });
        alert("Đã lưu cấu hình!");
    };

    const handleSyncData = async () => {
        if (!config.url || !config.mapping?.unitCodeCol) return alert("Vui lòng nhập URL và ánh xạ cột Mã đơn vị.");
        setIsProcessing(true);
        try {
            let finalUrl = config.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl);
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            
            const dataId = `${type}_${selectedMonth}`;
            await dbClient.upsert('mobile_ops_data', dataId, { data: rows });
            setImportedData(rows);
            alert(`Đồng bộ thành công ${rows.length} dòng dữ liệu.`);
            setActiveTab('eval');
        } catch (e) {
            alert("Lỗi đồng bộ dữ liệu: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-[40px] shadow-sm border space-y-6">
            <div className="flex justify-between items-center">
                <h3 className={`text-xl font-black tracking-tighter uppercase ${type === 'revenue' ? 'text-orange-600' : 'text-slate-800'}`}>{title}</h3>
                <div className="flex items-center gap-4">
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border-2 rounded-xl px-4 py-2 font-bold text-xs bg-slate-50 outline-none"/>
                    {isAdmin && (
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border">
                             <button onClick={() => setActiveTab('eval')} className={`px-4 py-2 rounded-xl text-xs font-black ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Kết quả</button>
                             <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-xl text-xs font-black ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Settings size={14}/></button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'eval' ? (
                isLoadingData ? <div className="h-[500px] flex items-center justify-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32}/></div> :
                <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 30, right: 0, left: 0, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                            <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name === 'actual' ? 'Thực hiện' : name === 'target' ? 'Kế hoạch' : name]}/>
                            <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: '20px' }}/>
                            <Bar yAxisId="left" dataKey="target" fill={barColors.plan} name="Kế hoạch">
                                <LabelList dataKey="target" position="top" formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                            </Bar>
                            <Bar yAxisId="left" dataKey="actual" fill={barColors.actual} name="Thực hiện">
                                <LabelList dataKey="percent" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: barColors.label }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in p-6 bg-slate-50 rounded-2xl border">
                    <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Link Google Sheet (CSV)</label>
                         <div className="flex gap-2">
                            <input value={config.url || ''} onChange={e => setConfig({...config, url: e.target.value})} className="w-full border-2 p-3 rounded-xl bg-white font-mono text-xs"/>
                            <button onClick={handleReadSheet} disabled={isProcessing} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                                {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Table size={14}/>} Đọc
                            </button>
                         </div>
                    </div>
                    {sheetColumns.length > 0 && (
                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">2. Ánh xạ cột</label>
                             <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-xl border">
                                <MappingSelect label="Cột Mã Đơn vị" columns={sheetColumns} value={config.mapping?.unitCodeCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, unitCodeCol: v}})} />
                                <MappingSelect label="Cột Kế hoạch" columns={sheetColumns} value={config.mapping?.targetCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, targetCol: v}})} />
                                <MappingSelect label="Cột Thực hiện" columns={sheetColumns} value={config.mapping?.actualCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, actualCol: v}})} />
                             </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button onClick={handleSaveConfig} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2"><Save size={14}/> Lưu Cấu hình</button>
                        <button onClick={handleSyncData} disabled={isProcessing} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2"><Import size={14}/> Đồng bộ Data</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const MobileOpsDashboard: React.FC<MobileOpsProps> = (props) => {
    const [activeSubModule, setActiveSubModule] = useState<'subscribers' | 'revenue'>('subscribers');

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center border-b pb-6">
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                    <Smartphone className="text-blue-600" size={36} /> DASHBOARD CTHĐ DI ĐỘNG
                </h2>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border">
                    <button onClick={() => setActiveSubModule('subscribers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeSubModule === 'subscribers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Users size={16}/> Thuê bao PTM</button>
                    <button onClick={() => setActiveSubModule('revenue')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeSubModule === 'revenue' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}><TrendingUp size={16}/> Doanh thu PTM</button>
                </div>
            </div>
            <div>
                {activeSubModule === 'subscribers' && <MobileKpiView type="subscribers" title="Thuê bao di động PTM theo đơn vị" {...props} onRefreshParent={props.onRefresh}/>}
                {activeSubModule === 'revenue' && <MobileKpiView type="revenue" title="Doanh thu TB di động PTM theo đơn vị" {...props} onRefreshParent={props.onRefresh}/>}
            </div>
        </div>
    );
};

const MappingSelect: React.FC<{
    label: string;
    columns: string[];
    value: string;
    onChange: (value: string) => void;
}> = ({label, columns, value, onChange}) => (
    <div>
        <label className="text-[10px] font-bold text-slate-500">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full border p-2 rounded-md mt-1 text-xs">
            <option value="">-- Chọn cột --</option>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
    </div>
);

export default MobileOpsDashboard;
