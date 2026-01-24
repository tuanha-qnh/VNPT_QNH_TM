
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Unit, DataSource, LibraryKpi, ActionProgram } from '../types';
import { Smartphone, BookCopy, BarChart2, FileText, Settings, Loader2, Plus, Edit2, Trash2, Save, X, Database, Link, SlidersHorizontal, Package, Wand2, RefreshCw, Download, Filter } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Main Props Interface
interface MobileOpsProps {
  currentUser: User;
  users: User[];
  units: Unit[];
  dataSources: DataSource[];
  libraryKpis: LibraryKpi[];
  actionPrograms: ActionProgram[];
  importedData: any[];
  onRefresh: () => void;
}

// ==================================
// == MAIN DASHBOARD COMPONENT
// ==================================
const MobileOpsDashboard: React.FC<MobileOpsProps> = (props) => {
  const [activeModule, setActiveModule] = useState<'programs' | 'library' | 'reports'>('programs');
  const isAdmin = props.currentUser.username === 'admin';

  const renderModule = () => {
    switch (activeModule) {
      case 'programs':
        return <ActionProgramsView {...props} />;
      case 'library':
        return isAdmin ? <KpiLibraryAdmin {...props} /> : <AccessDenied />;
      case 'reports':
        return <ReportsView {...props} />;
      default:
        return <ActionProgramsView {...props} />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <Smartphone className="text-blue-600" size={36} /> QUẢN TRỊ CTHĐ DI ĐỘNG
          </h2>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border">
          <ModuleTabButton id="programs" label="Chương trình hành động" icon={<BarChart2 size={16}/>} activeModule={activeModule} setActiveModule={setActiveModule} />
          {isAdmin && <ModuleTabButton id="library" label="Thư viện KPI" icon={<BookCopy size={16}/>} activeModule={activeModule} setActiveModule={setActiveModule} />}
          <ModuleTabButton id="reports" label="Báo cáo thống kê" icon={<FileText size={16}/>} activeModule={activeModule} setActiveModule={setActiveModule} />
        </div>
      </div>
      <div>{renderModule()}</div>
    </div>
  );
};

// ==================================
// == 1. KPI LIBRARY (ADMIN ONLY)
// ==================================
const KpiLibraryAdmin: React.FC<MobileOpsProps> = (props) => {
    const [activeTab, setActiveTab] = useState('config_cthd');
    return (
        <div className="bg-white p-8 rounded-[40px] shadow-sm border space-y-6">
            <div className="flex border-b">
                <AdminTab id="config_cthd" label="Cấu hình CTHĐ" icon={<Wand2 size={14}/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                <AdminTab id="library_kpi" label="Thư viện KPI" icon={<Package size={14}/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                <AdminTab id="setup_cthd" label="Setup CTHĐ" icon={<SlidersHorizontal size={14}/>} activeTab={activeTab} setActiveTab={setActiveTab} />
                <AdminTab id="setup_source" label="Setup Nguồn" icon={<Database size={14}/>} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
            <div className="pt-4">
                {activeTab === 'setup_source' && <DataSourceSetupTab {...props} />}
                {activeTab === 'setup_cthd' && <ActionProgramSetupTab {...props} />}
                {activeTab === 'library_kpi' && <LibraryKpiSetupTab {...props} />}
                {activeTab === 'config_cthd' && <ConfigureProgramsTab {...props} />}
            </div>
        </div>
    );
};

// ... Sub-tabs for KpiLibraryAdmin ...
const DataSourceSetupTab: React.FC<MobileOpsProps> = ({ dataSources, onRefresh }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<DataSource> | null>(null);
    const handleSave = async (data: Partial<DataSource>) => {
        const id = data.id || `ds_${Date.now()}`;
        await dbClient.upsert('mobile_data_sources', id, { ...data, id });
        onRefresh(); setIsOpen(false);
    };
    return (
        <AdminSection title="Quản lý Nguồn dữ liệu" onAdd={() => { setEditingItem({}); setIsOpen(true); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dataSources.map(ds => (
                    <div key={ds.id} className="bg-slate-50 border p-4 rounded-2xl flex justify-between items-center group">
                        <div>
                            <p className="font-bold text-sm text-slate-800">{ds.name}</p>
                            <p className="text-xs text-blue-500 font-mono truncate max-w-[200px]">{ds.url}</p>
                        </div>
                        <AdminActionButtons onEdit={() => { setEditingItem(ds); setIsOpen(true); }} onDelete={async () => { if(confirm("Xóa?")) { await dbClient.delete('mobile_data_sources', ds.id); onRefresh(); }}} />
                    </div>
                ))}
            </div>
            {isOpen && <DataSourceModal item={editingItem} onSave={handleSave} onClose={() => setIsOpen(false)} />}
        </AdminSection>
    );
};
const LibraryKpiModal: React.FC<{item: Partial<LibraryKpi> | null, dataSources: DataSource[], onSave: (data: Partial<LibraryKpi>) => void, onClose: () => void}> = ({ item, dataSources, onSave, onClose }) => {
    const [data, setData] = useState(item);
    const [columns, setColumns] = useState<string[]>([]);
    const [isReading, setIsReading] = useState(false);

    if (!data) return null;

    const handleReadData = async () => {
        if (!data.dataSourceId) return;
        const selectedDS = dataSources.find(ds => ds.id === data.dataSourceId);
        if (!selectedDS?.url) return alert("Nguồn dữ liệu này chưa có URL.");

        setIsReading(true);
        try {
            let finalUrl = selectedDS.url.trim();
            if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error("Không thể tải file.");
            const csv = await res.text();
            const wb = XLSX.read(csv, { type: 'string' });
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (rows.length > 0) {
                setColumns(Object.keys(rows[0]));
            } else {
                alert("File Google Sheet rỗng hoặc không có dữ liệu.");
                setColumns([]);
            }
        } catch (e: any) {
            alert("Lỗi đọc dữ liệu từ Google Sheet: " + e.message);
            setColumns([]);
        } finally {
            setIsReading(false);
        }
    };

    const handleMappingChange = (key: 'entityIdCol' | 'targetCol' | 'actualCol', value: string) => {
        setData(prevData => ({
            ...prevData,
            mapping: {
                ...(prevData?.mapping || {}),
                [key]: value
            } as LibraryKpi['mapping']
        }));
    };

    const MappingSelect: React.FC<{label: string, value: string, onChange: (val: string) => void}> = ({label, value, onChange}) => (
        <div>
            <label className="text-[10px] font-bold text-slate-400">{label}</label>
            <select className="w-full border p-2 rounded-md mt-1 text-xs" value={value} onChange={e => onChange(e.target.value)}>
                <option value="">-- Chọn cột --</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </div>
    );

    return (
        <Modal title="Thư viện KPI" onClose={onClose} onSave={() => onSave(data)}>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Mã KPI (không dấu, không cách)" value={data.code || ''} onChange={val => setData({...data, code: val.toLowerCase().replace(/\s/g, '_')})} />
                <InputField label="Tên KPI" value={data.name || ''} onChange={val => setData({...data, name: val})} />
                <InputField label="Đơn vị tính" value={data.unit || ''} onChange={val => setData({...data, unit: val})} />
                <div>
                    <label className="text-xs font-bold text-slate-500">Đối tượng</label>
                    <select className="w-full border p-2 rounded-md mt-1" value={data.audience || 'group'} onChange={e => setData({...data, audience: e.target.value as any})}>
                        <option value="group">Tập thể</option>
                        <option value="personal">Cá nhân</option>
                        <option value="both">Cả hai</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500">Nguồn dữ liệu</label>
                    <div className="flex gap-2 items-center">
                        <select className="flex-1 border p-2 rounded-md mt-1" value={data.dataSourceId || ''} onChange={e => { setData({...data, dataSourceId: e.target.value }); setColumns([]); }}>
                            <option value="">-- Chọn nguồn --</option>
                            {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                        </select>
                        <button onClick={handleReadData} disabled={isReading || !data.dataSourceId} className="bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-md mt-1 flex items-center gap-1 disabled:opacity-50">
                            {isReading ? <Loader2 className="animate-spin" size={14}/> : <Database size={14}/>} Đọc dữ liệu
                        </button>
                    </div>
                </div>
            </div>
            {columns.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border space-y-3 animate-fade-in">
                    <h4 className="text-xs font-bold text-slate-500">Ánh xạ cột dữ liệu</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <MappingSelect label="Cột Định danh" value={data.mapping?.entityIdCol || ''} onChange={val => handleMappingChange('entityIdCol', val)} />
                        <MappingSelect label="Cột Kế hoạch" value={data.mapping?.targetCol || ''} onChange={val => handleMappingChange('targetCol', val)} />
                        <MappingSelect label="Cột Thực hiện" value={data.mapping?.actualCol || ''} onChange={val => handleMappingChange('actualCol', val)} />
                    </div>
                </div>
            )}
        </Modal>
    );
};

const LibraryKpiSetupTab: React.FC<MobileOpsProps> = ({ libraryKpis, dataSources, onRefresh }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<LibraryKpi> | null>(null);
    const handleSave = async (data: Partial<LibraryKpi>) => {
        const id = data.id || `lkpi_${Date.now()}`;
        if (!data.code || !data.name || !data.unit || !data.audience || !data.dataSourceId) {
            alert("Vui lòng điền đầy đủ thông tin cơ bản của KPI.");
            return;
        }
        await dbClient.upsert('mobile_library_kpis', id, { ...data, id });
        onRefresh(); setIsOpen(false);
    };
    return (
        <AdminSection title="Quản lý Thư viện KPI" onAdd={() => { setEditingItem({ audience: 'group' }); setIsOpen(true); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {libraryKpis.map(kpi => (
                    <div key={kpi.id} className="bg-slate-50 border p-4 rounded-2xl group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{kpi.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{kpi.code} | ĐV: {kpi.unit}</p>
                            </div>
                            <AdminActionButtons onEdit={() => { setEditingItem(kpi); setIsOpen(true); }} onDelete={async () => { if(confirm("Xóa?")) { await dbClient.delete('mobile_library_kpis', kpi.id); onRefresh(); }}} />
                        </div>
                        <div className="text-[10px] font-bold mt-2 pt-2 border-t">
                            <p>Nguồn: <span className="font-mono text-blue-600">{dataSources.find(ds => ds.id === kpi.dataSourceId)?.name || 'N/A'}</span></p>
                            <p>Đối tượng: <span className="font-mono text-blue-600">{kpi.audience === 'group' ? 'Tập thể' : kpi.audience === 'personal' ? 'Cá nhân' : 'Cả hai'}</span></p>
                        </div>
                    </div>
                ))}
            </div>
            {isOpen && <LibraryKpiModal item={editingItem} dataSources={dataSources} onSave={handleSave} onClose={() => setIsOpen(false)} />}
        </AdminSection>
    );
};

const ActionProgramModal: React.FC<{item: Partial<ActionProgram> | null, units: Unit[], onSave: (data: Partial<ActionProgram>) => void, onClose: () => void}> = ({ item, units, onSave, onClose }) => {
    const [data, setData] = useState(item);
    if (!data) return null;

    const handleUnitSelection = (unitId: string, checked: boolean) => {
        const currentIds = data.participatingUnitIds || [];
        const newIds = checked ? [...currentIds, unitId] : currentIds.filter(id => id !== unitId);
        setData({ ...data, participatingUnitIds: newIds });
    };

    return (
        <Modal title="Chương trình hành động" onClose={onClose} onSave={() => onSave(data)}>
            <InputField label="Mã CTHĐ" value={data.code || ''} onChange={val => setData({...data, code: val})} />
            <InputField label="Tên CTHĐ" value={data.name || ''} onChange={val => setData({...data, name: val})} />
            <div>
                <label className="text-xs font-bold text-slate-500">Loại hình đánh giá</label>
                <select className="w-full border p-2 rounded-md mt-1" value={data.evaluationType || 'group'} onChange={e => setData({...data, evaluationType: e.target.value as any})}>
                    <option value="group">Tập thể</option>
                    <option value="personal">Cá nhân</option>
                    <option value="both">Cả hai</option>
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500">Đơn vị tham gia</label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 mt-1 grid grid-cols-2">
                    {units.filter(u => u.level > 0).map(unit => (
                        <label key={unit.id} className="flex items-center gap-2 text-sm p-1">
                            <input type="checkbox" checked={(data.participatingUnitIds || []).includes(unit.id)} onChange={e => handleUnitSelection(unit.id, e.target.checked)} />
                            {unit.name}
                        </label>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

const ActionProgramSetupTab: React.FC<MobileOpsProps> = ({ actionPrograms, units, onRefresh }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ActionProgram> | null>(null);
    const handleSave = async (data: Partial<ActionProgram>) => {
        const id = data.id || `ap_${Date.now()}`;
        if (!data.code || !data.name || !data.evaluationType) {
            alert("Vui lòng điền đầy đủ thông tin.");
            return;
        }
        const payload = { 
            ...data, 
            id, 
            kpiIds: data.kpiIds || [], 
            participatingUnitIds: data.participatingUnitIds || [],
            displayConfig: data.displayConfig || { type: 'graph', graphType: 'bar' }
        };
        await dbClient.upsert('mobile_action_programs', id, payload);
        onRefresh(); setIsOpen(false);
    };
    return (
        <AdminSection title="Quản lý Chương trình hành động" onAdd={() => { setEditingItem({ evaluationType: 'group' }); setIsOpen(true); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actionPrograms.map(ap => (
                    <div key={ap.id} className="bg-slate-50 border p-4 rounded-2xl group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{ap.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{ap.code}</p>
                            </div>
                            <AdminActionButtons onEdit={() => { setEditingItem(ap); setIsOpen(true); }} onDelete={async () => { if(confirm("Xóa?")) { await dbClient.delete('mobile_action_programs', ap.id); onRefresh(); }}} />
                        </div>
                    </div>
                ))}
            </div>
            {isOpen && <ActionProgramModal item={editingItem} units={units} onSave={handleSave} onClose={() => setIsOpen(false)} />}
        </AdminSection>
    );
};

const ConfigureProgramsTab: React.FC<MobileOpsProps> = ({ actionPrograms, libraryKpis, onRefresh }) => {
    const [selectedProgramId, setSelectedProgramId] = useState<string | null>(actionPrograms[0]?.id || null);

    const selectedProgram = useMemo(() => actionPrograms.find(p => p.id === selectedProgramId), [actionPrograms, selectedProgramId]);

    const availableKpis = useMemo(() => {
        if (!selectedProgram) return [];
        const programKpiIds = selectedProgram.kpiIds || [];
        return libraryKpis.filter(kpi => !programKpiIds.includes(kpi.id) && (kpi.audience === selectedProgram.evaluationType || kpi.audience === 'both'));
    }, [libraryKpis, selectedProgram]);
    
    const programKpis = useMemo(() => {
        if (!selectedProgram) return [];
        const programKpiIds = selectedProgram.kpiIds || [];
        return programKpiIds.map(id => libraryKpis.find(kpi => kpi.id === id)).filter(Boolean) as LibraryKpi[];
    }, [libraryKpis, selectedProgram]);

    const handleAddKpi = async (kpiId: string) => {
        if (!selectedProgram) return;
        const currentKpiIds = selectedProgram.kpiIds || [];
        const newKpiIds = [...currentKpiIds, kpiId];
        await dbClient.update('mobile_action_programs', selectedProgram.id, { kpiIds: newKpiIds });
        onRefresh();
    };
    
    const handleRemoveKpi = async (kpiId: string) => {
        if (!selectedProgram) return;
        const currentKpiIds = selectedProgram.kpiIds || [];
        const newKpiIds = currentKpiIds.filter(id => id !== kpiId);
        await dbClient.update('mobile_action_programs', selectedProgram.id, { kpiIds: newKpiIds });
        onRefresh();
    };
    
    const handleDisplayConfigChange = async (field: string, value: string) => {
        if (!selectedProgram) return;
        let newConfig = { ...(selectedProgram.displayConfig || {}), [field]: value };
        if (field === 'type') {
            if (value === 'graph') {
                delete newConfig.tableType;
                newConfig.graphType = 'bar';
            } else {
                delete newConfig.graphType;
                newConfig.tableType = 'normal';
            }
        }
        await dbClient.update('mobile_action_programs', selectedProgram.id, { displayConfig: newConfig });
        onRefresh();
    };

    return (
        <AdminSection title="Cấu hình chỉ tiêu cho Chương trình hành động" onAdd={() => alert("Vui lòng tạo CTHĐ ở tab 'Setup CTHĐ' trước.")}>
            <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-500">1. Chọn CTHĐ</h4>
                    {actionPrograms.map(p => (
                        <button key={p.id} onClick={() => setSelectedProgramId(p.id)} className={`w-full text-left p-3 rounded-lg border text-sm font-bold transition-all ${selectedProgramId === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'}`}>
                            {p.name}
                        </button>
                    ))}
                </div>
                {selectedProgram && (
                    <div className="flex-1 p-6 bg-slate-50 rounded-2xl border space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-500">2. Các KPI đã chọn</h4>
                                <div className="space-y-2 min-h-[100px] bg-white border p-2 rounded-lg">
                                    {programKpis.map(kpi => (
                                        <div key={kpi.id} className="bg-slate-50 p-2 rounded-md border flex items-center justify-between text-xs">
                                            <span className="font-bold">{kpi.name}</span>
                                            <button onClick={() => handleRemoveKpi(kpi.id)} className="p-1 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                    {programKpis.length === 0 && <p className="text-xs italic text-slate-400 p-4 text-center">Kéo KPI từ cột bên phải vào đây.</p>}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-500">3. Thêm KPI từ thư viện</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto bg-white border p-2 rounded-lg">
                                    {availableKpis.map(kpi => (
                                        <div key={kpi.id} className="bg-slate-50 p-2 rounded-md border flex items-center justify-between text-xs">
                                            <span className="font-bold">{kpi.name}</span>
                                            <button onClick={() => handleAddKpi(kpi.id)} className="p-1 text-green-500 hover:bg-green-50 rounded-full"><Plus size={12}/></button>
                                        </div>
                                    ))}
                                    {availableKpis.length === 0 && <p className="text-xs italic text-slate-400 p-4 text-center">Không có KPI phù hợp.</p>}
                                </div>
                            </div>
                        </div>
                        <div className="border-t pt-6 space-y-4">
                            <h4 className="text-xs font-bold text-slate-500">4. Cấu hình hiển thị</h4>
                            <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400">Hình thức</label>
                                    <select className="w-full border p-2 rounded-md mt-1 text-xs" value={selectedProgram.displayConfig?.type || 'graph'} onChange={e => handleDisplayConfigChange('type', e.target.value)}>
                                        <option value="graph">Biểu đồ (Graph)</option>
                                        <option value="table">Bảng (Table)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400">Loại chi tiết</label>
                                    {selectedProgram.displayConfig?.type === 'table' ? (
                                        <select className="w-full border p-2 rounded-md mt-1 text-xs" value={selectedProgram.displayConfig?.tableType || 'normal'} onChange={e => handleDisplayConfigChange('tableType', e.target.value)}>
                                            <option value="normal">Bảng thường</option>
                                            <option value="with_bars">Bảng với thanh tiến trình</option>
                                            <option value="heatmap">Bảng heatmap</option>
                                        </select>
                                    ) : (
                                        <select className="w-full border p-2 rounded-md mt-1 text-xs" value={selectedProgram.displayConfig?.graphType || 'bar'} onChange={e => handleDisplayConfigChange('graphType', e.target.value)}>
                                            <option value="bar">Biểu đồ cột</option>
                                            <option value="pie">Biểu đồ tròn</option>
                                            <option value="line">Biểu đồ đường</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminSection>
    );
};

// ==================================
// == 2. ACTION PROGRAMS VIEW (ALL USERS)
// ==================================
const ActionProgramsView: React.FC<MobileOpsProps> = ({ actionPrograms, libraryKpis, units, importedData, currentUser, dataSources, onRefresh }) => {
    const [selectedProgram, setSelectedProgram] = useState<ActionProgram | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [isSyncing, setIsSyncing] = useState(false);

    const myPrograms = useMemo(() => {
        if (currentUser.username === 'admin') return actionPrograms;
        const myUnitId = currentUser.unitId;
        return actionPrograms.filter(p => (p.participatingUnitIds || []).includes(myUnitId));
    }, [actionPrograms, currentUser]);

    useEffect(() => {
        if (myPrograms.length > 0 && !selectedProgram) {
            setSelectedProgram(myPrograms[0]);
        } else if (myPrograms.length > 0 && selectedProgram && !myPrograms.find(p => p.id === selectedProgram.id)) {
            setSelectedProgram(myPrograms[0]);
        } else if (myPrograms.length === 0) {
            setSelectedProgram(null);
        }
    }, [myPrograms, selectedProgram]);
    
    const handleSyncAllData = async () => {
        setIsSyncing(true);
        let totalSynced = 0;
        try {
            for (const ds of dataSources) {
                if (!ds.url) continue;
                let finalUrl = ds.url.trim();
                if (finalUrl.includes('/edit')) finalUrl = finalUrl.split('/edit')[0] + '/export?format=csv';
                const res = await fetch(finalUrl);
                if (!res.ok) continue;
                const csv = await res.text();
                const wb = XLSX.read(csv, { type: 'string' });
                const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                if (rows.length > 0) {
                    await dbClient.upsert('mobile_imported_data', `${ds.id}_${selectedMonth}`, { data: rows });
                    totalSynced += rows.length;
                }
            }
            alert(`Đồng bộ hoàn tất! ${totalSynced} dòng dữ liệu đã được cập nhật cho tháng ${selectedMonth}.`);
            onRefresh();
        } catch (e) {
            alert("Có lỗi xảy ra trong quá trình đồng bộ.");
        } finally {
            setIsSyncing(false);
        }
    }


    const programData = useMemo(() => {
        if (!selectedProgram || importedData.length === 0 || !selectedProgram.participatingUnitIds) return [];
        const programKpis = libraryKpis.filter(k => (selectedProgram.kpiIds || []).includes(k.id));
        if (programKpis.length === 0) return [];
        
        const unitScores = selectedProgram.participatingUnitIds.map(unitId => {
            const unit = units.find(u => u.id === unitId);
            if (!unit) return { name: 'Unknown', score: 0 };

            let totalPercent = 0;
            let kpiCount = 0;

            programKpis.forEach(kpi => {
                const relevantData = importedData.find(d => d.id === `${kpi.dataSourceId}_${selectedMonth}`);
                if(!relevantData || !kpi.mapping) return;

                const unitDataRow = relevantData.data.find((row: any) => String(row[kpi.mapping!.entityIdCol]) === String(unit.code));
                if(!unitDataRow) return;

                const target = unitDataRow[kpi.mapping.targetCol];
                const actual = unitDataRow[kpi.mapping.actualCol];

                if (target !== undefined && actual !== undefined && Number(target) > 0) {
                    totalPercent += (Number(actual) / Number(target)) * 100;
                    kpiCount++;
                }
            });
            return {
                name: unit?.name || 'Unknown',
                score: kpiCount > 0 ? Math.round(totalPercent / kpiCount) : 0,
            };
        });

        return unitScores.sort((a,b) => b.score - a.score);

    }, [selectedProgram, importedData, libraryKpis, units, selectedMonth]);
    
    return (
        <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/4 space-y-2">
                 {myPrograms.map(p => (
                    <button key={p.id} onClick={() => setSelectedProgram(p)} className={`w-full text-left p-4 rounded-xl border-2 text-sm font-black transition-all ${selectedProgram?.id === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'}`}>
                        {p.name}
                    </button>
                 ))}
                 {myPrograms.length === 0 && <div className="p-4 text-center text-xs italic text-slate-500">Bạn không tham gia CTHĐ nào.</div>}
            </div>
            <div className="flex-1 bg-white rounded-[40px] shadow-sm border p-8 min-h-[400px]">
                {selectedProgram ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <h3 className="font-black text-lg text-slate-800">{selectedProgram.name}</h3>
                            <div className="flex items-center gap-2">
                                <input type="month" className="border-2 rounded-xl px-4 py-2 font-bold text-xs bg-slate-50 outline-none" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                                <button onClick={handleSyncAllData} disabled={isSyncing} className="bg-blue-500 text-white p-2.5 rounded-xl hover:bg-blue-600 disabled:bg-slate-300">
                                    {isSyncing ? <Loader2 className="animate-spin"/> : <RefreshCw />}
                                </button>
                            </div>
                        </div>
                        <div className="h-96">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={programData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                    <XAxis type="number" domain={[0, 'dataMax + 20']} tickFormatter={(v) => `${v}%`} />
                                    <YAxis type="category" dataKey="name" width={150} interval={0} tick={{ fontSize: 10, width: 140 }} />
                                    <Tooltip formatter={(value: number) => `${value ? value.toFixed(2) : 0}%`} />
                                    <Bar dataKey="score" fill="#0068FF" barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">Chọn một chương trình để xem.</div>
                )}
            </div>
        </div>
    );
};


// ==================================
// == 3. REPORTS VIEW (ALL USERS)
// ==================================
const ReportsView: React.FC<MobileOpsProps> = (props) => {
    // ... logic for reports ...
    return (
        <div className="bg-white rounded-[40px] shadow-sm border p-8">
            <div>Báo cáo thống kê (Tính năng đang được phát triển)</div>
        </div>
    );
};

// ==================================
// == HELPER & UI COMPONENTS
// ==================================
const ModuleTabButton: React.FC<{id: string, label: string, icon: React.ReactNode, activeModule: string, setActiveModule: (id: string) => void}> = ({ id, label, icon, activeModule, setActiveModule }) => (
    <button onClick={() => setActiveModule(id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeModule === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        {icon} {label}
    </button>
);

const AdminTab: React.FC<{id: string, label: string, icon: React.ReactNode, activeTab: string, setActiveTab: (id: string) => void}> = ({ id, label, icon, activeTab, setActiveTab }) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-800'}`}>
        {icon} {label}
    </button>
);

const AdminSection: React.FC<{title: string, onAdd: () => void, children: React.ReactNode}> = ({ title, onAdd, children }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">{title}</h3>
            <button onClick={onAdd} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-600"><Plus size={14}/> Thêm mới</button>
        </div>
        <div>{children}</div>
    </div>
);

const AdminActionButtons: React.FC<{onEdit: () => void, onDelete: () => void}> = ({ onEdit, onDelete }) => (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-2 hover:bg-blue-100 text-blue-600 rounded-md"><Edit2 size={14}/></button>
        <button onClick={onDelete} className="p-2 hover:bg-red-100 text-red-500 rounded-md"><Trash2 size={14}/></button>
    </div>
);

const DataSourceModal: React.FC<{item: Partial<DataSource> | null, onSave: (data: Partial<DataSource>) => void, onClose: () => void}> = ({ item, onSave, onClose }) => {
    const [data, setData] = useState(item);
    if (!data) return null;
    return (
        <Modal title="Nguồn dữ liệu" onClose={onClose} onSave={() => onSave(data)}>
            <InputField label="Tên nguồn dữ liệu" value={data.name || ''} onChange={val => setData({...data, name: val})} />
            <InputField label="Link Google Sheet (CSV)" value={data.url || ''} onChange={val => setData({...data, url: val})} />
        </Modal>
    );
};

const Modal: React.FC<{title: string, children: React.ReactNode, onClose: () => void, onSave: () => void}> = ({ title, children, onClose, onSave }) => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">{title}</h3><button onClick={onClose}><X size={20}/></button></div>
            <div className="p-6 space-y-4">{children}</div>
            <div className="p-4 border-t flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-lg text-sm">Hủy</button><button onClick={onSave} className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white">Lưu</button></div>
        </div>
    </div>
);

const InputField: React.FC<{label: string, value: string, onChange: (val: string) => void}> = ({ label, value, onChange }) => (
    <div>
        <label className="text-xs font-bold text-slate-500">{label}</label>
        <input className="w-full border p-2 rounded-md mt-1" value={value} onChange={e => onChange(e.target.value)} />
    </div>
);

const AccessDenied = () => (
    <div className="text-center p-10 bg-red-50 border border-red-200 rounded-2xl">
        <h3 className="font-bold text-red-600">Truy cập bị từ chối</h3>
        <p className="text-sm text-slate-600">Bạn không có quyền truy cập vào module này.</p>
    </div>
);

export default MobileOpsDashboard;
