
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { supabase } from './utils/supabaseClient'; 
import { Task, Unit, User, Role } from './types';
import { Search, User as UserIcon, LogOut, Lock, RotateCcw, Loader2, Database, WifiOff, Mail, KeyRound, ShieldAlert, PlayCircle } from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); 
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // App State
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const fetchInitialData = async () => {
      setIsLoading(true);
      try {
          // 1. Lấy Units
          const { data: unitsData, error: uErr } = await supabase.from('units').select('*').order('level', { ascending: true });
          if (uErr) {
              console.error("Lỗi tải Units:", uErr);
              // Nếu lỗi do chưa có bảng (Relation not exist), không throw để app không crash
          }

          const mappedUnits: Unit[] = (unitsData || []).map((u: any) => ({
              id: u.id, code: u.code, name: u.name, parentId: u.parent_id,
              managerIds: u.manager_ids || [], level: u.level, address: u.address, phone: u.phone
          }));
          
          // 2. Lấy Users
          const { data: usersData, error: usErr } = await supabase.from('users').select('*');
          if (usErr) {
              console.error("Lỗi tải Users:", usErr);
          }

          const mappedUsers: User[] = (usersData || []).map((u: any) => ({
              id: u.id, hrmCode: u.hrm_code, fullName: u.full_name, email: u.email, 
              username: u.username, password: u.password, title: u.title, unitId: u.unit_id,
              isFirstLogin: u.is_first_login, canManageUsers: u.can_manage, avatar: u.avatar
          }));
          
          // 3. Lấy Tasks
          const { data: tasksData, error: tErr } = await supabase.from('tasks').select('*');
          if (tErr) {
              console.error("Lỗi tải Tasks:", tErr);
          }

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

      } catch (error) {
          console.error("Lỗi kết nối chung:", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchInitialData();
  }, []);

  // --- ADMIN RESET / INIT LOGIC ---
  const handleInitializeSystem = async () => {
    if (!confirm("Hệ thống sẽ tạo Đơn vị gốc và tài khoản Admin mặc định (admin/123). Bạn có chắc chắn?")) return;
    
    setIsLoading(true);
    try {
        // 1. Kiểm tra hoặc tạo Đơn vị gốc
        let { data: existingUnits } = await supabase.from('units').select('id').limit(1);
        let unitId = existingUnits?.[0]?.id;

        if (!unitId) {
            const { data: newUnit, error: uErr } = await supabase.from('units').insert([{
                code: 'VNPT_QN',
                name: 'VNPT Quảng Ninh (Gốc)',
                level: 0
            }]).select();
            
            if (uErr) throw new Error("Lỗi tạo đơn vị: " + uErr.message);
            if (newUnit && newUnit[0]) unitId = newUnit[0].id;
        }

        if (!unitId) throw new Error("Không thể xác định đơn vị gốc.");

        // 2. Kiểm tra hoặc tạo Admin User
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', 'admin').single();
        
        const adminData = {
            hrm_code: 'ADMIN',
            full_name: 'Quản Trị Viên (System)',
            email: 'admin@vnpt.vn',
            username: 'admin',
            password: '123', // Mật khẩu mặc định
            title: 'Giám đốc',
            unit_id: unitId,
            is_first_login: false,
            can_manage: true
        };

        if (existingUser) {
            // Nếu user đã tồn tại, reset lại password
            const { error: err } = await supabase.from('users').update(adminData).eq('id', existingUser.id);
            if (err) throw err;
        } else {
            const { error: err } = await supabase.from('users').insert([adminData]);
            if (err) throw err;
        }

        alert("Khởi tạo thành công! \nTài khoản: admin \nMật khẩu: 123");
        
        // Reload data
        await fetchInitialData();

    } catch (err: any) {
        console.error(err);
        alert("Lỗi Khởi tạo: " + err.message + "\n\nLƯU Ý: Nếu lỗi 'relation does not exist', bạn cần vào Supabase SQL Editor và chạy script tạo bảng (xem file SQL).");
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Logic so sánh username/pass từ state đã tải về
      const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
      if (user) {
          setCurrentUser(user);
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu.");
      }
  };

  const handleChangePassword = async () => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(newPassword)) {
          alert("Mật khẩu yếu! Phải bao gồm chữ hoa, thường, số và ký tự đặc biệt.");
          return;
      }
      
      const { error } = await supabase.from('users').update({ password: newPassword, is_first_login: false }).eq('id', currentUser!.id);

      if (!error) {
          const updatedUser = { ...currentUser!, password: newPassword, isFirstLogin: false };
          setUsers(users.map(u => u.id === currentUser!.id ? updatedUser : u));
          setCurrentUser(updatedUser);
          setShowChangePass(false);
          alert("Đổi mật khẩu thành công!");
      } else {
          alert("Lỗi khi lưu mật khẩu: " + error.message);
      }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          const targetUser = users.find(u => u.email === forgotEmail);
          if (!targetUser) {
              alert("Email này không tồn tại trong hệ thống!");
              setIsLoading(false);
              return;
          }
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
          const randomPass = Array(10).fill(null).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
          const { error } = await supabase.from('users').update({ password: randomPass, is_first_login: true }).eq('id', targetUser.id);
          if (error) throw error;
          console.log(`[MOCK EMAIL SERVICE] Sending to ${forgotEmail}: New Password is ${randomPass}`);
          setUsers(users.map(u => u.id === targetUser.id ? { ...u, password: randomPass, isFirstLogin: true } : u));
          alert(`Mật khẩu mới đã được gửi đến email: ${forgotEmail}\n(Mô phỏng: Mật khẩu là ${randomPass})`);
          setIsForgotPassword(false);
          setForgotEmail('');
      } catch (err: any) {
          alert("Có lỗi xảy ra: " + err.message);
      } finally {
          setIsLoading(false);
      }
  };

  const renderModule = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
    switch (activeModule) {
      case 'dashboard': return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
      case 'admin': return currentUser?.title.includes('Admin') || currentUser?.canManageUsers ? <Admin units={units} users={users} currentUser={currentUser} setUnits={setUnits} setUsers={setUsers} /> : <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập module này.</div>;
      case 'settings': return <Settings currentUser={currentUser!} />;
      case 'tasks': return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} setTasks={setTasks} />;
      case 'kpi-personal': return <KPI mode="personal" users={users} units={units} currentUser={currentUser!} />;
      case 'kpi-group': return <KPI mode="group" users={users} units={units} currentUser={currentUser!} />;
      default: return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
    }
  };

  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md relative">
                  <h1 className="text-2xl font-bold text-blue-700 text-center mb-6 mt-4">VNPT Quảng Ninh Task Manager</h1>
                  
                  {isForgotPassword ? (
                      <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 animate-fade-in">
                          <div className="text-center mb-4">
                              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2"><KeyRound size={24}/></div>
                              <h3 className="font-bold text-slate-700">Khôi phục mật khẩu</h3>
                              <p className="text-xs text-slate-500">Nhập email đã đăng ký để nhận mật khẩu mới.</p>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Email của bạn</label>
                              <div className="relative">
                                <input type="email" required className="w-full border rounded-lg p-3 pl-10" placeholder="example@vnpt.vn" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                              </div>
                          </div>
                          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                             {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Gửi mật khẩu mới'}
                          </button>
                          <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-slate-500 text-sm hover:text-blue-600 py-2">Quay lại Đăng nhập</button>
                      </form>
                  ) : (
                      isLoading ? (
                        <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                            <Loader2 className="animate-spin mb-2" /> Đang kết nối máy chủ...
                        </div>
                      ) : (
                        <div className="animate-fade-in">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                                    <input type="text" className="w-full border rounded-lg p-3" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                                    <input type="password" className="w-full border rounded-lg p-3" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Đăng nhập</button>
                                
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-blue-600 hover:underline">Quên mật khẩu?</button>
                                </div>
                            </form>
                            
                            {/* Nút Khởi tạo hiển thị nếu Database trống */}
                            {users.length === 0 && (
                                <div className="mt-8 pt-6 border-t border-slate-100 text-center animate-pulse">
                                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-2">
                                        <p className="text-xs text-orange-600 font-bold mb-1"><Database size={14} className="inline mr-1"/>Database chưa có dữ liệu</p>
                                        <p className="text-xs text-slate-500">Hệ thống phát hiện chưa có user nào.</p>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleInitializeSystem} 
                                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-md"
                                    >
                                        <PlayCircle size={16}/> Khởi tạo Admin (admin / 123)
                                    </button>
                                </div>
                            )}

                             {/* Nút Debug ẩn (nhỏ) để reset nếu cần */}
                            {users.length > 0 && (
                                <div className="mt-8 text-center">
                                    <button 
                                        type="button" 
                                        onClick={handleInitializeSystem} 
                                        className="text-xs text-slate-300 hover:text-red-500 transition-colors"
                                        title="Chỉ dùng khi cần reset lại user admin"
                                    >
                                        (Reset Admin Account)
                                    </button>
                                </div>
                            )}
                        </div>
                      )
                  )}
              </div>
          </div>
      );
  }

  if (showChangePass) {
      return (
          <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={32}/></div>
                  <h2 className="text-xl font-bold mb-2">Yêu cầu đổi mật khẩu</h2>
                  <p className="text-sm text-slate-500 mb-6">Mật khẩu đã được reset hoặc lần đầu đăng nhập.</p>
                  <input type="password" placeholder="Mật khẩu mới..." className="w-full border rounded-lg p-3 mb-4" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <button onClick={handleChangePassword} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Cập nhật mật khẩu</button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} flex flex-col`}>
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
           <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 w-96">
             <Search size={18} className="text-slate-400 mr-2" />
             <input type="text" placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-sm w-full" />
           </div>
           
           <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                <span className="flex items-center gap-1 text-green-600"><Database size={12}/> Online</span>
             </div>

             <div className="flex items-center gap-3 text-right">
               <div className="hidden md:block">
                 <div className="text-sm font-bold text-slate-800">{currentUser.fullName}</div>
                 <div className="text-xs text-slate-500">{currentUser.title}</div>
               </div>
               <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 overflow-hidden">
                 {currentUser.avatar ? <img src={currentUser.avatar} alt="" /> : <UserIcon size={20} />}
               </div>
             </div>
             
             <div className="h-8 w-px bg-slate-200 mx-1"></div>

             <button 
                onClick={() => setCurrentUser(null)} 
                className="flex items-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                title="Đăng xuất"
             >
                 <LogOut size={18} />
                 <span className="hidden md:inline">Đăng xuất</span>
             </button>
           </div>
        </header>

        <main className="p-6 flex-1 overflow-x-hidden">
           {renderModule()}
        </main>
      </div>
    </div>
  );
};

export default App;
