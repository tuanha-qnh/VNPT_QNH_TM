
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { dbClient } from './utils/firebaseClient'; 
import { Task, Unit, User, Role, TaskStatus, TaskPriority } from './types';
import { Search, LogOut, Loader2, Database, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';
import md5 from 'md5'; 

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeModule, setActiveModule] = useState(() => localStorage.getItem('vnpt_active_module') || 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('vnpt_active_module', activeModule);
  }, [activeModule]);

  const fetchInitialData = useCallback(async (isSilent = false) => {
      if (!isSilent) setIsInitialLoading(true);
      else setIsRefreshing(true);
      
      try {
          const [unitsData, usersData, tasksData, kpisData] = await Promise.all([
              dbClient.getAll('units'),
              dbClient.getAll('users'),
              dbClient.getAll('tasks'),
              dbClient.getAll('kpis')
          ]);

          setUnits(unitsData as Unit[]);
          setUsers(usersData as User[]);
          setTasks(tasksData as Task[]);
          setKpis(kpisData || []);

          const stored = localStorage.getItem('vnpt_user_session');
          if (stored) {
              const parsed = JSON.parse(stored);
              const updated = (usersData as User[]).find(u => u.id === parsed.id);
              if (updated) {
                  setCurrentUser(updated);
                  localStorage.setItem('vnpt_user_session', JSON.stringify(updated));
              }
          }
      } catch (error) {
          console.error("Lỗi tải dữ liệu từ Firebase:", error);
      } finally {
          setIsInitialLoading(false);
          setIsRefreshing(false);
      }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('vnpt_user_session');
    if (storedUser) {
        try { setCurrentUser(JSON.parse(storedUser)); } catch (e) { localStorage.removeItem('vnpt_user_session'); }
    }
    fetchInitialData();
  }, [fetchInitialData]);

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('vnpt_user_session');
  };

  const handleInitializeSystem = async () => {
    if (!confirm("Hệ thống sẽ khởi tạo dữ liệu gốc lên Firebase Cloud. Tiếp tục?")) return;
    setIsInitialLoading(true);
    try {
        const rootId = 'unit_root_qn';
        const adminId = 'user_admin_root';

        await dbClient.upsert('units', rootId, { 
            code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0, parentId: null 
        });

        await dbClient.upsert('users', adminId, {
            hrmCode: 'ADMIN', fullName: 'Quản Trị Viên', email: 'admin@vnpt.vn',
            username: 'admin', password: md5('123'), title: Role.DIRECTOR,
            unitId: rootId, isFirstLogin: false, canManageUsers: true
        });

        await fetchInitialData();
        alert("Khởi tạo Firebase Cloud Database thành công!\nĐăng nhập bằng: admin / 123");
    } catch (err: any) {
        if (err.message.includes('permission')) {
            alert("LỖI PHÂN QUYỀN FIREBASE:\n\nVui lòng vào Firebase Console -> Firestore -> Rules và đổi thành 'allow read, write: if true;'.\n\nChi tiết lỗi: " + err.message);
        } else {
            alert("Lỗi khởi tạo: " + err.message);
        }
    } finally {
        setIsInitialLoading(false);
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
          alert("Tên đăng nhập hoặc mật khẩu không chính xác.");
      }
  };

  const renderModule = () => {
    if (isInitialLoading) return <div className="flex flex-col items-center justify-center h-full gap-4 text-blue-600 font-bold"><Loader2 className="animate-spin" size={48} /> <span>Đang kết nối Cloud...</span></div>;
    switch (activeModule) {
      // Fix: Pass users prop to Dashboard
      case 'dashboard': return <Dashboard tasks={tasks} units={units} users={users} currentUser={currentUser!} groupKpi={kpis} />;
      case 'admin': return <Admin units={units} users={users} currentUser={currentUser!} onRefresh={() => fetchInitialData(true)} />;
      case 'tasks': return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} onRefresh={() => fetchInitialData(true)} />;
      case 'kpi-personal': return <KPI mode="personal" users={users} units={units} currentUser={currentUser!} />;
      case 'kpi-group': return <KPI mode="group" users={users} units={units} currentUser={currentUser!} />;
      case 'settings': return <Settings currentUser={currentUser!} onRefresh={() => fetchInitialData(true)} />;
      default: return <Dashboard tasks={tasks} units={units} users={users} currentUser={currentUser!} groupKpi={kpis} />;
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
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Management System v1.8 (Firebase)</p>
                  </div>
                  {(users.length === 0 && !isInitialLoading) ? (
                      <div className="space-y-6 animate-fade-in">
                          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-3">
                             <ShieldAlert className="text-amber-500 shrink-0" size={20}/>
                             <div>
                                <p className="text-[10px] text-amber-800 font-black uppercase tracking-wider">Lỗi kết nối hoặc DB trống</p>
                                <p className="text-[10px] text-amber-700 font-medium leading-tight mt-0.5">Nếu nút khởi tạo bên dưới báo lỗi "Permissions", hãy kiểm tra Firestore Rules.</p>
                             </div>
                          </div>
                          <button onClick={handleInitializeSystem} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all">
                             <Database size={20}/> Khởi tạo Firebase Cloud
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
                          <button type="submit" disabled={isInitialLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center">
                             {isInitialLoading ? <Loader2 className="animate-spin" /> : 'Vào hệ thống'}
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
           <div className="flex items-center gap-4">
               {isRefreshing && <RefreshCw className="animate-spin text-blue-500" size={20}/>}
               <div className="flex items-center bg-slate-100 rounded-2xl px-5 py-2.5 w-full max-w-md border border-slate-200">
                 <Search size={18} className="text-slate-400 mr-2" />
                 <input type="text" placeholder="Tìm nhanh công việc, nhân sự..." className="bg-transparent border-none outline-none text-sm w-full font-bold text-slate-600" />
               </div>
           </div>
           <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
                 <div className="text-sm font-black text-slate-800 leading-none uppercase tracking-tighter">{currentUser.fullName}</div>
                 <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">{currentUser.title}</div>
             </div>
             <div className="h-12 w-12 bg-gradient-to-tr from-blue-700 to-blue-500 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-blue-100 text-xl border-2 border-white overflow-hidden">
                {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : currentUser.fullName.charAt(0)}
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