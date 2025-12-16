
import React, { useState, useEffect, useRef } from 'react';
import { User, Unit, KPIData, KPI_KEYS, KPIKey } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, FileUp, Filter, AlertOctagon, FileSpreadsheet, ClipboardPaste, Save, RefreshCw, Settings, Link, Check, Database, ArrowRightLeft, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { loadData, saveData } from '../utils/mockData';

interface KPIProps {
  users: User[];
  units: Unit[];
}

interface DataSourceConfig {
    url: string;
    lastSync: string;
    mapping: { [key: string]: string }; // System Field -> Sheet Header Name
}

// Generate random KPI data for demo fallback
const generateKPI = (users: User[]): KPIData[] => {
    return users.map(u => {
        const targets: any = {};
        Object.keys(KPI_KEYS).forEach(key => {
            const target = Math.floor(Math.random() * 50) + 50;
            const actual = Math.floor(Math.random() * target * 1.2); 
            targets[key] = { target, actual };
        });
        return {
            hrmCode: u.hrmCode,
            fullName: u.fullName,
            unitId: u.unitId,
            targets
        };
    });
};

const KPI: React.FC<KPIProps> = ({ users, units }) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'eval' | 'config'>('eval'); 
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterKey, setFilterKey] = useState<KPIKey>('fiber');
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  
  // State for KPI Data
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Google Sheet Config
  const [dsConfig, setDsConfig] = useState<DataSourceConfig>({ url: '', lastSync: '', mapping: {} });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Define System Fields needing mapping
  const systemFields = [
      { key: 'HRM_CODE', label: 'Mã nhân viên (HRM)', required: true },
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k}_TARGET`, label: `[${k.toUpperCase()}] Chỉ tiêu`, required: false })),
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k}_ACTUAL`, label: `[${k.toUpperCase()}] Thực hiện`, required: false })),
  ];

  // Initialize data
  useEffect(() => {
    const savedData = loadData<KPIData[]>('kpi_data', []);
    if (savedData.length > 0) {
        setKpiData(savedData);
    } else {
        const initial = generateKPI(users);
        setKpiData(initial);
        saveData('kpi_data', initial);
    }

    const savedConfig = loadData<DataSourceConfig>('kpi_config', { url: '', lastSync: '', mapping: {} });
    setDsConfig(savedConfig);
  }, [users]);

  // Save whenever data changes
  useEffect(() => {
      if (kpiData.length > 0) saveData('kpi_data', kpiData);
  }, [kpiData]);

  useEffect(() => {
      saveData('kpi_config', dsConfig);
  }, [dsConfig]);


  // --- GOOGLE SHEET LOGIC ---

  const fetchCSV = async (url: string): Promise<any[]> => {
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Network response was not ok");
          const csvText = await response.text();
          const wb = XLSX.read(csvText, { type: 'string' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          return XLSX.utils.sheet_to_json(ws);
      } catch (error) {
          console.error(error);
          throw error;
      }
  };

  const checkConnection = async () => {
      if (!dsConfig.url) return alert("Vui lòng nhập đường dẫn CSV Google Sheet");
      setIsCheckingLink(true);
      try {
          const data = await fetchCSV(dsConfig.url);
          if (data.length > 0) {
              const headers = Object.keys(data[0]);
              setSheetHeaders(headers);
              alert(`Kết nối thành công! Tìm thấy ${headers.length} cột dữ liệu.`);
          } else {
              alert("Kết nối thành công nhưng file không có dữ liệu.");
          }
      } catch (e) {
          alert("Không thể đọc file. Vui lòng kiểm tra lại đường dẫn (Phải là link 'Publish to web' định dạng CSV).");
      } finally {
          setIsCheckingLink(false);
      }
  };

  const handleSyncData = async () => {
      if (!dsConfig.url) return alert("Chưa cấu hình đường dẫn dữ liệu.");
      setIsSyncing(true);
      try {
          const rawData = await fetchCSV(dsConfig.url);
          
          // Transform Data using Mapping
          const transformedData = rawData.map((row: any) => {
              const newRow: any = {};
              // Reverse look up from mapping: SystemKey -> SheetHeader
              Object.entries(dsConfig.mapping).forEach(([sysKey, sheetHeader]) => {
                  if (sheetHeader && row[sheetHeader] !== undefined) {
                      newRow[sysKey] = row[sheetHeader];
                  }
              });
              return newRow;
          });

          // Reuse the process logic
          processImportData(transformedData, false); // False to suppress alert
          
          setDsConfig(prev => ({ ...prev, lastSync: new Date().toLocaleString() }));
          alert("Đồng bộ dữ liệu thành công!");
          setActiveTab('eval');
      } catch (e) {
          alert("Lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra kết nối.");
      } finally {
          setIsSyncing(false);
      }
  };

  const updateMapping = (sysKey: string, sheetHeader: string) => {
      setDsConfig(prev => ({
          ...prev,
          mapping: { ...prev.mapping, [sysKey]: sheetHeader }
      }));
  };

  // --- EXISTING LOGIC ---

  const filteredData = kpiData.filter(item => {
      if (filterUnit !== 'all') {
          const unit = units.find(u => u.id === item.unitId);
          if (item.unitId !== filterUnit && unit?.parentId !== filterUnit) return false;
      }
      return true;
  });

  const top5 = filteredData.map(item => {
      const t = item.targets[filterKey] || { target: 0, actual: 0 };
      const percent = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return { ...item, percent: Math.round(percent), actual: t.actual, target: t.target };
  }).sort((a, b) => b.percent - a.percent).slice(0, 5);

  const bottom5 = filteredData.map(item => {
      const t = item.targets[filterKey] || { target: 0, actual: 0 };
      const percent = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return { ...item, percent: Math.round(percent), actual: t.actual, target: t.target };
  }).sort((a, b) => a.percent - b.percent).slice(0, 5);

  const handleDownloadTemplate = () => {
    const headers = ['HRM_CODE', 'HO_TEN', ...Object.keys(KPI_KEYS).map(k => `${k}_TARGET`), ...Object.keys(KPI_KEYS).map(k => `${k}_ACTUAL`)];
    const data = users.map(u => {
        const row: any = { HRM_CODE: u.hrmCode, HO_TEN: u.fullName };
        Object.keys(KPI_KEYS).forEach(k => { row[`${k}_TARGET`] = 0; row[`${k}_ACTUAL`] = 0; });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI_Template");
    XLSX.writeFile(wb, "VNPT_KPI_Template.xlsx");
  };

  const processImportData = (jsonData: any[], showAlert = true) => {
      if (!jsonData || jsonData.length === 0) return;
      const newKpiData = [...kpiData];
      let matchCount = 0;

      jsonData.forEach((row: any) => {
          const normalizedRow: any = {};
          // Normalize input keys to uppercase to match System Keys
          Object.keys(row).forEach(k => normalizedRow[k.toUpperCase()] = row[k]);
          // Also try direct mapping if mapped keys are used
          Object.keys(row).forEach(k => normalizedRow[k] = row[k]);

          // Priority: Mapped HRM_CODE -> Normalized HRM_CODE -> row HRM_CODE
          const hrmCode = normalizedRow['HRM_CODE']; 
          if (!hrmCode) return;

          const userIndex = newKpiData.findIndex(k => k.hrmCode === String(hrmCode));
          const user = users.find(u => u.hrmCode === String(hrmCode));
          
          if (user) {
              matchCount++;
              const targets: any = userIndex >= 0 ? { ...newKpiData[userIndex].targets } : {};
              Object.keys(KPI_KEYS).forEach(key => {
                  const targetKey = `${key}_TARGET`.toUpperCase();
                  const actualKey = `${key}_ACTUAL`.toUpperCase();
                  
                  // Logic: Try to find data using exact keys provided in jsonData
                  // (which might have been mapped from handleSyncData)
                  if (normalizedRow[targetKey] !== undefined) {
                       if (!targets[key]) targets[key] = { target: 0, actual: 0 };
                       targets[key].target = Number(normalizedRow[targetKey]) || 0;
                  }
                  if (normalizedRow[actualKey] !== undefined) {
                       if (!targets[key]) targets[key] = { target: 0, actual: 0 };
                       targets[key].actual = Number(normalizedRow[actualKey]) || 0;
                  }
              });
              const record: KPIData = { hrmCode: user.hrmCode, fullName: user.fullName, unitId: user.unitId, targets: targets };
              if (userIndex >= 0) newKpiData[userIndex] = record;
              else newKpiData.push(record);
          }
      });
      setKpiData(newKpiData);
      if (showAlert) {
          alert(`Đã cập nhật dữ liệu thành công cho ${matchCount} nhân sự.`);
          setActiveTab('eval');
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          processImportData(data);
      };
      reader.readAsBinaryString(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteData = () => {
     const rows = pasteContent.trim().split('\n');
     if (rows.length < 2) return alert("Dữ liệu không hợp lệ.");
     const headers = rows[0].split('\t').map(h => h.trim());
     const result = [];
     for (let i = 1; i < rows.length; i++) {
         const obj: any = {};
         const currentline = rows[i].split('\t');
         headers.forEach((header, index) => obj[header] = currentline[index]?.trim());
         result.push(obj);
     }
     processImportData(result);
     setPasteModalOpen(false);
     setPasteContent('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Bộ chỉ số điều hành</h2>
            <p className="text-sm text-slate-500">Giao kế hoạch và đánh giá BSC/KPI nhân viên</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setActiveTab('eval')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('plan')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Nhập liệu (Excel)</button>
            <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Cấu hình (Google Sheet)</button>
          </div>
       </div>

       {/* --- CONFIG TAB --- */}
       {activeTab === 'config' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Database className="text-blue-600"/> Liên kết Google Sheet</h3>
                   
                   <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800">
                       <p className="font-bold mb-2">Hướng dẫn tạo link:</p>
                       <ol className="list-decimal pl-5 space-y-1">
                           <li>Mở file Google Sheet chứa dữ liệu KPI.</li>
                           <li>Chọn <strong>File (Tệp)</strong> &gt; <strong>Share (Chia sẻ)</strong> &gt; <strong>Publish to web (Công bố lên web)</strong>.</li>
                           <li>Trong hộp thoại, chọn Sheet cần lấy và chọn định dạng <strong>Comma-separated values (.csv)</strong>.</li>
                           <li>Nhấn Publish và copy đường link sinh ra dán vào bên dưới.</li>
                       </ol>
                   </div>

                   <div className="flex gap-4 items-end mb-4">
                       <div className="flex-1">
                           <label className="block text-sm font-bold text-slate-700 mb-1">Đường dẫn CSV (Publish to web)</label>
                           <div className="flex gap-2">
                               <div className="relative flex-1">
                                   <Link className="absolute left-3 top-3 text-slate-400" size={18} />
                                   <input 
                                       type="text" 
                                       className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                       placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                                       value={dsConfig.url}
                                       onChange={e => setDsConfig({...dsConfig, url: e.target.value})}
                                   />
                               </div>
                               <button 
                                   onClick={checkConnection}
                                   disabled={isCheckingLink}
                                   className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2 whitespace-nowrap"
                               >
                                   {isCheckingLink ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>}
                                   Kiểm tra kết nối
                               </button>
                           </div>
                       </div>
                   </div>

                   {dsConfig.lastSync && (
                       <div className="text-xs text-slate-500 italic mb-4">
                           Đồng bộ lần cuối: {dsConfig.lastSync}
                       </div>
                   )}
               </div>

               {/* MAPPING SECTION */}
               <div className="p-6 bg-slate-50">
                   <div className="flex justify-between items-center mb-4">
                       <h4 className="font-bold text-slate-700 flex items-center gap-2"><ArrowRightLeft size={18} /> Ánh xạ dữ liệu (Mapping)</h4>
                       {sheetHeaders.length > 0 && (
                           <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Đã tìm thấy {sheetHeaders.length} cột từ Google Sheet</span>
                       )}
                   </div>
                   
                   {sheetHeaders.length === 0 ? (
                       <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-lg">
                           Vui lòng nhập Link và nhấn "Kiểm tra kết nối" để tải danh sách cột.
                       </div>
                   ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                           {systemFields.map((field) => (
                               <div key={field.key} className="flex items-center gap-4 bg-white p-3 rounded border border-slate-200">
                                   <div className="w-1/2">
                                       <div className="text-sm font-bold text-slate-700">{field.label}</div>
                                       <div className="text-xs text-slate-400 font-mono">{field.key}</div>
                                   </div>
                                   <div className="text-slate-400"><ArrowRightLeft size={16}/></div>
                                   <div className="w-1/2">
                                       <select 
                                           className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500"
                                           value={dsConfig.mapping[field.key] || ''}
                                           onChange={(e) => updateMapping(field.key, e.target.value)}
                                       >
                                           <option value="">-- Chọn cột --</option>
                                           {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                       </select>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
               </div>
               
               <div className="p-4 border-t bg-white flex justify-end">
                   <button 
                       onClick={handleSyncData}
                       disabled={isSyncing || sheetHeaders.length === 0}
                       className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       {isSyncing ? <RefreshCw className="animate-spin" size={20}/> : <RefreshCw size={20}/>}
                       Lưu cấu hình & Đồng bộ ngay
                   </button>
               </div>
           </div>
       )}

       {activeTab === 'plan' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Left: Actions */}
             <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><FileUp size={32} /></div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Nhập dữ liệu KPI (Excel)</h3>
                  <p className="text-slate-500 mb-6 max-w-sm">Hỗ trợ file Excel (.xlsx) hoặc copy trực tiếp từ Google Sheet. Yêu cầu trường khóa là <strong>HRM_CODE</strong>.</p>
                  
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          accept=".xlsx, .xls" 
                      />
                      
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                      >
                          <FileSpreadsheet size={20} /> Chọn File Excel
                      </button>

                      <button 
                        onClick={() => setPasteModalOpen(true)}
                        className="bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
                      >
                          <ClipboardPaste size={20} /> Paste từ Google Sheet
                      </button>

                      <div className="my-2 border-t w-full"></div>

                      <button 
                        onClick={handleDownloadTemplate}
                        className="text-slate-500 hover:text-blue-600 text-sm flex items-center justify-center gap-2"
                      >
                          <Download size={16} /> Tải file mẫu chuẩn
                      </button>
                  </div>
             </div>

             {/* Right: Guide */}
             <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
                <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><AlertOctagon size={20} className="text-orange-500"/> Hướng dẫn định dạng</h4>
                <ul className="space-y-3 text-sm text-slate-600 list-disc pl-5">
                    <li>Dòng đầu tiên của file phải là dòng tiêu đề (Header).</li>
                    <li>Bắt buộc có cột <strong>HRM_CODE</strong> để định danh nhân viên.</li>
                    <li>Với mỗi chỉ số (Ví dụ: Fiber), cần 2 cột tương ứng:
                        <ul className="list-circle pl-5 mt-1 text-slate-500">
                            <li><code>FIBER_TARGET</code> (Chỉ tiêu giao)</li>
                            <li><code>FIBER_ACTUAL</code> (Thực hiện được)</li>
                        </ul>
                    </li>
                    <li>Các mã chỉ số hỗ trợ:
                        <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs bg-white p-2 rounded border">
                           {Object.keys(KPI_KEYS).map(k => <div key={k}><span className="font-bold">{k.toUpperCase()}</span>_TARGET</div>)}
                        </div>
                    </li>
                </ul>
             </div>
         </div>
       )}

       {activeTab === 'eval' && (
         <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center justify-between">
               <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold"><Filter size={16} /> Lọc:</div>
                    <select className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                        <option value="all">-- Tất cả đơn vị --</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium outline-none focus:ring-2 focus:ring-blue-500" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="text-sm text-slate-500 italic">
                   {dsConfig.lastSync ? `Đồng bộ Google Sheet: ${dsConfig.lastSync}` : 'Dữ liệu được lưu tự động'}
               </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                 <h3 className="font-bold text-lg mb-4 text-green-700">Top 5 Nhân viên Xuất sắc</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={top5} layout="vertical" margin={{left: 40}}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                       <XAxis type="number" hide />
                       <YAxis dataKey="fullName" type="category" width={100} tick={{fontSize: 11}} />
                       <Tooltip cursor={{fill: '#f0fdf4'}} formatter={(value: number) => [`${value}%`, 'Hoàn thành']} />
                       <Bar dataKey="percent" fill="#22c55e" barSize={20} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#666', fontSize: 10, formatter: (val: number) => `${val}%` }} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2"><AlertOctagon size={20}/> Top 5 Cần cố gắng</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bottom5} layout="vertical" margin={{left: 40}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="fullName" type="category" width={100} tick={{fontSize: 11}} />
                        <Tooltip cursor={{fill: '#fef2f2'}} formatter={(value: number) => [`${value}%`, 'Hoàn thành']} />
                        <Bar dataKey="percent" fill="#ef4444" barSize={20} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#666', fontSize: 10, formatter: (val: number) => `${val}%` }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800">Chi tiết số liệu: {KPI_KEYS[filterKey]}</h3>
                   <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">Key: {filterKey}</span>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold">
                     <tr>
                       <th className="p-3">Nhân viên</th>
                       <th className="p-3">Đơn vị</th>
                       <th className="p-3 text-right">Kế hoạch (Target)</th>
                       <th className="p-3 text-right">Thực hiện (Actual)</th>
                       <th className="p-3 text-center">% Hoàn thành</th>
                       <th className="p-3 text-center">Đánh giá</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredData.length > 0 ? filteredData.map((item, index) => {
                         const targetData = item.targets[filterKey] || { target: 0, actual: 0 };
                         const percent = targetData.target ? (targetData.actual / targetData.target) * 100 : 0;
                         const unitName = units.find(u => u.id === item.unitId)?.name;
                         return (
                           <tr key={index} className="hover:bg-slate-50">
                             <td className="p-3">
                                 <div className="font-medium text-slate-800">{item.fullName}</div>
                                 <div className="text-xs text-slate-400">{item.hrmCode}</div>
                             </td>
                             <td className="p-3 text-slate-500 text-xs">{unitName}</td>
                             <td className="p-3 text-right font-mono">{targetData.target.toLocaleString()}</td>
                             <td className="p-3 text-right font-mono font-bold text-blue-700">{targetData.actual.toLocaleString()}</td>
                             <td className="p-3 text-center">
                                 <span className={`px-2 py-1 rounded text-xs font-bold text-white inline-block w-16 ${percent >= 100 ? 'bg-green-500' : percent >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {percent.toFixed(1)}%
                                 </span>
                             </td>
                             <td className="p-3 text-center text-xs font-medium">
                                 {percent >= 100 ? <span className="text-green-600">Đạt</span> : <span className="text-red-500">Chưa đạt</span>}
                             </td>
                           </tr>
                         )
                     }) : (
                         <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu phù hợp. Hãy Import file Excel hoặc kiểm tra bộ lọc.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
       )}

       {/* Paste Data Modal */}
       {pasteModalOpen && (
           <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                       <h3 className="font-bold text-lg">Paste dữ liệu từ Excel/Google Sheet</h3>
                       <button onClick={() => setPasteModalOpen(false)}><span className="text-2xl">&times;</span></button>
                   </div>
                   <div className="p-4">
                       <p className="text-sm text-slate-500 mb-2">Copy vùng dữ liệu từ Google Sheet (bao gồm cả dòng tiêu đề) và dán vào bên dưới:</p>
                       <textarea 
                           className="w-full h-64 border rounded-lg p-3 font-mono text-xs bg-slate-50"
                           placeholder={`HRM_CODE\tFIBER_TARGET\tFIBER_ACTUAL\nVNPT001\t50\t45\n...`}
                           value={pasteContent}
                           onChange={e => setPasteContent(e.target.value)}
                       ></textarea>
                   </div>
                   <div className="p-4 border-t flex justify-end gap-3">
                       <button onClick={() => setPasteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Hủy bỏ</button>
                       <button onClick={handlePasteData} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                           <Save size={18} /> Xử lý dữ liệu
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KPI;
