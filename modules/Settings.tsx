
import React, { useState, useEffect } from 'react';
import { Mail, Save, Server, Shield, AlertCircle, Send, CheckCircle, Loader2 } from 'lucide-react';
import { User } from '../types';

interface SettingsProps {
    currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const [emailConfig, setEmailConfig] = useState({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: '587',
        secure: true,
        email: '',
        appPassword: '', // Mật khẩu ứng dụng
        senderName: 'VNPT Task Manager'
    });
    
    // Test Email State
    const [testEmail, setTestEmail] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('email_config');
        if (stored) {
            setEmailConfig(JSON.parse(stored));
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('email_config', JSON.stringify(emailConfig));
        alert("Đã lưu cấu hình Email thành công!");
    };

    const handleSendTestEmail = () => {
        if (!testEmail) return alert("Vui lòng nhập email nhận.");
        if (!emailConfig.email || !emailConfig.appPassword) return alert("Vui lòng cấu hình Email gửi đi và Mật khẩu ứng dụng trước.");
        
        setIsTesting(true);
        // Simulate SMTP Network Delay
        setTimeout(() => {
            setIsTesting(false);
            alert(`[SIMULATION] Đã gửi email test thành công đến: ${testEmail}\n\nNội dung: Đây là email kiểm tra kết nối từ hệ thống VNPT Task Manager.`);
        }, 2000);
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
                    <h3 className="font-bold text-slate-700">Cấu hình Gửi Email (SMTP)</h3>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start">
                        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-1">Lưu ý bảo mật:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Với Gmail, bắt buộc bật <strong>Xác thực 2 bước</strong> và tạo <strong>Mật khẩu ứng dụng (App Password)</strong>.</li>
                                <li>Cổng mặc định Gmail là 587 (TLS) hoặc 465 (SSL).</li>
                            </ul>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ</label>
                            <select 
                                className="w-full border rounded-lg p-2.5 bg-slate-50"
                                value={emailConfig.service}
                                onChange={e => {
                                    const val = e.target.value;
                                    setEmailConfig(prev => ({
                                        ...prev, 
                                        service: val,
                                        host: val === 'gmail' ? 'smtp.gmail.com' : prev.host,
                                        port: val === 'gmail' ? '587' : prev.port
                                    }));
                                }}
                            >
                                <option value="gmail">Google Gmail (Mặc định)</option>
                                <option value="smtp">Custom SMTP Server</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">SMTP Host</label>
                            <div className="relative">
                                <input type="text" className="w-full border rounded-lg p-2.5 pl-9" value={emailConfig.host} onChange={e => setEmailConfig({...emailConfig, host: e.target.value})} />
                                <Server className="absolute left-3 top-3 text-slate-400" size={16}/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                                <input type="text" className="w-full border rounded-lg p-2.5" value={emailConfig.port} onChange={e => setEmailConfig({...emailConfig, port: e.target.value})} />
                            </div>
                            <div className="flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 text-blue-600" checked={emailConfig.secure} onChange={e => setEmailConfig({...emailConfig, secure: e.target.checked})}/>
                                    <span className="text-sm text-slate-700 font-medium">Use SSL/TLS</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email gửi đi (User)</label>
                            <input type="email" className="w-full border rounded-lg p-2.5" placeholder="admin@gmail.com" value={emailConfig.email} onChange={e => setEmailConfig({...emailConfig, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tên hiển thị</label>
                            <input type="text" className="w-full border rounded-lg p-2.5" placeholder="VNPT Task Manager" value={emailConfig.senderName} onChange={e => setEmailConfig({...emailConfig, senderName: e.target.value})} />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu ứng dụng (App Password)</label>
                            <div className="relative">
                                <input type="password" className="w-full border rounded-lg p-2.5 pr-10" placeholder="xxxx xxxx xxxx xxxx" value={emailConfig.appPassword} onChange={e => setEmailConfig({...emailConfig, appPassword: e.target.value})} />
                                <div className="absolute right-3 top-3 text-slate-400"><Shield size={18}/></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex w-full md:w-auto gap-2">
                        <input type="email" placeholder="Email nhận test..." className="border rounded-lg px-3 py-2 text-sm w-64" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                        <button onClick={handleSendTestEmail} disabled={isTesting} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                            {isTesting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Gửi thử
                        </button>
                    </div>
                    <button onClick={handleSave} className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm">
                        <Save size={18} /> Lưu cấu hình
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
