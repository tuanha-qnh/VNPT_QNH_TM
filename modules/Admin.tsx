
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
// Fix: Added Users to lucide-react imports to resolve the missing icon component error.
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileUp, FileSpreadsheet, Loader2, ShieldCheck, TreePine, UserPlus } from 'lucide-react';
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

  // --- LOGIC XỬ LÝ CÂY ĐƠN VỊ ---
  const buildTree = (data: Unit[], parentId: string | null = null): any[] => {
      return data
          .filter(item => item.parentId === parentId)
          .map(item => ({
              ...item,
              children: buildTree(data, item.id)
          }));
  };

  const unitTree = useMemo(() => buildTree(units, null), [units]);

  // --- COMPONENT HIỂN THỊ DÒNG TRONG CÂY ---
  const TreeRow: React.FC<{ item: any; level: number }> = ({ item, level }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = item.children && item.children.length > 0;

      return (
          <div className="flex flex-col">
              <div className={`flex items-center group py-3 px-4 hover:bg-blue-50/50 border-b border-slate-50 transition-colors ${level === 0 ? 'bg-slate-50/80 font-bold' : ''}`}>
                  <div style={{ width: `${level * 24}px` }} className="shrink-0" />
                  <button onClick={() => setIsOpen(!isOpen)} className={`p-1 mr-2 text-slate-400 hover:text-blue-600 ${!hasChildren ? 'invisible' : ''}`}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <Building size={16} className={`mr-2 ${level === 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                      <div className="text-sm text-slate-800">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{item.code}</div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={14}/></button>
                      {item.code !== 'VNPT_QN' && (
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
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
      setFormData(item);
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (activeTab === 'units' && (!formData.name || !formData.code)) return alert("Vui lòng nhập đủ Tên và Mã đơn vị");
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) return alert("Vui lòng nhập đủ thông tin nhân sự");

    setIsProcessing(true);
    try {
        const id = editingItem ? editingItem.id : (activeTab === 'units' ? `unit_${Date.now()}` : `user_${Date.now()}`);
        const data = { ...formData };

        // Mặc định đơn vị cha là VNPT Quảng Ninh nếu chưa chọn
        if (activeTab === 'units' && !data.parentId && data.code !== 'VNPT_QN') {
            const root = units.find(u => u.code === 'VNPT_QN');
            if (root) data.parentId = root.id;
        }

        // Mã hóa mật khẩu nếu là user mới
        if (activeTab === 'users' && !editingItem) {
            data.password = md5(data.password || '123456');
            data.isFirstLogin = true;
        }

        await dbClient.upsert(activeTab, id, data);
        alert("Lưu dữ liệu thành công!");
        setIsModalOpen(false);
        window.location.reload(); 
    } catch (err: any) { alert("Lỗi: " + err.message); } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
      const user = users.find(u => u.id === id);
      const unit = units.find(u => u.id === id);

      // BẢO VỆ ADMIN GỐC
      if (user && user.username === 'admin') {
          return alert("CẢNH BÁO: Đây là tài khoản quản trị hệ thống tối cao, không thể xóa!");
      }
      if (unit && unit.code === 'VNPT_QN') {
          return alert("CẢNH BÁO: Không thể xóa đơn vị gốc của hệ thống!");
      }

      if (confirm(`Xác nhận xóa ${activeTab === 'units' ? 'đơn vị' : 'nhân sự'} này?`)) {
          await dbClient.delete(activeTab, id);
          window.location.reload();
      }
  };

  // --- IMPORT NHÂN SỰ TỪ EXCEL ---
  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data: any[] = XLSX.utils.sheet_to_json(ws);

              for (const row of data) {
                  const hrmCode = String(row['HRM_CODE'] || '').trim();
                  if (!hrmCode) continue;

                  const userData = {
                      fullName: row['FULL_NAME'] || '',
                      hrmCode: hrmCode,
                      username: row['USERNAME'] || hrmCode.toLowerCase(),
                      password: md5(String(row['PASSWORD'] || '123456')),
                      title: row['TITLE'] || Role.STAFF,
                      email: row['EMAIL'] || '',
                      unitId: units.find(u => u.code === row['UNIT_CODE'])?.id || units[0].id,
                      isFirstLogin: true,
                      canManageUsers: row['IS_ADMIN'] === 'YES' || row['IS_ADMIN'] === true
                  };

                  await dbClient.upsert('users', `user_${hrmCode}`, userData);
              }
              alert(`Đã import thành công ${data.length} nhân sự!`);
              window.location.reload();
          } catch (err) {
              alert("Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng.");
          } finally {
              setIsProcessing(false);
          }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" /> Quản trị hệ thống
            </h2>
            <p className="text-xs text-slate-500 italic">Thiết lập cơ cấu tổ chức và nhân sự VNPT Quảng Ninh</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-2xl shadow-inner border border-slate-300">
          <button onClick={() => setActiveTab('units')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}><TreePine size={18}/> Sơ đồ Đơn vị</button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm scale-105' : 'text-slate-500'}`}><Users size={18}/> Danh sách Nhân sự</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
          <div className="p-6 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                {activeTab === 'units' ? <Building size={20} className="text-blue-500"/> : <UserIcon size={20} className="text-green-500"/>}
                {activeTab === 'units' ? 'Cơ cấu tổ chức hình cây' : 'Quản lý cán bộ công nhân viên'}
              </h3>
              <div className="flex gap-2 w-full sm:w-auto">
                  {activeTab === 'users' && (
                      <>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportUsers} />
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all">
                            <FileSpreadsheet size={18}/> Import Excel
                        </button>
                      </>
                  )}
                  <button onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all">
                      <Plus size={18}/> {activeTab === 'units' ? 'Thêm đơn vị' : 'Thêm nhân sự'}
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto">
              {activeTab === 'units' ? (
                  <div className="divide-y divide-slate-100">
                      {unitTree.map(root => <TreeRow key={root.id} item={root} level={0} />)}
                      {units.length === 0 && <div className="p-20 text-center text-slate-400 italic">Chưa có dữ liệu đơn vị.</div>}
                  </div>
              ) : (
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest sticky top-0 z-10">
                          <tr>
                              <th className="p-4 border-b">Thông tin Nhân sự</th>
                              <th className="p-4 border-b">Định danh HRM</th>
                              <th className="p-4 border-b">Đơn vị</th>
                              <th className="p-4 border-b text-right">Thao tác</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.map((user: any) => (
                              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-4">
                                      <div className="font-bold text-slate-800 flex items-center gap-2">
                                          {user.fullName}
                                          {user.username === 'admin' && <span className="bg-blue-100 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">System Admin</span>}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-medium">{user.title} • {user.username}</div>
                                  </td>
                                  <td className="p-4 font-mono text-xs text-blue-600 font-bold">{user.hrmCode}</td>
                                  <td className="p-4">
                                      <div className="text-xs text-slate-600">{units.find(u => u.id === user.unitId)?.name || 'N/A'}</div>
                                  </td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-1">
                                          <button onClick={() => handleEdit(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                          {user.username !== 'admin' && (
                                              <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
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

      {/* MODAL THÊM/SỬA */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-zoom-in">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Cập nhật thông tin' : 'Thêm bản ghi mới'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 space-y-5">
                      {activeTab === 'units' ? (
                          <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tên đơn vị</label>
                                <input className="w-full border-2 rounded-xl p-3 focus:border-blue-500 outline-none transition-all" placeholder="Ví dụ: Trung tâm Viễn thông 1..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Mã định danh (Code)</label>
                                <input className="w-full border-2 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-mono" placeholder="Ví dụ: QNH001..." value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Đơn vị quản lý cấp trên</label>
                                <select className="w-full border-2 rounded-xl p-3 focus:border-blue-500 outline-none transition-all" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                                    <option value="">-- Là đơn vị cao nhất --</option>
                                    {units.filter(u => u.id !== editingItem?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                          </>
                      ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Họ và tên</label>
                                <input className="w-full border-2 rounded-xl p-3" placeholder="Nguyễn Văn A..." value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Mã HRM</label>
                                <input className="w-full border-2 rounded-xl p-3 font-mono" placeholder="VNPT..." value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Username</label>
                                <input className="w-full border-2 rounded-xl p-3" placeholder="tên đăng nhập..." value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={formData.username === 'admin'} />
                            </div>
                            {!editingItem && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Mật khẩu (Mặc định: 123456)</label>
                                    <input className="w-full border-2 rounded-xl p-3" type="password" placeholder="Để trống nếu lấy mặc định..." value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                                </div>
                            )}
                            {editingItem?.username === 'admin' && (
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase text-blue-600">Đổi mật khẩu cho Admin</label>
                                    <input className="w-full border-2 border-blue-200 rounded-xl p-3" type="password" placeholder="Nhập mật khẩu mới tại đây..." onChange={e => setFormData({...formData, password: md5(e.target.value)})} />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Chức danh</label>
                                <select className="w-full border-2 rounded-xl p-3" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Phòng ban / Đơn vị</label>
                                <select className="w-full border-2 rounded-xl p-3" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                          </div>
                      )}
                  </div>

                  <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Hủy bỏ</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-2.5 rounded-xl font-bold shadow-xl flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all">
                        {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Lưu dữ liệu
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
