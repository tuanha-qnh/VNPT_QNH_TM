
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { dbClient } from './utils/supabaseClient'; 
import { Task, Unit, User, Role, TaskStatus, TaskPriority } from './types';
import { Search, LogOut, Loader2, Database, ShieldAlert } from 'lucide-react';
import md5 from 'md5'; 

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
              id: u.id, 
              code: u.code, 
              name: u.name, 
              parentId: u.parent_id || u.parentId || null,
              managerIds: u.manager_ids || u.managerIds || [], 
              level: u.level || 0
          })).sort((a, b) => (a.level || 0) - (b.level || 0));

          const mappedUsers: User[] = (usersData as any[]).map(u => ({
              id: u.id, 
              hrmCode: u.hrm_code || u.hrmCode, 
              fullName: u.full_name || u.fullName, 
              email: u.email, 
              username: u.username, 
              password: u.password, 
              title: u.title, 
              unitId: u.unit_id || u.unitId, 
              isFirstLogin: u.is_first_login ?? u.isFirstLogin, 
              canManageUsers: u.can_manage ?? u.canManageUsers, 
              avatar: u.avatar
          }));

          const mappedTasks: Task[] = (tasksData as any[]).map(t => ({
              id: t.id, name: t.name, content: t.content, status: t.status as TaskStatus, 
              priority: t.priority as TaskPriority, progress: t.progress || 0, deadline: t.deadline, 
              assignerId: t.assigner_id || t.assignerId,
              primaryAssigneeIds: t.primary_ids || t.primaryAssigneeIds || [], 
              supportAssigneeIds: t.support_ids || t.supportAssigneeIds || [],
              type: t.type || 'Single', createdAt: t.created_at || t.createdAt
          }));
          
          setUnits(mappedUnits);
          setUsers(mappedUsers);
          setTasks(mappedTasks);
      } catch (error) {
          console.error("Lỗi tải dữ liệu từ Supabase:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleInitializeSystem = async () => {
    if (!confirm("Hệ thống sẽ khởi tạo dữ liệu gốc lên Supabase Cloud. Tiếp tục?")) return;
    setIsLoading(true);
    try {
        const rootId = '00000000-0000-0000-0000-000000000001';
        await dbClient.upsert('units', rootId, { 
            code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0, parent_id: null 
        });

        const adminId = '00000000-0000-0000-0000-000000000002';
        await dbClient.upsert('users', adminId, {
            hrm_code: 'ADMIN', full_name: 'Quản Trị Viên', email: 'admin@vnpt.vn',
            username: 'admin', password: md5('123'), title: Role.DIRECTOR,
            unit_id: rootId, is_first_login: false, can_manage: true
        });

        await fetchInitialData();
        alert("Khởi tạo Cloud Database thành công!\nĐăng nhập bằng: admin / 123");
    } catch (err: any) {
        alert("Lỗi khởi tạo: " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      const hashedInput = md5(loginPassword);
      const user = users.find(u => u.username === loginUsername && (u.password === hashedInput || u.password === loginPassword));
      
      if (user) {
          setCurrentUser(user);
          localStorage.setItem('vnpt_user_session', JSON.stringify(user));
      } else {
          alert("Sai thông tin đăng nhập.");
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
          <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')]">
              <div className="bg-white p-12 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] w-full max-w-md border border-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
                  <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-blue-200">
                        <Database className="text-white" size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tighter">VNPT QUẢNG NINH</h1>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Management System v1.5</p>
                  </div>

                  {(users.length === 0 && !isLoading) ? (
                      <div className="space-y-6 animate-fade-in">
                          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-3">
                             <ShieldAlert className="text-amber-500 shrink-0" size={20}/>
                             <p className="text-xs text-amber-700 font-bold leading-relaxed text-center">
                                Cơ sở dữ liệu trống. Vui lòng bấm để khởi tạo.
                             </p>
                          </div>
                          <button onClick={handleInitializeSystem} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all">
                             <Database size={20}/> Khởi tạo Database Cloud
                          </button>
                      </div>
                   ) : (
                      <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đăng nhập</label>
                              <input type="text" required className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                              <input type="password" required className="w-full border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                          </div>
                          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center">
                             {isLoading ? <Loader2 className="animate-spin" /> : 'Vào hệ thống'}
                          </button>
                      </form>
                   )}
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} currentUser={currentUser} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} flex flex-col`}>
        <header className="h-20 bg-white/80 backdrop-blur-md sticky top-0 border-b px-8 flex items-center justify-between z-40">
           <div className="flex items-center bg-slate-100 rounded-2xl px-5 py-2.5 w-full max-w-md border border-slate-200">
             <Search size={18} className="text-slate-400 mr-2" />
             <input type="text" placeholder="Tìm nhanh công việc, nhân sự..." className="bg-transparent border-none outline-none text-sm w-full font-bold text-slate-600" />
           </div>
           <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
                 <div className="text-sm font-black text-slate-800 leading-none uppercase tracking-tighter">{currentUser.fullName}</div>
                 <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">{currentUser.title}</div>
             </div>
             <div className="h-12 w-12 bg-gradient-to-tr from-blue-700 to-blue-500 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-blue-100 text-xl border-2 border-white">
                {currentUser.fullName.charAt(0)}
             </div>
             <button onClick={handleLogout} className="text-slate-300 hover:text-red-600 transition-all p-2 hover:bg-red-50 rounded-xl"><LogOut size={24} /></button>
           </div>
        </header>
        <main className="p-10 flex-1 overflow-x-hidden">{renderModule()}</main>
      </div>
    </div>
  );
};

export default App;
