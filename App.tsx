
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { dbClient } from './utils/firebaseClient'; 
import { Task, Unit, User, Role } from './types';
import { Search, LogOut, Loader2, Database } from 'lucide-react';
import md5 from 'md5'; 

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); 

  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('vnpt_user_session');
    if (storedUser) {
        try {
            setCurrentUser(JSON.parse(storedUser));
        } catch (e) {
            localStorage.removeItem('vnpt_user_session');
        }
    }
    fetchInitialData();
  }, []);

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('vnpt_user_session');
  };

  const fetchInitialData = async () => {
      setIsLoading(true);
      try {
          const [unitsData, usersData, tasksData] = await Promise.all([
              dbClient.getAll('units'),
              dbClient.getAll('users'),
              dbClient.getAll('tasks')
          ]);

          const mappedUnits: Unit[] = (unitsData as any[]).map(u => ({
              id: u.id, code: u.code, name: u.name, parentId: u.parentId || u.parent_id || null,
              managerIds: u.managerIds || [], level: u.level || 0
          })).sort((a, b) => (a.level || 0) - (b.level || 0));

          const mappedUsers: User[] = (usersData as any[]).map(u => ({
              id: u.id, hrmCode: u.hrmCode || u.hrm_code, fullName: u.fullName || u.full_name, 
              email: u.email, username: u.username, password: u.password, title: u.title, 
              unitId: u.unitId || u.unit_id, isFirstLogin: u.isFirstLogin ?? u.is_first_login, 
              canManageUsers: u.canManageUsers ?? u.can_manage, avatar: u.avatar
          }));

          const mappedTasks: Task[] = (tasksData as any[]).map(t => ({
              id: t.id, name: t.name, content: t.content, status: t.status, priority: t.priority,
              progress: t.progress || 0, deadline: t.deadline, assignerId: t.assignerId || t.assigner_id,
              primaryAssigneeIds: t.primaryAssigneeIds || t.primary_ids || [], 
              supportAssigneeIds: t.supportAssigneeIds || t.support_ids || [],
              type: t.type || 'Single', createdAt: t.createdAt || t.created_at
          }));
          
          setUnits(mappedUnits);
          setUsers(mappedUsers);
          setTasks(mappedTasks);
      } catch (error) {
          console.error("Lỗi tải dữ liệu:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleInitializeSystem = async () => {
    setIsLoading(true);
    try {
        const rootId = 'root_unit_qn';
        await dbClient.upsert('units', rootId, { code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0, parentId: null });

        const adminId = 'admin_user';
        const hashedPassword = md5('123'); 
        const adminData = {
            hrmCode: 'ADMIN',
            fullName: 'Quản Trị Viên',
            email: 'admin@vnpt.vn',
            username: 'admin',
            password: hashedPassword, 
            title: Role.DIRECTOR,
            unitId: rootId,
            isFirstLogin: false,
            canManageUsers: true
        };
        await dbClient.upsert('users', adminId, adminData);

        // Cập nhật State ngay lập tức để người dùng có thể đăng nhập
        await fetchInitialData();
        alert("Đã khởi tạo dữ liệu hệ thống!\nUsername: admin\nPassword: 123");
    } catch (err: any) {
        alert("Lỗi: " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (users.length === 0) {
          alert("Hệ thống chưa có dữ liệu nhân sự. Vui lòng bấm Khởi tạo Database.");
          return;
      }
      
      const hashedInput = md5(loginPassword);
      const user = users.find(u => u.username === loginUsername && (u.password === hashedInput || u.password === loginPassword));
      
      if (user) {
          setCurrentUser(user);
          localStorage.setItem('vnpt_user_session', JSON.stringify(user));
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu.");
      }
  };

  const renderModule = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
    switch (activeModule) {
      case 'dashboard': return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
      case 'admin': return <Admin units={units} users={users} currentUser={currentUser!} setUnits={setUnits} setUsers={setUsers} />;
      case 'tasks': return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} setTasks={setTasks} />;
      case 'kpi-personal': return <KPI mode="personal" users={users} units={units} currentUser={currentUser!} />;
      case 'kpi-group': return <KPI mode="group" users={users} units={units} currentUser={currentUser!} />;
      case 'settings': return <Settings currentUser={currentUser!} />;
      default: return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
    }
  };

  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/double-bubble-outline.png')]">
              <div className="bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Database className="text-white" size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">VNPT QUẢNG NINH</h1>
                    <p className="text-slate-500 text-sm font-medium">Hệ thống Quản trị Công việc & KPI</p>
                  </div>

                  {users.length === 0 && !isLoading ? (
                      <div className="space-y-4">
                          <div className="bg-blue-50 p-4 rounded-2xl text-xs text-blue-700 font-bold leading-relaxed border border-blue-100">
                             Hệ thống đang ở trạng thái trống. Vui lòng khởi tạo bộ dữ liệu gốc (Admin/Units) để bắt đầu.
                          </div>
                          <button onClick={handleInitializeSystem} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95">
                             <Database size={20}/> Khởi tạo Database
                          </button>
                      </div>
                   ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tên đăng nhập</label>
                              <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all" placeholder="username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Mật khẩu</label>
                              <input type="password" className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                          </div>
                          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center">
                             {isLoading ? <Loader2 className="animate-spin" /> : 'Đăng nhập hệ thống'}
                          </button>
                          <div className="text-center pt-2">
                             <button type="button" onClick={handleInitializeSystem} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest">Reset / Re-init Database</button>
                          </div>
                      </form>
                   )}
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} flex flex-col`}>
        <header className="h-20 bg-white/80 backdrop-blur-md sticky top-0 border-b px-8 flex items-center justify-between z-40">
           <div className="flex items-center bg-slate-100 rounded-2xl px-4 py-2.5 w-full max-w-md border border-slate-200">
             <Search size={18} className="text-slate-400 mr-2" />
             <input type="text" placeholder="Tìm nhanh công việc, nhân sự..." className="bg-transparent border-none outline-none text-sm w-full font-medium" />
           </div>
           <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                 <div className="text-sm font-black text-slate-800 leading-none">{currentUser.fullName}</div>
                 <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1">{currentUser.title}</div>
             </div>
             <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100">
                {currentUser.fullName.charAt(0)}
             </div>
             <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-xl"><LogOut size={20} /></button>
           </div>
        </header>
        <main className="p-8 flex-1 overflow-x-hidden">{renderModule()}</main>
      </div>
    </div>
  );
};

export default App;
