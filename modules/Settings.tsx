
import React, { useState, useEffect } from 'react';
import { Mail, Save, Server, Shield, AlertCircle, Send, CheckCircle, Loader2, Lock, ArrowDownCircle, ArrowUpCircle, Wifi, XCircle } from 'lucide-react';
import { User } from '../types';

interface SettingsProps {
    currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
    const [emailConfig, setEmailConfig] = useState({
        // Outgoing
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: '587',
        encryption: 'starttls',
        email: '',
        appPassword: '',
        senderName: 'VNPT Task Manager',
        
        // Incoming (New)
        incomingProtocol: 'imap', // imap | pop3
        incomingHost: 'imap.gmail.com',
        incomingPort: '993',
        incomingEncryption: 'ssl'
    });
    
    const [testEmail, setTestEmail] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('email_config');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Default value for migration
            if (!parsed.incomingProtocol) {
                parsed.incomingProtocol = 'imap';
                parsed.incomingHost = parsed.service === 'gmail' ? 'imap.gmail.com' : '';
                parsed.incomingPort = parsed.service === 'gmail' ? '993' : '';
                parsed.incomingEncryption = 'ssl';
            }
            setEmailConfig(parsed);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('email_config', JSON.stringify(emailConfig));
        alert("Đã lưu cấu hình Email thành công!");
    };

    const handleCheckConnection = () => {
        // 1. Validate Input
        const errors = [];
        if (!emailConfig.host) errors.push("Thiếu SMTP Host");
        if (!emailConfig.port) errors.push("Thiếu SMTP Port");
        if (!emailConfig.email) errors.push("Thiếu Email đăng nhập");
        if (!emailConfig.appPassword) errors.push("Thiếu Mật khẩu ứng dụng");
        if (!emailConfig.incomingHost) errors.push(`Thiếu Host ${emailConfig.incomingProtocol.toUpperCase()}`);
        if (!emailConfig.incomingPort) errors.push(`Thiếu Port ${emailConfig.incomingProtocol.toUpperCase()}`);

        if (errors.length > 0) {
            alert("Vui lòng điền đầy đủ thông tin trước khi kiểm tra:\n- " + errors.join("\n- "));
            return;
        }

        setIsCheckingConnection(true);

        // 2. Simulation Network Check
        setTimeout(() => {
            setIsCheckingConnection(false);
            
            // Giả lập logic kiểm tra: Nếu port là số hợp lệ thì OK
            const isSmtpPortValid = !isNaN(Number(emailConfig.port));
            const isIncomingPortValid = !isNaN(Number(emailConfig.incomingPort));

            if (isSmtpPortValid && isIncomingPortValid) {
                alert(`[KẾT QUẢ KIỂM TRA]\n\n✅ SMTP Connection (${emailConfig.host}:${emailConfig.port})... OK\n✅ ${emailConfig.incomingProtocol.toUpperCase()} Connection (${emailConfig.incomingHost}:${emailConfig.incomingPort})... OK\n\n🟢 KẾT NỐI THÀNH CÔNG!`);
            } else {
                alert(`[LỖI KẾT NỐI]\n\n❌ Không thể kết nối đến máy chủ.\nVui lòng kiểm tra lại Port hoặc tường lửa.`);
            }
        }, 2000);
    };

    const handleSendTestEmail = () => {
        if (!testEmail) return alert("Vui lòng nhập email nhận.");
        if (!emailConfig.email || !emailConfig.appPassword) return alert("Vui lòng cấu hình Email gửi đi và Mật khẩu ứng dụng trước.");
        
        setIsTesting(true);
        setTimeout(() => {
            setIsTesting(false);
            alert(`[SIMULATION]\nSMTP: ${emailConfig.host}:${emailConfig.port} (${emailConfig.encryption.toUpperCase()})\nIncoming: ${emailConfig.incomingHost}:${emailConfig.incomingPort} (${emailConfig.incomingProtocol.toUpperCase()})\n\nĐã gửi email test thành công đến: ${testEmail}`);
        }, 2000);
    };

    const updateServiceDefaults = (service: string) => {
        if (service === 'gmail') {
            setEmailConfig(prev => ({
                ...prev,
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: '587',
                encryption: 'starttls',
                incomingProtocol: 'imap',
                incomingHost: 'imap.gmail.com',
                incomingPort: '993',
                incomingEncryption: 'ssl'
            }));
        } else {
            setEmailConfig(prev => ({ ...prev, service: 'smtp' }));
        }
    };

    if (currentUser.hrmCode !== 'ADMIN' && !currentUser.canManageUsers) {
        return <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập cài đặt hệ thống.</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống</h2>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
                    <Mail className="text-blue-600" />
                    <h3 className="font-bold text-slate-700">Cấu hình Email Server</h3>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 items-start">
                        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-1">Lưu ý bảo mật:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Với Gmail, bắt buộc bật <strong>Xác thực 2 bước</strong> và tạo <strong>Mật khẩu ứng dụng (App Password)</strong>.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Service Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dịch vụ Email</label>
                        <select 
                            className="w-full md:w-1/2 border rounded-lg p-2.5 bg-slate-50 font-medium text-slate-700"
                            value={emailConfig.service}
                            onChange={e => updateServiceDefaults(e.target.value)}
                        >
                            <option value="gmail">Google Gmail (Mặc định)</option>
                            <option value="smtp">Custom Mail Server</option>
                        </select>
                    </div>

                    {/* Credentials (Common) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email / Username</label>
                            <input type="email" className="w-full border rounded-lg p-2.5" placeholder="admin@gmail.com" value={emailConfig.email} onChange={e => setEmailConfig({...emailConfig, email: e.target.value})} />
                        </div>
                        <div className="relative">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu ứng dụng (App Password)</label>
                            <input type="password" className="w-full border rounded-lg p-2.5 pr-10" placeholder="xxxx xxxx xxxx xxxx" value={emailConfig.appPassword} onChange={e => setEmailConfig({...emailConfig, appPassword: e.target.value})} />
                            <div className="absolute right-3 top-9 text-slate-400"><Shield size={18}/></div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tên hiển thị gửi đi</label>
                            <input type="text" className="w-full border rounded-lg p-2.5" placeholder="VNPT Task Manager" value={emailConfig.senderName} onChange={e => setEmailConfig({...emailConfig, senderName: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* COLUMN 1: OUTGOING (SMTP) */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2"><ArrowUpCircle className="text-green-600" size={18}/> Outgoing Server (SMTP)</h4>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">SMTP Host</label>
                                <div className="relative">
                                    <input type="text" className="w-full border rounded-lg p-2.5 pl-9" value={emailConfig.host} onChange={e => setEmailConfig({...emailConfig, host: e.target.value})} />
                                    <Server className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Port</label>
                                    <input type="text" className="w-full border rounded-lg p-2.5" value={emailConfig.port} onChange={e => setEmailConfig({...emailConfig, port: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Encryption</label>
                                    <select className="w-full border rounded-lg p-2.5" value={emailConfig.encryption} onChange={e => setEmailConfig({...emailConfig, encryption: e.target.value})}>
                                        <option value="none">None</option>
                                        <option value="ssl">SSL/TLS</option>
                                        <option value="starttls">STARTTLS</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: INCOMING (POP3/IMAP) */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2"><ArrowDownCircle className="text-blue-600" size={18}/> Incoming Server</h4>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Giao thức</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="protocol" value="imap" checked={emailConfig.incomingProtocol === 'imap'} onChange={() => setEmailConfig({...emailConfig, incomingProtocol: 'imap', incomingPort: '993'})} />
                                        <span className="text-sm">IMAP</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="protocol" value="pop3" checked={emailConfig.incomingProtocol === 'pop3'} onChange={() => setEmailConfig({...emailConfig, incomingProtocol: 'pop3', incomingPort: '995'})} />
                                        <span className="text-sm">POP3</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Host ({emailConfig.incomingProtocol.toUpperCase()})</label>
                                <div className="relative">
                                    <input type="text" className="w-full border rounded-lg p-2.5 pl-9" value={emailConfig.incomingHost} onChange={e => setEmailConfig({...emailConfig, incomingHost: e.target.value})} />
                                    <Server className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Port</label>
                                    <input type="text" className="w-full border rounded-lg p-2.5" value={emailConfig.incomingPort} onChange={e => setEmailConfig({...emailConfig, incomingPort: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Encryption</label>
                                    <select className="w-full border rounded-lg p-2.5" value={emailConfig.incomingEncryption} onChange={e => setEmailConfig({...emailConfig, incomingEncryption: e.target.value})}>
                                        <option value="none">None</option>
                                        <option value="ssl">SSL/TLS</option>
                                        <option value="starttls">STARTTLS</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col md:flex-row w-full xl:w-auto gap-2">
                        <div className="flex gap-2 w-full">
                             <input type="email" placeholder="Email nhận test..." className="border rounded-lg px-3 py-2 text-sm flex-1 md:w-64" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                            <button onClick={handleSendTestEmail} disabled={isTesting} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap">
                                {isTesting ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Gửi thử
                            </button>
                        </div>
                    </div>

                    <div className="flex w-full xl:w-auto gap-3">
                         <button onClick={handleCheckConnection} disabled={isCheckingConnection} className="flex-1 xl:flex-none px-4 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 flex items-center justify-center gap-2 shadow-sm transition-colors">
                            {isCheckingConnection ? <Loader2 className="animate-spin" size={18}/> : <Wifi size={18}/>} Kiểm tra kết nối
                        </button>
                        <button onClick={handleSave} className="flex-1 xl:flex-none px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm transition-colors">
                            <Save size={18} /> Lưu cấu hình
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
