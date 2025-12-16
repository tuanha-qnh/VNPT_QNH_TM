import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Save, X, ChevronRight, ChevronDown, RefreshCcw, FileUp, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminProps {
  units: Unit[];
  users: User[];
  currentUser: User; // To check permissions
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- PERMISSIONS & SCOPING ---
  const isSuperAdmin = currentUser.hrmCode === 'ADMIN'; 
  const isSubAdmin = currentUser.canManageUsers;
  const canEditSystem = isSuperAdmin || isSubAdmin;

  // 1. Get all descendant unit IDs (Recursive) to build the scope
  const getDescendantUnitIds = (rootId: string, allUnits: Unit[]): string[] => {
      let descendants: string[] = [];
      const children = allUnits.filter(u => u.parentId === rootId);
      children.forEach(child => {
          descendants.push(child.id);
          descendants = [...descendants, ...getDescendantUnitIds(child.id, allUnits)];
      });
      return descendants;
  };

  // 2. Determine Visible Units based on permissions
  const visibleUnits = useMemo(() => {
      if (isSuperAdmin) return units;
      // If Sub-admin: only show their unit and its descendants
      if (isSubAdmin) {
          const descendants = getDescendantUnitIds(currentUser.unitId, units);
          return units.filter(u => u.id === currentUser.unitId || descendants.includes(u.id));
      }
      return [];
  }, [units, currentUser, isSuperAdmin, isSubAdmin]);

  // 3. Determine Visible Users based on visible units
  const visibleUsers = useMemo(() => {
      const visibleUnitIds = visibleUnits.map(u => u.id);
      return users.filter(u => visibleUnitIds.includes(u.unitId));
  }, [users, visibleUnits]);

  // Helper to find children within the visible scope
  const getChildUnits = (parentId: string | null) => visibleUnits.filter(u => u.parentId === parentId);

  const toggleExpand = (unitId: string) => {
    setExpandedUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  // Generate random QNHxxx code
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
      const unitCode = editingItem ? editingItem.code : generateUnitCode(units);

      const newUnit: Unit = {
        id: editingItem ? editingItem.id : `u${Date.now()}`,
        code: unitCode,
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
        unitId: formData.unitId || visibleUnits[0]?.id,
        username: formData.username,
        password: formData.password,
        isFirstLogin: true, 
        canManageUsers: formData.canManageUsers || false
      };

      if (editingItem) {
        const updatedUser = { ...editingItem, ...newUser, password: editingItem.password }; // Keep old password
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
    // 1. Prevent deleting self
    if (id === currentUser.id) {
        alert("Bạn không thể tự xóa chính mình khỏi hệ thống!");
        return;
    }

    // 2. Sub-admin cannot delete their own root unit
    if (activeTab === 'units' && isSubAdmin && id === currentUser.unitId) {
        alert("Bạn là quản trị viên của đơn vị này, không thể tự xóa đơn vị của mình.");
        return;
    }

    if (confirm("Bạn có chắc chắn muốn xóa dữ liệu này không? Hành động này không thể hoàn tác.")) {
        if (activeTab === 'units') {
            // Check dependencies: Children
            if (units.some(u => u.parentId === id)) {
                alert("KHÔNG THỂ XÓA: Đơn vị này đang chứa các đơn vị cấp con.\n\n-> Vui lòng xóa các đơn vị con trước.");
                return;
            }
            // Check dependencies: Users
            if (users.some(u => u.unitId === id)) {
                alert("KHÔNG THỂ XÓA: Đơn vị này đang có nhân sự.\n\n-> Vui lòng xóa hoặc chuyển nhân sự sang đơn vị khác trước.");
                return;
            }
            // Proceed to delete unit
            setUnits(units.filter(u => u.id !== id));
        } else {
            // Proceed to delete user
            setUsers(users.filter(u => u.id !== id));
        }
    }
  };

  const openModal = (item?: any, parentId?: string) => {
    setEditingItem(item);
    // If Sub-admin creates user, default unit is their unit
    const defaultUnitId = isSubAdmin ? currentUser.unitId : (parentId || visibleUnits[0]?.id);
    
    setFormData(item || { 
        parentId: parentId || null, 
        unitId: defaultUnitId,
        password: '123456',
        title: Role.STAFF 
    });
    setIsModalOpen(true);
  };

  // --- IMPORT LOGIC START ---
  const handleDownloadUserTemplate = () => {
      const headers = [['HRM_CODE', 'HO_TEN', 'USERNAME', 'CHUC_DANH', 'MA_DON_VI']];
      const sample = [['VNPT999', 'Nguyễn Văn Mẫu', 'maunv', 'Nhân viên', visibleUnits[0]?.code || 'QNH001']];
      const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
      const unitHeader = [['MA_DON_VI', 'TEN_DON_VI']];
      const unitRows = visibleUnits.map(u => [u.code, u.name]);
      const wsRef = XLSX.utils.aoa_to_sheet([...unitHeader, ...unitRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NHAP_LIEU");
      XLSX.utils.book_append_sheet(wb, wsRef, "DANH_SACH_MA_DON_VI");
      XLSX.writeFile(wb, "Mau_Nhap_Nhan_Su.xlsx");
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[] = XLSX.utils.sheet_to_json(ws);

          if (data.length === 0) {
              alert("File không có dữ liệu!");
              return;
          }

          let successCount = 0;
          let updateCount = 0;
          const currentUsers = [...users];

          data.forEach((row) => {
              const hrmCode = row['HRM_CODE'] ? String(row['HRM_CODE']).trim() : '';
              const fullName = row['HO_TEN'] ? String(row['HO_TEN']).trim() : '';
              const username = row['USERNAME'] ? String(row['USERNAME']).trim() : '';
              const title = row['CHUC_DANH'] ? String(row['CHUC_DANH']).trim() : Role.STAFF;
              const unitCodeImport = row['MA_DON_VI'] ? String(row['MA_DON_VI']).trim() : '';

              if (hrmCode && username) {
                  const existingIndex = currentUsers.findIndex(u => u.hrmCode === hrmCode || u.username === username);
                  // Scope check: Ensure imported user belongs to visible units
                  const targetUnit = visibleUnits.find(u => u.code === unitCodeImport);
                  if (!targetUnit) return; // Skip if unit not allowed

                  const userObj: User = {
                      id: existingIndex >= 0 ? currentUsers[existingIndex].id : `usr${Date.now()}_${Math.floor(Math.random()*1000)}`,
                      hrmCode, fullName, username, title,
                      unitId: targetUnit.id,
                      password: existingIndex >= 0 ? currentUsers[existingIndex].password : '123456',
                      isFirstLogin: existingIndex >= 0 ? currentUsers[existingIndex].isFirstLogin : true,
                      canManageUsers: false
                  };

                  if (existingIndex >= 0) {
                      currentUsers[existingIndex] = { ...currentUsers[existingIndex], ...userObj };
                      updateCount++;
                  } else {
                      currentUsers.push(userObj);
                      successCount++;
                  }
              }
          });
          setUsers(currentUsers);
          alert(`Đã xử lý xong!\n- Thêm mới: ${successCount}\n- Cập nhật: ${updateCount}`);
          setIsImportModalOpen(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsBinaryString(file);
  };
  // --- IMPORT LOGIC END ---

  // RECURSIVE RENDERER
  // Important: We need to pass the *actual* node to render, not just rely on parentId lookup
  // because Sub-admin root has a parentId that might not be visible.
  const renderTreeRecursively = (unit: Unit) => {
      // Find children of this unit within visibleUnits
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
                        
                        {/* Logic hiển thị nút Xóa */}
                        {/* Admin xóa được mọi thứ trừ chính mình (check trong function). Sub-admin xóa được mọi thứ trừ unit gốc của mình. */}
                        {(!isSubAdmin || unit.id !== currentUser.unitId) && (
                           <button onClick={() => handleDelete(unit.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                        )}
                </div>
            </div>
            
            {/* Recursion for Children */}
            {expandedUnits.includes(unit.id) && children.length > 0 && (
                <div className="pl-6 border-l border-slate-200 ml-3 mt-2">
                    {children.map(child => renderTreeRecursively(child))}
                </div>
            )}
        </div>
      );
  };

  // Determine the Root Nodes for the Tree View
  const rootNodes = useMemo(() => {
      if (isSuperAdmin) {
          // Admin starts at actual roots (parentId is null)
          return visibleUnits.filter(u => u.parentId === null);
      } else if (isSubAdmin) {
          // Sub-admin starts at their specific unit
          return visibleUnits.filter(u => u.id === currentUser.unitId);
      }
      return [];
  }, [visibleUnits, isSuperAdmin, isSubAdmin, currentUser]);


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
             {isSubAdmin && !isSuperAdmin && <span className="text-xs font-normal text-slate-500">(Phạm vi quản lý: {visibleUnits.find(u => u.id === currentUser.unitId)?.name})</span>}
           </h3>
           <div className="flex gap-2">
                {activeTab === 'users' && (
                    <button onClick={() => setIsImportModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <FileUp size={16} /> Import Excel
                    </button>
                )}
                {/* Chỉ hiện nút thêm mới khi ở tab users hoặc (tab units và user có quyền) */}
                <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                    <Plus size={16} /> Thêm mới
                </button>
            </div>
        </div>

        <div className="p-4">
            {activeTab === 'units' ? (
                <div className="max-w-4xl mx-auto">
                     {/* Render Tree from Calculated Root Nodes */}
                    {rootNodes.length > 0 ? (
                        rootNodes.map(rootUnit => renderTreeRecursively(rootUnit))
                    ) : (
                        <div className="text-center text-slate-400 p-8">Không có đơn vị nào để hiển thị.</div>
                    )}
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
                          <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 flex items-center gap-2">
                                  {user.fullName}
                                  {user.canManageUsers && <ShieldCheck size={14} className="text-blue-600" title="Sub-Admin (Có quyền quản trị)" />}
                              </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs bg-slate-100 px-1 rounded inline-block mt-1">{user.username}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">{user.title}</span></td>
                          <td className="px-4 py-3">{units.find(u => u.id === user.unitId)?.name}</td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            {canEditSystem && (
                                <button onClick={() => handleResetPassword(user.id)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded" title="Reset Password"><RefreshCcw size={16} /></button>
                            )}
                            <button onClick={() => openModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                            {/* Nút xóa: không hiện với chính mình */}
                            {user.id !== currentUser.id && (
                                <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
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

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-green-700 flex items-center gap-2"><FileSpreadsheet size={20}/> Import Nhân sự từ Excel</h3>
                      <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                          <p className="font-bold mb-1">Hướng dẫn:</p>
                          <ul className="list-disc pl-5 space-y-1">
                              <li>Bước 1: Tải file mẫu.</li>
                              <li>Bước 2: Điền thông tin nhân viên (lấy Mã Đơn Vị từ sheet 2).</li>
                              <li>Bước 3: Upload file.</li>
                              {isSubAdmin && !isSuperAdmin && <li className="text-red-600 font-bold">Lưu ý: Bạn chỉ được phép import nhân sự vào đơn vị của bạn.</li>}
                          </ul>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                           <button onClick={handleDownloadUserTemplate} className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                                <Download size={24} className="mb-2" />
                                <span className="font-bold">Tải file mẫu (.xlsx)</span>
                           </button>

                           <div className="relative">
                               <input 
                                  type="file" 
                                  ref={fileInputRef}
                                  onChange={handleImportUsers}
                                  className="hidden"
                                  accept=".xlsx, .xls"
                               />
                               <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center justify-center gap-2"
                               >
                                   <FileUp size={20} /> Chọn file Import
                               </button>
                           </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

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
                        <input type="text" className="w-full border rounded-lg p-2.5 bg-slate-100 text-slate-500" value={editingItem?.code || '(Tự động sinh sau khi lưu)'} disabled />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị cấp cha</label>
                        <select className="w-full border rounded-lg p-2.5 bg-slate-50" value={formData.parentId || ''} disabled={isSubAdmin && !editingItem}>
                            {/* SubAdmin can only create children for their own scoped units */}
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
                            <p className="text-xs text-slate-500 mt-1">Mặc định: 123456</p>
                        </div>
                    )}
                  </div>
                  
                  {/* Select Role & Unit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Chức danh</label>
                        <select className="w-full border rounded-lg p-2.5" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị trực thuộc</label>
                        <select className="w-full border rounded-lg p-2.5" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                        {visibleUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                  </div>

                  {/* Sub-Admin Checkbox */}
                   <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            id="manage" 
                            className="w-5 h-5 text-blue-600 rounded"
                            checked={formData.canManageUsers || false} 
                            onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} 
                        />
                        <label htmlFor="manage" className="text-sm text-slate-800 font-medium select-none cursor-pointer flex-1">
                            Cấp quyền Quản trị đơn vị (Sub-Admin)
                            <span className="block text-xs text-slate-500 font-normal">Người này có thể thêm/sửa/xóa nhân sự thuộc đơn vị của họ và các đơn vị cấp dưới.</span>
                        </label>
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