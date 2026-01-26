
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
  systemSettings: any;
  onRefresh: () => void;
}

// Danh sách thứ tự ưu tiên hiển thị
const SORT_ORDER = [
    'VNPT Hạ Long', 
    'VNPT Uông Bí', 
    'VNPT Cẩm Phả', 
    'VNPT Tiên Yên', 
    'VNPT Móng Cái', 
    'VNPT Bãi Cháy', 
    'VNPT Đông Triều', 
    'VNPT Vân Đôn - Cô Tô'
];

const MobileKpiView: React.FC<{
    type: 'subscribers' | 'revenue',
    title: string,
    currentUser: User,
    units: Unit[],
    systemSettings: any;
    onRefreshParent: () => void;
}> = ({ type, title, currentUser, units, systemSettings, onRefreshParent }) => {
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
        
        const data = units
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
            .filter(d => d.target > 0 || d.actual > 0);

        // Sắp xếp theo thứ tự ưu tiên
        return data.sort((a, b) => {
            const indexA = SORT_ORDER.indexOf(a.name);
            const indexB = SORT_ORDER.indexOf(b.name);
            
            // Nếu cả 2 đều có trong list, sắp xếp theo index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            
            // Nếu chỉ a có, a lên trước
            if (indexA !== -1) return -1;
            
            // Nếu chỉ b có, b lên trước
            if (indexB !== -1) return 1;
            
            // Nếu không, sắp xếp theo tên hoặc logic cũ
            return a.name.localeCompare(b.name);
        });

    }, [units, importedData, config]);

    // Cấu hình màu sắc
    const barColors = type === 'revenue' 
        ? { percent: '#3B82F6', actual: '#F97316', label: '#000000' } // Doanh thu: Percent Xanh dương (#3B82F6), Actual Cam
        : { percent: '#EAB308', actual: '#0068FF', label: '#000000' }; // Thuê bao: Percent Vàng đậm (#EAB308), Actual Xanh

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

    const handleQuickSync = async () => {
        // 1. Kiểm tra quyền
        if (!isAdmin && !systemSettings?.allowKpiSync) {
            alert("Chức năng đồng bộ đang bị khóa bởi Quản trị viên.");
            return;
        }

        // 2. Xác định tháng cần đồng bộ
        let targetMonth = new Date().toISOString().slice(0, 7);
        if (isAdmin) {
            const input = prompt("Nhập tháng muốn đồng bộ (YYYY-MM):", selectedMonth);
            if (!input) return;
            if (!/^\d{4}-\d{2}$/.test(input)) return alert("Tháng không hợp lệ.");
            targetMonth = input;
        }

        setIsProcessing(true);
        try {
            // 3. Lấy cấu hình từ DB (vì user có thể không đang ở tab Config)
            const configId = `${type}_${targetMonth}`;
            const configData = await dbClient.getById('mobile_ops_configs', configId);

            if (!configData || !configData.url || !configData.mapping?.unitCodeCol) {
                alert(`Không tìm thấy cấu hình đồng bộ cho tháng ${targetMonth}. Vui lòng liên hệ Admin cấu hình trước.`);
                setIsProcessing(false);
                return;
            }

            // 4. Thực hiện đồng bộ
            let finalUrl = configData.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl);
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            
            const dataId = `${type}_${targetMonth}`;
            await dbClient.upsert('mobile_ops_data', dataId, { data: rows });
            
            alert(`Đồng bộ thành công dữ liệu tháng ${targetMonth}!`);
            
            // Nếu đang xem đúng tháng vừa đồng bộ thì load lại
            if (targetMonth === selectedMonth) {
                fetchData();
            } else if (isAdmin) {
                setSelectedMonth(targetMonth); // Chuyển view sang tháng vừa đồng bộ
            }

        } catch (e) {
            alert("Lỗi đồng bộ: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-[40px] shadow-sm border space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className={`text-lg font-black tracking-tighter uppercase ${type === 'revenue' ? 'text-orange-600' : 'text-slate-800'}`}>{title}</h3>
                <div className="flex items-center gap-2">
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border-2 rounded-xl px-2 py-1.5 font-bold text-[10px] bg-slate-50 outline-none w-28"/>
                    
                    {/* Nút Đồng bộ nhanh */}
                    <button 
                        onClick={handleQuickSync} 
                        disabled={isProcessing}
                        className="bg-slate-100 text-slate-600 p-1.5 rounded-xl border hover:bg-slate-200 transition-colors" 
                        title="Đồng bộ dữ liệu"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                    </button>

                    {isAdmin && (
                        <div className="flex bg-slate-100 p-1 rounded-xl border ml-2">
                             <button onClick={() => setActiveTab('eval')} className={`p-1.5 rounded-lg text-[10px] font-black ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`} title="Xem biểu đồ"><TrendingUp size={14}/></button>
                             <button onClick={() => setActiveTab('config')} className={`p-1.5 rounded-lg text-[10px] font-black ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`} title="Cấu hình"><Settings size={14}/></button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-[350px]">
                {activeTab === 'eval' ? (
                    isLoadingData ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32}/></div> :
                    <div className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 30, right: 0, left: 0, bottom: 5 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                                <XAxis dataKey="name" interval={0} tick={{ fontSize: 9, fontWeight: 'bold' }} angle={-45} textAnchor="end" height={80} />
                                <YAxis yAxisId="left" tick={{fontSize: 10}} />
                                <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} tick={{fontSize: 10}} />
                                
                                <Tooltip content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl text-xs min-w-[180px] z-50">
                                                <p className="font-black text-slate-800 text-sm mb-2 border-b pb-2">{label}</p>
                                                <div className="flex justify-between items-center gap-4 mb-1">
                                                    <span className="text-slate-500 font-bold">Kế hoạch giao:</span>
                                                    <span className="font-black text-slate-700">{data.target.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-4 mb-1">
                                                    <span className="text-slate-500 font-bold">Kết quả thực hiện:</span>
                                                    <span className={`font-black ${type === 'revenue' ? 'text-orange-500' : 'text-blue-600'}`}>{data.actual.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-slate-500 font-bold">Tỷ lệ thực hiện:</span>
                                                    <span className={`font-black ${type === 'revenue' ? 'text-blue-600' : 'text-yellow-600'}`}>{data.percent}%</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} cursor={{fill: 'transparent'}} />

                                <Legend 
                                    verticalAlign="top" 
                                    align="center" 
                                    wrapperStyle={{ paddingBottom: '10px', fontWeight: 'bold', fontSize: '11px' }}
                                    formatter={(value) => <span style={{ color: '#000000' }}>{value}</span>}
                                />
                                
                                {/* Cột Tỷ lệ thực hiện - Dùng trục phải */}
                                <Bar yAxisId="right" dataKey="percent" fill={barColors.percent} name="Tỷ lệ thực hiện (%)">
                                    <LabelList dataKey="percent" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#000' }} />
                                </Bar>
                                
                                {/* Cột Thực hiện - Dùng trục trái */}
                                <Bar yAxisId="left" dataKey="actual" fill={barColors.actual} name="Kết quả thực hiện">
                                    <LabelList dataKey="actual" position="top" formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#000' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in p-6 bg-slate-50 rounded-2xl border h-full overflow-y-auto">
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
                                 <div className="grid grid-cols-1 gap-4 bg-white p-4 rounded-xl border">
                                    <MappingSelect label="Cột Mã Đơn vị" columns={sheetColumns} value={config.mapping?.unitCodeCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, unitCodeCol: v}})} />
                                    <MappingSelect label="Cột Kế hoạch" columns={sheetColumns} value={config.mapping?.targetCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, targetCol: v}})} />
                                    <MappingSelect label="Cột Thực hiện" columns={sheetColumns} value={config.mapping?.actualCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, actualCol: v}})} />
                                 </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={handleSaveConfig} className="bg-slate-200 text-slate-700 px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2"><Save size={14}/> Lưu</button>
                            <button onClick={handleSyncData} disabled={isProcessing} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2"><Import size={14}/> Đồng bộ</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MobileOpsDashboard: React.FC<MobileOpsProps> = (props) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="border-b pb-6">
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                    <Smartphone className="text-blue-600" size={36} /> DASHBOARD CTHĐ DI ĐỘNG
                </h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Giám sát chỉ tiêu PTM & Doanh thu theo thời gian thực</p>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <MobileKpiView 
                    type="subscribers" 
                    title="Thuê bao di động PTM" 
                    {...props} 
                    onRefreshParent={props.onRefresh}
                />
                <MobileKpiView 
                    type="revenue" 
                    title="Doanh thu PTM" 
                    {...props} 
                    onRefreshParent={props.onRefresh}
                />
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
