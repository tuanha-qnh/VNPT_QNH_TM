
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import { supabase } from './utils/supabaseClient'; // Import Supabase
import { Task, Unit, User, Role } from './types';
import { mockTasks, mockUnits, mockUsers } from './utils/mockData'; // Import Mock Data dự phòng
import { Search, User as UserIcon, LogOut, Lock, RotateCcw, Loader2, Database, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [isUsingMock, setIsUsingMock] = useState(false); // Trạng thái dùng Mock Data

  // App State
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // --- HÀM 1: TẢI DỮ LIỆU TỪ SUPABASE (CÓ FALLBACK MOCK DATA) ---
  const fetchInitialData = async () => {
      setIsLoading(true);
      try {
          // Kiểm tra sơ bộ URL (nếu vẫn để mặc định thì throw lỗi luôn để chuyển sang Mock)
          // @ts-ignore
          const url = supabase.supabaseUrl || '';
          if (url.includes('YOUR_PROJECT_ID')) {
              throw new Error("Chưa cấu hình Supabase URL");
          }

          // 1. Lấy Units
          const { data: unitsData, error: uErr } = await supabase.from('units').select('*').order('level', { ascending: true });
          if (uErr) throw uErr;

          const mappedUnits: Unit[] = (unitsData || []).map((u: any) => ({
              id: u.id,
              code: u.code,
              name: u.name,
              parentId: u.parent_id,
              managerIds: u.manager_ids || [],
              level: u.level,
              address: u.address,
              phone: u.phone
          }));
          
          // 2. Lấy Users
          const { data: usersData, error: usErr } = await supabase.from('users').select('*');
          if (usErr) throw usErr;

          const mappedUsers: User[] = (usersData || []).map((u: any) => ({
              id: u.id,
              hrmCode: u.hrm_code,
              fullName: u.full_name,
              username: u.username,
              password: u.password,
              title: u.title,
              unitId: u.unit_id,
              isFirstLogin: u.is_first_login,
              canManageUsers: u.can_manage,
              avatar: u.avatar
          }));
          
          // 3. Lấy Tasks
          const { data: tasksData, error: tErr } = await supabase.from('tasks').select('*');
          if (tErr) throw tErr;

          const mappedTasks: Task[] = (tasksData || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              content: t.content,
              status: t.status,
              priority: t.priority,
              progress: t.progress,
              deadline: t.deadline,
              assignerId: t.assigner_id,
              primaryAssigneeIds: t.primary_ids || [],
              supportAssigneeIds: t.support_ids || [],
              type: t.type || 'Single',
              createdAt: t.created_at,
              extensionRequest: t.ext_request,
              projectId: t.project_id
          }));
          
          // Nếu thành công thì set state
          setUnits(mappedUnits);
          setUsers(mappedUsers);
          setTasks(mappedTasks);
          setIsUsingMock(false);

      } catch (error) {
          console.warn("Không kết nối được DB, chuyển sang Mock Data:", error);
          // FALLBACK: Dùng Mock Data để user đăng nhập được ngay
          setUnits(mockUnits);
          setUsers(mockUsers);
          setTasks(mockTasks);
          setIsUsingMock(true);
      } finally {
          setIsLoading(false);
      }
  };

  // Chạy hàm tải dữ liệu khi mở App
  useEffect(() => {
      fetchInitialData();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Logic đăng nhập vẫn so sánh trên state 'users' đã tải về
      const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
      if (user) {
          setCurrentUser(user);
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu");
      }
  };

  const handleResetData = () => {
    alert("Tính năng Reset dữ liệu giả không khả dụng khi dùng Database thật.");
  };

  const handleChangePassword = async () => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(newPassword)) {
          alert("Mật khẩu yếu!");
          return;
      }
      
      // Nếu đang dùng Mock Data thì chỉ cập nhật Local State
      if (isUsingMock) {
           const updatedUser = { ...currentUser!, password: newPassword, isFirstLogin: false };
           setUsers(users.map(u => u.id === currentUser!.id ? updatedUser : u));
           setCurrentUser(updatedUser);
           setShowChangePass(false);
           alert("Đổi mật khẩu thành công (Chế độ Mock)!");
           return;
      }

      // Gọi API cập nhật mật khẩu nếu dùng DB thật
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword, is_first_login: false })
        .eq('id', currentUser!.id);

      if (!error) {
          // Cập nhật state local
          const updatedUser = { ...currentUser!, password: newPassword, isFirstLogin: false };
          setUsers(users.map(u => u.id === currentUser!.id ? updatedUser : u));
          setCurrentUser(updatedUser);
          setShowChangePass(false);
          alert("Đổi mật khẩu thành công!");
      } else {
          alert("Lỗi khi lưu mật khẩu: " + error.message);
      }
  };

  const renderModule = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

    switch (activeModule) {
      case 'dashboard':
        return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
      case 'admin':
        return currentUser?.title.includes('Admin') || currentUser?.canManageUsers ? (
            <Admin units={units} users={users} currentUser={currentUser} setUnits={setUnits} setUsers={setUsers} />
        ) : <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập module này.</div>;
      case 'tasks':
        return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} setTasks={setTasks} />;
      case 'kpi-personal':
        return <KPI mode="personal" users={users} units={units} currentUser={currentUser!} />;
      case 'kpi-group':
        return <KPI mode="group" users={users} units={units} currentUser={currentUser!} />;
      default:
        return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
    }
  };

  // Login Screen
  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md relative">
                  {isUsingMock && !isLoading && (
                      <div className="absolute top-0 left-0 w-full bg-orange-100 text-orange-700 text-xs py-1 px-4 text-center rounded-t-xl border-b border-orange-200">
                         <WifiOff size={12} className="inline mr-1"/> Đang chạy chế độ Dữ liệu mẫu (Offline Mode)
                      </div>
                  )}
                  
                  <h1 className="text-2xl font-bold text-blue-700 text-center mb-6 mt-4">VNPT Quảng Ninh Task Manager</h1>
                  {isLoading ? (
                      <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                          <Loader2 className="animate-spin mb-2" /> Đang kết nối máy chủ...
                      </div>
                  ) : (
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
                        
                        {isUsingMock && (
                            <div className="text-xs text-center text-slate-400 mt-2">
                                Mặc định: <strong>admin / 123</strong>
                            </div>
                        )}
                    </form>
                  )}
              </div>
          </div>
      );
  }

  // Force Change Password Screen
  if (showChangePass) {
      return (
          <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={32}/></div>
                  <h2 className="text-xl font-bold mb-2">Yêu cầu đổi mật khẩu</h2>
                  <p className="text-sm text-slate-500 mb-6">Lần đầu đăng nhập, vui lòng đổi mật khẩu.</p>
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
             {/* Connection Status Indicator */}
             <div className="hidden md:flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                 {isUsingMock ? 
                    <span className="flex items-center gap-1 text-orange-600"><WifiOff size={12}/> Offline Mode</span> : 
                    <span className="flex items-center gap-1 text-green-600"><Database size={12}/> Online</span>
                 }
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
