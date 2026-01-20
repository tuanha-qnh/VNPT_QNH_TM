
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileSpreadsheet, Loader2, ShieldCheck, TreePine, Download, RefreshCw, AlertCircle, Database, Lock, Shield } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/supabaseClient'; 
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

  const isSystemAdmin = currentUser.username === 'admin';

  // Lọc danh sách nhân sự có thể nhìn thấy
  const visibleUsers = useMemo(() => {
      if (isSystemAdmin) return users;
      // Sub-admin chỉ nhìn thấy nhân viên trong đơn vị của mình
      return users.filter(u => u.unitId === currentUser.unitId);
  }, [users, isSystemAdmin, currentUser.unitId]);

  // Lọc danh sách đơn vị có thể nhìn thấy
  const visibleUnits = useMemo(() => {
      if (isSystemAdmin) return units;
      return units.filter(u => u.id === currentUser.unitId);
  }, [units, isSystemAdmin, currentUser.unitId]);

  const generateUnitCode = () => {
      const num = Math.floor(Math.random() * 9999) + 1;
      return `QNH${num.toString().padStart(4, '0')}`;
  };

  const unitTree = useMemo(() => {
      const build = (data: Unit[], parentId: string | null = null): any[] => {
          return data
              .filter(item => item.parentId === parentId)
              .map(item => ({ ...item, children: build(data, item.id) }));
      };
      const root = visibleUnits.find(u => u.code === 'VNPT_QN' || !u.parentId);
      if (!root && visibleUnits.length > 0) return build(visibleUnits, null);
      return root ? [{ ...root, children: build(visibleUnits, root.id) }] : [];
  }, [visibleUnits]);

  const TreeRow: React.FC<{ item: any; level: number }> = ({ item, level }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = item.children && item.children.length > 0;
      return (
          <div className="flex flex-col">
              <div className={`flex items-center group py-4 px-8 hover:bg-blue-50 transition-all border-b border-slate-50 ${level === 0 ? 'bg-slate-50/50 font-black' : ''}`}>
                  <div style={{ width: `${level * 32}px` }} className="shrink-0" />
                  <button onClick={() => setIsOpen(!isOpen)} className={`p-1 mr-3 text-slate-400 hover:text-blue-600 ${!hasChildren ? 'invisible' : ''}`}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <Building size={18} className={`mr-4 ${level === 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800 tracking-tight">{item.name}</div>
                      <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">{item.code}</div>
                  </div>
                  {isSystemAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handleEdit(item)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl shadow-sm border border-transparent hover:border-blue-100"><Edit2 size={16}/></button>
                        {item.code !== 'VNPT_QN' && <button onClick={() => handleDelete(item.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-2xl shadow-sm border border-transparent hover:border-red-100"><Trash2 size={16}/></button>}
                    </div>
                  )}
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
        
        if (activeTab === 'units') {
            const code = editingItem ? formData.code : generateUnitCode();
            let pId = formData.parentId;
            if (!pId && code !== 'VNPT_QN') {
                const root = units.find(u => u.code === 'VNPT_QN');
                pId = root ? root.id : null;
            }
            await dbClient.upsert('units', id, {
                id, code, name: formData.name, parent_id: pId,
                level: pId ? (units.find(u => u.id === pId)?.level || 0) + 1 : 0
            });
        } else {
            // Không cho phép sub-admin đổi unit cho user khác ngoài unit của chính mình
            const unitId = isSystemAdmin ? (formData.unitId || units[0]?.id) : currentUser.unitId;
            
            await dbClient.upsert('users', id, {
                id, hrm_code: formData.hrmCode, full_name: formData.fullName,
                username: formData.username,
                password: editingItem ? (formData.newPassword ? md5(formData.newPassword) : formData.password) : md5(formData.password || '123456'),
                title: formData.title, unit_id: unitId, email: formData.email,
                is_first_login: editingItem ? (formData.newPassword ? true : formData.isFirstLogin) : true,
                can_manage: formData.canManageUsers || false
            });
        }
        setIsModalOpen(false);
        window.location.reload(); 
    } catch (err: any) {
        alert("Lỗi: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Xác nhận xóa khỏi Cloud?")) {
          setIsProcessing(true);
          try {
              await dbClient.delete(activeTab, id);
              window.location.reload();
          } catch (e: any) { alert("Lỗi: " + e.message); }
          finally { setIsProcessing(false); }
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-4">
                <ShieldCheck className="text-blue-600" size={40} /> QUẢN TRỊ NHÂN SỰ
            </h2>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">
                {isSystemAdmin ? 'Toàn quyền Hệ thống' : `Quản trị Đơn vị: ${units.find(u => u.id === currentUser.unitId)?.name}`}
            </p>
        </div>
        <div className="flex bg-slate-200 p-1.5 rounded-3xl border border-slate-300">
          {isSystemAdmin && <button onClick={() => setActiveTab('units')} className={`px-10 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-3 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-2xl' : 'text-slate-500'}`}><TreePine size={18}/> ĐƠN VỊ</button>}
          <button onClick={() => setActiveTab('users')} className={`px-10 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-3 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-2xl' : 'text-slate-500'}`}><Users size={18}/> NHÂN SỰ</button>
        </div>
      </div>

      <div className="bg-white rounded-[50px] shadow-2xl border border-slate-100 overflow-hidden min-h-[500px] flex flex-col relative">
          {isProcessing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-md z-[60] flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600" size={64} />
                  <span className="font-black text-blue-900 uppercase tracking-widest mt-6">Đang lưu dữ liệu...</span>
              </div>
          )}

          <div className="p-10 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-8">
              <h3 className="font-black text-slate-400 flex items-center gap-4 text-xs uppercase tracking-widest">
                {activeTab === 'units' ? <Building size={20}/> : <UserIcon size={20}/>}
                {activeTab === 'units' ? 'Cấu trúc đơn vị' : 'Nhân sự thuộc quyền quản lý'}
              </h3>
              <button onClick={() => { setEditingItem(null); setFormData(activeTab === 'users' ? { unitId: currentUser.unitId } : {}); setIsModalOpen(true); }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-all">
                  <Plus size={20}/> THÊM MỚI
              </button>
          </div>

          <div className="flex-1 overflow-auto">
              {activeTab === 'units' ? (
                  <div className="divide-y divide-slate-50">
                      {unitTree.map(root => <TreeRow key={root.id} item={root} level={0} />)}
                  </div>
              ) : (
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest sticky top-0">
                          <tr>
                              <th className="p-8 border-b">Họ tên & Tài khoản</th>
                              <th className="p-8 border-b">Mã HRM</th>
                              <th className="p-8 border-b">Loại TK</th>
                              <th className="p-8 border-right text-right">Hành động</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {visibleUsers.sort((a,b) => a.username === 'admin' ? -1 : 1).map((user: any) => (
                              <tr key={user.id} className="hover:bg-blue-50/30 transition-all group">
                                  <td className="p-8">
                                      <div className="font-black text-slate-800 flex items-center gap-3 text-lg tracking-tighter">
                                          {user.fullName}
                                          {user.username === 'admin' && <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full uppercase">Root</span>}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-bold uppercase mt-1.5">{user.title} • @{user.username}</div>
                                  </td>
                                  <td className="p-8 font-mono text-sm text-blue-600 font-black">{user.hrmCode}</td>
                                  <td className="p-8">
                                      {user.canManageUsers ? (
                                          <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 uppercase"><Shield size={14}/> Sub-Admin</span>
                                      ) : (
                                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nhân viên</span>
                                      )}
                                  </td>
                                  <td className="p-8 text-right">
                                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                          <button onClick={() => handleEdit(user)} className="p-4 text-slate-300 hover:text-blue-600 hover:bg-white rounded-3xl border border-transparent hover:border-blue-100 shadow-xl"><Edit2 size={18}/></button>
                                          {user.username !== 'admin' && (
                                              <button onClick={() => handleDelete(user.id)} className="p-4 text-slate-300 hover:text-red-600 hover:bg-white rounded-3xl border border-transparent hover:border-red-100 shadow-xl"><Trash2 size={18}/></button>
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
          <div className="fixed inset-0 z-[100] bg-slate-900/80 flex items-center justify-center p-6 backdrop-blur-xl">
              <div className="bg-white rounded-[60px] w-full max-w-2xl shadow-2xl overflow-hidden border border-white">
                  <div className="p-10 border-b bg-slate-50 flex justify-between items-center">
                      <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{editingItem ? 'Chỉnh sửa' : 'Tạo mới'}</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{activeTab}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-red-500 p-4 rounded-full transition-all"><X size={32}/></button>
                  </div>
                  
                  <div className="p-12 space-y-8 max-h-[60vh] overflow-y-auto">
                      {activeTab === 'users' ? (
                          <div className="grid grid-cols-2 gap-8">
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Họ và tên</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold text-slate-700 bg-slate-50" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mã HRM</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-mono text-blue-600 font-black bg-slate-50 uppercase" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Username</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold text-slate-700 bg-slate-50" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={formData.username === 'admin'} />
                            </div>
                            <div className="col-span-2 p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield className="text-blue-600" size={24}/>
                                    <div>
                                        <div className="text-sm font-black text-blue-900">Quyền quản trị đơn vị (Sub-Admin)</div>
                                        <div className="text-[10px] text-blue-400 font-bold uppercase mt-0.5">Cho phép quản lý nhân sự thuộc đơn vị này</div>
                                    </div>
                                </div>
                                <input type="checkbox" className="w-6 h-6 rounded-lg border-2" checked={formData.canManageUsers || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{editingItem ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu (Mặc định: 123456)'}</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 bg-slate-50" type="password" onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Chức danh</label>
                                <select className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {isSystemAdmin && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Phòng ban</label>
                                    <select className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            )}
                          </div>
                      ) : (
                          <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tên phòng ban / Trung tâm</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                          </div>
                      )}
                  </div>

                  <div className="p-12 border-t bg-slate-50 flex justify-end gap-6">
                      <button onClick={() => setIsModalOpen(false)} className="px-10 py-5 text-slate-400 font-black uppercase text-xs tracking-widest">Hủy bỏ</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-14 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-blue-700 transition-all">Xác nhận Lưu</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
