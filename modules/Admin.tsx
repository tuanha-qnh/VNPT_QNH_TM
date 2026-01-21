
import React, { useState, useMemo } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, Save, X, ChevronRight, ChevronDown, Loader2, Search, Download, ShieldCheck, UploadCloud, Eye } from 'lucide-react';
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
  const [filterUnit, setFilterUnit] = useState('all');
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
    if (filterUnit !== 'all') list = list.filter(u => u.unitId === filterUnit);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.fullName.toLowerCase().includes(s) || u.hrmCode.toLowerCase().includes(s) || u.username.toLowerCase().includes(s));
    }
    return list;
  }, [users, isSystemAdmin, isSubAdmin, currentUser.unitId, filterUnit, searchTerm]);

  const unitTree = useMemo(() => {
    const build = (parentId: string | null = null): any[] => {
      return units
        .filter(u => u.parentId === parentId)
        .map(u => ({ ...u, children: build(u.id) }));
    };
    return build(null);
  }, [units]);

  const handleDownloadTemplate = () => {
    if (!canModify) return;
    const data = [
      { "Họ và tên": "Nguyễn Văn A", "Mã HRM": "12345", "Username": "anv", "Mật khẩu": "123", "Chức danh": "Nhân viên", "Mã đơn vị": "QNH001", "SubAdmin (Yes/No)": "No" }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Import");
    XLSX.writeFile(wb, "Mau_Import_NhanSu_VNPT.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canModify) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
        setIsProcessing(true);
        let success = 0;
        for (const row of data) {
          const hrmCode = String(row["Mã HRM"] || "").trim();
          const username = String(row["Username"] || "").trim();
          if (!hrmCode || !username) continue;
          const unitCodeFromExcel = String(row["Mã đơn vị"] || "").trim();
          const targetUnit = units.find(u => u.code === unitCodeFromExcel);
          let unitIdToAssign = targetUnit ? targetUnit.id : (isSubAdmin ? currentUser.unitId : units[0]?.id);
          if (isSubAdmin && !isSystemAdmin) unitIdToAssign = currentUser.unitId;
          const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          await dbClient.upsert('users', id, {
            hrmCode, fullName: row["Họ và tên"] || username, username, password: md5(String(row["Mật khẩu"] || '123')),
            title: row["Chức danh"] || Role.STAFF, unitId: unitIdToAssign, isFirstLogin: true, canManageUsers: String(row["SubAdmin (Yes/No)"]).toLowerCase() === 'yes',
            accessibleUnitIds: [unitIdToAssign]
          });
          success++;
        }
        onRefresh();
        alert(`Đã import thành công ${success} nhân sự.`);
      } catch (err) { alert("Lỗi khi xử lý file Excel."); }
      finally { setIsProcessing(false); e.target.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    if (!canModify) return;
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) return alert("Vui lòng nhập đầy đủ thông tin.");
    setIsProcessing(true);
    try {
      const id = editingItem?.id || (activeTab === 'users' ? `user_${Date.now()}` : `unit_${Date.now()}`);
      if (activeTab === 'units') {
        const parentId = formData.parentId || units.find(u => u.code === 'VNPT_QN')?.id || null;
        await dbClient.upsert('units', id, { ...formData, code: editingItem ? formData.code : `QNH${Math.floor(Math.random() * 900) + 100}`, parentId, level: parentId ? 1 : 0 });
      } else {
        const finalUnitId = (isSubAdmin && !isSystemAdmin) ? currentUser.unitId : (formData.unitId || currentUser.unitId);
        const payload = {
          ...formData, unitId: finalUnitId,
          password: formData.newPassword ? md5(formData.newPassword) : (editingItem ? formData.password : md5(formData.password || '123')),
          accessibleUnitIds: formData.accessibleUnitIds || [finalUnitId]
        };
        delete payload.newPassword;
        await dbClient.upsert('users', id, payload);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (e) { alert("Lỗi lưu dữ liệu."); }
    finally { setIsProcessing(false); }
  };

  const toggleAccessibleUnit = (unitId: string) => {
    const currentList = formData.accessibleUnitIds || [];
    if (currentList.includes(unitId)) {
      setFormData({ ...formData, accessibleUnitIds: currentList.filter((id: string) => id !== unitId) });
    } else {
      setFormData({ ...formData, accessibleUnitIds: [...currentList, unitId] });
    }
  };

  const UnitNode: React.FC<{ item: any, level: number }> = ({ item, level }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div className="flex flex-col">
        <div className={`flex items-center py-3 px-4 hover:bg-blue-50 border-b transition-colors ${level === 0 ? 'bg-slate-50 font-black' : ''}`}>
          <div style={{ width: level * 24 }} />
          {item.children.length > 0 ? (
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 mr-2 text-slate-400">
              {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </button>
          ) : <div className="w-6" />}
          <Building size={16} className="text-blue-600 mr-3" />
          <span className="flex-1 text-sm text-slate-700">{item.name} <span className="text-[10px] text-slate-400 font-mono ml-2">[{item.code}]</span></span>
          {isSystemAdmin && item.code !== 'VNPT_QN' && (
            <div className="flex gap-2">
              <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-1.5 hover:bg-white rounded border text-blue-500"><Edit2 size={12}/></button>
              <button onClick={async () => { if(confirm("Xóa đơn vị này?")) { await dbClient.delete('units', item.id); onRefresh(); }}} className="p-1.5 hover:bg-white rounded border text-red-500"><Trash2 size={12}/></button>
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
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
          <ShieldCheck className="text-blue-600" size={32}/> QUẢN TRỊ NHÂN SỰ
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl border">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>NHÂN SỰ</button>
          {isSystemAdmin && <button onClick={() => setActiveTab('units')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>CƠ CẤU</button>}
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-6 border-b bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input placeholder="Tìm nhân sự..." className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          {canModify && (
            <div className="flex gap-2">
              <button onClick={handleDownloadTemplate} className="px-4 py-2.5 text-blue-600 font-bold text-xs flex items-center gap-2 hover:bg-blue-50 rounded-xl"><Download size={16}/> TẢI MẪU</button>
              <label className="px-4 py-2.5 bg-slate-800 text-white font-bold text-xs flex items-center gap-2 hover:bg-black rounded-xl cursor-pointer">
                <UploadCloud size={16}/> IMPORT EXCEL
                <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
              </label>
              <button onClick={() => { setEditingItem(null); setFormData({ unitId: currentUser.unitId, title: Role.STAFF, accessibleUnitIds: [currentUser.unitId] }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"><Plus size={18}/> THÊM MỚI</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'units' ? (
            <div className="p-4">{unitTree.map(u => <UnitNode key={u.id} item={u} level={0} />)}</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest sticky top-0">
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
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black border uppercase">{user.fullName.charAt(0)}</div>
                        <div>
                          <div className="font-bold text-slate-800">{user.fullName}</div>
                          <div className="flex gap-1 mt-1">
                            {user.canManageUsers && <span className="text-[8px] bg-blue-600 text-white px-1 py-0.5 rounded font-black uppercase">SubAdmin</span>}
                            {user.accessibleUnitIds && user.accessibleUnitIds.length > 1 && <span className="text-[8px] bg-emerald-600 text-white px-1 py-0.5 rounded font-black uppercase">Đa đơn vị</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-slate-400">{user.hrmCode}</div>
                      <div className="text-blue-600 font-bold">@{user.username}</div>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-500">{user.title}</td>
                    <td className="p-4 text-xs text-slate-400">{units.find(u => u.id === user.unitId)?.name || 'N/A'}</td>
                    <td className="p-4 text-right">
                      {(isSystemAdmin || (isSubAdmin && user.unitId === currentUser.unitId)) && (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => { setEditingItem(user); setFormData({ ...user, accessibleUnitIds: user.accessibleUnitIds || [user.unitId] }); setIsModalOpen(true); }} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"><Edit2 size={16}/></button>
                          {user.username !== 'admin' && <button onClick={async () => { if(confirm("Xóa nhân sự này?")) { await dbClient.delete('users', user.id); onRefresh(); }}} className="p-2 hover:bg-red-100 rounded-lg text-red-500"><Trash2 size={16}/></button>}
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
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-zoom-in border">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingItem ? 'CẬP NHẬT NHÂN SỰ' : 'THÊM MỚI NHÂN SỰ'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Họ và tên</label>
                  <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mã HRM</label>
                  <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên đăng nhập</label>
                  <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingItem?.username === 'admin'} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{editingItem ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}</label>
                  <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" type="password" value={formData[editingItem ? 'newPassword' : 'password'] || ''} onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chức danh</label>
                  <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Đơn vị trực thuộc</label>
                  <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.unitId} onChange={e => {
                      const newUnitId = e.target.value;
                      const currentAccessible = formData.accessibleUnitIds || [];
                      setFormData({
                        ...formData,
                        unitId: newUnitId,
                        accessibleUnitIds: currentAccessible.includes(newUnitId) ? currentAccessible : [...currentAccessible, newUnitId]
                      });
                  }} disabled={isSubAdmin && !isSystemAdmin}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-6 bg-blue-50 rounded-[28px] border border-blue-100 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-blue-100">
                  <input type="checkbox" id="subAdmin" className="w-5 h-5 rounded-lg text-blue-600" checked={formData.canManageUsers || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                  <label htmlFor="subAdmin" className="text-sm font-black text-blue-800 uppercase tracking-tighter cursor-pointer">Cấp quyền SubAdmin (Quản trị nhân sự đơn vị)</label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-widest">
                    <Eye size={14}/> Phân quyền xem dữ liệu đa đơn vị
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                    {units.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white transition-all cursor-pointer border border-transparent hover:border-blue-200">
                        <input type="checkbox" className="w-4 h-4 rounded text-emerald-600" checked={(formData.accessibleUnitIds || []).includes(u.id)} onChange={() => toggleAccessibleUnit(u.id)} />
                        <span className="text-[10px] font-bold text-slate-600 truncate">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
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
