
import React, { useState, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, Save, X, ChevronRight, ChevronDown, Loader2, Search, Download, ShieldCheck, UploadCloud, Eye, Info, LayoutGrid, GitMerge, Users2, FileSpreadsheet, KeyRound, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbClient } from '../utils/firebaseClient';
import md5 from 'md5';

interface AdminProps {
  units: Unit[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

const Admin: React.FC<AdminProps> = ({ units, users, currentUser, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'units' | 'users'>('users');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isSystemAdmin = currentUser.username === 'admin';
  const isSubAdmin = currentUser.canManageUsers === true;
  const canModify = isSystemAdmin || isSubAdmin;

  const filteredUsers = useMemo(() => {
    let list = users;
    if (!isSystemAdmin && isSubAdmin) {
      list = users.filter(u => u.unitId === currentUser.unitId);
    } else if (!isSystemAdmin && !isSubAdmin) {
      return [];
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.fullName.toLowerCase().includes(s) || u.hrmCode.toLowerCase().includes(s) || u.username.toLowerCase().includes(s));
    }
    return list;
  }, [users, isSystemAdmin, isSubAdmin, currentUser.unitId, searchTerm]);

  const unitTree = useMemo(() => {
    const build = (parentId: string | null = null): any[] => {
      return units
        .filter(u => u.parentId === parentId)
        .map(u => ({ ...u, children: build(u.id) }));
    };
    return build(null);
  }, [units]);

  const handleOpenAddModal = () => {
    if (activeTab === 'users') {
      setEditingItem(null);
      setFormData({ 
        unitId: currentUser.unitId, 
        title: Role.STAFF, 
        accessibleUnitIds: [currentUser.unitId], 
        canManageUsers: false,
        password: '123'
      });
    } else {
      const rootUnit = units.find(u => u.level === 0 || u.code === 'VNPT_QN');
      setEditingItem(null);
      setFormData({ 
        name: '', 
        code: `QNH${Math.floor(Math.random() * 900) + 100}`, 
        parentId: rootUnit?.id || null, 
        level: rootUnit ? rootUnit.level + 1 : 1 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!canModify) return;
    setIsProcessing(true);
    try {
      const id = editingItem?.id || (activeTab === 'users' ? `user_${Date.now()}` : `unit_${Date.now()}`);
      
      if (activeTab === 'units') {
        if (!formData.name || !formData.code) throw new Error("Vui lòng nhập tên và mã đơn vị.");
        const parentUnit = units.find(u => u.id === formData.parentId);
        const level = parentUnit ? parentUnit.level + 1 : 0;
        await dbClient.upsert('units', id, { ...formData, level });
      } else {
        if (!formData.fullName || !formData.hrmCode || !formData.username) throw new Error("Vui lòng nhập đủ thông tin nhân sự.");
        
        const finalUnitId = (isSubAdmin && !isSystemAdmin) ? currentUser.unitId : (formData.unitId || currentUser.unitId);
        
        const payload = {
          ...formData, 
          unitId: finalUnitId,
          // Nếu tạo mới thì băm pass, nếu sửa thì giữ nguyên trừ khi được reset bên ngoài
          password: editingItem ? editingItem.password : md5(formData.password || '123'),
          isFirstLogin: editingItem ? editingItem.isFirstLogin : true,
          accessibleUnitIds: formData.accessibleUnitIds && formData.accessibleUnitIds.length > 0 ? formData.accessibleUnitIds : [finalUnitId]
        };
        await dbClient.upsert('users', id, payload);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (e: any) { 
      alert(e.message || "Lỗi lưu dữ liệu."); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleResetPassword = async () => {
    if (!editingItem) return;
    if (confirm("Reset mật khẩu nhân viên này về mặc định '123'?")) {
      await dbClient.update('users', editingItem.id, { password: md5('123'), isFirstLogin: true });
      alert("Đã reset mật khẩu thành công!");
      onRefresh();
      setIsModalOpen(false);
    }
  };

  const downloadTemplate = () => {
    const data = [
      ["Họ và tên", "Mã HRM", "Mã đơn vị", "Username", "Mật khẩu", "Chức danh", "Là SubAdmin (Yes/No)"],
      ["Nguyễn Văn A", "HRM001", "QNH102", "anv", "123", "Chuyên viên", "No"],
      ["Trần Thị B", "HRM002", "QNH103", "btt", "123", "Trưởng phòng", "Yes"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "VNPT_Import_NhanSu_Mau.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        setIsProcessing(true);
        for (const row of data) {
          const fullName = row["Họ và tên"];
          const hrmCode = row["Mã HRM"];
          const unitCode = row["Mã đơn vị"];
          const username = row["Username"];
          const password = String(row["Mật khẩu"] || '123');
          const title = row["Chức danh"];
          const isSubAdminImport = String(row["Là SubAdmin (Yes/No)"]).toLowerCase() === 'yes';

          const unit = units.find(u => u.code === unitCode);
          if (unit && fullName && hrmCode && username) {
            const userId = `user_imp_${hrmCode}`;
            await dbClient.upsert('users', userId, {
              fullName, hrmCode, username, 
              password: md5(password), 
              title, 
              unitId: unit.id,
              canManageUsers: isSubAdminImport,
              isFirstLogin: true,
              accessibleUnitIds: [unit.id]
            });
          }
        }
        alert("Import hoàn tất!");
        onRefresh();
      } catch (err) {
        alert("Lỗi khi đọc file Excel.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const UnitNode: React.FC<{ item: any, level: number }> = ({ item, level }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div className="flex flex-col">
        <div className={`flex items-center py-3.5 px-4 hover:bg-blue-50 border-b transition-all group ${level === 0 ? 'bg-slate-50 font-black' : ''}`}>
          <div style={{ width: level * 28 }} />
          {item.children.length > 0 ? (
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 mr-2 text-slate-400 hover:text-blue-600">
              {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>
          ) : <div className="w-7" />}
          <Building size={18} className={`${level === 0 ? 'text-blue-600' : 'text-slate-400'} mr-3`} />
          <div className="flex-1">
            <span className="text-sm font-bold text-slate-700">{item.name}</span>
            <span className="text-[10px] text-slate-400 font-mono ml-2">({item.code})</span>
          </div>
          {isSystemAdmin && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-1.5 hover:bg-white rounded border text-blue-500 shadow-sm"><Edit2 size={12}/></button>
              {item.code !== 'VNPT_QN' && <button onClick={async () => { if(confirm("Xóa đơn vị này?")) { await dbClient.delete('units', item.id); onRefresh(); }}} className="p-1.5 hover:bg-white rounded border text-red-500 shadow-sm"><Trash2 size={12}/></button>}
            </div>
          )}
        </div>
        {isOpen && item.children.map((c: any) => <UnitNode key={c.id} item={c} level={level + 1} />)}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <ShieldCheck className="text-blue-600" size={32}/> 
            {activeTab === 'users' ? 'QUẢN TRỊ NHÂN SỰ' : 'CƠ CẤU TỔ CHỨC'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hệ thống danh mục VNPT Quảng Ninh</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border shadow-inner">
          <button onClick={() => setActiveTab('users')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            <Users2 size={16}/> Nhân sự
          </button>
          {isSystemAdmin && (
            <button onClick={() => setActiveTab('units')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
              <GitMerge size={16}/> Cơ cấu
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-6 border-b bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                placeholder={activeTab === 'users' ? "Tìm kiếm nhân sự..." : "Tìm kiếm đơn vị..."} 
                className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm outline-none focus:border-blue-500 transition-all font-bold" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          {canModify && (
            <div className="flex gap-2">
              {activeTab === 'users' && (
                <>
                  <button onClick={downloadTemplate} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-200">
                    <Download size={16}/> File mẫu
                  </button>
                  <label className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-green-700 cursor-pointer shadow-lg shadow-green-100">
                    <FileSpreadsheet size={16}/> Import Excel
                    <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
                  </label>
                </>
              )}
              <button onClick={handleOpenAddModal} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all">
                <Plus size={18}/> {activeTab === 'users' ? 'Thêm nhân sự' : 'Thêm đơn vị'}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'units' ? (
            <div className="p-6">{unitTree.map(u => <UnitNode key={u.id} item={u} level={0} />)}</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="p-4 border-b">Họ và tên</th>
                  <th className="p-4 border-b">Mã HRM / User</th>
                  <th className="p-4 border-b">Chức danh</th>
                  <th className="p-4 border-b">Đơn vị gốc</th>
                  <th className="p-4 border-b text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black border uppercase overflow-hidden">
                           {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{user.fullName}</div>
                          <div className="flex gap-1 mt-1">
                            {user.canManageUsers && <span className="text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded font-black uppercase">SubAdmin</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-slate-400">{user.hrmCode}</div>
                      <div className="text-blue-600 font-bold">@{user.username}</div>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-500">{user.title}</td>
                    <td className="p-4 text-xs text-slate-400 font-bold">{units.find(u => u.id === user.unitId)?.name || 'N/A'}</td>
                    <td className="p-4 text-right">
                      {(isSystemAdmin || (isSubAdmin && user.unitId === currentUser.unitId)) && (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingItem(user); setFormData({ ...user, accessibleUnitIds: user.accessibleUnitIds || [user.unitId] }); setIsModalOpen(true); }} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600" title="Chỉnh sửa"><Edit2 size={16}/></button>
                          {user.username !== 'admin' && <button onClick={async () => { if(confirm("Xóa nhân sự này?")) { await dbClient.delete('users', user.id); onRefresh(); }}} className="p-2 hover:bg-red-100 rounded-lg text-red-500" title="Xóa"><Trash2 size={16}/></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl overflow-hidden animate-zoom-in border">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {activeTab === 'users' ? (editingItem ? 'CẬP NHẬT NHÂN SỰ' : 'THÊM MỚI NHÂN SỰ') : (editingItem ? 'CẬP NHẬT ĐƠN VỊ' : 'TẠO MỚI ĐƠN VỊ')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full"><X size={24}/></button>
            </div>
            
            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {activeTab === 'units' ? (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên đơn vị / Phòng ban</label>
                    <input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="VD: Phòng Kế toán..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mã định danh đơn vị</label>
                      <input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="VD: QNH101..." value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Đơn vị cấp trên</label>
                      <select className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value || null})}>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 grid grid-cols-2 gap-5">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Họ và tên</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mã HRM</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Username</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
                    </div>
                    {!editingItem ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mật khẩu đăng nhập</label>
                        <input type="password" placeholder="Mặc định: 123" className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Quản lý bảo mật</label>
                        <button onClick={handleResetPassword} className="w-full bg-slate-100 text-slate-700 p-3.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200">
                           <KeyRound size={16}/> Reset Password về 123
                        </button>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chức danh</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Đơn vị công tác</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold" value={formData.unitId} onChange={e => setFormData({...formData, unitId: e.target.value})} disabled={isSubAdmin && !isSystemAdmin}>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    {isSystemAdmin && (
                      <div className="col-span-2 p-4 bg-blue-50 rounded-2xl flex items-center gap-3 border border-blue-100">
                        <input type="checkbox" id="chkSubAdmin" className="w-5 h-5 rounded text-blue-600" checked={formData.canManageUsers || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                        <label htmlFor="chkSubAdmin" className="text-xs font-black text-blue-800 uppercase">Gán quyền SubAdmin (Quản trị nhân sự đơn vị)</label>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 space-y-4">
                    <div className="flex items-center gap-2 border-b-2 pb-2">
                       <CheckSquare className="text-blue-600" size={18}/>
                       <label className="text-xs font-black text-slate-800 uppercase tracking-tight">Phân quyền xem dữ liệu (Theo đơn vị)</label>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 italic">Chọn các đơn vị mà nhân sự này được phép xem toàn bộ công việc và KPI:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto p-2 border rounded-2xl bg-slate-50">
                       {units.map(u => (
                         <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded text-blue-600" 
                              checked={(formData.accessibleUnitIds || []).includes(u.id)}
                              onChange={e => {
                                const current = formData.accessibleUnitIds || [];
                                if(e.target.checked) setFormData({...formData, accessibleUnitIds: [...current, u.id]});
                                else setFormData({...formData, accessibleUnitIds: current.filter((id: string) => id !== u.id)});
                              }}
                            />
                            <span className="text-[11px] font-bold text-slate-600 truncate">{u.name}</span>
                         </label>
                       ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t bg-slate-50/50 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black text-xs uppercase">Hủy</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 flex items-center gap-2">
                {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} LƯU DỮ LIỆU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
