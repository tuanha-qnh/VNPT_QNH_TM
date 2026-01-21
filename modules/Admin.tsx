
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Users, Save, X, ChevronRight, ChevronDown, FileSpreadsheet, Loader2, Search, Download, GripVertical, ShieldCheck, Key, UploadCloud } from 'lucide-react';
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
  const isSubAdmin = currentUser.canManageUsers;

  const generateUnitCode = () => {
    const num = Math.floor(Math.random() * 999) + 1;
    return `QNH${num.toString().padStart(3, '0')}`;
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    // Quyền: SubAdmin chỉ thấy user trong đơn vị mình
    if (!isSystemAdmin) {
      list = users.filter(u => u.unitId === currentUser.unitId);
    }
    if (filterUnit !== 'all') list = list.filter(u => u.unitId === filterUnit);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.fullName.toLowerCase().includes(s) || u.hrmCode.toLowerCase().includes(s) || u.username.toLowerCase().includes(s));
    }
    return list;
  }, [users, isSystemAdmin, currentUser.unitId, filterUnit, searchTerm]);

  const unitTree = useMemo(() => {
    const build = (parentId: string | null = null): any[] => {
      return units
        .filter(u => u.parentId === parentId)
        .map(u => ({ ...u, children: build(u.id) }));
    };
    return build(null);
  }, [units]);

  const handleDownloadTemplate = () => {
    const data = [
      { 
        "Họ và tên": "Nguyễn Văn A", 
        "Mã HRM": "12345", 
        "Username": "anv", 
        "Mật khẩu": "123", 
        "Chức danh": "Nhân viên", 
        "Mã đơn vị": "QNH001", 
        "SubAdmin": "No" 
      }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
    XLSX.writeFile(wb, "Mau_Import_NhanSu.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
      
      setIsProcessing(true);
      let count = 0;
      for (const row of data) {
        // Tìm đơn vị theo mã
        const unitCode = String(row["Mã đơn vị"] || "");
        const unit = units.find(u => u.code === unitCode);
        const unitId = unit ? unit.id : currentUser.unitId; // Mặc định về đơn vị người đang import nếu không tìm thấy

        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await dbClient.upsert('users', id, {
          hrmCode: String(row["Mã HRM"]),
          fullName: row["Họ và tên"],
          username: row["Username"],
          password: md5(String(row["Mật khẩu"] || '123')),
          title: row["Chức danh"] || Role.STAFF,
          unitId: unitId,
          isFirstLogin: true,
          canManageUsers: row["SubAdmin"]?.toLowerCase() === 'yes'
        });
        count++;
      }
      onRefresh();
      setIsProcessing(false);
      alert(`Đã import ${count} nhân sự thành công!`);
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    if (activeTab === 'users' && (!formData.fullName || !formData.hrmCode || !formData.username)) return alert("Vui lòng nhập đầy đủ thông tin.");
    setIsProcessing(true);
    try {
      const id = editingItem?.id || (activeTab === 'users' ? `user_${Date.now()}` : `unit_${Date.now()}`);
      if (activeTab === 'units') {
        const parentId = formData.parentId || units.find(u => u.code === 'VNPT_QN')?.id || null;
        await dbClient.upsert('units', id, {
          ...formData,
          code: editingItem ? formData.code : generateUnitCode(),
          parentId,
          level: parentId ? 1 : 0
        });
      } else {
        const payload = {
          ...formData,
          password: formData.newPassword ? md5(formData.newPassword) : (editingItem ? formData.password : md5(formData.password || '123'))
        };
        delete payload.newPassword;
        await dbClient.upsert('users', id, payload);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (e) { alert("Lỗi lưu dữ liệu."); }
    finally { setIsProcessing(false); }
  };

  const UnitNode = ({ item, level }: { item: any, level: number, key?: any }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <div className="flex flex-col">
        <div 
          className={`flex items-center py-3 px-4 hover:bg-blue-50 border-b group transition-colors ${level === 0 ? 'bg-slate-50 font-black' : ''}`}
          draggable={isSystemAdmin}
          onDragStart={(e) => e.dataTransfer.setData("unitId", item.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("unitId");
            if (draggedId === item.id) return;
            await dbClient.update('units', draggedId, { parentId: item.id });
            onRefresh();
          }}
        >
          <div style={{ width: level * 24 }} />
          {item.children.length > 0 ? (
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 mr-2 text-slate-400">
              {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </button>
          ) : <div className="w-6" />}
          <Building size={16} className="text-blue-600 mr-3" />
          <span className="flex-1 text-sm text-slate-700">{item.name} <span className="text-[10px] text-slate-400 font-mono ml-2">[{item.code}]</span></span>
          {isSystemAdmin && item.code !== 'VNPT_QN' && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
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
          <ShieldCheck className="text-blue-600" size={32}/> QUẢN TRỊ HỆ THỐNG
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl border">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>NHÂN SỰ</button>
          {isSystemAdmin && (
            <button onClick={() => setActiveTab('units')} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>CƠ CẤU TỔ CHỨC</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-6 border-b bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input placeholder="Tìm nhanh nhân sự..." className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === 'users' && isSystemAdmin && (
              <select className="border rounded-xl px-4 text-sm bg-white outline-none" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                <option value="all">Tất cả đơn vị</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
          
          <div className="flex gap-2">
            {activeTab === 'users' && (
              <>
                <button onClick={handleDownloadTemplate} className="px-4 py-2.5 text-blue-600 font-bold text-xs flex items-center gap-2 hover:bg-blue-50 rounded-xl transition-all"><Download size={16}/> TẢI MẪU</button>
                <label className="px-4 py-2.5 bg-slate-800 text-white font-bold text-xs flex items-center gap-2 hover:bg-black rounded-xl cursor-pointer transition-all">
                  <UploadCloud size={16}/> IMPORT EXCEL
                  <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
                </label>
              </>
            )}
            <button onClick={() => { setEditingItem(null); setFormData(activeTab === 'users' ? { unitId: currentUser.unitId, title: Role.STAFF } : { parentId: units[0]?.id }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"><Plus size={18}/> THÊM MỚI</button>
          </div>
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
                  <th className="p-4 border-b">Đơn vị</th>
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
                          {user.canManageUsers && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tighter">SubAdmin</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-slate-400">{user.hrmCode}</div>
                      <div className="text-blue-600 font-bold">@{user.username}</div>
                    </td>
                    <td className="p-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase">{user.title}</span></td>
                    <td className="p-4 text-xs font-medium text-slate-500">{units.find(u => u.id === user.unitId)?.name || 'N/A'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => { setEditingItem(user); setFormData(user); setIsModalOpen(true); }} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"><Edit2 size={16}/></button>
                        {user.username !== 'admin' && <button onClick={async () => { if(confirm("Xóa nhân sự?")) { await dbClient.delete('users', user.id); onRefresh(); }}} className="p-2 hover:bg-red-100 rounded-lg text-red-500"><Trash2 size={16}/></button>}
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
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden border animate-zoom-in">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingItem ? 'CẬP NHẬT' : 'THÊM MỚI'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full"><X size={24}/></button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
              {activeTab === 'users' ? (
                <>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã HRM</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đăng nhập</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingItem?.username === 'admin'} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{editingItem ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu'}</label>
                      <input className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" type="password" value={formData[editingItem ? 'newPassword' : 'password'] || ''} onChange={e => setFormData({...formData, [editingItem ? 'newPassword' : 'password']: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức danh</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị trực thuộc</label>
                      <select className="w-full border-2 p-3.5 rounded-2xl bg-slate-50 outline-none font-bold" value={formData.unitId} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-5 bg-blue-50 rounded-[24px] border border-blue-100">
                    <input type="checkbox" id="subAdmin" className="w-5 h-5 rounded-lg border-blue-300 text-blue-600 focus:ring-blue-500" checked={formData.canManageUsers || false} onChange={e => setFormData({...formData, canManageUsers: e.target.checked})} />
                    <label htmlFor="subAdmin" className="text-sm font-black text-blue-800 uppercase tracking-tighter cursor-pointer">Kích hoạt quyền SubAdmin (Quản trị nhân sự đơn vị)</label>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tên đơn vị</label>
                    <input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Đơn vị cha</label>
                    <select className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value || null})}>
                      <option value="">-- VNPT Quảng Ninh (Gốc) --</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t bg-slate-50/50 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black text-xs uppercase hover:text-slate-600 transition-all">Hủy</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 flex items-center gap-2 transition-all">
                {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} LƯU HỆ THỐNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
