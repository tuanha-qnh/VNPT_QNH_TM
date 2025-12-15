import React, { useState } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Save, X, ChevronRight, ChevronDown, Lock, RefreshCcw } from 'lucide-react';

interface AdminProps {
  units: Unit[];
  users: User[];
  currentUser: User; // To check permissions
  setUnits: (units: Unit[]) => void;
  setUsers: (users: User[]) => void;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const Admin: React.FC<AdminProps> = ({ units, users, currentUser, setUnits, setUsers }) => {
  const [activeTab, setActiveTab] = useState<'units' | 'users'>('units');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [expandedUnits, setExpandedUnits] = useState<string[]>(['u1']); // Expand root by default

  const canEditUser = currentUser.title === Role.ADMIN;
  const canResetPass = currentUser.title === Role.ADMIN || currentUser.canManageUsers;

  // Helper to build unit tree
  const getChildUnits = (parentId: string | null) => units.filter(u => u.parentId === parentId);

  const toggleExpand = (unitId: string) => {
    setExpandedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const handleSave = () => {
    // Validation
    if (activeTab === 'users' && !editingItem) {
        if (!formData.username || !formData.password) {
            alert("Vui lòng nhập Username và Password");
            return;
        }
    }

    if (activeTab === 'units') {
      const parent = units.find(u => u.id === formData.parentId);
      const newUnit: Unit = {
        id: editingItem ? editingItem.id : `u${Date.now()}`,
        parentId: formData.parentId || null,
        name: formData.name || 'Đơn vị mới',
        managerIds: formData.managerIds || [],
        address: formData.address || '',
        phone: formData.phone || '',
        level: parent ? parent.level + 1 : 0
      };
      if (editingItem) {
        setUnits(units.map(u => u.id === editingItem.id ? newUnit : u));
      } else {
        setUnits([...units, newUnit]);
      }
    } else {
      const newUser: User = {
        id: editingItem ? editingItem.id : `usr${Date.now()}`,
        hrmCode: formData.hrmCode || '',
        fullName: formData.fullName || '',
        title: formData.title || Role.STAFF,
        unitId: formData.unitId || units[0]?.id,
        username: formData.username,
        password: formData.password, // In real app, hash this
        isFirstLogin: true, // New users always must change pass
        canManageUsers: formData.canManageUsers || false
      };

      if (editingItem) {
        // Only update fields that are allowed to be changed
        const updatedUser = { ...editingItem, ...newUser, password: editingItem.password }; // Keep old password unless reset
        setUsers(users.map(u => u.id === editingItem.id ? updatedUser : u));
      } else {
        setUsers([...users, newUser]);
      }
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleResetPassword = (userId: string) => {
    if (!confirm("Bạn có chắc chắn muốn reset mật khẩu về '123456'?")) return;
    setUsers(users.map(u => u.id === userId ? { ...u, password: '123456', isFirstLogin: true } : u));
    alert("Đã reset mật khẩu thành công!");
  };

  const handleDelete = (id: string) => {
    if (id === currentUser.id) {
        alert("Bạn không thể xóa chính mình!");
        return;
    }
    if (confirm("Bạn có chắc chắn muốn xóa?")) {
        if (activeTab === 'units') {
            // Check for children
            if (units.some(u => u.parentId === id)) {
                alert("Không thể xóa đơn vị đang có đơn vị con!");
                return;
            }
            setUnits(units.filter(u => u.id !== id));
        } else {
            setUsers(users.filter(u => u.id !== id));
        }
    }
  };

  const openModal = (item?: any, parentId?: string) => {
    setEditingItem(item);
    setFormData(item || { parentId: parentId || null, password: '123456' });
    setIsModalOpen(true);
  };

  // Recursive Unit Renderer
  const renderUnitTree = (parentId: string | null) => {
    const children = getChildUnits(parentId);
    if (children.length === 0) return null;

    return (
        <div className="pl-4 border-l border-slate-200 ml-2">
            {children.map(unit => (
                <div key={unit.id} className="mb-2">
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(unit.id)}>
                            {getChildUnits(unit.id).length > 0 ? (
                                expandedUnits.includes(unit.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                            ) : <div className="w-4" />}
                            <div>
                                <div className="font-semibold text-slate-800">{unit.name}</div>
                                <div className="text-xs text-slate-500">
                                    Lãnh đạo: {unit.managerIds.map(mid => users.find(u => u.id === mid)?.fullName).join(', ') || 'Chưa có'}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => openModal(null, unit.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Thêm cấp con"><Plus size={16}/></button>
                             <button onClick={() => openModal(unit)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => handleDelete(unit.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    {expandedUnits.includes(unit.id) && renderUnitTree(unit.id)}
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="space-y-6">
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
           {(activeTab === 'units' || canEditUser) && (
              <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Plus size={16} /> Thêm mới
              </button>
           )}
        </div>

        <div className="p-4">
            {activeTab === 'units' ? (
                <div className="max-w-4xl mx-auto">
                    {/* Render Root Level manually first or recursively */}
                    {getChildUnits(null).length > 0 ? renderUnitTree(null) : <div className="text-center text-slate-400">Chưa có dữ liệu</div>}
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
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">{user.hrmCode}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                          <td className="px-4 py-3 font-mono text-xs bg-slate-100 px-1 rounded inline-block mt-1">{user.username}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">{user.title}</span></td>
                          <td className="px-4 py-3">{units.find(u => u.id === user.unitId)?.name}</td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            {canResetPass && (
                                <button onClick={() => handleResetPassword(user.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded" title="Reset Password"><RefreshCcw size={16} /></button>
                            )}
                            {canEditUser && (
                                <>
                                    <button onClick={() => openModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            )}
        </div>
      </div>

      {/* Modal */}
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị cấp cha</label>
                    <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.parentId || ''} disabled>
                        <option value="">-- Cấp cao nhất --</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
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
                            <p className="text-xs text-slate-500 mt-1">Mặc định: 123456</p>
                        </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chức danh</label>
                    <select className="w-full border rounded-lg p-2.5" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                      {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị</label>
                    <select className="w-full border rounded-lg p-2.5" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                   <div className="flex items-center gap-2 mt-4">
                        <input type="checkbox" id="manage" checked={formData.canManageUsers || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                        <label htmlFor="manage" className="text-sm text-slate-700 select-none">Cho phép quản lý User (Sub-Admin)</label>
                   </div>
                </>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200">Hủy</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"><Save size={16} /> Lưu lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
