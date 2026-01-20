
import React, { useState, useRef, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileSpreadsheet, Loader2, ShieldCheck, TreePine, Download, RefreshCw, AlertCircle, Database, Lock, Shield, Search, GripVertical } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/supabaseClient'; 
import md5 from 'md5'; 

interface AdminProps {
  units: Unit[];
  users: User[];
  currentUser: User; 
  setUnits: (units: Unit[]) => void;
  setUsers: (users: User[]) => void;
  onRefresh: () => void;
}

const Admin: React.FC<AdminProps> = ({ units, users, currentUser, setUnits, setUsers, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'units' | 'users'>('users');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSystemAdmin = currentUser.username === 'admin';

  // Helper: Lấy toàn bộ ID của các đơn vị con (decedants)
  const getDescendantUnitIds = (unitId: string): string[] => {
      let ids: string[] = [unitId];
      const children = units.filter(u => u.parentId === unitId);
      children.forEach(child => {
          ids = [...ids, ...getDescendantUnitIds(child.id)];
      });
      return ids;
  };

  // Lọc đơn vị hiển thị
  const visibleUnits = useMemo(() => {
      if (isSystemAdmin) return units;
      const myManageableIds = getDescendantUnitIds(currentUser.unitId);
      return units.filter(u => myManageableIds.includes(u.id));
  }, [units, isSystemAdmin, currentUser.unitId]);

  // Lọc danh sách nhân sự có thể nhìn thấy (Toàn bộ người trong cây đơn vị quản lý)
  const visibleUsers = useMemo(() => {
      const manageableUnitIds = isSystemAdmin ? units.map(u => u.id) : getDescendantUnitIds(currentUser.unitId);
      let filtered = users.filter(u => manageableUnitIds.includes(u.unitId));
      
      if (searchTerm) {
          filtered = filtered.filter(u => 
              u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
              u.hrmCode.toLowerCase().includes(searchTerm.toLowerCase())
          );
      }
      return filtered;
  }, [users, isSystemAdmin, currentUser.unitId, units, searchTerm]);

  const unitTree = useMemo(() => {
      const build = (data: Unit[], parentId: string | null = null): any[] => {
          return data
              .filter(item => item.parentId === parentId)
              .map(item => ({ ...item, children: build(data, item.id) }));
      };
      
      let roots = visibleUnits.filter(u => !u.parentId || !visibleUnits.find(p => p.id === u.parentId));
      return roots.map(root => ({ ...root, children: build(visibleUnits, root.id) }));
  }, [visibleUnits]);

  // --- LOGIC DRAG & DROP ĐƠN VỊ ---
  const handleDragStart = (e: React.DragEvent, unitId: string) => {
      e.dataTransfer.setData("unitId", unitId);
  };

  const handleDrop = async (e: React.DragEvent, targetParentId: string) => {
      e.preventDefault();
      const unitId = e.dataTransfer.getData("unitId");
      if (unitId === targetParentId) return;

      const isDescendant = (id: string, potentialParentId: string): boolean => {
          const u = units.find(x => x.id === id);
          if (!u || !u.parentId) return false;
          if (u.parentId === potentialParentId) return true;
          return isDescendant(u.parentId, potentialParentId);
      };
      if (isDescendant(targetParentId, unitId)) {
          alert("Không thể chuyển đơn vị cha vào đơn vị con!");
          return;
      }

      setIsProcessing(true);
      try {
          const unitToMove = units.find(u => u.id === unitId);
          if (unitToMove) {
              await dbClient.upsert('units', unitId, {
                  code: unitToMove.code,
                  name: unitToMove.name,
                  parent_id: targetParentId,
                  level: (units.find(u => u.id === targetParentId)?.level || 0) + 1
              });
              onRefresh();
          }
      } catch (err) { alert("Lỗi khi di chuyển đơn vị"); }
      finally { setIsProcessing(false); }
  };

  const TreeRow: React.FC<{ item: any; level: number; mode: 'units' | 'users' }> = ({ item, level, mode }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = item.children && item.children.length > 0;
      const unitUsers = visibleUsers.filter(u => u.unitId === item.id);
      
      return (
          <div className="flex flex-col">
              <div 
                  className={`flex items-center group py-4 px-8 hover:bg-blue-50/50 transition-all border-b border-slate-50 ${level === 0 ? 'bg-slate-50/30 font-black' : ''}`}
                  draggable={mode === 'units' && isSystemAdmin && item.code !== 'VNPT_QN'}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => mode === 'units' && handleDrop(e, item.id)}
              >
                  <div style={{ width: `${level * 32}px` }} className="shrink-0 flex items-center justify-center">
                       {mode === 'units' && level > 0 && <GripVertical size={14} className="text-slate-200 opacity-0 group-hover:opacity-100 cursor-move mr-2" />}
                  </div>
                  <button onClick={() => setIsOpen(!isOpen)} className={`p-1 mr-3 text-slate-400 hover:text-blue-600 ${(mode === 'units' ? !hasChildren : (!hasChildren && unitUsers.length === 0)) ? 'invisible' : ''}`}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <Building size={18} className={`mr-4 ${level === 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800 tracking-tight">{item.name}</div>
                      <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                          {item.code} 
                          {mode === 'users' && <span className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">({unitUsers.length} nhân sự)</span>}
                      </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-blue-100"><Edit2 size={14}/></button>
                      {item.code !== 'VNPT_QN' && isSystemAdmin && (
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-red-100"><Trash2 size={14}/></button>
                      )}
                  </div>
              </div>
              
              {isOpen && (
                  <>
                    {mode === 'users' && unitUsers.map(user => (
                        <div key={user.id} className="flex items-center py-3 px-8 hover:bg-emerald-50/50 transition-all border-b border-slate-50 group">
                             <div style={{ width: `${(level + 1) * 32}px` }} className="shrink-0" />
                             <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-4 border-2 border-white shadow-sm overflow-hidden text-slate-400">
                                 {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="avatar"/> : <UserIcon size={20}/>}
                             </div>
                             <div className="flex-1">
                                 <div className="text-sm font-black text-slate-700 flex items-center gap-2">
                                     {user.fullName}
                                     {user.canManageUsers && <Shield size={12} className="text-amber-500" title="Sub-Admin"/>}
                                 </div>
                                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{user.title} • @{user.username} • {user.hrmCode}</div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => handleEdit(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl border border-transparent hover:border-blue-100"><Edit2 size={14}/></button>
                                {user.username !== 'admin' && (
                                    <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl border border-transparent hover:border-red-100"><Trash2 size={14}/></button>
                                )}
                             </div>
                        </div>
                    ))}
                    {hasChildren && item.children.map((child: any) => <TreeRow key={child.id} item={child} level={level + 1} mode={mode} />)}
                  </>
              )}
          </div>
      );
  };

  const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({ ...item });
      if (!item.hrmCode) setActiveTab('units');
      else setActiveTab('users');
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (activeTab === 'units' && !formData.name) return alert("Vui lòng nhập Tên đơn vị");
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) return alert("Vui lòng nhập đủ thông tin");

    setIsProcessing(true);
    try {
        const id = editingItem ? editingItem.id : crypto.randomUUID();
        
        if (activeTab === 'units') {
            let pId = formData.parentId || formData.parent_id;
            if (!pId && formData.code !== 'VNPT_QN') {
                const root = units.find(u => u.code === 'VNPT_QN');
                pId = root ? root.id : null;
            }
            await dbClient.upsert('units', id, {
                code: editingItem ? formData.code : `QNH${Math.floor(Math.random() * 9000) + 1000}`,
                name: formData.name, 
                parent_id: pId,
                level: pId ? (units.find(u => u.id === pId)?.level || 0) + 1 : 0
            });
        } else {
            const unitId = formData.unitId || formData.unit_id || (isSystemAdmin ? units[0]?.id : currentUser.unitId);
            
            await dbClient.upsert('users', id, {
                hrm_code: formData.hrmCode,
                full_name: formData.fullName,
                username: formData.username,
                password: editingItem ? (formData.newPassword ? md5(formData.newPassword) : formData.password) : md5(formData.password || '123456'),
                title: formData.title,
                unit_id: unitId,
                email: formData.email || '', 
                is_first_login: editingItem ? (formData.newPassword ? true : (formData.isFirstLogin ?? formData.is_first_login)) : true,
                can_manage: formData.canManageUsers ?? formData.can_manage ?? false,
                avatar: formData.avatar || ''
            });
        }
        setIsModalOpen(false);
        onRefresh(); // Làm mới dữ liệu thay vì reload toàn trang
    } catch (err: any) {
        alert("Lỗi lưu Cloud: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Xác nhận xóa bản ghi này?")) {
          setIsProcessing(true);
          try {
              await dbClient.delete(activeTab === 'users' ? 'users' : 'units', id);
              onRefresh();
          } catch (e: any) { alert("Lỗi xóa: " + e.message); }
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
                  const unit = units.find(u => u.code === row['UNIT_CODE']) || units[0];
                  
                  await dbClient.upsert('users', crypto.randomUUID(), {
                      hrm_code: hrmCode,
                      full_name: row['FULL_NAME'] || '', 
                      username: row['USERNAME'] || hrmCode.toLowerCase(),
                      password: md5('123456'), 
                      title: row['TITLE'] || Role.STAFF, 
                      is_first_login: true,
                      unit_id: unit.id,
                      email: row['EMAIL'] || '',
                      can_manage: false,
                      avatar: ''
                  });
              }
              onRefresh();
          } catch (err) { alert("Lỗi Import Cloud"); } finally { setIsProcessing(false); }
      };
      reader.readAsBinaryString(file);
  };

  const downloadSampleFile = () => {
    const sampleData = [{ 'FULL_NAME': 'Nguyễn Văn A', 'HRM_CODE': 'VNPT001', 'USERNAME': 'anv', 'TITLE': 'Nhân viên', 'UNIT_CODE': 'VNPT_QN', 'EMAIL': 'vana@vnpt.vn' }];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NhanSu");
    XLSX.writeFile(wb, "Mau_Import_NhanSu.xlsx");
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-4">
                <ShieldCheck className="text-blue-600" size={40} /> QUẢN TRỊ HỆ THỐNG
            </h2>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">
                {isSystemAdmin ? 'Toàn quyền điều hành toàn tỉnh' : `Đơn vị quản lý: ${units.find(u => u.id === currentUser.unitId)?.name}`}
            </p>
        </div>
        <div className="flex bg-slate-200 p-1.5 rounded-3xl border border-slate-300">
          <button onClick={() => setActiveTab('users')} className={`px-10 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-3 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-2xl' : 'text-slate-500'}`}><Users size={18}/> NHÂN SỰ</button>
          {isSystemAdmin && <button onClick={() => setActiveTab('units')} className={`px-10 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-3 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-2xl' : 'text-slate-500'}`}><TreePine size={18}/> ĐƠN VỊ</button>}
        </div>
      </div>

      <div className="bg-white rounded-[50px] shadow-2xl border border-slate-100 overflow-hidden min-h-[600px] flex flex-col relative">
          {isProcessing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-md z-[60] flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-600" size={64} />
                  <span className="font-black text-blue-900 uppercase tracking-widest mt-6">Đang đồng bộ Cloud...</span>
              </div>
          )}

          <div className="p-8 border-b bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4 w-full max-w-md">
                 <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Tìm nhân sự, username, mã HRM..." 
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-blue-500 font-bold text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                  {activeTab === 'users' && isSystemAdmin && (
                      <>
                        <button onClick={downloadSampleFile} className="bg-white text-slate-600 border border-slate-200 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-50">
                            <Download size={16}/> MẪU
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportUsers} />
                        <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest flex items-center gap-2 hover:bg-emerald-100">
                            <FileSpreadsheet size={18}/> IMPORT
                        </button>
                      </>
                  )}
                  <button onClick={() => { setEditingItem(null); setFormData(activeTab === 'users' ? { unitId: currentUser.unitId } : {}); setIsModalOpen(true); }} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-700">
                      <Plus size={20}/> THÊM MỚI
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
              {unitTree.length > 0 ? (
                  <div className="divide-y divide-slate-50 pb-20">
                      {activeTab === 'units' && (
                          <div className="p-4 bg-blue-50/50 border-b border-blue-100 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">
                              Mẹo: Kéo và thả các đơn vị để thay đổi cấu trúc quản lý
                          </div>
                      )}
                      {unitTree.map(root => <TreeRow key={root.id} item={root} level={0} mode={activeTab} />)}
                  </div>
              ) : (
                  <div className="p-20 text-center flex flex-col items-center">
                      <Building size={64} className="text-slate-200 mb-6" />
                      <p className="text-slate-400 font-bold italic">Không tìm thấy dữ liệu phù hợp.</p>
                  </div>
              )}
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-xl">
              <div className="bg-white rounded-[60px] w-full max-w-2xl shadow-2xl overflow-hidden border border-white animate-zoom-in">
                  <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
                      <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{editingItem ? (activeTab === 'users' ? 'Cập nhật nhân sự' : 'Cập nhật đơn vị') : (activeTab === 'users' ? 'Tạo nhân sự mới' : 'Tạo đơn vị mới')}</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{activeTab === 'users' ? 'Dữ liệu nhân sự' : 'Thông tin đơn vị'}</p>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-red-500 p-4 rounded-full"><X size={32}/></button>
                  </div>
                  
                  <div className="p-12 space-y-8 max-h-[60vh] overflow-y-auto">
                      {activeTab === 'users' ? (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Họ và tên</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold text-slate-700 bg-slate-50 outline-none focus:border-blue-500" value={formData.fullName || formData.full_name || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mã HRM</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-mono text-blue-600 font-black bg-slate-50 uppercase" value={formData.hrmCode || formData.hrm_code || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Username</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold text-slate-700 bg-slate-50" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingItem && editingItem.username === 'admin'} />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email công vụ</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold text-slate-700 bg-slate-50" placeholder="example@vnpt.vn" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                            </div>
                            <div className="col-span-2 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Shield className="text-amber-600" size={24}/>
                                    <div>
                                        <div className="text-sm font-black text-amber-900">Quản trị đơn vị (Sub-Admin)</div>
                                        <div className="text-[10px] text-amber-500 font-bold uppercase mt-0.5">Cho phép quản lý nhân sự thuộc đơn vị này</div>
                                    </div>
                                </div>
                                <input type="checkbox" className="w-6 h-6 rounded-lg accent-amber-600" checked={formData.canManageUsers || formData.can_manage || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{editingItem ? 'Mật khẩu mới (Để trống nếu giữ cũ)' : 'Mật khẩu (Mặc định: 123456)'}</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 bg-slate-50" type="password" onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Chức danh</label>
                                <select className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Đơn vị</label>
                                <select className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50" value={formData.unitId || formData.unit_id || ''} onChange={e => setFormData({...formData, unitId: e.target.value})} disabled={!isSystemAdmin}>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                      ) : (
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tên đơn vị</label>
                                <input className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50 outline-none focus:border-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Đơn vị cha</label>
                                <select className="w-full border-2 border-slate-100 rounded-3xl p-5 font-bold bg-slate-50 outline-none focus:border-blue-500" value={formData.parentId || formData.parent_id || ''} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                                    <option value="">-- VNPT Quảng Ninh --</option>
                                    {units.filter(u => u.id !== editingItem?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>
                      )}
                  </div>

                  <div className="p-12 border-t bg-slate-50/50 flex justify-end gap-6">
                      <button onClick={() => setIsModalOpen(false)} className="px-10 py-5 text-slate-400 font-black uppercase text-xs tracking-widest">Hủy</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-14 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">Lưu Cloud</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
