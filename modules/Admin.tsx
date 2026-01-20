
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileSpreadsheet, Loader2, ShieldCheck, TreePine, Download, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/firebaseClient'; 
import md5 from 'md5'; 

interface AdminProps {
  units: Unit[];
  users: User[];
  currentUser: User; 
  setUnits: (units: Unit[]) => void;
  setUsers: (users: User[]) => void;
}

const Admin: React.FC<AdminProps> = ({ units, users, currentUser, setUnits, setUsers }) => {
  const [activeTab, setActiveTab] = useState<'units' | 'users'>('units');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUnitCode = () => {
      const num = Math.floor(Math.random() * 9999) + 1;
      return `QNH${num.toString().padStart(4, '0')}`;
  };

  const downloadSampleFile = () => {
      const sampleData = [{ 'FULL_NAME': 'Nguyễn Văn A', 'HRM_CODE': 'VNPT001', 'USERNAME': 'anv', 'TITLE': 'Nhân viên', 'UNIT_CODE': 'VNPT_QN' }];
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NhanSu");
      XLSX.writeFile(wb, "Mau_Import_NhanSu.xlsx");
  };

  const unitTree = useMemo(() => {
      const build = (data: Unit[], parentId: string | null = null): any[] => {
          return data
              .filter(item => item.parentId === parentId)
              .map(item => ({ ...item, children: build(data, item.id) }));
      };
      const root = units.find(u => u.code === 'VNPT_QN' || !u.parentId);
      return root ? [{ ...root, children: build(units, root.id) }] : build(units, null);
  }, [units]);

  const TreeRow: React.FC<{ item: any; level: number }> = ({ item, level }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = item.children && item.children.length > 0;
      return (
          <div className="flex flex-col">
              <div className={`flex items-center group py-3.5 px-6 hover:bg-blue-50/50 border-b border-slate-50 transition-all ${level === 0 ? 'bg-slate-50/80 font-black' : ''}`}>
                  <div style={{ width: `${level * 24}px` }} className="shrink-0" />
                  <button onClick={() => setIsOpen(!isOpen)} className={`p-1 mr-2 text-slate-400 hover:text-blue-600 ${!hasChildren ? 'invisible' : ''}`}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <Building size={16} className={`mr-3 ${level === 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                      <div className="text-sm text-slate-800 tracking-tight">{item.name}</div>
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">{item.code}</div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm"><Edit2 size={14}/></button>
                      {item.code !== 'VNPT_QN' && (
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm"><Trash2 size={14}/></button>
                      )}
                  </div>
              </div>
              {isOpen && hasChildren && item.children.map((child: any) => <TreeRow key={child.id} item={child} level={level + 1} />)}
          </div>
      );
  };

  const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({ ...item });
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (activeTab === 'units' && !formData.name) return alert("Vui lòng nhập Tên đơn vị");
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) return alert("Vui lòng nhập đủ thông tin");

    setIsProcessing(true);
    try {
        const id = editingItem ? editingItem.id : (activeTab === 'units' ? `unit_${Date.now()}` : `user_${Date.now()}`);
        let finalData = { ...formData, id };

        if (activeTab === 'units') {
            if (!editingItem) finalData.code = generateUnitCode();
            if (!finalData.parentId && finalData.code !== 'VNPT_QN') {
                const root = units.find(u => u.code === 'VNPT_QN');
                finalData.parentId = root ? root.id : null;
            }
        }

        if (activeTab === 'users') {
            if (!editingItem) {
                finalData.password = md5(formData.password || '123456');
                finalData.isFirstLogin = true;
            } else if (formData.newPassword) {
                finalData.password = md5(formData.newPassword);
            }
        }

        await dbClient.upsert(activeTab, id, finalData);
        setIsModalOpen(false);
        window.location.reload(); 
    } catch (err: any) {
        alert("Lỗi: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Xác nhận xóa bản ghi?")) {
          setIsProcessing(true);
          try {
              await dbClient.delete(activeTab, id);
              window.location.reload();
          } catch (e) { alert("Lỗi khi xóa"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const wb = XLSX.read(evt.target?.result, { type: 'binary' });
              const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
              for (const row of data) {
                  const hrmCode = String(row['HRM_CODE'] || '').trim();
                  if (!hrmCode) continue;
                  await dbClient.upsert('users', `user_${hrmCode}`, {
                      fullName: row['FULL_NAME'] || '', hrmCode, username: row['USERNAME'] || hrmCode.toLowerCase(),
                      password: md5('123456'), title: row['TITLE'] || Role.STAFF, isFirstLogin: true,
                      unitId: units.find(u => u.code === row['UNIT_CODE'])?.id || units[0].id
                  });
              }
              window.location.reload();
          } catch (err) { alert("Lỗi Import"); } finally { setIsProcessing(false); }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                <ShieldCheck className="text-blue-600" size={32} /> QUẢN TRỊ HỆ THỐNG
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Cơ cấu tổ chức & Nhân sự VNPT Quảng Ninh</p>
        </div>
        <div className="flex bg-slate-200 p-1.5 rounded-2xl border border-slate-300 shadow-inner">
          <button onClick={() => setActiveTab('units')} className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500'}`}><TreePine size={18}/> ĐƠN VỊ</button>
          <button onClick={() => setActiveTab('users')} className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500'}`}><Users size={18}/> NHÂN SỰ</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-2xl shadow-blue-50 border border-slate-100 overflow-hidden min-h-[600px] flex flex-col relative">
          {isProcessing && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-[60] flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={56} />
                  <span className="font-black text-blue-700 uppercase tracking-tighter animate-pulse text-lg">Đang đồng bộ dữ liệu...</span>
              </div>
          )}

          <div className="p-8 border-b bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-6">
              <h3 className="font-black text-slate-700 flex items-center gap-3 text-sm uppercase tracking-widest">
                {activeTab === 'units' ? <Building size={20} className="text-blue-500"/> : <UserIcon size={20} className="text-green-500"/>}
                {activeTab === 'units' ? 'Sơ đồ tổ chức hình cây' : 'Danh sách cán bộ công nhân viên'}
              </h3>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                  {activeTab === 'users' && (
                      <>
                        <button onClick={downloadSampleFile} className="flex-1 sm:flex-none bg-slate-100 text-slate-600 border border-slate-200 px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200">
                            <Download size={16}/> FILE MẪU
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportUsers} />
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100">
                            <FileSpreadsheet size={18}/> IMPORT EXCEL
                        </button>
                      </>
                  )}
                  <button onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-xl shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all">
                      <Plus size={20}/> THÊM MỚI
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto">
              {activeTab === 'units' ? (
                  <div className="divide-y divide-slate-50">
                      {unitTree.map(root => <TreeRow key={root.id} item={root} level={0} />)}
                  </div>
              ) : (
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest sticky top-0 z-10">
                          <tr>
                              <th className="p-6 border-b">Nhân sự & Tài khoản</th>
                              <th className="p-6 border-b">Mã HRM</th>
                              <th className="p-6 border-b">Đơn vị công tác</th>
                              <th className="p-6 border-b text-right">Hành động</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.sort((a,b) => a.username === 'admin' ? -1 : 1).map((user: any) => (
                              <tr key={user.id} className="hover:bg-blue-50/20 transition-all group">
                                  <td className="p-6">
                                      <div className="font-black text-slate-800 flex items-center gap-2 text-base tracking-tight">
                                          {user.fullName}
                                          {user.username === 'admin' && <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase">Root Admin</span>}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{user.title} • @{user.username}</div>
                                  </td>
                                  <td className="p-6 font-mono text-sm text-blue-600 font-black">{user.hrmCode}</td>
                                  <td className="p-6">
                                      <div className="text-xs font-bold text-slate-600">{units.find(u => u.id === user.unitId)?.name || 'N/A'}</div>
                                  </td>
                                  <td className="p-6 text-right">
                                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                          <button onClick={() => handleEdit(user)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl shadow-sm border border-transparent hover:border-blue-100"><Edit2 size={18}/></button>
                                          {user.username !== 'admin' && (
                                              <button onClick={() => handleDelete(user.id)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-white rounded-2xl shadow-sm border border-transparent hover:border-red-100"><Trash2 size={18}/></button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[40px] w-full max-w-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden animate-zoom-in border border-white">
                  <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{editingItem ? 'Cập nhật' : 'Thêm mới'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeTab === 'units' ? 'Module Đơn vị' : 'Module Nhân sự'}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-2xl transition-all"><X size={32}/></button>
                  </div>
                  
                  <div className="p-10 space-y-6 max-h-[60vh] overflow-y-auto">
                      {activeTab === 'units' ? (
                          <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đơn vị</label>
                                <input className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all text-sm font-bold bg-slate-50" placeholder="VD: Trung tâm Viễn thông..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã đơn vị (Sinh tự động)</label>
                                <div className="relative">
                                    <input className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-100 font-mono text-sm text-slate-400 font-bold" value={formData.code || 'QNHxxxx'} disabled />
                                    <RefreshCw size={20} className="absolute right-4 top-4 text-blue-300 animate-spin-slow" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị quản lý trực tiếp</label>
                                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all text-sm font-bold bg-slate-50" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                                    <option value="">-- Mặc định: VNPT Quảng Ninh --</option>
                                    {units.filter(u => u.id !== editingItem?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                          </>
                      ) : (
                          <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên</label>
                                <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã HRM</label>
                                <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-mono text-sm font-black bg-slate-50 text-blue-600 uppercase" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                                <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={formData.username === 'admin'} />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{editingItem ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu (Mặc định: 123456)'}</label>
                                <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm bg-slate-50" type="password" onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức danh</label>
                                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                                <select className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                          </div>
                      )}
                  </div>

                  <div className="p-10 border-t bg-slate-50/50 flex justify-end gap-4">
                      <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-100 rounded-2xl transition-all">Hủy bỏ</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">Xác nhận lưu</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
