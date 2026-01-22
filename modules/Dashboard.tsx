
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Task, TaskStatus, Unit, User, KPI_KEYS, Role, KPIKey, PersonalTask } from '../types';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Activity, Zap, Briefcase, Calendar as CalendarIcon, Smartphone, StickyNote, ArrowRight } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';

interface DashboardProps {
  tasks: Task[];
  units: Unit[];
  users: User[];
  currentUser: User;
  groupKpi: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, units, users, currentUser, groupKpi }) => {
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].includes(currentUser.title as Role);
  const myAccessibleUnits = currentUser.accessibleUnitIds || [currentUser.unitId];

  useEffect(() => {
    const fetchPersonal = async () => {
      const all = await dbClient.getAll('personal_tasks');
      setPersonalTasks((all as PersonalTask[]).filter(t => t.userId === currentUser.id));
    };
    fetchPersonal();
  }, [currentUser.id]);

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

  const personalMonthStats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonth = personalTasks.filter(t => t.deadline.startsWith(currentMonth));
    return {
      total: thisMonth.length,
      completed: thisMonth.filter(t => t.status === 'Đã hoàn thành').length,
      inProgress: thisMonth.filter(t => t.status === 'Đang xử lý').length,
      pending: thisMonth.filter(t => t.status === 'Chưa xử lý').length,
    };
  }, [personalTasks]);

  return (
    <div className="space-y-12 animate-fade-in pb-10">
      <div className="flex justify-between items-end border-b-4 border-slate-100 pb-8">
        <div>
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 flex items-center gap-2"><Zap size={14}/> Hệ thống điều hành VNPT QN</div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Chào {currentUser.fullName}!</h2>
        </div>
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-2xl">
            <CalendarIcon size={14}/> {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-12">
            <section className="space-y-8">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
                <TrendingUp className="text-blue-600" size={24}/> Điểm tin sản lượng & doanh thu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl md:col-span-2 flex flex-col justify-center">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border-2 border-slate-50 text-center group">
                  <div className="text-3xl font-black text-slate-800">{taskStats.total}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Tổng việc</div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border-2 border-slate-50 text-center group">
                  <div className="text-3xl font-black text-green-600">{taskStats.completed}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Hoàn thành</div>
                </div>
                <div className="bg-red-50 p-6 rounded-[32px] border-2 border-red-100 text-center group">
                  <div className="text-3xl font-black text-red-600">{taskStats.overdue}</div>
                  <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-2">Quá hạn</div>
                </div>
              </div>
            </section>
        </div>

        <div className="space-y-8">
           <section className="space-y-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
                <StickyNote className="text-amber-500" size={24}/> Việc cá nhân trong tháng
              </h3>
              <div className="bg-white rounded-[40px] border shadow-sm p-8 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <div className="flex items-center gap-6">
                   <div className="text-5xl font-black text-amber-500">{personalMonthStats.total}</div>
                   <div>
                      <div className="text-xs font-black text-slate-800 uppercase">Tổng đầu việc</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ghi chú cá nhân tháng {new Date().getMonth()+1}</div>
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t pt-8">
                   <div className="text-center">
                      <div className="text-xl font-black text-green-600">{personalMonthStats.completed}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Xong</div>
                   </div>
                   <div className="text-center border-x">
                      <div className="text-xl font-black text-blue-500">{personalMonthStats.inProgress}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Đang xử lý</div>
                   </div>
                   <div className="text-center">
                      <div className="text-xl font-black text-slate-400">{personalMonthStats.pending}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Chưa làm</div>
                   </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                    <div className="text-[10px] font-black text-amber-700 uppercase mb-3 flex items-center justify-between">
                       <span>Danh sách việc cần lưu ý</span>
                       <ArrowRight size={14}/>
                    </div>
                    <div className="space-y-3">
                       {personalTasks.filter(t => t.status !== 'Đã hoàn thành').slice(0, 3).map(pt => (
                         <div key={pt.id} className="flex items-start gap-2 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></div>
                            <span className="text-[11px] font-bold text-slate-600 line-clamp-1 group-hover:text-amber-600 cursor-default">{pt.name}</span>
                         </div>
                       ))}
                       {personalMonthStats.total === 0 && <div className="text-[10px] text-slate-400 italic">Tháng này chưa có việc.</div>}
                    </div>
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
