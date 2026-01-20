
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import Settings from './modules/Settings';
import { dbClient } from './utils/firebaseClient'; 
import { Task, Unit, User, Role } from './types';
import { Search, LogOut, Lock, Loader2, Database, ShieldCheck } from 'lucide-react';
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
          // Firebase NoSQL không cần SQL Setup, dữ liệu sẽ tự tạo khi lưu
          const unitsData = await dbClient.getAll('units');
          const usersData = await dbClient.getAll('users');
          const tasksData = await dbClient.getAll('tasks');

          const mappedUnits: Unit[] = (unitsData as any[]).map(u => ({
              id: u.id, code: u.code, name: u.name, parentId: u.parent_id || u.parentId,
              managerIds: u.manager_ids || u.managerIds || [], level: u.level || 0, 
              address: u.address, phone: u.phone
          })).sort((a, b) => (a.level || 0) - (b.level || 0));

          const mappedUsers: User[] = (usersData as any[]).map(u => ({
              id: u.id, hrmCode: u.hrm_code || u.hrmCode, fullName: u.full_name || u.fullName, 
              email: u.email, username: u.username, password: u.password, title: u.title, 
              unitId: u.unit_id || u.unitId, isFirstLogin: u.is_first_login ?? u.isFirstLogin, 
              canManageUsers: u.can_manage ?? u.canManageUsers, avatar: u.avatar
          }));

          const mappedTasks: Task[] = (tasksData as any[]).map(t => ({
              id: t.id, name: t.name, content: t.content, status: t.status, priority: t.priority,
              progress: t.progress || 0, deadline: t.deadline, assignerId: t.assigner_id || t.assignerId,
              primaryAssigneeIds: t.primary_ids || t.primaryAssigneeIds || [], 
              supportAssigneeIds: t.support_ids || t.supportAssigneeIds || [],
              type: t.type || 'Single', createdAt: t.created_at || t.createdAt, 
              extensionRequest: t.ext_request || t.extensionRequest,
              projectId: t.project_id || t.projectId
          }));
          
          setUnits(mappedUnits);
          setUsers(mappedUsers);
          setTasks(mappedTasks);

      } catch (error: any) {
          console.error("Lỗi tải dữ liệu:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleInitializeSystem = async () => {
    setIsLoading(true);
    try {
        const rootId = 'root_unit_qn';
        const unitData = { code: 'VNPT_QN', name: 'VNPT Quảng Ninh (Gốc)', level: 0 };
        await dbClient.upsert('units', rootId, unitData);

        const adminId = 'admin_user';
        const hashedPassword = md5('123'); 
        const adminData = {
            hrm_code: 'ADMIN',
            full_name: 'Quản Trị Viên',
            email: 'admin@vnpt.vn',
            username: 'admin',
            password: hashedPassword, 
            title: 'Giám đốc',
            unit_id: rootId,
            is_first_login: false,
            can_manage: true
        };
        await dbClient.upsert('users', adminId, adminData);

        alert("Khởi tạo Firebase thành công! Tài khoản: admin / 123");
        await fetchInitialData();
    } catch (err: any) {
        alert("Lỗi Khởi tạo: " + err.message);
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
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu.");
      }
  };

  const handleChangePassword = async () => {
      const hashedPassword = md5(newPassword);
      await dbClient.upsert('users', currentUser!.id, { password: hashedPassword, is_first_login: false });
      setShowChangePass(false);
      alert("Đổi mật khẩu thành công!");
      fetchInitialData();
  };

  const renderModule = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;
    switch (activeModule) {
      case 'dashboard': return <Dashboard tasks={tasks} units={units} currentUser={currentUser!} />;
      case 'admin': return <Admin units={units} users={users} currentUser={currentUser!} setUnits={setUnits} setUsers={setUsers} />;
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
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                  <h1 className="text-2xl font-bold text-blue-700 text-center mb-6">VNPT Quảng Ninh Task Manager</h1>
                  {users.length === 0 && !isLoading ? (
                      <div className="text-center space-y-6">
                          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                             Hệ thống chưa có dữ liệu. Hãy bấm nút dưới đây để khởi tạo Database Firebase.
                          </div>
                          <button onClick={handleInitializeSystem} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                             <Database size={20}/> Khởi tạo Database Miễn Phí
                          </button>
                      </div>
                   ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                          <input type="text" className="w-full border rounded-lg p-3" placeholder="Username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} />
                          <input type="password" className="w-full border rounded-lg p-3" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Đăng nhập</button>
                      </form>
                   )}
              </div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} flex flex-col`}>
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm">
           <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 w-96">
             <Search size={18} className="text-slate-400 mr-2" />
             <input type="text" placeholder="Tìm kiếm công việc..." className="bg-transparent border-none outline-none text-sm w-full" />
           </div>
           <div className="flex items-center gap-3">
             <div className="text-right">
                 <div className="text-sm font-bold text-slate-800">{currentUser.fullName}</div>
                 <div className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">{currentUser.title}</div>
             </div>
             <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 transition-colors ml-4"><LogOut size={20} /></button>
           </div>
        </header>
        <main className="p-6 flex-1 overflow-x-hidden">{renderModule()}</main>
      </div>
    </div>
  );
};

export default App;
