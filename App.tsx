import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import Admin from './modules/Admin';
import Tasks from './modules/Tasks';
import KPI from './modules/KPI';
import { loadData, saveData, mockTasks, mockUnits, mockUsers } from './utils/mockData';
import { Task, Unit, User } from './types';
import { Bell, Search, User as UserIcon, LogOut, Lock, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // App State
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Persistent Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Load Data on Mount
  useEffect(() => {
      setTasks(loadData('tasks', mockTasks));
      setUnits(loadData('units', mockUnits));
      setUsers(loadData('users', mockUsers));
  }, []);

  // Save Data on Change
  useEffect(() => saveData('tasks', tasks), [tasks]);
  useEffect(() => saveData('units', units), [units]);
  useEffect(() => saveData('users', users), [users]);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
      if (user) {
          setCurrentUser(user);
          if (user.isFirstLogin) setShowChangePass(true);
      } else {
          alert("Sai tên đăng nhập hoặc mật khẩu");
      }
  };

  const handleResetData = () => {
    if (confirm('Thao tác này sẽ xóa mọi dữ liệu bạn đã nhập và đưa hệ thống về trạng thái ban đầu (Admin password: 123). Bạn có chắc chắn không?')) {
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleChangePassword = () => {
      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!regex.test(newPassword)) {
          alert("Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");
          return;
      }
      if (newPassword === '123456') {
          alert("Mật khẩu mới không được trùng mật khẩu mặc định.");
          return;
      }
      
      const updatedUser = { ...currentUser!, password: newPassword, isFirstLogin: false };
      const updatedUsers = users.map(u => u.id === currentUser!.id ? updatedUser : u);
      setUsers(updatedUsers);
      setCurrentUser(updatedUser);
      setShowChangePass(false);
      alert("Đổi mật khẩu thành công!");
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <Dashboard tasks={tasks} />;
      case 'admin':
        return currentUser?.title.includes('Admin') || currentUser?.canManageUsers ? (
            <Admin units={units} users={users} currentUser={currentUser} setUnits={setUnits} setUsers={setUsers} />
        ) : <div className="p-8 text-center text-red-500">Bạn không có quyền truy cập module này.</div>;
      case 'tasks':
        return <Tasks tasks={tasks} users={users} units={units} currentUser={currentUser!} setTasks={setTasks} />;
      case 'kpi':
        return <KPI users={users} units={units} />;
      default:
        return <Dashboard tasks={tasks} />;
    }
  };

  // Login Screen
  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                  <h1 className="text-2xl font-bold text-blue-700 text-center mb-6">VNPT Quảng Ninh Task Manager</h1>
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
                      
                      <div className="text-center text-xs text-slate-400 mt-4 border-t pt-4">
                          <button type="button" onClick={handleResetData} className="text-red-500 hover:text-red-700 underline flex items-center justify-center gap-1 w-full font-medium">
                            <RotateCcw size={14} /> Reset Dữ liệu Demo
                          </button>
                      </div>
                  </form>
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
                  <p className="text-sm text-slate-500 mb-6">Đây là lần đăng nhập đầu tiên hoặc mật khẩu đã được reset. Vui lòng đổi mật khẩu mới.</p>
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
             {/* User Info */}
             <div className="flex items-center gap-3 text-right">
               <div className="hidden md:block">
                 <div className="text-sm font-bold text-slate-800">{currentUser.fullName}</div>
                 <div className="text-xs text-slate-500">{currentUser.title}</div>
               </div>
               <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200 overflow-hidden">
                 {currentUser.avatar ? <img src={currentUser.avatar} alt="" /> : <UserIcon size={20} />}
               </div>
             </div>
             
             {/* Separator */}
             <div className="h-8 w-px bg-slate-200 mx-1"></div>

             {/* Logout Button */}
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