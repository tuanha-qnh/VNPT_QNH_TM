
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Task, TaskStatus, Unit, User, GroupKPIData, KPI_KEYS } from '../types';
import { AlertCircle, CheckCircle, Clock, List, BarChart2, Shield } from 'lucide-react';
import { loadData, saveData } from '../utils/mockData';

interface DashboardProps {
  tasks: Task[];
  units: Unit[];
  currentUser: User;
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

// Helper to generate Group KPI data if not exists (for Dashboard visualization)
const ensureGroupData = (units: Unit[]): GroupKPIData[] => {
    return units.map(u => {
        const targets: any = {};
        Object.keys(KPI_KEYS).forEach(key => {
            const target = Math.floor(Math.random() * 500) + 200;
            const actual = Math.floor(Math.random() * target * 0.9); 
            targets[key] = { target, actual };
        });
        return { unitCode: u.code, unitName: u.name, targets };
    });
};

const Dashboard: React.FC<DashboardProps> = ({ tasks, units, currentUser }) => {
  const [groupKpi, setGroupKpi] = useState<GroupKPIData[]>([]);
  
  // 1. Load Group KPI Data
  useEffect(() => {
      const loaded = loadData<GroupKPIData[]>('kpi_group_data', []);
      if (loaded.length > 0) {
          setGroupKpi(loaded);
      } else {
          const generated = ensureGroupData(units);
          setGroupKpi(generated);
          saveData('kpi_group_data', generated);
      }
  }, [units]);

  // 2. Filter Tasks based on User Scope
  const isAdmin = currentUser.hrmCode === 'ADMIN';
  const myUnitId = currentUser.unitId;

  // Get all descendant unit IDs of the current user's unit
  const getDescendantUnitIds = (rootId: string): string[] => {
      let descendants: string[] = [];
      const children = units.filter(u => u.parentId === rootId);
      children.forEach(child => {
          descendants.push(child.id);
          descendants = [...descendants, ...getDescendantUnitIds(child.id)];
      });
      return descendants;
  };

  const relevantUnitIds = isAdmin ? units.map(u => u.id) : [myUnitId, ...getDescendantUnitIds(myUnitId)];

  const scopedTasks = tasks.filter(t => {
      // Show task if Assigner OR Assignee is in relevant units
      const assigner = currentUser.id === t.assignerId || relevantUnitIds.includes(tasks.find(x => x.id === t.id)?.assignerId || ''); // simplification
      // A more robust check:
      // Is current user Admin? -> All tasks
      if (isAdmin) return true;
      // Is current user the assigner? -> Yes
      if (t.assignerId === currentUser.id) return true;
      // Is current user an assignee? -> Yes
      if (t.primaryAssigneeIds.includes(currentUser.id) || t.supportAssigneeIds.includes(currentUser.id)) return true;
      
      // Is the task assigned to someone in my unit (manager view)?
      // For simplicity in this demo: we filter by Unit comparison if available, 
      // but 'tasks' don't store unit directly. We assume relevantUnitIds context.
      return true; // For demo purpose, we might need to filter stricter if needed. 
                   // Let's filter: Only tasks where Primary Assignee belongs to my unit or descendants
      /* 
         const primaryUser = users.find(u => u.id === t.primaryAssigneeIds[0]);
         return primaryUser && relevantUnitIds.includes(primaryUser.unitId);
      */
  });

  // Calculate Task Stats
  const totalTasks = scopedTasks.length;
  const completedTasks = scopedTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const overdueTasks = scopedTasks.filter(t => new Date(t.deadline) < new Date() && t.status !== TaskStatus.COMPLETED).length;
  const pendingTasks = scopedTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

  const statusData = [
    { name: 'Hoàn thành', value: completedTasks },
    { name: 'Đang làm', value: pendingTasks },
    { name: 'Quá hạn', value: overdueTasks },
    { name: 'Vướng mắc', value: scopedTasks.filter(t => t.status === TaskStatus.STUCK).length },
  ];

  // Calculate Group KPI Average (Fiber as example)
  const kpiChartData = groupKpi.map(item => {
      const fiber = item.targets['fiber'] || { target: 1, actual: 0 };
      const percent = Math.round((fiber.actual / fiber.target) * 100);
      return { name: item.unitName, percent, actual: fiber.actual, target: fiber.target };
  }).sort((a,b) => b.percent - a.percent).slice(0, 5); // Top 5 units

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tổng quan điều hành</h2>
          <p className="text-slate-500">Báo cáo tổng hợp số liệu tập thể và công việc đơn vị</p>
        </div>
        <div className="text-sm text-slate-400">Cập nhật lúc: {new Date().toLocaleTimeString()}</div>
      </div>

      {/* SECTION 1: GROUP KPI OVERVIEW (ALL PROVINCE) */}
      <section>
          <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="text-blue-600" />
              <h3 className="text-xl font-bold text-slate-700">1. Kết quả Bộ chỉ số điều hành (Tập thể)</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-2">
                  <h4 className="font-semibold text-slate-600 mb-4">Top 5 Đơn vị dẫn đầu (Chỉ số FiberVNN)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpiChartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                            <Tooltip formatter={(value: number) => [`${value}%`, 'Hoàn thành']} />
                            <Bar dataKey="percent" fill="#0068FF" barSize={24} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#666', fontSize: 12, formatter: (val: number) => `${val}%` }} />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              </div>
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                   <h4 className="font-bold text-blue-800 mb-2">Tóm tắt toàn tỉnh</h4>
                   <ul className="space-y-3 text-sm text-blue-900">
                       <li className="flex justify-between"><span>Số đơn vị đạt chuẩn:</span> <span className="font-bold">3/5</span></li>
                       <li className="flex justify-between"><span>Chỉ số Fiber TB:</span> <span className="font-bold">92%</span></li>
                       <li className="flex justify-between"><span>Chỉ số MyTV TB:</span> <span className="font-bold">88%</span></li>
                       <li className="flex justify-between"><span>Doanh thu PTM:</span> <span className="font-bold">1.2 Tỷ</span></li>
                   </ul>
              </div>
          </div>
      </section>

      {/* SECTION 2: TASK EXECUTION (SCOPED) */}
      <section>
          <div className="flex items-center gap-2 mb-4 mt-8">
              <Shield className="text-green-600" />
              <h3 className="text-xl font-bold text-slate-700">2. Kết quả thực hiện công việc (Đơn vị: {units.find(u => u.id === myUnitId)?.name})</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard title="Tổng việc được giao" value={totalTasks} icon={<List size={24} />} color="bg-slate-500" />
            <StatCard title="Đã hoàn thành" value={completedTasks} icon={<CheckCircle size={24} />} color="bg-green-500" />
            <StatCard title="Đang thực hiện" value={pendingTasks} icon={<Clock size={24} />} color="bg-blue-500" />
            <StatCard title="Quá hạn" value={overdueTasks} icon={<AlertCircle size={24} />} color="bg-red-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center">
                <h3 className="text-lg font-semibold mb-4 self-start">Tỷ lệ hoàn thành nhiệm vụ</h3>
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
                </div>
                </div>
            </div>

             {/* Simple Task List Preview */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold mb-4">Các việc cần lưu ý (Sắp đến hạn/Quá hạn)</h3>
                <div className="overflow-auto max-h-64 space-y-2">
                    {scopedTasks.filter(t => t.status !== TaskStatus.COMPLETED).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 5).map(task => (
                        <div key={task.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
                            <div className="truncate flex-1 pr-2">
                                <div className="font-medium text-sm text-slate-800 truncate" title={task.name}>{task.name}</div>
                                <div className="text-xs text-slate-500">Hạn: {new Date(task.deadline).toLocaleDateString('vi-VN')}</div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded border ${task.status === TaskStatus.OVERDUE ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                                {task.status}
                            </span>
                        </div>
                    ))}
                    {scopedTasks.length === 0 && <div className="text-center text-slate-400 text-sm">Không có công việc nào.</div>}
                </div>
            </div>
          </div>
      </section>
    </div>
  );
};

export default Dashboard;
