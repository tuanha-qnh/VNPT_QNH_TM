
import React, { useState, useEffect } from 'react';
import { Mail, Save, Server, Shield, AlertCircle, Send, CheckCircle, Loader2, Lock, ArrowDownCircle, ArrowUpCircle, Wifi, XCircle, Info, Key, ShieldAlert } from 'lucide-react';
import { User } from '../types';
import { dbClient } from '../utils/supabaseClient';
import md5 from 'md5';

interface SettingsProps {
    currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [isChangingPass, setIsChangingPass] = useState(false);
    
    const [emailConfig, setEmailConfig] = useState({
        service: 'gmail', host: 'smtp.gmail.com', port: '587', encryption: 'starttls', email: '',
        appPassword: '', senderName: 'VNPT Task Manager', incomingProtocol: 'imap',
        incomingHost: 'imap.gmail.com', incomingPort: '993', incomingEncryption: 'ssl'
    });
    
    const isSystemAdmin = currentUser.username === 'admin';

    useEffect(() => {
        if (isSystemAdmin) {
            const stored = localStorage.getItem('email_config');
            if (stored) {
                try { setEmailConfig(JSON.parse(stored)); } catch (e) {}
            }
        }
    }, [isSystemAdmin]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) return alert("Mật khẩu mới không khớp nhau!");
        if (passwordData.new.length < 6) return alert("Mật khẩu mới phải từ 6 ký tự trở lên.");

        setIsChangingPass(true);
        try {
            const oldHashed = md5(passwordData.old);
            if (oldHashed !== currentUser.password && passwordData.old !== currentUser.password) {
                throw new Error("Mật khẩu cũ không chính xác.");
            }

            const newHashed = md5(passwordData.new);
            
            // SỬA: Mapping CamelCase -> snake_case để tránh lỗi "canManageUsers column not found"
            const updatePayload = {
                hrm_code: currentUser.hrmCode,
                full_name: currentUser.fullName,
                username: currentUser.username,
                password: newHashed,
                title: currentUser.title,
                unit_id: currentUser.unitId,
                email: currentUser.email || '',
                is_first_login: false,
                can_manage: currentUser.canManageUsers || false,
                avatar: currentUser.avatar
            };

            await dbClient.upsert('users', currentUser.id, updatePayload);
            
            alert("Đổi mật khẩu thành công! Vui lòng dùng mật khẩu mới cho lần đăng nhập sau.");
            setPasswordData({ old: '', new: '', confirm: '' });
        } catch (err: any) {
            alert("Lỗi: " + err.message);
        } finally {
            setIsChangingPass(false);
        }
    };

    const handleSaveEmail = () => {
        localStorage.setItem('email_config', JSON.stringify(emailConfig));
        alert("Đã lưu cấu hình Email thành công!");
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-20">
            <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter">CÀI ĐẶT TÀI KHOẢN</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cấu hình cá nhân và hệ thống</p>
            </div>
            
            <div className="bg-white rounded-[40px] shadow-2xl shadow-blue-50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50 flex items-center gap-3">
                    <Key className="text-blue-600" size={24} />
                    <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Đổi mật khẩu cá nhân</h3>
                </div>
                <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                            <input type="password" required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50 focus:border-blue-500 outline-none" value={passwordData.old} onChange={e => setPasswordData({...passwordData, old: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                            <input type="password" required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50 focus:border-blue-500 outline-none" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                            <input type="password" required className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50 focus:border-blue-500 outline-none" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isChangingPass} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
                            {isChangingPass ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Cập nhật mật khẩu mới
                        </button>
                    </div>
                </form>
            </div>

            {isSystemAdmin ? (
                <div className="bg-white rounded-[40px] shadow-2xl shadow-blue-50 border border-slate-100 overflow-hidden opacity-100">
                    <div className="p-6 border-b bg-slate-50 flex items-center gap-3">
                        <Mail className="text-blue-600" size={24} />
                        <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Cấu hình Email Server (Admin Only)</h3>
                    </div>
                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase border-b pb-2">Outgoing (SMTP)</h4>
                                <div className="space-y-3">
                                    <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" placeholder="SMTP Host" value={emailConfig.host} onChange={e => setEmailConfig({...emailConfig, host: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input className="border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" placeholder="Port" value={emailConfig.port} onChange={e => setEmailConfig({...emailConfig, port: e.target.value})} />
                                        <select className="border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" value={emailConfig.encryption} onChange={e => setEmailConfig({...emailConfig, encryption: e.target.value})}>
                                            <option value="ssl">SSL/TLS</option>
                                            <option value="starttls">STARTTLS</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase border-b pb-2">Thông tin tài khoản</h4>
                                <div className="space-y-3">
                                    <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" placeholder="Email đăng nhập" value={emailConfig.email} onChange={e => setEmailConfig({...emailConfig, email: e.target.value})} />
                                    <input className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold bg-slate-50" type="password" placeholder="Mật khẩu ứng dụng" value={emailConfig.appPassword} onChange={e => setEmailConfig({...emailConfig, appPassword: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleSaveEmail} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all">Lưu cấu hình Server</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-10 rounded-[40px] border-2 border-dashed border-slate-200 text-center">
                    <ShieldAlert className="text-slate-300 mx-auto mb-4" size={48} />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Các cấu hình hệ thống nâng cao chỉ dành cho Admin</p>
                </div>
            )}
        </div>
    );
};

export default Settings;
