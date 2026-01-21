
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Task, TaskStatus, Unit, User, KPI_KEYS, Role, KPIKey } from '../types';
import { AlertCircle, CheckCircle, Clock, List, BarChart2, TrendingUp, DollarSign, Activity, Users, Zap, Briefcase, Calendar as CalendarIcon } from 'lucide-react';

interface DashboardProps {
  tasks: Task[];
  units: Unit[];
  users: User[];
  currentUser: User;
  groupKpi: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, units, users, currentUser, groupKpi }) => {
  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].includes(currentUser.title as Role);

  // 1. Điểm tin KPI Toàn tỉnh
  const provinceKpi = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const records = groupKpi.filter(r => r.period === currentMonth && r.type === 'group');
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
  }, [groupKpi]);

  // 2. Thống kê công việc cá nhân hóa
  const myTasks = useMemo(() => {
    if (isLeader || currentUser.username === 'admin') {
      // Lãnh đạo thấy việc của đơn vị mình
      return tasks.filter(t => {
        const assigner = users.find(u => u.id === t.assignerId);
        return assigner?.unitId === currentUser.unitId || currentUser.username === 'admin';
      });
    }
    // Nhân viên thấy việc được giao
    return tasks.filter(t => t.primaryAssigneeIds.includes(currentUser.id) || t.supportAssigneeIds.includes(currentUser.id));
  }, [tasks, isLeader, currentUser, users]);

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
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-2 flex items-center gap-2"><Zap size={14}/> Hệ thống điều hành tập trung</div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">BẢNG ĐIỀU HÀNH VNPT QUẢNG NINH</h2>
        </div>
        <div className="text-right hidden sm:block">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-2xl">
            <CalendarIcon size={14}/> {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* SECTION 1: ĐIỂM TIN KPI TOÀN TỈNH */}
      <section className="space-y-8">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
          <TrendingUp className="text-blue-600" size={24}/> ĐIỂM TIN SẢN LƯỢNG & DOANH THU TOÀN TỈNH
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-125" />
            <DollarSign className="text-blue-600 mb-6" size={40}/>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu VT-CNTT</div>
            <div className="text-3xl font-black text-slate-800 mt-2">{(provinceKpi.revenue?.actual || 0).toLocaleString()} <span className="text-xs text-slate-400">VNĐ</span></div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">Hoàn thành:</span>
              <span className="text-lg font-black text-blue-600">{provinceKpi.revenue?.percent}%</span>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-125" />
            <Activity className="text-green-600 mb-6" size={40}/>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FiberVNN PTM</div>
            <div className="text-3xl font-black text-slate-800 mt-2">{(provinceKpi.fiber?.actual || 0).toLocaleString()} <span className="text-xs text-slate-400">TB</span></div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase">Hoàn thành:</span>
              <span className="text-lg font-black text-green-600">{provinceKpi.fiber?.percent}%</span>
            </div>
          </div>
          <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl lg:col-span-2 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full -mb-32 -mr-32" />
            <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-60">Thống kê chỉ tiêu trọng điểm</h4>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              {['mytv', 'mesh', 'camera', 'mobile_ptm'].map(k => (
                <div key={k} className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <span className="text-[10px] text-white/80 font-black uppercase truncate pr-4">{KPI_KEYS[k as KPIKey]}</span>
                  <span className="text-base font-black text-blue-400">{provinceKpi[k]?.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: KẾT QUẢ CÔNG VIỆC */}
      <section className="space-y-8">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
          <Briefcase className="text-orange-500" size={24}/> TÌNH HÌNH CÔNG VIỆC {isLeader ? 'ĐƠN VỊ' : 'CÁ NHÂN'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group hover:border-blue-500 transition-all">
            <div className="text-4xl font-black text-slate-800 group-hover:scale-110 transition-transform">{taskStats.total}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Đầu việc</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group hover:border-green-500 transition-all">
            <div className="text-4xl font-black text-green-600 group-hover:scale-110 transition-transform">{taskStats.completed}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Hoàn thành</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-slate-50 text-center group hover:border-blue-400 transition-all">
            <div className="text-4xl font-black text-blue-500 group-hover:scale-110 transition-transform">{taskStats.inProgress}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Đang xử lý</div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border-2 border-orange-100 text-center group hover:bg-orange-50 transition-all">
            <div className="text-4xl font-black text-orange-500 group-hover:scale-110 transition-transform">{taskStats.nearDeadline}</div>
            <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-2">Sắp quá hạn</div>
          </div>
          <div className="bg-red-50 p-8 rounded-[32px] border-2 border-red-100 text-center group hover:bg-red-600 transition-all">
            <div className="text-4xl font-black text-red-600 group-hover:text-white transition-colors">{taskStats.overdue}</div>
            <div className="text-[9px] font-black text-red-400 group-hover:text-white/80 uppercase tracking-widest mt-2 transition-colors">Quá hạn</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 lg:col-span-2">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-8">Danh sách việc cần ưu tiên</h4>
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4">
              {myTasks.filter(t => t.status !== TaskStatus.COMPLETED).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).map(t => (
                <div key={t.id} className="flex items-center gap-6 group">
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-black text-slate-700 truncate max-w-[400px]">{t.name}</span>
                      <span className="text-[10px] font-black text-slate-400">{t.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${new Date(t.deadline) < new Date() ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${t.progress}%` }} />
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 ${new Date(t.deadline) < new Date() ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                    {new Date(t.deadline).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              ))}
              {myTasks.filter(t => t.status !== TaskStatus.COMPLETED).length === 0 && (
                <div className="text-center py-20 text-slate-300 font-black uppercase text-xl italic opacity-50">Tuyệt vời! Không còn việc tồn đọng.</div>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mb-10 text-center">Tỷ lệ hoàn thành mục tiêu</h4>
            <div className="relative w-56 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={[
                      { name: 'Xong', value: taskStats.completed }, 
                      { name: 'Tồn', value: taskStats.total - taskStats.completed }
                    ]} 
                    innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value" stroke="none"
                  >
                    <Cell fill="#22C55E" />
                    <Cell fill="#F1F5F9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-5xl font-black text-slate-800">{taskStats.total > 0 ? Math.round((taskStats.completed/taskStats.total)*100) : 0}%</div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Efficiency</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
