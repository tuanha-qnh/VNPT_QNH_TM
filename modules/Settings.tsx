
import React, { useState } from 'react';
// Added Settings as SettingsIcon to imports
import { Mail, Save, Server, Shield, AlertCircle, Send, CheckCircle, Loader2, Lock, ArrowDownCircle, ArrowUpCircle, Wifi, XCircle, Info, Key, ShieldAlert, Database, RotateCcw, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { User, Role } from '../types';
import { dbClient } from '../utils/firebaseClient';
import md5 from 'md5';

interface SettingsProps {
    currentUser: User;
    onRefresh: () => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onRefresh }) => {
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [isChangingPass, setIsChangingPass] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    
    const isSystemAdmin = currentUser.username === 'admin';

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) return alert("Mật khẩu mới không khớp!");
        setIsChangingPass(true);
        try {
            // Kiểm tra mật khẩu cũ (hỗ trợ cả md5 và text nếu chưa hash)
            if (md5(passwordData.old) !== currentUser.password && passwordData.old !== currentUser.password) {
                throw new Error("Mật khẩu cũ không chính xác.");
            }
            await dbClient.update('users', currentUser.id, { 
                password: md5(passwordData.new),
                isFirstLogin: false 
            });
            alert("Đổi mật khẩu thành công!");
            setPasswordData({ old: '', new: '', confirm: '' });
            onRefresh();
        } catch (err: any) { alert("Lỗi: " + err.message); }
        finally { setIsChangingPass(false); }
    };

    const handleResetDatabase = async () => {
        if (!isSystemAdmin) return;
        
        const confirm1 = confirm("CẢNH BÁO NGUY HIỂM!\n\nHành động này sẽ XÓA SẠCH toàn bộ dữ liệu hiện tại trên Cloud Firebase (Công việc, KPI, Đơn vị, Nhân sự) và khởi tạo lại trạng thái mặc định ban đầu.\n\nBạn có chắc chắn muốn tiếp tục?");
        if (!confirm1) return;

        const confirm2 = confirm("XÁC NHẬN LẦN CUỐI!\n\nDữ liệu sau khi xóa KHÔNG THỂ khôi phục. Bạn vẫn muốn thực hiện khởi tạo lại hệ thống?");
        if (!confirm2) return;

        setIsResetting(true);
        try {
            // 1. Fetch all data to get IDs
            const collections = ['units', 'users', 'tasks', 'kpis'];
            
            for (const col of collections) {
                const items = await dbClient.getAll(col);
                // 2. Delete each item
                for (const item of items) {
                    await dbClient.delete(col, item.id);
                }
            }

            // 3. Re-initialize Root Data
            const rootId = 'unit_root_qn';
            const adminId = 'user_admin_root';

            await dbClient.upsert('units', rootId, { 
                code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0, parentId: null 
            });

            await dbClient.upsert('users', adminId, {
                hrmCode: 'ADMIN', fullName: 'Quản Trị Viên', email: 'admin@vnpt.vn',
                username: 'admin', password: md5('123'), title: Role.DIRECTOR,
                unitId: rootId, isFirstLogin: false, canManageUsers: true
            });

            alert("Khởi tạo lại Database thành công! Hệ thống đã quay về trạng thái gốc.");
            window.location.reload(); // Reload to clear session and state
        } catch (err: any) {
            alert("Lỗi khi reset database: " + err.message);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-20">
            <div className="flex items-center gap-4 border-b-4 border-slate-100 pb-6">
                <SettingsIcon className="text-slate-800" size={36}/>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Cài đặt hệ thống</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Thông tin tài khoản */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-[32px] shadow-sm border p-8 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-blue-600 rounded-[24px] flex items-center justify-center text-white font-black text-4xl mb-6 shadow-xl shadow-blue-100">
                            {currentUser.fullName.charAt(0)}
                        </div>
                        <h3 className="font-black text-slate-800 text-xl">{currentUser.fullName}</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{currentUser.title}</p>
                        <div className="mt-6 pt-6 border-t w-full text-left space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <Shield className="shrink-0" size={14}/> ID: {currentUser.hrmCode}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <Mail className="shrink-0" size={14}/> {currentUser.email}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form đổi mật khẩu */}
                <div className="md:col-span-2 space-y-8">
                    <div className="bg-white rounded-[40px] shadow-sm border p-10 space-y-8">
                        <div className="flex items-center gap-3 border-b pb-6">
                            <Key className="text-blue-600" size={24}/>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Đổi mật khẩu bảo mật</h3>
                        </div>
                        <form onSubmit={handleChangePassword} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                                <input type="password" required className="w-full border-2 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 font-bold transition-all" value={passwordData.old} onChange={e => setPasswordData({...passwordData, old: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                                    <input type="password" required className="w-full border-2 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 font-bold transition-all" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                                    <input type="password" required className="w-full border-2 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 font-bold transition-all" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                                </div>
                            </div>
                            <button type="submit" disabled={isChangingPass} className="w-full bg-blue-600 text-white py-5 rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                                {isChangingPass ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Cập nhật mật khẩu
                            </button>
                        </form>
                    </div>

                    {/* Vùng nguy hiểm cho Admin */}
                    {isSystemAdmin && (
                        <div className="bg-red-50 rounded-[40px] shadow-sm border border-red-100 p-10 space-y-8 animate-fade-in">
                            <div className="flex items-center gap-3 border-b border-red-200 pb-6">
                                <ShieldAlert className="text-red-600" size={24}/>
                                <h3 className="text-lg font-black text-red-600 uppercase tracking-tight">Danger Zone</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm font-bold text-red-800 leading-relaxed">
                                    Hành động khởi tạo lại Database sẽ xóa toàn bộ dữ liệu nghiệp vụ đang có trên Cloud và khôi phục về trạng thái xuất xưởng. Chỉ thực hiện khi hệ thống gặp lỗi dữ liệu nghiêm trọng.
                                </p>
                                <button 
                                    onClick={handleResetDatabase} 
                                    disabled={isResetting}
                                    className="w-full bg-red-600 text-white py-5 rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {isResetting ? <Loader2 className="animate-spin" size={18}/> : <RotateCcw size={18}/>} Khởi tạo lại toàn bộ Database
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
