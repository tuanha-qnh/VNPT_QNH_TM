
import React from 'react';
import { LayoutDashboard, Users, CheckSquare, BarChart2, Settings, Menu, PieChart } from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule, isOpen, toggleSidebar }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
    { id: 'admin', label: 'Quản trị hệ thống', icon: <Users size={20} /> },
    { id: 'tasks', label: 'Quản lý công việc', icon: <CheckSquare size={20} /> },
    { type: 'divider' },
    { id: 'kpi-group', label: 'KPI Tập thể', icon: <PieChart size={20} /> },
    { id: 'kpi-personal', label: 'KPI Cá nhân', icon: <BarChart2 size={20} /> },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full bg-[#0f172a] text-white transition-all duration-300 z-50 flex flex-col ${isOpen ? 'w-64' : 'w-16'}`}>
      <div className="h-16 flex items-center justify-between px-4 bg-[#004BB5] shadow-md">
        {isOpen && <span className="font-bold text-lg tracking-wider">VNPT QN</span>}
        <button onClick={toggleSidebar} className="p-1 hover:bg-white/10 rounded">
          <Menu size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4">
        <ul>
          {menuItems.map((item, index) => {
            if (item.type === 'divider') {
                return <li key={`div-${index}`} className="my-2 border-t border-white/10"></li>;
            }
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveModule(item.id!)}
                  className={`w-full flex items-center px-4 py-3 hover:bg-white/10 transition-colors ${
                    activeModule === item.id ? 'bg-[#0068FF] border-r-4 border-white' : ''
                  }`}
                  title={!isOpen ? item.label : ''}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {isOpen && <span className="ml-3 truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10">
        <button className="flex items-center text-gray-400 hover:text-white transition-colors w-full">
          <Settings size={20} />
          {isOpen && <span className="ml-3">Cài đặt</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
