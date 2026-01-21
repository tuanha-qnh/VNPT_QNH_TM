
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Task, TaskStatus, Unit, User, KPI_KEYS, Role, KPIKey } from '../types';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Activity, Zap, Briefcase, Calendar as CalendarIcon, Smartphone } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  units: Unit[];
  users: User[];
  currentUser: User;
  groupKpi: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, units, users, currentUser, groupKpi }) => {
  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].includes(currentUser.title as Role);
  const myAccessibleUnits = currentUser.accessibleUnitIds || [currentUser.unitId];

  // 1. Điểm tin KPI - Lọc theo đơn vị được phép
  const provinceKpi = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const records = groupKpi.filter(r => r.period === currentMonth && r.type === 'group' && (currentUser.username === 'admin' || myAccessibleUnits.includes(units.find(u => u.code === r.entityId)?.id || '')));
    const summary: any = {};
    Object.keys(KPI_KEYS).forEach(k => {
      let t = 0, a = 0;
      records.forEach(r => {
        t += r.targets?.[k]?.target || 0;
        a += r.targets?.[k]?.actual || 0;
      });
      summary[k] = { target: t, actual: a, percent: t > 0 ? Math.round((a/t)*100) : 0 };
    });
    return summary;
  }, [groupKpi, units, currentUser, myAccessibleUnits]);

  // 2. Thống kê công việc - Lọc theo quyền xem
  const myTasks = useMemo(() => {
    if (currentUser.username === 'admin') return tasks;
    return tasks.filter(t => 
      t.assignerId === currentUser.id ||
      t.primaryAssigneeIds.includes(currentUser.id) || 
      t.supportAssigneeIds.includes(currentUser.id) ||
      myAccessibleUnits.includes(users.find(u => u.id === t.assignerId)?.unitId || '')
    );
  }, [tasks, currentUser, myAccessibleUnits, users]);

  const taskStats = {
    total: myTasks.length,
    completed: myTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    inProgress: myTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    overdue: myTasks.filter(t => t.status === TaskStatus.OVERDUE || (new Date(t.deadline) < new Date() && t.status !== TaskStatus.COMPLETED)).length,
    nearDeadline: myTasks.filter(t => {
      const diff = new Date(t.deadline).getTime() - new Date().getTime();
      return diff > 0 && diff < 86400000 * 3 && t.status !== TaskStatus.COMPLETED;
    }).length
  };

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      <div className="flex justify-between items-end border-b-4 border-slate-100 pb-8">
        <div>
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 flex items-center gap-2"><Zap size={14}/> Hệ thống điều hành VNPT QN</div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Bảng điều hành đơn vị</h2>
        </div>
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-2xl">
            <CalendarIcon size={14}/> {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <section className="space-y-8">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
          <TrendingUp className="text-blue-600" size={24}/> Điểm tin sản lượng & doanh thu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden group">
            <Smartphone className="text-blue-600 mb-6" size={40}/>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Di động PTM</div>
            <div className="text-3xl font-black text-slate-800 mt-2">{(provinceKpi.mobile_rev?.actual || 0).toLocaleString()} <span className="text-xs text-slate-400">VNĐ</span></div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">Hoàn thành:</span>
              <span className="text-lg font-black text-blue-600">{provinceKpi.mobile_rev?.percent}%</span>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden group">
            <Activity className="text-green-600 mb-6" size={40}/>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FiberVNN PTM</div>
            <div className="text-3xl font-black text-slate-800 mt-2">{(provinceKpi.fiber?.actual || 0).toLocaleString()} <span className="text-xs text-slate-400">TB</span></div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">Hoàn thành:</span>
              <span className="text-lg font-black text-green-600">{provinceKpi.fiber?.percent}%</span>
            </div>
          </div>
          <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl lg:col-span-2 flex flex-col justify-center">
            <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-60">Các chỉ tiêu trọng điểm khác</h4>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              {['mytv', 'mesh', 'camera', 'revenue'].map(k => (
                <div key={k} className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <span className="text-[10px] text-white/80 font-black uppercase truncate pr-4">{KPI_KEYS[k as KPIKey]}</span>
                  <span className="text-base font-black text-blue-400">{provinceKpi[k]?.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
          <Briefcase className="text-orange-500" size={24}/> Tình hình công việc xử lý
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group">
            <div className="text-4xl font-black text-slate-800">{taskStats.total}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Tổng số việc</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group">
            <div className="text-4xl font-black text-green-600">{taskStats.completed}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Hoàn thành</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group">
            <div className="text-4xl font-black text-blue-500">{taskStats.inProgress}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Đang thực hiện</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-orange-100 text-center group">
            <div className="text-4xl font-black text-orange-500">{taskStats.nearDeadline}</div>
            <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-2">Sắp quá hạn</div>
          </div>
          <div className="bg-red-50 p-8 rounded-[32px] border-2 border-red-100 text-center group">
            <div className="text-4xl font-black text-red-600">{taskStats.overdue}</div>
            <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-2">Đã quá hạn</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
