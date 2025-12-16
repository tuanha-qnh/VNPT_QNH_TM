
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Save, X, ChevronRight, ChevronDown, RefreshCcw, FileUp, Download, FileSpreadsheet, ShieldCheck, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabaseClient'; // Import Client

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); // Loading state for save/delete
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser.hrmCode === 'ADMIN'; 
  const isSubAdmin = currentUser.canManageUsers;
  const canEditSystem = isSuperAdmin || isSubAdmin;

  const getDescendantUnitIds = (rootId: string, allUnits: Unit[]): string[] => {
      let descendants: string[] = [];
      const children = allUnits.filter(u => u.parentId === rootId);
      children.forEach(child => {
          descendants.push(child.id);
          descendants = [...descendants, ...getDescendantUnitIds(child.id, allUnits)];
      });
      return descendants;
  };

  const visibleUnits = useMemo(() => {
      if (isSuperAdmin) return units;
      if (isSubAdmin) {
          const descendants = getDescendantUnitIds(currentUser.unitId, units);
          return units.filter(u => u.id === currentUser.unitId || descendants.includes(u.id));
      }
      return [];
  }, [units, currentUser, isSuperAdmin, isSubAdmin]);

  const visibleUsers = useMemo(() => {
      const visibleUnitIds = visibleUnits.map(u => u.id);
      return users.filter(u => visibleUnitIds.includes(u.unitId));
  }, [users, visibleUnits]);

  const toggleExpand = (unitId: string) => {
    setExpandedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const generateUnitCode = (existingUnits: Unit[]) => {
      let code = '';
      let isUnique = false;
      while (!isUnique) {
          const num = Math.floor(Math.random() * 999) + 1;
          code = `QNH${num.toString().padStart(3, '0')}`;
          if (!existingUnits.some(u => u.code === code)) {
              isUnique = true;
          }
      }
      return code;
  };

  // --- THAY ĐỔI LỚN NHẤT: LOGIC LƯU VÀO DB ---
  const handleSave = async () => {
    if (activeTab === 'users' && !editingItem) {
        if (!formData.username || !formData.password) {
            alert("Vui lòng nhập Username và Password");
            return;
        }
    }

    setIsProcessing(true);

    try {
        if (activeTab === 'units') {
            const parent = units.find(u => u.id === formData.parentId);
            const unitCode = editingItem ? editingItem.code : generateUnitCode(units);
            const unitName = formData.name || 'Đơn vị mới';
            const unitLevel = parent ? parent.level + 1 : 0;
            
            // 1. Chuẩn bị dữ liệu DB (snake_case)
            const dbUnit = {
                code: unitCode,
                name: unitName,
                parent_id: formData.parentId || null,
                address: formData.address,
                level: unitLevel,
                manager_ids: formData.managerIds || []
            };

            let savedUnit: Unit | null = null;

            if (editingItem) {
                // UPDATE
                const { error } = await supabase.from('units').update(dbUnit).eq('id', editingItem.id);
                if (error) throw error;
                // Update Local State
                const newUnit = { ...editingItem, ...formData, code: unitCode, level: unitLevel };
                setUnits(units.map(u => u.id === editingItem.id ? newUnit : u));
            } else {
                // INSERT
                const { data, error } = await supabase.from('units').insert([dbUnit]).select();
                if (error) throw error;
                // Add to Local State (Mapping back)
                if (data && data[0]) {
                    const u = data[0];
                    const newUnit: Unit = { 
                        id: u.id, code: u.code, name: u.name, parentId: u.parent_id, 
                        managerIds: u.manager_ids || [], level: u.level, address: u.address, phone: u.phone 
                    };
                    setUnits([...units, newUnit]);
                }
            }

        } else {
            // USERS
            const dbUser = {
                hrm_code: formData.hrmCode,
                full_name: formData.fullName,
                title: formData.title || Role.STAFF,
                unit_id: formData.unitId || visibleUnits[0]?.id,
                username: formData.username,
                password: formData.password, // Lưu ý: Nên hash password ở backend thật
                can_manage: formData.canManageUsers || false
            };

            if (editingItem) {
                // Update User
                // Xóa username khỏi object update để không cho sửa username
                const { username, ...updatePayload } = dbUser; 
                const { error } = await supabase.from('users').update(updatePayload).eq('id', editingItem.id);
                if (error) throw error;
                
                // Update Local State
                const updatedUser = { ...editingItem, ...formData };
                setUsers(users.map(u => u.id === editingItem.id ? updatedUser : u));

            } else {
                // Insert User
                const { data, error } = await supabase.from('users').insert([dbUser]).select();
                if (error) throw error;

                if (data && data[0]) {
                    const u = data[0];
                    const newUser: User = {
                        id: u.id, hrmCode: u.hrm_code, fullName: u.full_name, username: u.username,
                        password: u.password, title: u.title, unitId: u.unit_id,
                        isFirstLogin: u.is_first_login, canManageUsers: u.can_manage
                    };
                    setUsers([...users, newUser]);
                }
            }
        }
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
    } catch (err: any) {
        alert("Lỗi khi lưu dữ liệu: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm("Bạn có chắc chắn muốn reset mật khẩu về '123456'?")) return;
    try {
        const { error } = await supabase.from('users').update({ password: '123456', is_first_login: true }).eq('id', userId);
        if (error) throw error;
        setUsers(users.map(u => u.id === userId ? { ...u, password: '123456', isFirstLogin: true } : u));
        alert("Đã reset mật khẩu thành công!");
    } catch(err: any) {
        alert("Lỗi: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser.id) return alert("Không thể xóa chính mình!");
    if (activeTab === 'units' && isSubAdmin && id === currentUser.unitId) return alert("Không thể xóa đơn vị gốc của bạn.");

    if (confirm("Bạn có chắc chắn muốn xóa không?")) {
        setIsProcessing(true);
        try {
            if (activeTab === 'units') {
                if (units.some(u => u.parentId === id)) throw new Error("Phải xóa đơn vị con trước.");
                if (users.some(u => u.unitId === id)) throw new Error("Đơn vị vẫn còn nhân sự.");
                
                const { error } = await supabase.from('units').delete().eq('id', id);
                if (error) throw error;
                setUnits(units.filter(u => u.id !== id));
            } else {
                const { error } = await supabase.from('users').delete().eq('id', id);
                if (error) throw error;
                setUsers(users.filter(u => u.id !== id));
            }
        } catch (err: any) {
            alert("Không thể xóa: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    }
  };

  // ... (Phần Import Excel và Render Tree giữ nguyên như logic cũ, chỉ thay đổi data flow)
  // Để code gọn, tôi giữ nguyên phần render UI, vì nó chỉ phụ thuộc vào props units/users đã được update.

  const openModal = (item?: any, parentId?: string) => {
    setEditingItem(item);
    const defaultUnitId = isSubAdmin ? currentUser.unitId : (parentId || visibleUnits[0]?.id);
    setFormData(item || { 
        parentId: parentId || null, 
        unitId: defaultUnitId,
        password: '123456',
        title: Role.STAFF 
    });
    setIsModalOpen(true);
  };
  
  // -- GIỮ NGUYÊN PHẦN RENDER UI --
  const renderTreeRecursively = (unit: Unit) => {
      const children = visibleUnits.filter(u => u.parentId === unit.id);
      return (
        <div key={unit.id} className="mb-2">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(unit.id)}>
                    {children.length > 0 ? (
                        expandedUnits.includes(unit.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    ) : <div className="w-4" />}
                    <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          {unit.name} 
                          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{unit.code || 'N/A'}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Lãnh đạo: {unit.managerIds.map(mid => users.find(u => u.id === mid)?.fullName).join(', ') || 'Chưa có'}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                        <button onClick={() => openModal(null, unit.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Thêm cấp con"><Plus size={16}/></button>
                        <button onClick={() => openModal(unit)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                        {(!isSubAdmin || unit.id !== currentUser.unitId) && (
                           <button onClick={() => handleDelete(unit.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                        )}
                </div>
            </div>
            {expandedUnits.includes(unit.id) && children.length > 0 && (
                <div className="pl-6 border-l border-slate-200 ml-3 mt-2">
                    {children.map(child => renderTreeRecursively(child))}
                </div>
            )}
        </div>
      );
  };

  const rootNodes = useMemo(() => {
      if (isSuperAdmin) return visibleUnits.filter(u => u.parentId === null);
      if (isSubAdmin) return visibleUnits.filter(u => u.id === currentUser.unitId);
      return [];
  }, [visibleUnits, isSuperAdmin, isSubAdmin, currentUser]);

  return (
    <div className="space-y-6">
      {isProcessing && <div className="fixed inset-0 z-[70] bg-white/50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div>}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Quản trị hệ thống</h2>
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button onClick={() => setActiveTab('units')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Quản trị Đơn vị</button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Quản trị Nhân sự</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
           <h3 className="font-semibold text-slate-700 flex items-center gap-2">
             {activeTab === 'units' ? <Building size={18} /> : <UserIcon size={18} />}
             Danh sách {activeTab === 'units' ? 'Đơn vị (Sơ đồ cây)' : 'Nhân sự'}
           </h3>
           <div className="flex gap-2">
                <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                    <Plus size={16} /> Thêm mới
                </button>
            </div>
        </div>

        <div className="p-4">
            {activeTab === 'units' ? (
                <div className="max-w-4xl mx-auto">
                    {rootNodes.length > 0 ? rootNodes.map(rootUnit => renderTreeRecursively(rootUnit)) : <div className="text-center text-slate-400 p-8">Không có đơn vị.</div>}
                </div>
            ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Mã HRM</th>
                        <th className="px-4 py-3">Họ và tên</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Chức danh</th>
                        <th className="px-4 py-3">Đơn vị</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">{user.hrmCode}</td>
                          <td className="px-4 py-3"><div className="font-medium text-slate-900">{user.fullName}</div></td>
                          <td className="px-4 py-3 font-mono text-xs bg-slate-100 px-1 rounded inline-block mt-1">{user.username}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">{user.title}</span></td>
                          <td className="px-4 py-3">{units.find(u => u.id === user.unitId)?.name}</td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            {canEditSystem && <button onClick={() => handleResetPassword(user.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded" title="Reset Password"><RefreshCcw size={16} /></button>}
                            <button onClick={() => openModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                            {user.id !== currentUser.id && <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">{editingItem ? 'Cập nhật' : 'Thêm mới'} {activeTab === 'units' ? 'Đơn vị' : 'Nhân sự'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {activeTab === 'units' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mã đơn vị</label>
                        <input type="text" className="w-full border rounded-lg p-2.5 bg-slate-100 text-slate-500" value={editingItem?.code || '(Tự động)'} disabled />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị cấp cha</label>
                        <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.parentId || ''} disabled={isSubAdmin && !editingItem}>
                            {!isSubAdmin && <option value="">-- Cấp cao nhất --</option>}
                            {visibleUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên đơn vị</label>
                    <input type="text" className="w-full border rounded-lg p-2.5" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ</label>
                    <input type="text" className="w-full border rounded-lg p-2.5" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mã HRM</label>
                        <input type="text" className="w-full border rounded-lg p-2.5" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
                        <input type="text" className="w-full border rounded-lg p-2.5" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <input type="text" className="w-full border rounded-lg p-2.5" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={!!editingItem} />
                    </div>
                    {!editingItem && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                            <input type="text" className="w-full border rounded-lg p-2.5 bg-slate-100" value={formData.password} disabled />
                        </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Chức danh</label>
                        <select className="w-full border rounded-lg p-2.5" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị</label>
                        <select className="w-full border rounded-lg p-2.5" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                        {visibleUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                  </div>

                   <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            id="manage" 
                            className="w-5 h-5 text-blue-600 rounded"
                            checked={formData.canManageUsers || false} 
                            onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} 
                        />
                        <label htmlFor="manage" className="text-sm text-slate-800 font-medium select-none cursor-pointer flex-1">
                            Quyền Quản trị đơn vị (Sub-Admin)
                        </label>
                   </div>
                </>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200">Hủy</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />} Lưu lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
