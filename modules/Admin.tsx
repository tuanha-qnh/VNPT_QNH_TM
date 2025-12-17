
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Save, X, ChevronRight, ChevronDown, RefreshCcw, FileUp, Download, FileSpreadsheet, ShieldCheck, Loader2, FolderInput } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabaseClient'; 
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Move Unit State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [unitToMove, setUnitToMove] = useState<Unit | null>(null);
  const [targetParentId, setTargetParentId] = useState<string>('');

  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); 
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

  const handleDownloadTemplate = () => {
      const headers = ['HRM_CODE', 'FULL_NAME', 'EMAIL', 'USERNAME', 'PASSWORD', 'TITLE', 'UNIT_CODE'];
      const sampleData = [
          ['VNPT001', 'Nguyễn Văn A', 'vana@vnpt.vn', 'vana', '123456', 'Nhân viên', 'VNPT_QN'],
          ['VNPT002', 'Trần Thị B', 'thib@vnpt.vn', 'thib', '123456', 'Trưởng phòng', 'VNPT_QN']
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "User_Template");
      XLSX.writeFile(wb, "Mau_Nhap_Nhan_Su.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              setIsProcessing(true);
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsName = wb.SheetNames[0];
              const ws = wb.Sheets[wsName];
              const data = XLSX.utils.sheet_to_json(ws);
              if (data.length === 0) throw new Error("File không có dữ liệu!");
              const newUsersPayload: any[] = [];
              const errors: string[] = [];
              
              data.forEach((row: any, index) => {
                  const hrmCode = row['HRM_CODE'];
                  const username = row['USERNAME'];
                  const unitCode = row['UNIT_CODE'];
                  
                  if (!hrmCode || !username || !unitCode) { 
                      errors.push(`Dòng ${index + 2}: Thiếu HRM_CODE, USERNAME hoặc UNIT_CODE`); 
                      return; 
                  }
                  
                  const targetUnit = units.find(u => u.code === unitCode);
                  if (!targetUnit) { 
                      errors.push(`Dòng ${index + 2}: Mã đơn vị '${unitCode}' không tồn tại.`); 
                      return; 
                  }
                  
                  // FIX PASSWORDS: Force convert to string and trim spaces
                  let rawPassword = '123456'; 
                  const excelPass = row['PASSWORD'];
                  if (excelPass !== undefined && excelPass !== null && String(excelPass).trim() !== '') {
                      rawPassword = String(excelPass).trim();
                  }

                  const hashedPassword = md5(rawPassword); 
                  
                  newUsersPayload.push({
                      hrm_code: String(hrmCode), 
                      full_name: row['FULL_NAME'] || 'Chưa đặt tên', 
                      email: row['EMAIL'] || '',
                      username: String(username).trim(), 
                      password: hashedPassword, 
                      title: row['TITLE'] || 'Nhân viên',
                      unit_id: targetUnit.id, 
                      can_manage: false, 
                      is_first_login: true
                  });
              });
              
              if (errors.length > 0) alert(`Có lỗi trong file:\n${errors.join('\n')}\n\nCác dòng hợp lệ vẫn sẽ được thêm.`);
              
              if (newUsersPayload.length > 0) {
                  const { data: insertedData, error } = await supabase.from('users').insert(newUsersPayload).select();
                  
                  if (error) throw error;
                  
                  if (insertedData) {
                      const mappedUsers: User[] = insertedData.map((u: any) => ({
                          id: u.id, hrmCode: u.hrm_code, fullName: u.full_name, email: u.email,
                          username: u.username, password: u.password, title: u.title, unitId: u.unit_id,
                          isFirstLogin: u.is_first_login, canManageUsers: u.can_manage
                      }));
                      setUsers([...users, ...mappedUsers]);
                      alert(`Đã thêm thành công ${insertedData.length} nhân sự!`);
                      setIsImportModalOpen(false);
                  }
              }
          } catch (err: any) { 
              console.error(err);
              if (err.message && (err.message.includes('users_password_key') || err.message.includes('unique constraint'))) {
                  alert(
                      "🚨 LỖI DATABASE NGHIÊM TRỌNG 🚨\n\n" +
                      "Cột mật khẩu (password) trong Database đang bị cài đặt ràng buộc DUY NHẤT (Unique).\n" +
                      "Điều này khiến bạn không thể tạo nhiều tài khoản có cùng mật khẩu '123456'.\n\n" +
                      "👉 CÁCH KHẮC PHỤC:\n" +
                      "1. Truy cập Supabase SQL Editor.\n" +
                      "2. Chạy lệnh SQL sau để gỡ bỏ ràng buộc:\n\n" +
                      "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_key;\n" +
                      "DROP INDEX IF EXISTS users_password_key;"
                  );
              } else {
                  alert("Lỗi nhập file: " + err.message); 
              }
          } finally { 
              setIsProcessing(false); 
              if (fileInputRef.current) fileInputRef.current.value = ''; 
          }
      };
      reader.readAsBinaryString(file);
  };

  // --- LOGIC DI CHUYỂN ĐƠN VỊ ---
  const openMoveModal = (unit: Unit) => {
      setUnitToMove(unit);
      setTargetParentId(unit.parentId || '');
      setIsMoveModalOpen(true);
  };

  const handleMoveUnit = async () => {
      if (!unitToMove) return;
      if (unitToMove.id === targetParentId) return alert("Không thể di chuyển vào chính nó!");
      
      setIsProcessing(true);
      try {
          const parent = units.find(u => u.id === targetParentId);
          const newLevel = parent ? parent.level + 1 : 0;
          
          const { error } = await supabase.from('units').update({ 
              parent_id: targetParentId || null,
              level: newLevel
          }).eq('id', unitToMove.id);

          if (error) throw error;

          // Update local state
          setUnits(units.map(u => u.id === unitToMove.id ? { ...u, parentId: targetParentId || null, level: newLevel } : u));
          alert(`Đã di chuyển đơn vị "${unitToMove.name}" thành công!`);
          setIsMoveModalOpen(false);
          setUnitToMove(null);
      } catch (err: any) {
          alert("Lỗi di chuyển: " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSave = async () => {
    if (activeTab === 'users' && !editingItem && (!formData.username || !formData.password)) { alert("Vui lòng nhập Username và Password"); return; }
    setIsProcessing(true);
    try {
        if (activeTab === 'units') {
            const parent = units.find(u => u.id === formData.parentId);
            const unitCode = editingItem ? editingItem.code : generateUnitCode(units);
            const unitName = formData.name || 'Đơn vị mới';
            const unitLevel = parent ? parent.level + 1 : 0;
            const dbUnit = { code: unitCode, name: unitName, parent_id: formData.parentId || null, address: formData.address, level: unitLevel, manager_ids: formData.managerIds || [] };
            if (editingItem) {
                const { error } = await supabase.from('units').update(dbUnit).eq('id', editingItem.id);
                if (error) throw error;
                const newUnit = { ...editingItem, ...formData, code: unitCode, level: unitLevel };
                setUnits(units.map(u => u.id === editingItem.id ? newUnit : u));
            } else {
                const { data, error } = await supabase.from('units').insert([dbUnit]).select();
                if (error) throw error;
                if (data && data[0]) {
                    const u = data[0];
                    const newUnit: Unit = { id: u.id, code: u.code, name: u.name, parentId: u.parent_id, managerIds: u.manager_ids || [], level: u.level, address: u.address, phone: u.phone };
                    setUnits([...units, newUnit]);
                }
            }
        } else {
            const dbUser: any = { hrm_code: formData.hrmCode, full_name: formData.fullName, email: formData.email, title: formData.title || Role.STAFF, unit_id: formData.unitId || visibleUnits[0]?.id, username: formData.username, can_manage: formData.canManageUsers || false };
            if (!editingItem) { 
                // Create: Hash password
                dbUser.password = md5(String(formData.password).trim()); 
                dbUser.is_first_login = true; 
            }
            if (editingItem) {
                const { username, password, ...updatePayload } = dbUser;
                const { error } = await supabase.from('users').update(updatePayload).eq('id', editingItem.id);
                if (error) throw error;
                const updatedUser = { ...editingItem, ...formData }; 
                setUsers(users.map(u => u.id === editingItem.id ? updatedUser : u));
            } else {
                const { data, error } = await supabase.from('users').insert([dbUser]).select();
                if (error) throw error;
                if (data && data[0]) {
                    const u = data[0];
                    const newUser: User = { id: u.id, hrmCode: u.hrm_code, fullName: u.full_name, email: u.email, username: u.username, password: u.password, title: u.title, unitId: u.unit_id, isFirstLogin: u.is_first_login, canManageUsers: u.can_manage };
                    setUsers([...users, newUser]);
                }
            }
        }
        setIsModalOpen(false); setEditingItem(null); setFormData({});
    } catch (err: any) { alert("Lỗi khi lưu dữ liệu: " + err.message); } finally { setIsProcessing(false); }
  };

  const handleResetPassword = async (userId: string) => { 
      if (!confirm("Bạn có chắc chắn muốn reset mật khẩu về '123456'?")) return; 
      try { 
          const defaultHash = md5('123456'); 
          const { error } = await supabase.from('users').update({ password: defaultHash, is_first_login: true }).eq('id', userId); 
          if (error) throw error; 
          setUsers(users.map(u => u.id === userId ? { ...u, password: defaultHash, isFirstLogin: true } : u)); 
          alert("Đã reset mật khẩu thành công!"); 
      } catch(err: any) { alert("Lỗi: " + err.message); } 
  };

  const handleDelete = async (id: string) => { if (id === currentUser.id) return alert("Không thể xóa chính mình!"); if (activeTab === 'units' && isSubAdmin && id === currentUser.unitId) return alert("Không thể xóa đơn vị gốc của bạn."); if (confirm("Bạn có chắc chắn muốn xóa không?")) { setIsProcessing(true); try { if (activeTab === 'units') { if (units.some(u => u.parentId === id)) throw new Error("Phải xóa đơn vị con trước."); if (users.some(u => u.unitId === id)) throw new Error("Đơn vị vẫn còn nhân sự."); const { error } = await supabase.from('units').delete().eq('id', id); if (error) throw error; setUnits(units.filter(u => u.id !== id)); } else { const { error } = await supabase.from('users').delete().eq('id', id); if (error) throw error; setUsers(users.filter(u => u.id !== id)); } } catch (err: any) { alert("Không thể xóa: " + err.message); } finally { setIsProcessing(false); } } };
  const openModal = (item?: any, parentId?: string) => { setEditingItem(item); const defaultUnitId = isSubAdmin ? currentUser.unitId : (parentId || visibleUnits[0]?.id); setFormData(item || { parentId: parentId || null, unitId: defaultUnitId, password: '123456', title: Role.STAFF }); setIsModalOpen(true); };
  
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
                        {canEditSystem && (
                            <button onClick={() => openMoveModal(unit)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Di chuyển đơn vị (Sáp nhập)"><FolderInput size={16}/></button>
                        )}
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
                {activeTab === 'users' && (
                    <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-green-600 text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <FileUp size={16} /> Import Excel
                    </button>
                )}
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
                        <th className="px-4 py-3">Email</th>
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
                          <td className="px-4 py-3 text-blue-600 truncate max-w-[150px]">{user.email}</td>
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

      {/* MOVE UNIT MODAL */}
      {isMoveModalOpen && unitToMove && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-orange-50">
                      <h3 className="font-bold text-lg text-orange-800 flex items-center gap-2"><FolderInput size={20}/> Di chuyển Đơn vị</h3>
                      <button onClick={() => setIsMoveModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-6">
                      <div className="bg-slate-50 p-3 rounded-lg border mb-4">
                          <div className="text-sm text-slate-500">Đơn vị cần chuyển:</div>
                          <div className="font-bold text-slate-800">{unitToMove.name}</div>
                      </div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Chọn đơn vị cha mới</label>
                      <select 
                        className="w-full border rounded-lg p-3 bg-white"
                        value={targetParentId || ''}
                        onChange={e => setTargetParentId(e.target.value)}
                      >
                          <option value="">-- Cấp cao nhất (Gốc) --</option>
                          {visibleUnits
                             .filter(u => u.id !== unitToMove.id && !getDescendantUnitIds(unitToMove.id, units).includes(u.id)) // Filter descendants to prevent loops
                             .map(u => (
                                 <option key={u.id} value={u.id}>{u.name}</option>
                             ))
                          }
                      </select>
                      <p className="text-xs text-slate-500 mt-2 italic">Lưu ý: Không thể chọn chính nó hoặc các đơn vị con của nó.</p>
                  </div>
                  <div className="p-4 border-t flex justify-end gap-3">
                      <button onClick={() => setIsMoveModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600">Hủy</button>
                      <button onClick={handleMoveUnit} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold flex items-center gap-2">
                         {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu thay đổi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-green-50">
                      <h3 className="font-bold text-lg text-green-800 flex items-center gap-2"><FileSpreadsheet size={20}/> Import Nhân sự từ Excel</h3>
                      <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                          <FileUp size={48} className="mx-auto text-slate-400 mb-2"/>
                          <p className="text-slate-600 font-medium mb-1">Kéo thả hoặc chọn file Excel</p>
                          <p className="text-xs text-slate-400 mb-4">Hỗ trợ định dạng .xlsx, .xls</p>
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
                          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Chọn File</button>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                          <p className="font-bold mb-1 flex items-center gap-2"><ShieldCheck size={16}/> Lưu ý quan trọng:</p>
                          <ul className="list-disc pl-5 space-y-1">
                              <li>Sử dụng đúng <strong>File mẫu chuẩn</strong> để tránh lỗi.</li>
                              <li>Cột <strong>UNIT_CODE</strong> phải khớp với Mã đơn vị đã khai báo.</li>
                              <li>Mật khẩu mặc định nếu bỏ trống là: <strong>123456</strong>.</li>
                          </ul>
                      </div>
                  </div>
                  <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
                      <button onClick={handleDownloadTemplate} className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-2">
                          <Download size={16}/> Tải file mẫu chuẩn
                      </button>
                      <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200">Đóng</button>
                  </div>
              </div>
          </div>
      )}

      {/* Add/Edit Modal (UI giữ nguyên như trước, logic save đã update ở trên) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
             {/* ... Form Header ... */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">{editingItem ? 'Cập nhật' : 'Thêm mới'} {activeTab === 'units' ? 'Đơn vị' : 'Nhân sự'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
             {/* ... Form Body (Giữ nguyên các field input) ... */}
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
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email (Dùng để khôi phục mật khẩu)</label>
                      <input type="email" className="w-full border rounded-lg p-2.5" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="example@vnpt.vn" />
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
            {/* ... Form Footer ... */}
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
