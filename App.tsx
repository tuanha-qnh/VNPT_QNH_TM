
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { supabase } from './utils/supabaseClient'; 
import { Task, Unit, User, Role } from './types';
import { SQL_SETUP_SCRIPT } from './utils/dbSetup'; 
import { Search, LogOut, Lock, Loader2, ShieldAlert, Copy, Check } from 'lucide-react';
import md5 from 'md5'; 

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); 
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const logoutTimerRef = useRef<any>(null);
  const AUTO_LOGOUT_TIME = 30 * 60 * 1000; // 30 phút

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('vnpt_user_session');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
        } catch (e) {
            console.error("Lỗi khôi phục phiên:", e);
            localStorage.removeItem('vnpt_user_session');
        }
    }
    fetchInitialData();
  }, []);

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('vnpt_user_session');
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  };

  const resetLogoutTimer = () => {
      if (!currentUser) return;
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = setTimeout(() => {
          alert("Hết phiên làm việc (30 phút không tương tác). Vui lòng đăng nhập lại.");
          handleLogout();
      }, AUTO_LOGOUT_TIME);
  };

  useEffect(() => {
      if (currentUser) {
          window.addEventListener('mousemove', resetLogoutTimer);
          window.addEventListener('keypress', resetLogoutTimer);
          window.addEventListener('click', resetLogoutTimer);
          resetLogoutTimer();
      } else {
          window.removeEventListener('mousemove', resetLogoutTimer);
          window.removeEventListener('keypress', resetLogoutTimer);
          window.removeEventListener('click', resetLogoutTimer);
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      }
      return () => {
          window.removeEventListener('mousemove', resetLogoutTimer);
          window.removeEventListener('keypress', resetLogoutTimer);
          window.removeEventListener('click', resetLogoutTimer);
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      };
  }, [currentUser]);

  const isTableMissingError = (errMsg: string) => {
      const msg = errMsg.toLowerCase();
      return msg.includes("relation") || 
             msg.includes("does not exist") || 
             msg.includes("could not find the table") ||
             msg.includes("schema cache");
  };

  const fetchInitialData = async () => {
      setIsLoading(true);
      try {
          // Kiểm tra bảng units
          const { data: unitsData, error: uErr } = await supabase.from('units').select('*').order('level', { ascending: true });
          if (uErr && isTableMissingError(uErr.message)) { setShowSetupModal(true); setIsLoading(false); return; }

          // Kiểm tra bảng kpis (Quan trọng để fix lỗi của khách hàng)
          const { error: kErr } = await supabase.from('kpis').select('id').limit(1);
          if (kErr && isTableMissingError(kErr.message)) { setShowSetupModal(true); setIsLoading(false); return; }

          const mappedUnits: Unit[] = (unitsData || []).map((u: any) => ({
              id: u.id, code: u.code, name: u.name, parentId: u.parent_id,
              managerIds: u.manager_ids || [], level: u.level, address: u.address, phone: u.phone
          }));
          
          const { data: usersData, error: usErr } = await supabase.from('users').select('*');
          if (usErr && isTableMissingError(usErr.message)) setShowSetupModal(true);

          const mappedUsers: User[] = (usersData || []).map((u: any) => ({
              id: u.id, hrmCode: u.hrm_code, fullName: u.full_name, email: u.email, 
              username: u.username, password: u.password, title: u.title, unitId: u.unit_id,
              isFirstLogin: u.is_first_login, canManageUsers: u.can_manage, avatar: u.avatar
          }));
          
          const { data: tasksData, error: tErr } = await supabase.from('tasks').select('*');
          if (tErr && isTableMissingError(tErr.message)) setShowSetupModal(true);

          const mappedTasks: Task[] = (tasksData || []).map((t: any) => ({
              id: t.id, name: t.name, content: t.content, status: t.status, priority: t.priority,
              progress: t.progress, deadline: t.deadline, assignerId: t.assigner_id,
              primaryAssigneeIds: t.primary_ids || [], supportAssigneeIds: t.support_ids || [],
              type: t.type || 'Single', createdAt: t.created_at, extensionRequest: t.ext_request,
              projectId: t.project_id
          }));
          
          setUnits(mappedUnits);
          setUsers(mappedUsers);
          setTasks(mappedTasks);

      } catch (error: any) {
          console.error("Lỗi kết nối cơ sở dữ liệu:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleInitializeSystem = async () => {
    setIsLoading(true);
    try {
        let { error: uCheckErr } = await supabase.from('units').select('id').limit(1);
        if (uCheckErr && isTableMissingError(uCheckErr.message)) {
            setShowSetupModal(true);
            setIsLoading(false);
            return;
        }

        let unitId = null;
        const { data: existingUnits } = await supabase.from('units').select('id').eq('code', 'VNPT_QN').limit(1);
        
        if (existingUnits && existingUnits.length > 0) {
            unitId = existingUnits[0].id;
        } else {
            const { data: newUnit, error: createUnitErr } = await supabase
                .from('units')
                .insert([{ code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0 }])
                .select();
            if (createUnitErr) throw new Error("Lỗi tạo Unit: " + createUnitErr.message);
            unitId = newUnit[0].id;
        }

        const hashedPassword = md5('123'); 
        const adminData = {
            hrm_code: 'ADMIN',
            full_name: 'Quản Trị Viên (System)',
            email: 'admin@vnpt.vn',
            username: 'admin',
            password: hashedPassword, 
            title: 'Giám đốc',
            unit_id: unitId,
            is_first_login: false,
            can_manage: true
        };

        const { data: existingUser } = await supabase.from('users').select('id').eq('username', 'admin').maybeSingle();

        if (existingUser) {
            const { error: upErr } = await supabase.from('users').update(adminData).eq('id', existingUser.id);
            if (upErr) throw upErr;
        } else {
            const { error: inErr } = await supabase.from('users').insert([adminData]);
            if (inErr) throw inErr;
        }

        alert("Khởi tạo thành công! Tài khoản: admin / 123");
        await fetchInitialData();

    } catch (err: any) {
        console.error("Setup Error:", err);
        if (isTableMissingError(err.message)) setShowSetupModal(true);
        else alert("Lỗi Khởi tạo: " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopySQL = () => {
      navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const hashedInput = md5(loginPassword);
      let user = users.find(u => u.username === loginUsername && u.password === hashedInput);
      if (!user) {
          user = users.find(u => u.username === loginUsername && u.password === loginPassword);
          if (user) {
              const { error } = await supabase.from('users').update({ password: hashedInput }).eq('id', user.id);
              if (!error) {
                  user.password = hashedInput; 
                  setUsers(prev => prev.map(u => u.id === user!.id ? { ...u, password: hashedInput } : u));
              }
          }
      }
      if (user) {
          setCurrentUser(user);
          localStorage.setItem('vnpt_user_session', JSON.stringify(user));
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu.");
      }
  };

  const handleChangePassword = async () => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(newPassword)) {
          alert("Mật khẩu yếu!");
          return;
      }
      const hashedPassword = md5(newPassword);
      const { error } = await supabase.from('users').update({ password: hashedPassword, is_first_login: false }).eq('id', currentUser!.id);
      if (!error) {
          const updatedUser = { ...currentUser!, password: hashedPassword, isFirstLogin: false };
          setUsers(users.map(u => u.id === currentUser!.id ? updatedUser : u));
          setCurrentUser(updatedUser);
          localStorage.setItem('vnpt_user_session', JSON.stringify(updatedUser));
          setShowChangePass(false);
          alert("Đổi mật khẩu thành công!");
      }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          const targetUser = users.find(u => u.email === forgotEmail);
          if (!targetUser) { alert("Email này không tồn tại!"); setIsLoading(false); return; }
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          const randomPass = Array(8).fill(null).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
          const hashedRandomPass = md5(randomPass);
          const { error } = await supabase.from('users').update({ password: hashedRandomPass, is_first_login: true }).eq('id', targetUser.id);
          if (error) throw error;
          setUsers(users.map(u => u.id === targetUser.id ? { ...u, password: hashedRandomPass, isFirstLogin: true } : u));
          alert(`Mật khẩu mới là: ${randomPass}`);
          setIsForgotPassword(false);
      } catch (err: any) { alert("Có lỗi: " + err.message); } finally { setIsLoading(false); }
  };

  const renderModule = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
    switch (activeModule) {
      case 'dashboard': return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
      case 'admin': return currentUser?.title.includes('Admin') || currentUser?.canManageUsers ? <Admin units={units} users={users} currentUser={currentUser} setUnits={setUnits} setUsers={setUsers} /> : <div className="p-8 text-center text-red-500">Từ chối truy cập.</div>;
      case 'settings': return <Settings currentUser={currentUser!} />;
      case 'tasks': return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} setTasks={setTasks} />;
      case 'kpi-personal': return <KPI mode="personal" users={users} units={units} currentUser={currentUser!} />;
      case 'kpi-group': return <KPI mode="group" users={users} units={units} currentUser={currentUser!} />;
      default: return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
    }
  };

  if (showSetupModal) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl text-center">
                  <ShieldAlert size={48} className="mx-auto text-orange-600 mb-4" />
                  <h2 className="text-xl font-bold mb-4">Database không tìm thấy bảng 'kpis'</h2>
                  <div className="text-left space-y-4 text-sm text-slate-600 mb-6">
                      <p>Vui lòng copy và chạy script SQL Setup bên dưới vào phần <b>SQL Editor</b> trên Supabase Dashboard của bạn để tạo bảng 'kpis' và các ràng buộc cần thiết.</p>
                      <pre className="bg-slate-800 text-slate-200 p-4 rounded-lg h-40 overflow-y-auto font-mono text-[10px]">{SQL_SETUP_SCRIPT}</pre>
                  </div>
                  <button onClick={handleCopySQL} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 mx-auto">
                      {copySuccess ? <Check size={16}/> : <Copy size={16}/>} Copy SQL Script
                  </button>
                  <button onClick={() => window.location.reload()} className="mt-4 block mx-auto text-blue-600 underline">Tôi đã chạy xong SQL, Tải lại trang</button>
              </div>
          </div>
      )
  }

  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                  <h1 className="text-2xl font-bold text-blue-700 text-center mb-6">VNPT Quảng Ninh Task Manager</h1>
                  {isLoading ? <div className="text-center py-8"><Loader2 className="animate-spin mx-auto mb-2" /> Đang kết nối...</div> : 
                   users.length === 0 ? (
                      <div className="text-center space-y-6">
                          <button onClick={handleInitializeSystem} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Tạo Admin ngay</button>
                      </div>
                   ) : isForgotPassword ? (
                      <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                          <input type="email" required className="w-full border rounded-lg p-3" placeholder="Email nhận mật khẩu..." value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Gửi</button>
                          <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-slate-500 text-sm">Quay lại</button>
                      </form>
                   ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                          <input type="text" className="w-full border rounded-lg p-3" placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                          <input type="password" className="w-full border rounded-lg p-3" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Đăng nhập</button>
                          <div className="text-center"><button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-blue-600 underline">Quên mật khẩu?</button></div>
                      </form>
                   )}
              </div>
          </div>
      );
  }

  if (showChangePass) {
      return (
          <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
                  <Lock size={32} className="mx-auto text-orange-600 mb-4" />
                  <h2 className="text-xl font-bold mb-6">Yêu cầu đổi mật khẩu</h2>
                  <input type="password" placeholder="Mật khẩu mới..." className="w-full border rounded-lg p-3 mb-4" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <button onClick={handleChangePassword} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Cập nhật</button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} flex flex-col`}>
        <header className="h-16 bg-white border-b sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
           <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 w-96">
             <Search size={18} className="text-slate-400 mr-2" />
             <input type="text" placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-sm w-full" />
           </div>
           <div className="flex items-center gap-3">
             <div className="text-right hidden md:block">
                 <div className="text-sm font-bold">{currentUser.fullName}</div>
                 <div className="text-xs text-slate-500">{currentUser.title}</div>
             </div>
             <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-600 ml-4"><LogOut size={18} /></button>
           </div>
        </header>
        <main className="p-6 flex-1 overflow-x-hidden">{renderModule()}</main>
      </div>
    </div>
  );
};

export default App;
