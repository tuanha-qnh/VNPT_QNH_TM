import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Task, TaskStatus } from '../types';
import { AlertCircle, CheckCircle, Clock, List } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF4560'];

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
    <div className={`p-4 rounded-full ${color} text-white`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ tasks }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const overdueTasks = tasks.filter(t => new Date(t.deadline) < new Date() && t.status !== TaskStatus.COMPLETED).length;
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
  
  // Logic for "Due Soon" (within 3 days)
  const dueSoonTasks = tasks.filter(t => {
    const deadline = new Date(t.deadline);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 0 && diffDays <= 3 && t.status !== TaskStatus.COMPLETED;
  }).length;

  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;
  const overdueRate = totalTasks > 0 ? ((overdueTasks / totalTasks) * 100).toFixed(1) : 0;

  const statusData = [
    { name: 'Hoàn thành', value: completedTasks },
    { name: 'Đang làm', value: pendingTasks },
    { name: 'Quá hạn', value: overdueTasks },
    { name: 'Vướng mắc', value: tasks.filter(t => t.status === TaskStatus.STUCK).length },
  ];

  // Dummy data for Unit comparison
  const unitData = [
    { name: 'P. KT-ĐT', completed: 12, overdue: 2 },
    { name: 'P. Kinh doanh', completed: 18, overdue: 5 },
    { name: 'TT Viễn thông 1', completed: 8, overdue: 1 },
    { name: 'TT Viễn thông 2', completed: 14, overdue: 3 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tổng quan điều hành</h2>
          <p className="text-slate-500">Thống kê tiến độ thực hiện nhiệm vụ toàn đơn vị</p>
        </div>
        <div className="text-sm text-slate-400">Cập nhật lúc: {new Date().toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Tổng công việc" 
          value={totalTasks} 
          icon={<List size={24} />} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Đã hoàn thành" 
          value={completedTasks} 
          icon={<CheckCircle size={24} />} 
          color="bg-green-500" 
        />
        <StatCard 
          title="Sắp hết hạn" 
          value={dueSoonTasks} 
          icon={<Clock size={24} />} 
          color="bg-yellow-500" 
        />
        <StatCard 
          title="Đã quá hạn" 
          value={overdueTasks} 
          icon={<AlertCircle size={24} />} 
          color="bg-red-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center">
            <h3 className="text-lg font-semibold mb-4 self-start">Tỷ lệ hoàn thành</h3>
            <div className="relative w-48 h-48 flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-800">{completionRate}%</span>
                <span className="text-xs text-slate-500">Hoàn thành</span>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
                 <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>Hoàn thành</div>
                 <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>Quá hạn: {overdueRate}%</div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-4">Tiến độ theo đơn vị</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitData}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Legend />
                <Bar dataKey="completed" name="Hoàn thành" fill="#00C49F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overdue" name="Quá hạn" fill="#FF8042" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
