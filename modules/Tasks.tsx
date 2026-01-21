
import React, { useState, useMemo, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, Role } from '../types';
import { Plus, Search, X, Edit2, Trash2, Save, Loader2, MessageSquare, Timer, Filter, ArrowUpDown, CheckCircle2, AlertTriangle, Clock, ChevronRight, History } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient';

interface TasksProps {
  tasks: Task[];
  users: User[];
  units: Unit[];
  currentUser: User;
  onRefresh: () => void;
}

const Tasks: React.FC<TasksProps> = ({ tasks, users, units, currentUser, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({});

  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].includes(currentUser.title as Role);

  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (searchTerm) list = list.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus);
    if (filterMonth) list = list.filter(t => t.dateAssigned.startsWith(filterMonth));
    
    // Phân quyền: Lãnh đạo thấy hết, Nhân viên thấy việc mình tham gia
    if (!isLeader && currentUser.username !== 'admin') {
      list = list.filter(t => t.primaryAssigneeIds.includes(currentUser.id) || t.supportAssigneeIds.includes(currentUser.id));
    }
    return list;
  }, [tasks, searchTerm, filterStatus, filterMonth, isLeader, currentUser]);

  const statusStyle: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: 'bg-slate-100 text-slate-500',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-600',
    [TaskStatus.COMPLETED]: 'bg-green-100 text-green-600',
    [TaskStatus.NOT_PERFORMED]: 'bg-red-100 text-red-500',
    [TaskStatus.OVERDUE]: 'bg-red-600 text-white',
    [TaskStatus.STUCK]: 'bg-orange-100 text-orange-600'
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.deadline) return alert("Vui lòng nhập tên và thời hạn.");
    setIsProcessing(true);
    const id = `task_${Date.now()}`;
    const payload = {
      ...formData,
      id,
      assignerId: currentUser.id,
      assignerName: currentUser.fullName,
      dateAssigned: new Date().toISOString().split('T')[0],
      status: TaskStatus.PENDING,
      progress: 0,
      primaryAssigneeIds: formData.primaryAssigneeIds || [],
      supportAssigneeIds: formData.supportAssigneeIds || [],
      priority: formData.priority || TaskPriority.MEDIUM,
      timeline: []
    };
    await dbClient.upsert('tasks', id, payload);
    setShowForm(false);
    onRefresh();
    setIsProcessing(false);
  };

  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    await dbClient.update('tasks', task.id, { status: newStatus });
    onRefresh();
  };

  const handleAddTimeline = async (task: Task) => {
    const progress = prompt("Tiến độ hiện tại (%)?", String(task.progress));
    const comment = prompt("Nội dung cập nhật?");
    if (progress !== null && comment) {
      const newTimeline = [...(task.timeline || []), { date: new Date().toISOString(), comment, progress: Number(progress) }];
      await dbClient.update('tasks', task.id, { timeline: newTimeline, progress: Number(progress) });
      onRefresh();
      alert("Đã cập nhật tiến độ!");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <Timer className="text-blue-600" size={36}/> QUẢN LÝ CÔNG VIỆC
          </h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Monday.com style Workflow</p>
        </div>
        {isLeader && (
          <button onClick={() => { setFormData({}); setShowForm(true); }} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus size={20}/> Giao việc mới
          </button>
        )}
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex flex-wrap gap-5 items-center">
          <div className="relative flex-1 min-w-[350px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
            <input placeholder="Tìm tên công việc, nội dung..." className="w-full pl-12 pr-6 py-3.5 bg-white border-2 rounded-[20px] text-sm font-bold focus:border-blue-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-4">
            <input type="month" className="border-2 rounded-2xl px-4 py-3 text-sm font-bold bg-white" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
            <select className="border-2 rounded-2xl px-4 py-3 text-sm font-bold bg-white outline-none" value={filterStatus} onChange={setFilterStatus && (e => setFilterStatus(e.target.value))}>
              <option value="all">Tất cả trạng thái</option>
              {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest border-b">
              <tr>
                <th className="p-5 w-12 text-center">#</th>
                <th className="p-5 min-w-[300px]">Tên công việc & Chỉ đạo</th>
                <th className="p-5">Người giao</th>
                <th className="p-5">Chủ trì</th>
                <th className="p-5">Trạng thái</th>
                <th className="p-5">Tiến độ</th>
                <th className="p-5">Thời hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTasks.map((task, idx) => (
                <tr key={task.id} className="group hover:bg-blue-50/40 transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500" onClick={() => setSelectedTask(task)}>
                  <td className="p-5 text-center text-slate-300 font-black">{idx + 1}</td>
                  <td className="p-5">
                    <div className="font-black text-slate-800 text-base group-hover:text-blue-600 transition-colors">{task.name}</div>
                    <div className="text-xs text-slate-400 line-clamp-1 mt-1 font-medium">{task.content}</div>
                  </td>
                  <td className="p-5">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{task.dateAssigned}</div>
                    <div className="text-xs font-bold text-slate-700">{task.assignerName}</div>
                  </td>
                  <td className="p-5">
                    <div className="flex -space-x-3">
                      {task.primaryAssigneeIds.slice(0, 3).map(uid => (
                        <div key={uid} className="w-9 h-9 rounded-xl bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-blue-600" title={users.find(u => u.id === uid)?.fullName}>
                          {users.find(u => u.id === uid)?.fullName.charAt(0)}
                        </div>
                      ))}
                      {task.primaryAssigneeIds.length > 3 && (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-500">
                          +{task.primaryAssigneeIds.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyle[task.status]}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="w-32">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{task.progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className={`flex items-center gap-2 text-xs font-black ${new Date(task.deadline) < new Date() && task.status !== TaskStatus.COMPLETED ? 'text-red-600' : 'text-slate-600'}`}>
                      <Clock size={14}/> {task.deadline}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="text-slate-300 font-black text-xl uppercase italic">Không tìm thấy dữ liệu</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GIAO VIỆC */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-3xl shadow-2xl overflow-hidden border animate-zoom-in">
            <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">GIAO VIỆC MỚI</h3>
              <button onClick={() => setShowForm(false)} className="p-3 hover:bg-red-50 text-slate-400 rounded-full transition-all"><X size={28}/></button>
            </div>
            <div className="p-12 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên công việc</label>
                <input className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-black text-slate-800 outline-none focus:border-blue-500 transition-all" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung chỉ đạo</label>
                <textarea className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-bold text-slate-600 outline-none focus:border-blue-500 transition-all h-32" value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chủ trì thực hiện (Đa chọn)</label>
                  {/* Fix: Cast 'o' to any in Array.from to allow accessing 'value' property (lines 212, 218) */}
                  <select multiple className="w-full border-2 p-4 rounded-[24px] bg-slate-50 font-bold text-slate-700 outline-none h-40 text-sm" value={formData.primaryAssigneeIds || []} onChange={e => setFormData({...formData, primaryAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.filter(u => u.unitId === currentUser.unitId || isLeader).map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.title})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phối hợp (Đa chọn)</label>
                  <select multiple className="w-full border-2 p-4 rounded-[24px] bg-slate-50 font-bold text-slate-700 outline-none h-40 text-sm" value={formData.supportAssigneeIds || []} onChange={e => setFormData({...formData, supportAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.filter(u => u.unitId === currentUser.unitId || isLeader).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời hạn hoàn thành</label>
                  <input type="date" className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-black outline-none" value={formData.deadline || ''} onChange={e => setFormData({...formData, deadline: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Độ ưu tiên</label>
                  <select className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-black outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}>
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-10 border-t bg-slate-50/50 flex justify-end gap-5">
              <button onClick={() => setShowForm(false)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase hover:text-slate-600">Hủy bỏ</button>
              <button onClick={handleCreate} disabled={isProcessing} className="bg-blue-600 text-white px-16 py-5 rounded-[28px] font-black text-xs uppercase shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-3">
                {isProcessing ? <Loader2 className="animate-spin" /> : 'XÁC NHẬN GIAO VIỆC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHI TIẾT TƯƠNG TÁC (Tương tự Monday Side-panel) */}
      {selectedTask && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl animate-slide-in flex flex-col">
            <div className="p-10 border-b flex justify-between items-center bg-blue-600 text-white">
              <div>
                <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1">Thao tác công việc</div>
                <h3 className="text-2xl font-black">{selectedTask.name}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-3 hover:bg-white/20 rounded-full transition-all"><X size={28}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-12 space-y-10">
              <div className="bg-slate-50 p-8 rounded-[32px] border">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nội dung chỉ đạo:</h4>
                <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-line">{selectedTask.content}</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</h4>
                  <select 
                    className={`w-full p-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 ${statusStyle[selectedTask.status]}`}
                    value={selectedTask.status}
                    onChange={(e) => handleUpdateStatus(selectedTask, e.target.value as TaskStatus)}
                  >
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ ({selectedTask.progress}%)</h4>
                  <button onClick={() => handleAddTimeline(selectedTask)} className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl border-2 border-blue-100 font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2">
                    <History size={16}/> Cập nhật Timeline
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16}/> Báo cáo vướng mắc</h4>
                <textarea 
                  className="w-full border-2 rounded-[24px] p-6 text-sm font-bold bg-slate-50 outline-none focus:border-orange-500 min-h-[120px] transition-all"
                  placeholder="Mô tả các khó khăn đang gặp phải..."
                  defaultValue={selectedTask.difficulties}
                  onBlur={async (e) => {
                    await dbClient.update('tasks', selectedTask.id, { difficulties: e.target.value });
                    onRefresh();
                  }}
                />
              </div>

              <div className="bg-red-50 p-8 rounded-[32px] border border-red-100">
                <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4">Xin gia hạn thời gian</h4>
                {selectedTask.extensionRequest?.status === 'pending' ? (
                  <div className="bg-white p-6 rounded-2xl border-2 border-red-200">
                    <div className="text-xs font-black text-slate-700">Lý do: <span className="font-bold italic text-slate-500">"{selectedTask.extensionRequest.reason}"</span></div>
                    <div className="text-xs font-black text-slate-700 mt-1">Đề xuất đến: <span className="text-red-600">{selectedTask.extensionRequest.requestedDate}</span></div>
                    {isLeader && (
                      <div className="mt-4 flex gap-2">
                        <button onClick={async () => { await dbClient.update('tasks', selectedTask.id, { deadline: selectedTask.extensionRequest!.requestedDate, extensionRequest: { ...selectedTask.extensionRequest!, status: 'approved' } }); onRefresh(); alert("Đã phê duyệt gia hạn!"); }} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[10px] font-black">CHẤP THUẬN</button>
                        <button onClick={async () => { await dbClient.update('tasks', selectedTask.id, { extensionRequest: { ...selectedTask.extensionRequest!, status: 'rejected' } }); onRefresh(); }} className="bg-red-600 text-white px-5 py-2 rounded-xl text-[10px] font-black">TỪ CHỐI</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => {
                    const reason = prompt("Lý do xin gia hạn:");
                    const date = prompt("Ngày mong muốn (YYYY-MM-DD):");
                    if(reason && date) {
                      dbClient.update('tasks', selectedTask.id, { extensionRequest: { requestedDate: date, reason, status: 'pending', requestDate: new Date().toISOString() } });
                      onRefresh();
                      alert("Đã gửi yêu cầu gia hạn!");
                    }
                  }} className="w-full py-4 bg-white text-red-600 border-2 border-red-200 border-dashed rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all">Gửi yêu cầu xin gia hạn</button>
                )}
              </div>
            </div>

            <div className="p-10 border-t bg-slate-50 flex justify-between gap-5">
              {isLeader && (
                <button onClick={async () => { if(confirm("Xóa vĩnh viễn công việc này?")) { await dbClient.delete('tasks', selectedTask.id); setSelectedTask(null); onRefresh(); }}} className="text-red-600 font-black text-xs uppercase flex items-center gap-2 hover:bg-red-50 px-6 py-3 rounded-xl transition-all"><Trash2 size={20}/> Xóa việc</button>
              )}
              <button onClick={() => setSelectedTask(null)} className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all">Đóng cửa sổ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
