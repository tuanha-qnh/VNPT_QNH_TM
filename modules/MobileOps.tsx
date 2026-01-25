
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { User, Unit } from '../types';
import { Smartphone, Users, TrendingUp, Settings, Loader2, Database, Table, Filter, Save, Import, RefreshCw, GripHorizontal } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, LabelList, CartesianGrid, Legend, Line } from 'recharts';

interface MobileOpsConfig {
  id: string; 
  type: 'subscribers' | 'revenue';
  period: string; // YYYY-MM
  url: string;
  mapping?: {
    unitCodeCol?: string;
    targetCol?: string;
    actualCol?: string;
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
    icon: React.ReactNode,
    barColor: string,
    currentUser: User,
    units: Unit[],
    onRefreshParent: () => void;
    chartHeight: number;
    onHeightChange: (newHeight: number) => void;
    reloadTrigger: number;
}> = ({ type, title, icon, barColor, currentUser, units, chartHeight, onHeightChange, reloadTrigger }) => {
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
        
        try {
            // The reliable flow: Fetch both config and data directly from the database.
            // The chart will only render if BOTH are present.
            const [configData, dataResult] = await Promise.all([
                dbClient.getById('mobile_ops_configs', configId),
                dbClient.getById('mobile_ops_data', dataId)
            ]);

            setConfig(configData || { type, period: selectedMonth, url: '', mapping: {} });
            setImportedData((dataResult as { data: any[] } | null)?.data || []);

        } catch (error) {
            console.error("Error fetching mobile ops data from DB:", error);
            setConfig({ type, period: selectedMonth, url: '', mapping: {} });
            setImportedData([]);
        } finally {
            setIsLoadingData(false);
        }
    }, [type, selectedMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData, reloadTrigger]);

    const chartData = useMemo(() => {
        const unitsWithReportFlag = units.filter(u => u.includeInPtmReport);
        const unitOrder = [
            'VNPT Hạ Long', 'VNPT Uông Bí', 'VNPT Cẩm Phả', 'VNPT Tiên Yên',
            'VNPT Móng Cái', 'VNPT Bãi Cháy', 'VNPT Đông Triều', 'VNPT Vân Đồn - Cô Tô'
        ];

        const { unitCodeCol, targetCol, actualCol } = config.mapping || {};
        
        const targetUnits = unitsWithReportFlag.length > 0 ? unitsWithReportFlag : units.filter(unit => unitOrder.includes(unit.name));

        const data = targetUnits
            .map(unit => {
                let target = 0;
                let actual = 0;
                
                if (importedData.length > 0 && unitCodeCol && targetCol && actualCol) {
                    const row = importedData.find(d => String(d[unitCodeCol]) === String(unit.code));
                    target = Number(row?.[targetCol] || 0);
                    actual = Number(row?.[actualCol] || 0);
                }
                
                const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
                return { name: unit.name, target, actual, percent };
            });

        return data.sort((a, b) => unitOrder.indexOf(a.name) - unitOrder.indexOf(b.name));
        
    }, [units, importedData, config]);

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
    
    const handleSaveAndSync = async () => {
        if (!config.url || !config.mapping?.unitCodeCol || !config.mapping?.targetCol || !config.mapping?.actualCol) {
            return alert("Vui lòng nhập URL Google Sheet và ánh xạ đầy đủ các cột: Mã đơn vị, Kế hoạch, Thực hiện.");
        }
        setIsProcessing(true);
        try {
            // Step 1: Save the configuration to the database.
            const configId = `${type}_${selectedMonth}`;
            await dbClient.upsert('mobile_ops_configs', configId, { ...config, id: configId, type, period: selectedMonth });

            // Step 2: Fetch data from Google Sheet.
            let finalUrl = config.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error("Không thể tải file từ Google Sheet. Kiểm tra lại link và quyền truy cập.");
            
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            
            // Step 3: Save the fetched data to the database.
            const dataId = `${type}_${selectedMonth}`;
            await dbClient.upsert('mobile_ops_data', dataId, { data: rows });

            // Step 4: Update local state to show the chart immediately for the admin.
            setImportedData(rows);
            
            alert(`Đã lưu cấu hình và đồng bộ thành công ${rows.length} dòng dữ liệu.`);
            setActiveTab('eval');
        } catch (e) {
            alert("Đã xảy ra lỗi: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = chartHeight;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            onHeightChange(startHeight + deltaY);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
          const data = payload[0].payload;
          const currentBarColor = payload.find(p => p.dataKey === 'actual')?.fill || barColor;
          return (
            <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200">
              <p className="font-black text-sm text-slate-800 mb-2 border-b pb-2">{label}</p>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold">
                  Kế hoạch: <span className="font-mono font-black text-slate-700">{data.target.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500 font-bold">
                  Thực hiện: <span className="font-mono font-black" style={{ color: currentBarColor }}>{data.actual.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500 font-bold">
                  Tỷ lệ: <span className="font-mono font-black" style={{ color: currentBarColor }}>{data.percent}%</span>
                </p>
              </div>
            </div>
          );
        }
        return null;
    };

    const VerticalActualLabel: React.FC<any> = ({ x, y, width, height, value }) => {
        if (height < 50 || !value || value === 0) return null;
        const formattedValue = value.toLocaleString();
        return (
            <text
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`translate(${x + width / 2}, ${y + height / 2}) rotate(-90)`}
                className="text-xs font-bold pointer-events-none tracking-wider"
            >
                {formattedValue}
            </text>
        );
    };

    return (
        <div className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4 h-full flex flex-col relative">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 tracking-tighter uppercase flex items-center gap-2">{icon} {title}</h3>
                <div className="flex items-center gap-2">
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border-2 rounded-lg px-2 py-1 font-bold text-[10px] bg-slate-50 outline-none"/>
                    {isAdmin && (
                        <div className="flex bg-slate-100 p-1 rounded-lg border">
                             <button onClick={() => setActiveTab('eval')} className={`px-2 py-1 rounded-md text-[9px] font-black ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Chart</button>
                             <button onClick={() => setActiveTab('config')} className={`p-1.5 rounded-md text-[9px] font-black ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Settings size={12}/></button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'eval' ? (
                isLoadingData ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32}/></div> :
                (!config.mapping?.unitCodeCol || importedData.length === 0) ? (
                    <div className="flex-1 h-[500px] flex flex-col items-center justify-center bg-slate-50 rounded-2xl text-center p-4">
                        <Database size={48} className="text-slate-300 mb-4"/>
                        <h4 className="font-black text-slate-600">Chưa có dữ liệu để hiển thị</h4>
                        {isAdmin ? (
                            <p className="text-xs text-slate-400 mt-2">Vui lòng chuyển qua tab Cấu hình để thiết lập và đồng bộ dữ liệu.</p>
                        ) : (
                            <p className="text-xs text-slate-400 mt-2">Dữ liệu cho tháng này chưa được cập nhật. Vui lòng liên hệ quản trị viên.</p>
                        )}
                    </div>
                ) :
                <div className="flex-1" style={{ height: `${chartHeight}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 40, right: 30, left: -20, bottom: 90 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 9 }}/>
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 9 }} domain={[0, 100]}/>
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0, 104, 255, 0.05)'}} />
                            <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '50px' }} formatter={(value) => <span style={{ color: '#000' }}>{value}</span>}/>
                            
                            <Bar yAxisId="left" dataKey="target" fill={`${barColor}4D`} name="Kế hoạch" barSize={40}>
                                <LabelList 
                                    dataKey="percent" 
                                    position="top" 
                                    offset={5}
                                    formatter={(value: number) => `${value}%`} 
                                    style={{ fill: '#1e293b', fontSize: '10px', fontWeight: 'bold' }} 
                                />
                            </Bar>
                            <Bar yAxisId="left" dataKey="actual" fill={barColor} name="Thực hiện" barSize={25}>
                                <LabelList dataKey="actual" content={<VerticalActualLabel />} />
                            </Bar>
                             <Line yAxisId="right" type="monotone" dataKey="percent" name="Tỷ lệ" stroke="#e11d48" strokeWidth={2} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in p-4 bg-slate-50 rounded-2xl border flex-1">
                    <div className="space-y-1">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">1. Link Google Sheet (CSV)</label>
                         <div className="flex gap-2">
                            <input value={config.url || ''} onChange={e => setConfig({...config, url: e.target.value})} className="w-full border-2 p-2 rounded-lg bg-white font-mono text-[10px]"/>
                            <button onClick={handleReadSheet} disabled={isProcessing} className="bg-slate-700 text-white px-3 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 disabled:opacity-50">
                                {isProcessing ? <Loader2 className="animate-spin" size={12}/> : <Table size={12}/>} Đọc
                            </button>
                         </div>
                    </div>
                    {sheetColumns.length > 0 && (
                        <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">2. Ánh xạ cột</label>
                             <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-lg border">
                                <MappingSelect label="Cột Mã Đơn vị" columns={sheetColumns} value={config.mapping?.unitCodeCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, unitCodeCol: v}})} />
                                <MappingSelect label="Cột Kế hoạch" columns={sheetColumns} value={config.mapping?.targetCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, targetCol: v}})} />
                                <MappingSelect label="Cột Thực hiện" columns={sheetColumns} value={config.mapping?.actualCol || ''} onChange={(v: string) => setConfig({...config, mapping: {...config.mapping, actualCol: v}})} />
                             </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <button onClick={handleSaveAndSync} disabled={isProcessing} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
                            {isProcessing ? <Loader2 className="animate-spin" size={12}/> : <Save size={12}/>}
                            Lưu & Đồng bộ
                        </button>
                    </div>
                </div>
            )}
            <div 
                onMouseDown={handleMouseDown}
                className="absolute bottom-0 left-0 w-full h-4 flex items-center justify-center cursor-ns-resize group"
            >
               <div className="w-12 h-1.5 bg-slate-200 rounded-full group-hover:bg-blue-500 transition-colors"></div>
            </div>
        </div>
    );
};

const MobileOpsDashboard: React.FC<MobileOpsProps> = (props) => {
    const [chartHeight, setChartHeight] = useState(500);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [reloadTrigger, setReloadTrigger] = useState(0);

    const handleHeightChange = useCallback((newHeight: number) => {
        const clampedHeight = Math.max(300, Math.min(1200, newHeight));
        setChartHeight(clampedHeight);
    }, []);

    const handleManualReload = () => {
        setReloadTrigger(prev => prev + 1);
    };

    const handleGlobalSync = async () => {
        const month = prompt("Nhập tháng muốn cập nhật dữ liệu (định dạng YYYY-MM):", new Date().toISOString().slice(0, 7));
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            if (month) alert("Định dạng tháng không hợp lệ.");
            return;
        }

        setIsSyncingAll(true);
        try {
            const types: ('subscribers' | 'revenue')[] = ['subscribers', 'revenue'];
            let successCount = 0;
            let errorMessages = [];

            for (const type of types) {
                const configId = `${type}_${month}`;
                const config = await dbClient.getById('mobile_ops_configs', configId) as MobileOpsConfig;

                if (config && config.url && config.mapping?.unitCodeCol) {
                    try {
                        let finalUrl = config.url.trim();
                        if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
                        const res = await fetch(finalUrl);
                        if (!res.ok) throw new Error(`Không tải được file cho ${type}`);
                        const csv = await res.text();
                        const wb = XLSX.read(csv, { type: 'string' });
                        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                        
                        const dataId = `${type}_${month}`;
                        await dbClient.upsert('mobile_ops_data', dataId, { data: rows });
                        successCount++;
                    } catch (e) {
                        errorMessages.push(`Lỗi khi đồng bộ ${type}: ${(e as Error).message}`);
                    }
                } else {
                    errorMessages.push(`Không tìm thấy cấu hình hợp lệ cho ${type} tháng ${month}.`);
                }
            }
            
            alert(`Hoàn tất!\n- Đồng bộ thành công: ${successCount}/${types.length} loại dữ liệu.\n- Tháng: ${month}\n${errorMessages.length > 0 ? `\nLỗi:\n- ${errorMessages.join('\n- ')}` : ''}`);
            props.onRefresh();

        } catch (e) {
            alert("Đã có lỗi hệ thống xảy ra trong quá trình đồng bộ.");
        } finally {
            setIsSyncingAll(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-wrap gap-4 justify-between items-center border-b pb-6">
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                    <Smartphone className="text-blue-600" size={36} /> DASHBOARD CTHĐ DI ĐỘNG
                </h2>
                <div className="flex items-center gap-2">
                    <button 
                      onClick={handleManualReload} 
                      className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-green-100 flex items-center gap-2 hover:bg-green-700 transition-all"
                    >
                      <RefreshCw size={16}/>
                      Nạp dữ liệu
                    </button>
                    {props.currentUser.username === 'admin' && (
                        <button 
                          onClick={handleGlobalSync} 
                          disabled={isSyncingAll} 
                          className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all disabled:bg-slate-400"
                        >
                          {isSyncingAll ? <Loader2 className="animate-spin" size={16}/> : <Import size={16}/>}
                          Đồng bộ từ Sheet
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <MobileKpiView type="subscribers" title="Thuê bao PTM" icon={<Users size={16}/>} barColor="#0068FF" {...props} onRefreshParent={props.onRefresh} chartHeight={chartHeight} onHeightChange={handleHeightChange} reloadTrigger={reloadTrigger} />
                <MobileKpiView type="revenue" title="Doanh thu PTM" icon={<TrendingUp size={16}/>} barColor="#f97316" {...props} onRefreshParent={props.onRefresh} chartHeight={chartHeight} onHeightChange={handleHeightChange} reloadTrigger={reloadTrigger} />
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
        <label className="text-[9px] font-bold text-slate-500">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full border p-1.5 rounded-md mt-1 text-[10px]">
            <option value="">-- Chọn cột --</option>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
    </div>
);

export default MobileOpsDashboard;
