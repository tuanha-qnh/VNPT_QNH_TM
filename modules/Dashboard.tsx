
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Task, TaskStatus, Unit, User, KPI_KEYS } from '../types';
import { AlertCircle, CheckCircle, Clock, List, BarChart2, Shield } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  units: Unit[];
  currentUser: User;
  groupKpi: any[]; // Dữ liệu thật từ database
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

const Dashboard: React.FC<DashboardProps> = ({ tasks, units, currentUser, groupKpi }) => {
  // 1. Lọc Công việc theo phạm vi người dùng
  const isAdmin = currentUser.username === 'admin';
  const myUnitId = currentUser.unitId;

  const getDescendantUnitIds = (rootId: string): string[] => {
      let descendants: string[] = [];
      const children = units.filter(u => u.parentId === rootId);
      children.forEach(child => {
          descendants.push(child.id);
          descendants = [...descendants, ...getDescendantUnitIds(child.id)];
      });
      return descendants;
  };

  const relevantUnitIds = useMemo(() => 
    isAdmin ? units.map(u => u.id) : [myUnitId, ...getDescendantUnitIds(myUnitId)],
    [isAdmin, units, myUnitId]
  );

  const scopedTasks = useMemo(() => {
    if (isAdmin) return tasks;
    return tasks.filter(t => 
        t.assignerId === currentUser.id || 
        t.primaryAssigneeIds.includes(currentUser.id) || 
        t.supportAssigneeIds.includes(currentUser.id)
    );
  }, [tasks, isAdmin, currentUser.id]);

  // Tính toán Thống kê công việc
  const totalTasks = scopedTasks.length;
  const completedTasks = scopedTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const overdueTasks = scopedTasks.filter(t => t.status === TaskStatus.OVERDUE).length;
  const pendingTasks = scopedTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : "0.0";

  const statusData = [
    { name: 'Hoàn thành', value: completedTasks },
    { name: 'Đang làm', value: pendingTasks },
    { name: 'Quá hạn', value: overdueTasks },
    { name: 'Vướng mắc', value: scopedTasks.filter(t => t.status === TaskStatus.STUCK).length },
  ].filter(d => d.value > 0);

  // Xử lý dữ liệu KPI thực tế (Lấy loại group cho biểu đồ tập thể)
  const groupKpiRecords = useMemo(() => 
    groupKpi.filter(k => k.type === 'group'),
    [groupKpi]
  );

  const kpiChartData = useMemo(() => {
      return groupKpiRecords.map(item => {
          const unit = units.find(u => u.code === item.entity_id);
          const fiber = item.targets?.fiber || { target: 0, actual: 0 };
          const percent = fiber.target > 0 ? Math.round((fiber.actual / fiber.target) * 100) : 0;
          return { 
            name: unit?.name || item.entity_id, 
            percent, 
            actual: fiber.actual, 
            target: fiber.target 
          };
      })
      .filter(item => item.target > 0) // Chỉ hiện đơn vị có dữ liệu chỉ tiêu
      .sort((a,b) => b.percent - a.percent)
      .slice(0, 5);
  }, [groupKpiRecords, units]);

  // Tính toán tóm tắt toàn tỉnh dựa trên dữ liệu thật
  const provinceSummary = useMemo(() => {
    if (groupKpiRecords.length === 0) return null;
    
    let totalFiberPct = 0;
    let totalMytvPct = 0;
    let unitsWithData = 0;
    let unitsReachedStandard = 0;

    groupKpiRecords.forEach(record => {
        const fiber = record.targets?.fiber || { target: 0, actual: 0 };
        const mytv = record.targets?.mytv || { target: 0, actual: 0 };
        
        if (fiber.target > 0 || mytv.target > 0) {
            unitsWithData++;
            const fPct = fiber.target > 0 ? (fiber.actual / fiber.target) : 0;
            const mPct = mytv.target > 0 ? (mytv.actual / mytv.target) : 0;
            totalFiberPct += fPct;
            totalMytvPct += mPct;
            if (fPct >= 1) unitsReachedStandard++;
        }
    });

    if (unitsWithData === 0) return null;

    return {
        reached: unitsReachedStandard,
        total: unitsWithData,
        avgFiber: (totalFiberPct / unitsWithData * 100).toFixed(1),
        avgMytv: (totalMytvPct / unitsWithData * 100).toFixed(1)
    };
  }, [groupKpiRecords]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tổng quan điều hành</h2>
          <p className="text-slate-500">Báo cáo tổng hợp số liệu tập thể và công việc đơn vị</p>
        </div>
        <div className="text-sm text-slate-400">Cập nhật lúc: {new Date().toLocaleTimeString()}</div>
      </div>

      {/* SECTION 1: GROUP KPI OVERVIEW */}
      <section>
          <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="text-blue-600" />
              <h3 className="text-xl font-bold text-slate-700">1. Kết quả Bộ chỉ số điều hành (Tập thể)</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-2">
                  <h4 className="font-semibold text-slate-600 mb-4">Top 5 Đơn vị dẫn đầu (Chỉ số FiberVNN)</h4>
                  <div className="h-64">
                    {kpiChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={kpiChartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <XAxis type="number" hide domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                                <Tooltip formatter={(value: number) => [`${value}%`, 'Hoàn thành']} />
                                <Bar dataKey="percent" fill="#0068FF" barSize={24} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#666', fontSize: 12, formatter: (val: number) => `${val}%` }} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <BarChart2 size={48} className="mb-2 opacity-20" />
                            <p className="italic text-sm">Chưa có dữ liệu KPI tập thể trên Cloud.</p>
                        </div>
                    )}
                  </div>
              </div>
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                   <h4 className="font-bold text-blue-800 mb-2">Tóm tắt dữ liệu thật</h4>
                   {provinceSummary ? (
                       <ul className="space-y-3 text-sm text-blue-900">
                           <li className="flex justify-between"><span>Số đơn vị đạt chuẩn:</span> <span className="font-bold">{provinceSummary.reached}/{provinceSummary.total}</span></li>
                           <li className="flex justify-between"><span>Chỉ số Fiber TB:</span> <span className="font-bold">{provinceSummary.avgFiber}%</span></li>
                           <li className="flex justify-between"><span>Chỉ số MyTV TB:</span> <span className="font-bold">{provinceSummary.avgMytv}%</span></li>
                           <li className="flex justify-between"><span>Trạng thái:</span> <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-widest">LIVE DATA</span></li>
                       </ul>
                   ) : (
                       <div className="text-center py-10">
                           <p className="text-blue-400 text-xs italic">Vui lòng nạp dữ liệu tại module KPI Mode Tập thể để xem báo cáo.</p>
                       </div>
                   )}
              </div>
          </div>
      </section>

      {/* SECTION 2: TASK EXECUTION */}
      <section>
          <div className="flex items-center gap-2 mb-4 mt-8">
              <Shield className="text-green-600" />
              <h3 className="text-xl font-bold text-slate-700">2. Kết quả thực hiện công việc (Đơn vị: {units.find(u => u.id === myUnitId)?.name || 'Quản trị'})</h3>
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
                {statusData.length > 0 ? (
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
                ) : (
                    <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-100"></div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-800">{completionRate}%</span>
                </div>
                </div>
            </div>

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
                    {scopedTasks.filter(t => t.status !== TaskStatus.COMPLETED).length === 0 && (
                        <div className="text-center py-10 flex flex-col items-center text-slate-400">
                            <CheckCircle size={32} className="mb-2 opacity-20" />
                            <p className="text-sm italic">Tuyệt vời! Không có công việc nào tồn đọng.</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
      </section>
    </div>
  );
};

export default Dashboard;
