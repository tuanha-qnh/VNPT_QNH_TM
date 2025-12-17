
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Unit, KPIData, GroupKPIData, KPI_KEYS, KPIKey, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, FileUp, Filter, AlertOctagon, FileSpreadsheet, ClipboardPaste, Save, RefreshCw, Link, Check, Database, ArrowRightLeft, Users, Settings as SettingsIcon, Trash2, Edit, X, Clock, PlayCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { loadData, saveData } from '../utils/mockData';

interface KPIProps {
  users: User[];
  units: Unit[];
  currentUser: User;
  mode: 'personal' | 'group'; // NEW: Mode prop
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
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // State for KPI Data - KHỞI TẠO RỖNG, KHÔNG MOCK DATA
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Google Sheet Config
  const [dsConfig, setDsConfig] = useState<DataSourceConfig>({ url: '', lastSync: '', autoSync: true, mapping: {} });
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [isCheckingLink, setIsCheckingLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Permission Logic
  const isAdmin = currentUser.hrmCode === 'ADMIN';
  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].some(r => currentUser.title.includes(r));
  const canViewGroup = isAdmin || isLeader;

  // Key Identifier based on mode
  const ID_KEY = mode === 'personal' ? 'HRM_CODE' : 'UNIT_CODE';
  const ID_LABEL = mode === 'personal' ? 'Mã nhân viên (HRM)' : 'Mã đơn vị';
  const DATA_STORAGE_KEY = mode === 'personal' ? 'kpi_data' : 'kpi_group_data';
  const CONFIG_STORAGE_KEY = mode === 'personal' ? 'kpi_config' : 'kpi_group_config';

  // Define System Fields needing mapping
  const systemFields = [
      { key: ID_KEY, label: ID_LABEL, required: true },
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k.toUpperCase()}_TARGET`, label: `[${k.toUpperCase()}] Chỉ tiêu`, required: false })),
      ...Object.keys(KPI_KEYS).map(k => ({ key: `${k.toUpperCase()}_ACTUAL`, label: `[${k.toUpperCase()}] Thực hiện`, required: false })),
  ];

  // --- 1. AGGREGATION LOGIC (TỔNG HỢP SỐ LIỆU ĐƠN VỊ CHA) ---
  const calculateAggregations = useCallback((data: any[]) => {
      // Chỉ áp dụng tính tổng cho mode Group (Tập thể)
      if (mode !== 'group') return data;

      // Deep copy để tránh mutation
      let currentData = [...data];
      
      // Lấy danh sách các đơn vị cha (Level 0 - VNPT Quảng Ninh)
      const rootUnits = units.filter(u => u.parentId === null);

      rootUnits.forEach(root => {
          // Tìm tất cả đơn vị con cháu (Descendants) của Root này
          // Hàm đệ quy lấy ID con
          const getDescendantIds = (parentId: string): string[] => {
              const children = units.filter(u => u.parentId === parentId);
              let ids = children.map(c => c.id);
              children.forEach(c => {
                  ids = [...ids, ...getDescendantIds(c.id)];
              });
              return ids;
          };

          const descendantIds = getDescendantIds(root.id);
          const descendantCodes = units.filter(u => descendantIds.includes(u.id)).map(u => u.code);

          // Khởi tạo biến tổng
          const totals: any = {};
          Object.keys(KPI_KEYS).forEach(key => totals[key] = { target: 0, actual: 0 });

          // Duyệt qua dữ liệu hiện tại, nếu item thuộc con cháu thì cộng dồn
          currentData.forEach(record => {
              if (descendantCodes.includes(record.unitCode)) {
                  Object.keys(KPI_KEYS).forEach(key => {
                      const t = record.targets[key] || { target: 0, actual: 0 };
                      totals[key].target += (t.target || 0);
                      totals[key].actual += (t.actual || 0);
                  });
              }
          });

          // Tạo hoặc cập nhật record cho Đơn vị cha
          const rootRecordIndex = currentData.findIndex(r => r.unitCode === root.code);
          const rootRecord = {
              unitCode: root.code,
              unitName: root.name,
              targets: totals
          };

          if (rootRecordIndex >= 0) {
              currentData[rootRecordIndex] = rootRecord;
          } else {
              currentData.push(rootRecord);
          }
      });

      return currentData;
  }, [units, mode]);

  // --- 2. LOAD DATA & CONFIG ---
  useEffect(() => {
    if (mode === 'group' && !canViewGroup) {
        setIsDataLoaded(true);
        return;
    }

    const storedData = localStorage.getItem(DATA_STORAGE_KEY);
    if (storedData) {
        try {
            const parsed = JSON.parse(storedData);
            setKpiData(parsed);
        } catch (e) {
            console.error("Error parsing KPI data", e);
            setKpiData([]); // Dữ liệu lỗi thì reset về rỗng
        }
    } else {
        setKpiData([]); // Mặc định rỗng, KHÔNG tạo mock data
    }
    
    const savedConfig = loadData<DataSourceConfig>(CONFIG_STORAGE_KEY, { url: '', lastSync: '', autoSync: true, mapping: {} });
    setDsConfig(savedConfig);
    
    setIsDataLoaded(true);
  }, [mode, users, units]);

  // --- 3. PERSIST DATA ---
  useEffect(() => {
      if (isDataLoaded) {
          saveData(DATA_STORAGE_KEY, kpiData);
      }
  }, [kpiData, isDataLoaded, DATA_STORAGE_KEY]);

  useEffect(() => {
      if (isDataLoaded) {
          saveData(CONFIG_STORAGE_KEY, dsConfig);
      }
  }, [dsConfig, isDataLoaded, CONFIG_STORAGE_KEY]);


  // --- 4. GOOGLE SHEET & AUTO SYNC LOGIC ---

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

  const handleSyncData = useCallback(async (isManual = false) => {
      if (!dsConfig.url) {
          if (isManual) alert("Chưa cấu hình đường dẫn dữ liệu.");
          return;
      }
      
      setIsSyncing(true);
      try {
          const rawData = await fetchCSV(dsConfig.url);
          // Sử dụng mapping mới nhất từ state hoặc từ tham số nếu cần thiết
          // Ở đây dùng dsConfig.mapping
          
          if (Object.keys(dsConfig.mapping).length === 0) {
              if (isManual) alert("Chưa cấu hình Mapping dữ liệu.");
              return;
          }

          const transformedData = rawData.map((row: any) => {
              const newRow: any = {};
              Object.entries(dsConfig.mapping).forEach(([sysKey, sheetHeader]) => {
                  const headerKey = sheetHeader as string;
                  if (headerKey && row[headerKey] !== undefined) {
                      newRow[sysKey] = row[headerKey];
                  }
              });
              return newRow;
          });

          processImportData(transformedData, isManual);
          
          setDsConfig(prev => ({ ...prev, lastSync: new Date().toLocaleString() }));
      } catch (e) {
          console.error("Sync Error", e);
          if (isManual) alert("Lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra kết nối.");
      } finally {
          setIsSyncing(false);
      }
  }, [dsConfig.url, dsConfig.mapping]);

  // --- AUTOMATIC SYNC INTERVAL (10 MINUTES) ---
  useEffect(() => {
      if (!dsConfig.url || !dsConfig.autoSync || !isDataLoaded) return;

      console.log(`[KPI ${mode}] Đăng ký tự động đồng bộ mỗi 10 phút...`);
      const intervalId = setInterval(() => {
          console.log(`[KPI ${mode}] Tự động đồng bộ kích hoạt lúc ${new Date().toLocaleTimeString()}`);
          handleSyncData(false);
      }, 600000); // 600,000 ms = 10 phút

      return () => clearInterval(intervalId);
  }, [dsConfig.url, dsConfig.autoSync, isDataLoaded, handleSyncData, mode]);


  // Check connection & Get Headers
  const checkConnection = async () => {
      if (!dsConfig.url) return alert("Vui lòng nhập đường dẫn CSV Google Sheet");
      setIsCheckingLink(true);
      try {
          const data = await fetchCSV(dsConfig.url);
          if (data.length > 0) {
              const headers = Object.keys(data[0]);
              setSheetHeaders(headers);
              setPreviewData(data.slice(0, 5)); // Lưu 5 dòng đầu để preview
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

  const updateMapping = (sysKey: string, sheetHeader: string) => {
      setDsConfig(prev => ({
          ...prev,
          mapping: { ...prev.mapping, [sysKey]: sheetHeader }
      }));
  };

  // --- PROCESSING IMPORT DATA ---

  const processImportData = (jsonData: any[], showAlert = true) => {
      if (!jsonData || jsonData.length === 0) return;
      
      // 1. Convert imported JSON to System KPI Format
      let processedList: any[] = [];
      
      // Nếu là append: let processedList = [...kpiData];
      // Nếu là replace (đồng bộ): let processedList = [];
      // Ở đây ta dùng chiến thuật: Merge vào list cũ hoặc tạo list mới. 
      // Với đồng bộ tự động, tốt nhất là cập nhật trên list hiện có để giữ các record không có trong file sync (nếu có).
      // TUY NHIÊN: Yêu cầu là "Đồng bộ", nên dữ liệu từ Sheet là nguồn chuẩn (Single Source of Truth) cho các items đó.
      
      let newList = [...kpiData];

      jsonData.forEach((row: any) => {
          const normalizedRow: any = {};
          // Chuyển key về uppercase để match systemFields nếu cần, nhưng mapping đã handle việc gán đúng key.
          Object.keys(row).forEach(k => normalizedRow[k] = row[k]);
          
          const idValue = normalizedRow[ID_KEY]; 
          if (!idValue) return;

          let targetIndex = -1;
          let entityName = '';
          let entityUnitId = ''; // Only for personal

          if (mode === 'personal') {
              targetIndex = newList.findIndex(k => k.hrmCode === String(idValue));
              const user = users.find(u => u.hrmCode === String(idValue));
              if (user) {
                  entityName = user.fullName;
                  entityUnitId = user.unitId;
              } else {
                  // Nếu không tìm thấy user trong hệ thống, vẫn import nhưng lấy tên tạm hoặc bỏ qua
                  // Ở đây ta bỏ qua để đảm bảo tính toàn vẹn
                  return; 
              }
          } else {
               targetIndex = newList.findIndex(k => k.unitCode === String(idValue));
               const unit = units.find(u => u.code === String(idValue));
               if (unit) {
                   entityName = unit.name;
               } else return;
          }

          // Merge targets
          const targets: any = targetIndex >= 0 ? { ...newList[targetIndex].targets } : {};
          Object.keys(KPI_KEYS).forEach(key => {
              const targetKey = `${key.toUpperCase()}_TARGET`;
              const actualKey = `${key.toUpperCase()}_ACTUAL`;
              
              if (normalizedRow[targetKey] !== undefined) {
                   if (!targets[key]) targets[key] = { target: 0, actual: 0 };
                   targets[key].target = Number(normalizedRow[targetKey]) || 0;
              }
              if (normalizedRow[actualKey] !== undefined) {
                   if (!targets[key]) targets[key] = { target: 0, actual: 0 };
                   targets[key].actual = Number(normalizedRow[actualKey]) || 0;
              }
          });

          let record: any;
          if (mode === 'personal') {
               record = { hrmCode: String(idValue), fullName: entityName, unitId: entityUnitId, targets: targets };
          } else {
               record = { unitCode: String(idValue), unitName: entityName, targets: targets };
          }

          if (targetIndex >= 0) newList[targetIndex] = record;
          else newList.push(record);
      });

      // 2. Perform Aggregation (Cộng dồn lên đơn vị cha)
      const aggregatedList = calculateAggregations(newList);
      
      setKpiData(aggregatedList);
      
      if (showAlert) {
          alert(`Đã cập nhật dữ liệu thành công! (Tổng số: ${aggregatedList.length} bản ghi)`);
          setActiveTab('eval');
      }
  };

  const handleDownloadTemplate = () => {
    const headers = [ID_KEY, mode === 'personal' ? 'HO_TEN' : 'TEN_DON_VI', ...Object.keys(KPI_KEYS).map(k => `${k.toUpperCase()}_TARGET`), ...Object.keys(KPI_KEYS).map(k => `${k.toUpperCase()}_ACTUAL`)];
    
    let data = [];
    if (mode === 'personal') {
        data = users.map(u => {
            const row: any = { [ID_KEY]: u.hrmCode, HO_TEN: u.fullName };
            Object.keys(KPI_KEYS).forEach(k => { row[`${k.toUpperCase()}_TARGET`] = 0; row[`${k.toUpperCase()}_ACTUAL`] = 0; });
            return row;
        });
    } else {
        data = units.map(u => {
            const row: any = { [ID_KEY]: u.code, TEN_DON_VI: u.name };
            Object.keys(KPI_KEYS).forEach(k => { row[`${k.toUpperCase()}_TARGET`] = 0; row[`${k.toUpperCase()}_ACTUAL`] = 0; });
            return row;
        });
    }

    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI_Template");
    XLSX.writeFile(wb, `VNPT_KPI_${mode}.xlsx`);
  };

  const filteredData = kpiData.filter(item => {
      // Group mode always shows all units for leaders
      if (mode === 'group') return true;

      // Personal mode: Filter by unit
      if (filterUnit !== 'all') {
          const unit = units.find(u => u.id === item.unitId);
          if (item.unitId !== filterUnit && unit?.parentId !== filterUnit) return false;
      }
      return true;
  });

  const getChartData = (data: any[]) => {
      return data.map(item => {
          const t = item.targets?.[filterKey] || { target: 0, actual: 0 };
          const percent = t.target > 0 ? (t.actual / t.target) * 100 : 0;
          return { 
              name: mode === 'personal' ? item.fullName : item.unitName,
              percent: Math.round(percent), 
              actual: t.actual, 
              target: t.target 
          };
      }).sort((a, b) => b.percent - a.percent);
  };

  const chartData = getChartData(filteredData);
  const top5 = chartData.slice(0, 5);
  const bottom5 = [...chartData].sort((a, b) => a.percent - b.percent).slice(0, 5);

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

  // --- ADMIN MANAGEMENT LOGIC ---
  const handleDeleteItem = (index: number) => {
      if (!confirm("Bạn có chắc chắn muốn xóa bộ chỉ số này không?")) return;
      const newData = [...kpiData];
      newData.splice(index, 1);
      // Recalculate Aggregation after delete
      const aggData = calculateAggregations(newData);
      setKpiData(aggData);
  };

  const openEditModal = (item: any) => {
      setEditingItem(JSON.parse(JSON.stringify(item))); // Deep copy
      setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
      if (!editingItem) return;
      let newData = kpiData.map(item => {
          const itemId = mode === 'personal' ? item.hrmCode : item.unitCode;
          const editId = mode === 'personal' ? editingItem.hrmCode : editingItem.unitCode;
          return itemId === editId ? editingItem : item;
      });
      
      // Recalculate aggregation after manual edit
      newData = calculateAggregations(newData);

      setKpiData(newData);
      setIsEditModalOpen(false);
      setEditingItem(null);
  };

  const updateEditingTarget = (key: string, field: 'target' | 'actual', value: string) => {
      setEditingItem((prev: any) => ({
          ...prev,
          targets: {
              ...prev.targets,
              [key]: {
                  ...prev.targets[key],
                  [field]: Number(value)
              }
          }
      }));
  };

  // Guard: Check permission for group mode
  if (mode === 'group' && !canViewGroup) {
      return (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm">
              <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4"><Users size={32} /></div>
              <h3 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h3>
              <p className="text-slate-500">Chỉ Giám đốc, PGĐ, Trưởng/Phó phòng mới được xem KPI Tập thể toàn tỉnh.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {mode === 'group' ? <Users className="text-blue-600"/> : <ArrowRightLeft className="text-green-600"/>}
                {mode === 'group' ? 'KPI Tập thể (Đơn vị)' : 'KPI Cá nhân (Nhân viên)'}
            </h2>
            <p className="text-sm text-slate-500">
                {mode === 'group' ? 'Theo dõi chỉ số điều hành của các đơn vị toàn tỉnh' : 'Giao kế hoạch và đánh giá BSC/KPI từng nhân viên'}
            </p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setActiveTab('eval')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Đánh giá</button>
            <button onClick={() => setActiveTab('plan')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Nhập liệu</button>
            
            {/* ADMIN CAN CONFIG & MANAGE */}
            {isAdmin && (
                <>
                    <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'manage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Quản lý</button>
                    <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}><SettingsIcon size={16}/></button>
                </>
            )}
          </div>
       </div>

       {/* --- CONFIG TAB (ADMIN ONLY) --- */}
       {activeTab === 'config' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2"><Database className="text-blue-600"/> Liên kết Google Sheet (CSV)</h3>
                   <p className="text-sm text-slate-500 mb-4">Hệ thống sẽ tự động đồng bộ dữ liệu mỗi 10 phút nếu được bật.</p>
                   
                   <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                       <div className="flex-1 w-full">
                           <label className="block text-sm font-bold text-slate-700 mb-1">Đường dẫn CSV (Publish to web)</label>
                           <div className="flex gap-2">
                               <input 
                                   type="text" 
                                   className="w-full pl-4 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                   placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                                   value={dsConfig.url}
                                   onChange={e => setDsConfig({...dsConfig, url: e.target.value})}
                               />
                               <button 
                                   onClick={checkConnection}
                                   disabled={isCheckingLink}
                                   className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2 whitespace-nowrap"
                               >
                                   {isCheckingLink ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>}
                                   Đọc dữ liệu nguồn
                               </button>
                           </div>
                       </div>
                   </div>

                   <div className="flex items-center gap-3 mt-2">
                        <input type="checkbox" id="autoSync" checked={dsConfig.autoSync} onChange={e => setDsConfig({...dsConfig, autoSync: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                        <label htmlFor="autoSync" className="text-sm font-medium text-slate-700 cursor-pointer select-none">Tự động đồng bộ 10 phút/lần</label>
                   </div>
               </div>

               {/* MAPPING SECTION */}
               <div className="p-6">
                   <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-700">Cấu hình ánh xạ (Mapping)</h4>
                        {sheetHeaders.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Đã tìm thấy {sheetHeaders.length} cột từ nguồn</span>}
                   </div>
                   
                   {sheetHeaders.length === 0 ? (
                       <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                           <Database className="mx-auto text-slate-300 mb-2" size={32}/>
                           <p className="text-slate-500">Vui lòng nhập URL và bấm "Đọc dữ liệu nguồn" để lấy danh sách cột.</p>
                       </div>
                   ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {systemFields.map((field) => (
                                <div key={field.key} className="flex items-center gap-4 bg-slate-50 p-3 rounded border border-slate-200">
                                    <div className="w-1/2">
                                        <div className="text-sm font-bold text-slate-700">{field.label} {field.required && <span className="text-red-500">*</span>}</div>
                                        <div className="text-xs text-slate-400 font-mono">{field.key}</div>
                                    </div>
                                    <div className="w-1/2">
                                        <select 
                                            className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500 bg-white"
                                            value={dsConfig.mapping[field.key] || ''}
                                            onChange={(e) => updateMapping(field.key, e.target.value)}
                                        >
                                            <option value="">-- Chọn cột nguồn --</option>
                                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                   )}
               </div>
               
               <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                   <button 
                       onClick={() => handleSyncData(true)}
                       disabled={isSyncing || sheetHeaders.length === 0}
                       className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       {isSyncing ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20}/>}
                       Lưu & Đồng bộ ngay
                   </button>
               </div>
           </div>
       )}

       {/* --- MANAGE TAB (ADMIN ONLY) --- */}
       {activeTab === 'manage' && isAdmin && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800">Quản lý dữ liệu KPI</h3>
                   <div className="text-xs text-slate-500">Tổng số: {kpiData.length} bản ghi</div>
               </div>
               <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                       <thead className="bg-slate-100 text-slate-700 font-bold">
                           <tr>
                               <th className="p-3">ID</th>
                               <th className="p-3">Tên đối tượng</th>
                               <th className="p-3 text-center">Số lượng chỉ tiêu</th>
                               <th className="p-3 text-right">Hành động</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {kpiData.length > 0 ? kpiData.map((item, index) => {
                               const id = mode === 'personal' ? item.hrmCode : item.unitCode;
                               const name = mode === 'personal' ? item.fullName : item.unitName;
                               const targetCount = Object.keys(item.targets || {}).length;
                               return (
                                   <tr key={index} className="hover:bg-slate-50">
                                       <td className="p-3 font-mono text-xs">{id}</td>
                                       <td className="p-3 font-medium">{name}</td>
                                       <td className="p-3 text-center">{targetCount}</td>
                                       <td className="p-3 text-right flex justify-end gap-2">
                                           <button onClick={() => openEditModal(item)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"><Edit size={16}/></button>
                                           <button onClick={() => handleDeleteItem(index)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded"><Trash2 size={16}/></button>
                                       </td>
                                   </tr>
                               );
                           }) : (
                               <tr><td colSpan={4} className="p-8 text-center text-slate-400">Chưa có dữ liệu nào.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       )}

       {activeTab === 'plan' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Left: Actions */}
             <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><FileUp size={32} /></div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Nhập liệu {mode === 'group' ? 'Tập thể' : 'Cá nhân'}</h3>
                  <p className="text-slate-500 mb-6 max-w-sm">Hỗ trợ file Excel (.xlsx) hoặc copy trực tiếp từ Google Sheet. Trường khóa: <strong>{ID_KEY}</strong>.</p>
                  
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
                      <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md">
                          <FileSpreadsheet size={20} /> Chọn File Excel
                      </button>
                      <button onClick={() => setPasteModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-lg font-bold hover:bg-slate-50 flex items-center justify-center gap-2">
                          <ClipboardPaste size={20} /> Paste từ Google Sheet
                      </button>
                      <div className="my-2 border-t w-full"></div>
                      <button onClick={handleDownloadTemplate} className="text-slate-500 hover:text-blue-600 text-sm flex items-center justify-center gap-2">
                          <Download size={16} /> Tải file mẫu chuẩn
                      </button>
                  </div>
             </div>

             {/* Right: Guide */}
             <div className="bg-slate-50 p-8 rounded-xl border border-slate-200">
                <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><AlertOctagon size={20} className="text-orange-500"/> Hướng dẫn định dạng</h4>
                <ul className="space-y-3 text-sm text-slate-600 list-disc pl-5">
                    <li>Dòng đầu tiên là tiêu đề (Header).</li>
                    <li>Bắt buộc có cột <strong>{ID_KEY}</strong> ({ID_LABEL}).</li>
                    <li>Với mỗi chỉ số (Ví dụ: Fiber), cần 2 cột:
                        <ul className="list-circle pl-5 mt-1 text-slate-500">
                            <li><code>FIBER_TARGET</code> (Chỉ tiêu)</li>
                            <li><code>FIBER_ACTUAL</code> (Thực hiện)</li>
                        </ul>
                    </li>
                    {mode === 'group' && (
                        <li className="font-bold text-blue-700 mt-2">Lưu ý: Đơn vị cha (VNPT Quảng Ninh) sẽ được tự động cộng dồn từ các đơn vị con. Không cần nhập thủ công.</li>
                    )}
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
                    {/* Only show Unit Filter in Personal Mode */}
                    {mode === 'personal' && (
                        <select className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                            <option value="all">-- Tất cả đơn vị --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}

                    <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium outline-none focus:ring-2 focus:ring-blue-500" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                        {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
               </div>
               <div className="flex items-center gap-4 text-sm text-slate-500 italic">
                   {dsConfig.url && (
                        <div className="flex items-center gap-1">
                            <Clock size={14} className={isSyncing ? "animate-spin text-blue-600" : "text-slate-400"}/>
                            {isSyncing ? "Đang đồng bộ..." : `Đồng bộ lần cuối: ${dsConfig.lastSync || 'Chưa'}`}
                        </div>
                   )}
                   <button onClick={() => handleSyncData(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-xs font-bold"><RefreshCw size={12}/> Sync</button>
               </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                 <h3 className="font-bold text-lg mb-4 text-green-700">Top 5 {mode === 'personal' ? 'Nhân viên' : 'Đơn vị'} Xuất sắc</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={top5} layout="vertical" margin={{left: 40}}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                       <Tooltip cursor={{fill: '#f0fdf4'}} formatter={(value: number) => [`${value}%`, 'Hoàn thành']} />
                       <Bar dataKey="percent" fill="#22c55e" barSize={20} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#666', fontSize: 10, formatter: (val: number) => `${val}%` }} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2"><AlertOctagon size={20}/> Top 5 {mode === 'personal' ? 'Cần cố gắng' : 'Thấp nhất'}</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bottom5} layout="vertical" margin={{left: 40}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
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
               {/* 
                  YÊU CẦU: Hiển thị tối đa 10 dòng, có thanh cuộn đứng.
                  Giải pháp: set max-height ~ 500px (mỗi dòng ~ 50px) và overflow-y-auto
                  Thêm sticky cho thead để khi cuộn vẫn thấy tiêu đề.
               */}
               <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm">
                     <tr>
                       <th className="p-3 bg-slate-100">{mode === 'personal' ? 'Nhân viên' : 'Đơn vị'}</th>
                       <th className="p-3 bg-slate-100">Mã</th>
                       <th className="p-3 bg-slate-100 text-right">Kế hoạch (Target)</th>
                       <th className="p-3 bg-slate-100 text-right">Thực hiện (Actual)</th>
                       <th className="p-3 bg-slate-100 text-center">% Hoàn thành</th>
                       <th className="p-3 bg-slate-100 text-center">Đánh giá</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredData.length > 0 ? filteredData.map((item, index) => {
                         const targetData = item.targets?.[filterKey] || { target: 0, actual: 0 };
                         const percent = targetData.target ? (targetData.actual / targetData.target) * 100 : 0;
                         const idVal = mode === 'personal' ? item.hrmCode : item.unitCode;
                         const nameVal = mode === 'personal' ? item.fullName : item.unitName;

                         // Highlight rows if it's a parent unit
                         const isParent = mode === 'group' && units.some(u => u.code === item.unitCode && u.parentId === null);

                         return (
                           <tr key={index} className={`hover:bg-slate-50 ${isParent ? 'bg-blue-50/50 font-semibold' : ''}`}>
                             <td className="p-3 font-medium text-slate-800">
                                 {nameVal} 
                                 {isParent && <span className="text-[10px] text-blue-600 border border-blue-200 bg-white px-1 ml-2 rounded">TỔNG</span>}
                             </td>
                             <td className="p-3 text-xs text-slate-400">{idVal}</td>
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
                         <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu phù hợp.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
       )}

       {/* Edit KPI Modal */}
       {isEditModalOpen && editingItem && (
           <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                       <h3 className="font-bold text-lg">Cập nhật số liệu: {mode === 'personal' ? editingItem.fullName : editingItem.unitName}</h3>
                       <button onClick={() => setIsEditModalOpen(false)}><X size={20}/></button>
                   </div>
                   <div className="p-4 flex-1 overflow-y-auto">
                       <table className="w-full text-sm">
                           <thead className="bg-slate-100 font-bold sticky top-0">
                               <tr>
                                   <th className="p-2 text-left">Chỉ tiêu</th>
                                   <th className="p-2 w-32">Kế hoạch</th>
                                   <th className="p-2 w-32">Thực hiện</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y">
                               {Object.entries(KPI_KEYS).map(([key, label]) => {
                                   const t = editingItem.targets[key] || { target: 0, actual: 0 };
                                   return (
                                       <tr key={key}>
                                           <td className="p-2">{label}</td>
                                           <td className="p-2"><input type="number" className="w-full border rounded p-1" value={t.target} onChange={e => updateEditingTarget(key, 'target', e.target.value)} /></td>
                                           <td className="p-2"><input type="number" className="w-full border rounded p-1 text-blue-700 font-bold" value={t.actual} onChange={e => updateEditingTarget(key, 'actual', e.target.value)} /></td>
                                       </tr>
                                   )
                               })}
                           </tbody>
                       </table>
                   </div>
                   <div className="p-4 border-t flex justify-end gap-3 bg-slate-50">
                       <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600">Hủy</button>
                       <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Lưu thay đổi</button>
                   </div>
               </div>
           </div>
       )}

       {/* Paste Data Modal */}
       {pasteModalOpen && (
           <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                   <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                       <h3 className="font-bold text-lg">Paste dữ liệu {mode === 'group' ? 'Tập thể' : 'Cá nhân'}</h3>
                       <button onClick={() => setPasteModalOpen(false)}><span className="text-2xl">&times;</span></button>
                   </div>
                   <div className="p-4">
                       <p className="text-sm text-slate-500 mb-2">Copy từ Google Sheet (kèm Header). Cột khóa: <strong>{ID_KEY}</strong></p>
                       <textarea 
                           className="w-full h-64 border rounded-lg p-3 font-mono text-xs bg-slate-50"
                           placeholder={`${ID_KEY}\tFIBER_TARGET\tFIBER_ACTUAL\n...`}
                           value={pasteContent}
                           onChange={e => setPasteContent(e.target.value)}
                       ></textarea>
                   </div>
                   <div className="p-4 border-t flex justify-end gap-3">
                       <button onClick={() => setPasteModalOpen(false)} className="px-4 py-2 text-slate-600">Hủy</button>
                       <button onClick={handlePasteData} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Lưu dữ liệu</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KPI;
