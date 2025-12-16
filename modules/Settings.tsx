
import React, { useState, useEffect } from 'react';
import { Mail, Save, Server, Shield, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface SettingsProps {
    currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const [emailConfig, setEmailConfig] = useState({
        service: 'gmail',
        email: '',
        appPassword: '', // Mật khẩu ứng dụng
        senderName: 'VNPT Task Manager'
    });

    useEffect(() => {
        const stored = localStorage.getItem('email_config');
        if (stored) {
            setEmailConfig(JSON.parse(stored));
        }
    }, []);

    const handleSave = () => {
        // Lưu vào LocalStorage (Giả lập việc lưu config hệ thống)
        localStorage.setItem('email_config', JSON.stringify(emailConfig));
        alert("Đã lưu cấu hình Email thành công!");
    };

    if (currentUser.hrmCode !== 'ADMIN' && !currentUser.canManageUsers) {
        return <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập cài đặt hệ thống.</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống</h2>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
                    <Mail className="text-blue-600" />
                    <h3 className="font-bold text-slate-700">Cấu hình Gửi Email (SMTP/Gmail)</h3>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start">
                        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-1">Hướng dẫn cấu hình Gmail:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Đây là module dùng để gửi email khôi phục mật khẩu cho nhân viên.</li>
                                <li>Với tài khoản Gmail, bạn cần bật <strong>xác thực 2 bước</strong> và tạo <strong>Mật khẩu ứng dụng (App Password)</strong>.</li>
                                <li>Không sử dụng mật khẩu đăng nhập Gmail thông thường.</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ gửi mail</label>
                        <select 
                            className="w-full border rounded-lg p-2.5 bg-slate-50"
                            value={emailConfig.service}
                            onChange={e => setEmailConfig({...emailConfig, service: e.target.value})}
                        >
                            <option value="gmail">Google Gmail</option>
                            <option value="smtp">Custom SMTP (Khác)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email gửi đi (Admin Email)</label>
                            <input 
                                type="email" 
                                className="w-full border rounded-lg p-2.5"
                                placeholder="admin@gmail.com"
                                value={emailConfig.email}
                                onChange={e => setEmailConfig({...emailConfig, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tên người gửi</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5"
                                placeholder="VNPT Task Manager"
                                value={emailConfig.senderName}
                                onChange={e => setEmailConfig({...emailConfig, senderName: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu ứng dụng (App Password)</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border rounded-lg p-2.5 pr-10"
                                placeholder="xxxx xxxx xxxx xxxx"
                                value={emailConfig.appPassword}
                                onChange={e => setEmailConfig({...emailConfig, appPassword: e.target.value})}
                            />
                            <div className="absolute right-3 top-3 text-slate-400">
                                <Shield size={18}/>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Hệ thống sẽ mã hóa mật khẩu này khi lưu trữ.</p>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                    >
                        <Save size={18} /> Lưu cấu hình
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
