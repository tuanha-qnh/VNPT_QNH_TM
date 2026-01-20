
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Unit, User, Role } from '../types';
import { Plus, Edit2, Trash2, Building, User as UserIcon, Save, X, ChevronRight, ChevronDown, RefreshCcw, FileUp, ShieldCheck, Loader2 } from 'lucide-react';
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

  const handleSave = async () => {
    setIsProcessing(true);
    try {
        const id = editingItem ? editingItem.id : (activeTab === 'units' ? `unit_${Date.now()}` : `user_${Date.now()}`);
        const data = { ...formData };
        if (activeTab === 'users' && !editingItem) data.password = md5(data.password || '123456');

        await dbClient.upsert(activeTab, id, data);
        alert("Lưu dữ liệu thành công!");
        window.location.reload(); // Tải lại để cập nhật App State
    } catch (err: any) { alert("Lỗi: " + err.message); } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Xác nhận xóa bản ghi?")) {
          await dbClient.delete(activeTab, id);
          window.location.reload();
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Cấu hình hệ thống</h2>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('units')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'units' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Đơn vị</button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Nhân sự</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                {activeTab === 'units' ? <Building size={20}/> : <UserIcon size={20}/>}
                Danh sách {activeTab === 'units' ? 'phòng ban/đơn vị' : 'cán bộ công nhân viên'}
              </h3>
              <button onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2"><Plus size={18}/> Thêm mới</button>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                      <tr>
                          <th className="p-4">Thông tin</th>
                          <th className="p-4">Định danh</th>
                          <th className="p-4 text-right">Thao tác</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y">
                      {(activeTab === 'units' ? units : users).map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-4">
                                  <div className="font-bold text-slate-800">{activeTab === 'units' ? item.name : item.fullName}</div>
                                  <div className="text-[10px] text-slate-400">{activeTab === 'users' ? item.title : `Cấp ${item.level}`}</div>
                              </td>
                              <td className="p-4 font-mono text-xs text-blue-600">{activeTab === 'units' ? item.code : item.hrmCode}</td>
                              <td className="p-4 text-right flex justify-end gap-2">
                                  <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-zoom-in">
                  <h3 className="text-xl font-bold mb-6">{editingItem ? 'Cập nhật' : 'Thêm mới'}</h3>
                  <div className="space-y-4">
                      {activeTab === 'units' ? (
                          <>
                            <input className="w-full border rounded-xl p-3" placeholder="Tên đơn vị..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            <input className="w-full border rounded-xl p-3" placeholder="Mã đơn vị (Ví dụ: QNH001)..." value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                          </>
                      ) : (
                          <>
                            <input className="w-full border rounded-xl p-3" placeholder="Họ và tên..." value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                            <input className="w-full border rounded-xl p-3" placeholder="Mã HRM..." value={formData.hrmCode || ''} onChange={e => setFormData({...formData, hrmCode: e.target.value})} />
                            <input className="w-full border rounded-xl p-3" placeholder="Username đăng nhập..." value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} />
                            {!editingItem && <input className="w-full border rounded-xl p-3" type="password" placeholder="Mật khẩu..." value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />}
                            <select className="w-full border rounded-xl p-3" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})}>
                                {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select className="w-full border rounded-xl p-3" value={formData.unitId || ''} onChange={e => setFormData({...formData, unitId: e.target.value})}>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </>
                      )}
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Hủy</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Lưu lại
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Admin;
