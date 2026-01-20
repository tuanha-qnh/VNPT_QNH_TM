
import React, { useState } from 'react';
import { Mail, Save, Server, Shield, AlertCircle, Send, CheckCircle, Loader2, Lock, ArrowDownCircle, ArrowUpCircle, Wifi, XCircle, Info, Key, ShieldAlert } from 'lucide-react';
import { User } from '../types';
import { dbClient } from '../utils/firebaseClient'; // Đổi sang Firebase
import md5 from 'md5';

interface SettingsProps {
    currentUser: User;
    onRefresh: () => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onRefresh }) => {
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [isChangingPass, setIsChangingPass] = useState(false);
    const isSystemAdmin = currentUser.username === 'admin';

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) return alert("Mật khẩu mới không khớp!");
        setIsChangingPass(true);
        try {
            if (md5(passwordData.old) !== currentUser.password && passwordData.old !== currentUser.password) {
                throw new Error("Mật khẩu cũ không chính xác.");
            }
            await dbClient.update('users', currentUser.id, { 
                password: md5(passwordData.new),
                isFirstLogin: false 
            });
            alert("Đổi mật khẩu Firebase thành công!");
            setPasswordData({ old: '', new: '', confirm: '' });
            onRefresh();
        } catch (err: any) { alert("Lỗi: " + err.message); }
        finally { setIsChangingPass(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <h2 className="text-3xl font-black text-slate-800">CÀI ĐẶT (FIREBASE)</h2>
            <div className="bg-white rounded-[40px] shadow border p-10">
                <h3 className="font-bold mb-6 flex items-center gap-2"><Key className="text-blue-600"/> Đổi mật khẩu Cloud</h3>
                <form onSubmit={handleChangePassword} className="space-y-6">
                    <input type="password" placeholder="Mật khẩu cũ" className="w-full border-2 rounded-2xl p-4 bg-slate-50" value={passwordData.old} onChange={e => setPasswordData({...passwordData, old: e.target.value})} />
                    <input type="password" placeholder="Mật khẩu mới" className="w-full border-2 rounded-2xl p-4 bg-slate-50" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} />
                    <input type="password" placeholder="Xác nhận" className="w-full border-2 rounded-2xl p-4 bg-slate-50" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                    <button type="submit" disabled={isChangingPass} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">
                        {isChangingPass ? <Loader2 className="animate-spin mx-auto" /> : 'Cập nhật Firebase'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Settings;
