
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileUp, FileSpreadsheet, Loader2, ShieldCheck, TreePine, Download, RefreshCw, AlertCircle } from 'lucide-react';
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

  // --- HÀM TỰ SINH MÃ ĐƠN VỊ ---
  const generateUnitCode = () => {
      const num = Math.floor(Math.random() * 9999) + 1;
      return `QNH${num.toString().padStart(4, '0')}`;
  };

  // --- TẢI FILE MẪU EXCEL ---
  const downloadSampleFile = () => {
      const sampleData = [
          {
              'FULL_NAME': 'Nguyễn Văn A',
              'HRM_CODE': 'VNPT001',
              'USERNAME': 'anv',
              'PASSWORD': '',
              'TITLE': 'Nhân viên',
              'EMAIL': 'anv@vnpt.vn',
              'UNIT_CODE': 'VNPT_QN',
              'IS_ADMIN': 'NO'
          }
      ];
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
      XLSX.writeFile(wb, "Mau_Import_NhanSu_VNPT_QN.xlsx");
  };

  // --- LOGIC XỬ LÝ CÂY ĐƠN VỊ ---
  // Đảm bảo VNPT Quảng Ninh luôn ở cấp cao nhất
  const unitTree = useMemo(() => {
      const build = (data: Unit[], parentId: string | null = null): any[] => {
          return data
              .filter(item => item.parentId === parentId)
              .map(item => ({
                  ...item,
                  children: build(data, item.id)
              }));
      };
      
      // Tìm đơn vị gốc (Root)
      const rootUnit = units.find(u => u.code === 'VNPT_QN' || u.parentId === null);
      if (!rootUnit) return build(units, null);
      
      return [{
          ...rootUnit,
          children: build(units, rootUnit.id)
      }];
  }, [units]);

  // --- COMPONENT HIỂN THỊ DÒNG TRONG CÂY ---
  const TreeRow: React.FC<{ item: any; level: number }> = ({ item, level }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = item.children && item.children.length > 0;

      return (
          <div className="flex flex-col">
              <div className={`flex items-center group py-3 px-4 hover:bg-blue-50 border-b border-slate-50 transition-colors ${level === 0 ? 'bg-slate-50 font-bold' : ''}`}>
                  <div style={{ width: `${level * 24}px` }} className="shrink-0" />
                  <button onClick={() => setIsOpen(!isOpen)} className={`p-1 mr-2 text-slate-400 hover:text-blue-600 ${!hasChildren ? 'invisible' : ''}`}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <Building size={16} className={`mr-2 ${level === 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                      <div className="text-sm text-slate-800">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{item.code}</div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded shadow-sm"><Edit2 size={14}/></button>
                      {item.code !== 'VNPT_QN' && (
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded shadow-sm"><Trash2 size={14}/></button>
                      )}
                  </div>
              </div>
              {isOpen && hasChildren && (
                  <div className="flex flex-col">
                      {item.children.map((child: any) => <TreeRow key={child.id} item={child} level={level + 1} />)}
                  </div>
              )}
          </div>
      );
  };

  // --- XỬ LÝ LƯU DỮ LIỆU ---
  const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({ ...item });
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    // 1. Validation
    if (activeTab === 'units' && !formData.name) return alert("Vui lòng nhập Tên đơn vị");
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) {
        return alert("Vui lòng nhập đầy đủ: Họ tên, Mã HRM và Tên đăng nhập");
    }

    setIsProcessing(true);
    try {
        const id = editingItem ? editingItem.id : (activeTab === 'units' ? `unit_${Date.now()}` : `user_${Date.now()}`);
        let finalData = { ...formData, id };

        if (activeTab === 'units') {
            // Tự động sinh mã cho đơn vị mới
            if (!editingItem) {
                finalData.code = generateUnitCode();
            }
            // Logic gán đơn vị cha mặc định là VNPT Quảng Ninh
            if (!finalData.parentId && finalData.code !== 'VNPT_QN') {
                const root = units.find(u => u.code === 'VNPT_QN');
                if (root) {
                    finalData.parentId = root.id;
                    finalData.level = (root.level || 0) + 1;
                } else {
                    finalData.parentId = null;
                    finalData.level = 0;
                }
            } else if (finalData.parentId) {
                const parent = units.find(u => u.id === finalData.parentId);
                finalData.level = (parent?.level || 0) + 1;
            }
        }

        if (activeTab === 'users') {
            // Mật khẩu mặc định 123456
            if (!editingItem) {
                const rawPassword = formData.password || '123456';
                finalData.password = md5(rawPassword);
                finalData.isFirstLogin = true;
                finalData.canManageUsers = formData.canManageUsers || false;
            } else if (formData.newPassword) {
                // Nếu đổi mật khẩu
                finalData.password = md5(formData.newPassword);
                delete finalData.newPassword;
            }
        }

        // Lưu vào Firebase
        await dbClient.upsert(activeTab, id, finalData);
        
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
        
        // Thông báo và reload để đồng bộ dữ liệu
        alert("Đã lưu dữ liệu thành công!");
        window.location.reload(); 
    } catch (err: any) { 
        console.error("Lỗi khi lưu:", err);
        alert("Lỗi hệ thống: " + (err.message || "Không thể lưu dữ liệu"));
    } finally { 
        setIsProcessing(false); 
    }
  };

  const handleDelete = async (id: string) => {
      const user = users.find(u => u.id === id);
      const unit = units.find(u => u.id === id);

      if (user && user.username === 'admin') return alert("Không thể xóa tài khoản Admin hệ thống!");
      if (unit && unit.code === 'VNPT_QN') return alert("Không thể xóa đơn vị gốc!");

      if (confirm(`Bạn có chắc chắn muốn xóa bản ghi này?`)) {
          setIsProcessing(true);
          try {
              await dbClient.delete(activeTab, id);
              window.location.reload();
          } catch (e: any) {
              alert("Lỗi khi xóa: " + e.message);
          } finally {
              setIsProcessing(false);
          }
      }
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data: any[] = XLSX.utils.sheet_to_json(ws);

              for (const row of data) {
                  const hrmCode = String(row['HRM_CODE'] || '').trim();
                  if (!hrmCode) continue;

                  const userData = {
                      id: `user_${hrmCode}`,
                      fullName: row['FULL_NAME'] || '',
                      hrmCode: hrmCode,
                      username: row['USERNAME'] || hrmCode.toLowerCase(),
                      password: md5(String(row['PASSWORD'] || '123456')),
                      title: row['TITLE'] || Role.STAFF,
                      email: row['EMAIL'] || '',
                      unitId: units.find(u => u.code === row['UNIT_CODE'])?.id || units.find(u => u.code === 'VNPT_QN')?.id || '',
                      isFirstLogin: true,
                      canManageUsers: row['IS_ADMIN'] === 'YES' || row['IS_ADMIN'] === true
                  };
                  await dbClient.upsert('users', userData.id, userData);
              }
              alert(`Import thành công ${data.length} nhân sự!`);
              window.location.reload();
          } catch (err) {
              alert("Lỗi xử lý file Excel.");
          } finally {
              setIsProcessing(false);
          }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" /> Quản trị hệ thống
            </h2>
            <p className="text-xs text-slate-500 italic">Quản lý sơ đồ tổ chức & Tài khoản nhân sự</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-2xl border border-slate-300 shadow-sm">
          <button onClick={() => setActiveTab('units')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><TreePine size={16}/> Đơn vị</button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Users size={16}/> Nhân sự</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden min-h-[500px] flex flex-col relative">
          {/* OVERLAY KHI ĐANG XỬ LÝ */}
          {isProcessing && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[50] flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600 mb-2" size={48} />
                  <span className="font-bold text-blue-700 animate-pulse">Hệ thống đang lưu dữ liệu...</span>
              </div>
          )}

          <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wider">
                {activeTab === 'units' ? <Building size={18} className="text-blue-500"/> : <UserIcon size={18} className="text-green-500"/>}
                {activeTab === 'units' ? 'Sơ đồ tổ chức hình cây' : 'Danh sách nhân sự toàn tỉnh'}
              </h3>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {activeTab === 'users' && (
                      <>
                        <button onClick={downloadSampleFile} className="flex-1 sm:flex-none bg-slate-100 text-slate-600 border border-slate-300 px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                            <Download size={14}/> Tải file mẫu
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportUsers} />
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all">
                            <FileSpreadsheet size={16}/> Import Excel
                        </button>
                      </>
                  )}
                  <button onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all">
                      <Plus size={16}/> Thêm mới
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto">
              {activeTab === 'units' ? (
                  <div className="divide-y divide-slate-100">
                      {unitTree.map(root => <TreeRow key={root.id} item={root} level={0} />)}
                      {units.length === 0 && <div className="p-20 text-center text-slate-400 italic">Chưa có dữ liệu đơn vị. Vui lòng thêm mới hoặc khởi tạo hệ thống.</div>}
                  </div>
              ) : (
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-widest sticky top-0 z-10">
                          <tr>
                              <th className="p-4 border-b">Họ tên & Tài khoản</th>
                              <th className="p-4 border-b">Mã HRM</th>
                              <th className="p-4 border-b">Đơn vị</th>
                              <th className="p-4 border-b text-right">Thao tác</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.sort((a,b) => a.username === 'admin' ? -1 : 1).map((user: any) => (
                              <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="p-4">
                                      <div className="font-bold text-slate-800 flex items-center gap-2">
                                          {user.fullName}
                                          {user.username === 'admin' && <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-sm">Admin Gốc</span>}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-medium">{user.title} • @{user.username}</div>
                                  </td>
                                  <td className="p-4 font-mono text-xs text-blue-600 font-bold">{user.hrmCode}</td>
                                  <td className="p-4">
                                      <div className="text-xs text-slate-600">{units.find(u => u.id === user.unitId)?.name || 'Chưa gán đơn vị'}</div>
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-1">
                                          <button onClick={() => handleEdit(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-blue-100"><Edit2 size={16}/></button>
                                          {user.username !== 'admin' && (
                                              <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-red-100"><Trash2 size={16}/></button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {users.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic">Hệ thống chưa có nhân sự nào.</td></tr>}
                      </tbody>
                  </table>
              )}
          </div>
      </div>

      {/* MODAL THÊM/SỬA */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-zoom-in border border-slate-200">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{editingItem ? 'Cập nhật thông tin' : 'Thêm mới bản ghi'}</h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{activeTab === 'units' ? 'Module Đơn vị' : 'Module Nhân sự'}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
                      {activeTab === 'units' ? (
                          <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tên phòng ban / Trung tâm</label>
                                <input className="w-full border-2 rounded-2xl p-3.5 focus:border-blue-500 outline-none transition-all text-sm bg-slate-50" placeholder="Ví dụ: Trung tâm Điều hành mạng..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Mã định danh (Code)</label>
                                <div className="relative">
                                    <input className="w-full border-2 rounded-2xl p-3.5 bg-slate-100 font-mono text-sm text-slate-500" value={formData.code || (editingItem ? '' : 'Hệ thống tự sinh mã QNHxxxx')} disabled />
                                    {!editingItem && <RefreshCw size={18} className="absolute right-4 top-4 text-blue-400 animate-spin-slow" />}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Đơn vị quản lý cấp trên</label>
                                <select className="w-full border-2 rounded-2xl p-3.5 focus:border-blue-500 outline-none transition-all text-sm bg-slate-50" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                                    <option value="">-- Mặc định (Trực thuộc VNPT Quảng Ninh) --</option>
                                    {units.filter(u => u.id !== editingItem?.id).map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-2 px-1 flex items-center gap-1"><AlertCircle size={10}/> Nếu để trống, đơn vị này sẽ là cấp 2 trực thuộc Tổng công ty.</p>
                            </div>
                          </>
                      ) : (
                          <div className="grid grid-cols-2 gap-5">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Họ và tên nhân sự</label>
                                <input className="w-full border-2 rounded-2xl p-3.5 text-sm bg-slate-50" placeholder="Nguyễn Văn A..." value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Mã HRM</label>
                                <input className="w-full border-2 rounded-2xl p-3.5 font-mono text-sm bg-slate-50" placeholder="Mã định danh HRM..." value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tên đăng nhập</label>
                                <input className="w-full border-2 rounded-2xl p-3.5 text-sm bg-slate-50" placeholder="username..." value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={formData.username === 'admin'} />
                            </div>
                            
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                                    {editingItem ? 'Đặt mật khẩu mới (Để trống nếu không muốn đổi)' : 'Mật khẩu đăng nhập'}
                                </label>
                                <div className="relative">
                                    <input className="w-full border-2 rounded-2xl p-3.5 text-sm bg-slate-50" type="password" placeholder={editingItem ? "Nhập pass mới..." : "Mặc định: 123456"} onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                                    <Lock size={18} className="absolute right-4 top-4 text-slate-300" />
                                </div>
                                {!editingItem && <p className="text-[10px] text-blue-500 mt-1">* User mới sẽ phải đổi mật khẩu ngay lần đăng nhập đầu tiên.</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Chức danh / Vai trò</label>
                                <select className="w-full border-2 rounded-2xl p-3.5 text-sm bg-slate-50" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                    <option value="">-- Chọn chức danh --</option>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Phòng ban trực thuộc</label>
                                <select className="w-full border-2 rounded-2xl p-3.5 text-sm bg-slate-50" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                                    <option value="">-- Chọn đơn vị --</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                          </div>
                      )}
                  </div>

                  <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-2xl transition-all">Hủy bỏ</button>
                      <button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 active:scale-95 disabled:bg-blue-300 transition-all">
                        {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Xác nhận lưu
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
