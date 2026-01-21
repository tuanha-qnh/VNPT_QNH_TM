
import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, Role } from '../types';
import { Plus, Search, X, Edit2, Trash2, Save, Loader2, MessageSquare, Timer, Filter, CheckCircle2, AlertTriangle, Clock, Hash, Smartphone, MessageCircle } from 'lucide-react';
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
  const [formData, setFormData] = useState<Partial<Task>>({
    assignmentSource: 'Direct',
    priority: TaskPriority.MEDIUM,
    primaryAssigneeIds: [],
    supportAssigneeIds: []
  });

  const isLeader = [Role.DIRECTOR, Role.VICE_DIRECTOR, Role.MANAGER, Role.VICE_MANAGER].includes(currentUser.title as Role);
  const myAccessibleUnits = currentUser.accessibleUnitIds || [currentUser.unitId];

  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (searchTerm) list = list.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus);
    if (filterMonth) list = list.filter(t => t.dateAssigned.startsWith(filterMonth));
    
    // Phân quyền: Thấy việc của mình, việc của các đơn vị được cấp quyền, hoặc việc mình giao
    if (currentUser.username !== 'admin') {
      list = list.filter(t => 
        t.assignerId === currentUser.id ||
        t.primaryAssigneeIds.includes(currentUser.id) || 
        t.supportAssigneeIds.includes(currentUser.id) ||
        myAccessibleUnits.includes(users.find(u => u.id === t.assignerId)?.unitId || '')
      );
    }
    return list;
  }, [tasks, searchTerm, filterStatus, filterMonth, currentUser, myAccessibleUnits, users]);

  const statusStyle: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: 'bg-slate-100 text-slate-500',
    [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-600',
    [TaskStatus.COMPLETED]: 'bg-green-100 text-green-600',
    [TaskStatus.NOT_PERFORMED]: 'bg-red-100 text-red-500',
    [TaskStatus.OVERDUE]: 'bg-red-600 text-white',
    [TaskStatus.STUCK]: 'bg-orange-100 text-orange-600'
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.deadline) return alert("Vui lòng nhập tên và thời hạn.");
    setIsProcessing(true);
    const id = formData.id || `task_${Date.now()}`;
    const payload = {
      ...formData,
      id,
      assignerId: formData.assignerId || currentUser.id,
      assignerName: formData.assignerName || currentUser.fullName,
      dateAssigned: formData.dateAssigned || new Date().toISOString().split('T')[0],
      status: formData.status || TaskStatus.PENDING,
      progress: formData.progress || 0,
      primaryAssigneeIds: formData.primaryAssigneeIds || [],
      supportAssigneeIds: formData.supportAssigneeIds || [],
      priority: formData.priority || TaskPriority.MEDIUM,
      assignmentSource: formData.assignmentSource || 'Direct',
      eOfficeNumber: formData.eOfficeNumber || '',
      coordinationInstructions: formData.coordinationInstructions || ''
    };
    await dbClient.upsert('tasks', id, payload);
    setShowForm(false);
    onRefresh();
    setIsProcessing(false);
    if (selectedTask?.id === id) {
        setSelectedTask(payload as Task);
    }
  };

  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    await dbClient.update('tasks', task.id, { status: newStatus });
    onRefresh();
    setSelectedTask(prev => prev ? {...prev, status: newStatus} : null);
  };

  const handleAddTimeline = async (task: Task) => {
    const progress = prompt("Tiến độ hiện tại (%)?", String(task.progress));
    const comment = prompt("Nội dung báo cáo kết quả thực hiện?");
    if (progress !== null && comment) {
      const newTimeline = [...(task.timeline || []), { date: new Date().toISOString(), comment, progress: Number(progress) }];
      await dbClient.update('tasks', task.id, { 
        timeline: newTimeline, 
        progress: Number(progress),
        executionResults: comment 
      });
      onRefresh();
      setSelectedTask(prev => prev ? {...prev, timeline: newTimeline, progress: Number(progress), executionResults: comment} : null);
      alert("Đã cập nhật báo cáo!");
    }
  };

  const approveExtension = async (task: Task) => {
    if (!task.extensionRequest) return;
    const newDeadline = task.extensionRequest.requestedDate;
    await dbClient.update('tasks', task.id, { 
      deadline: newDeadline, 
      extensionRequest: { ...task.extensionRequest, status: 'approved' } 
    }); 
    onRefresh(); 
    setSelectedTask(prev => prev ? {...prev, deadline: newDeadline, extensionRequest: {...prev.extensionRequest!, status: 'approved'}} : null);
    alert("Đã phê duyệt gia hạn!"); 
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <Timer className="text-blue-600" size={36}/> QUẢN LÝ CÔNG VIỆC
          </h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">VNPT Quảng Ninh - Hệ thống điều hành</p>
        </div>
        {isLeader && (
          <button onClick={() => { setFormData({ assignmentSource: 'Direct', priority: TaskPriority.MEDIUM, primaryAssigneeIds: [], supportAssigneeIds: [] }); setShowForm(true); }} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus size={20}/> Giao việc mới
          </button>
        )}
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex flex-wrap gap-5 items-center">
          <div className="relative flex-1 min-w-[350px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
            <input placeholder="Tìm tên công việc..." className="w-full pl-12 pr-6 py-3.5 bg-white border-2 rounded-[20px] text-sm font-bold focus:border-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-4">
            <input type="month" className="border-2 rounded-2xl px-4 py-3 text-sm font-bold bg-white" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
            <select className="border-2 rounded-2xl px-4 py-3 text-sm font-bold bg-white outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
                <th className="p-5 min-w-[300px]">Tên công việc</th>
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
                    <div className="flex items-center gap-2 mb-1">
                      {task.assignmentSource === 'eOffice' && <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black"><Hash size={10}/> eOffice: {task.eOfficeNumber}</span>}
                      {task.assignmentSource === 'Zalo' && <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] font-black"><MessageCircle size={10}/> Zalo</span>}
                      {task.assignmentSource === 'Direct' && <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black"><Smartphone size={10}/> Trực tiếp</span>}
                      {task.extensionRequest?.status === 'pending' && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[9px] font-black animate-pulse">ĐỢI GIA HẠN</span>}
                    </div>
                    <div className="font-black text-slate-800 text-base">{task.name}</div>
                  </td>
                  <td className="p-5">
                    <div className="text-xs font-bold text-slate-700">{task.assignerName}</div>
                  </td>
                  <td className="p-5">
                    <div className="flex -space-x-2">
                      {task.primaryAssigneeIds.slice(0, 3).map(uid => (
                        <div key={uid} className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-black text-white" title={users.find(u => u.id === uid)?.fullName}>
                          {users.find(u => u.id === uid)?.fullName.charAt(0)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${statusStyle[task.status]}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${task.progress}%` }} />
                    </div>
                  </td>
                  <td className="p-5">
                    <div className={`text-xs font-black ${new Date(task.deadline) < new Date() && task.status !== TaskStatus.COMPLETED ? 'text-red-600' : 'text-slate-600'}`}>
                      {task.deadline}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl overflow-hidden border animate-zoom-in">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{formData.id ? 'CHỈNH SỬA CÔNG VIỆC' : 'GIAO VIỆC MỚI'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình thức giao</label>
                  <select className="w-full border-2 p-3 rounded-xl bg-slate-50 font-bold outline-none" value={formData.assignmentSource} onChange={e => setFormData({...formData, assignmentSource: e.target.value})}>
                    <option value="Direct">Trực tiếp</option>
                    <option value="eOffice">eOffice</option>
                    <option value="Zalo">Zalo</option>
                  </select>
                </div>
                {formData.assignmentSource === 'eOffice' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số eOffice</label>
                    <input className="w-full border-2 p-3 rounded-xl bg-slate-50 font-bold outline-none" placeholder="Văn bản số..." value={formData.eOfficeNumber || ''} onChange={e => setFormData({...formData, eOfficeNumber: e.target.value})} />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Độ ưu tiên</label>
                  <select className="w-full border-2 p-3 rounded-xl bg-slate-50 font-bold outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}>
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên công việc</label>
                <input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-black outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung chỉ đạo (Chủ trì)</label>
                  <textarea className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold h-24 outline-none" value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chỉ đạo phối hợp</label>
                  <textarea className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold h-24 outline-none" value={formData.coordinationInstructions || ''} onChange={e => setFormData({...formData, coordinationInstructions: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân sự chủ trì</label>
                  <select multiple className="w-full border-2 p-3 rounded-xl bg-slate-50 font-bold h-32" value={formData.primaryAssigneeIds || []} onChange={e => setFormData({...formData, primaryAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân sự phối hợp</label>
                  <select multiple className="w-full border-2 p-3 rounded-xl bg-slate-50 font-bold h-32" value={formData.supportAssigneeIds || []} onChange={e => setFormData({...formData, supportAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạn hoàn thành</label>
                <input type="date" className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-black outline-none" value={formData.deadline || ''} onChange={e => setFormData({...formData, deadline: e.target.value})} />
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50/50 flex justify-end gap-4">
              <button onClick={() => setShowForm(false)} className="px-8 py-3 text-slate-400 font-black text-xs uppercase">Hủy</button>
              <button onClick={handleCreateOrUpdate} disabled={isProcessing} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700">
                {isProcessing ? <Loader2 className="animate-spin" /> : 'LƯU CÔNG VIỆC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl animate-slide-in flex flex-col">
            <div className="p-8 border-b flex justify-between items-center bg-blue-600 text-white">
              <div className="flex-1 pr-4">
                <h3 className="text-xl font-black truncate">{selectedTask.name}</h3>
                <div className="text-[9px] font-bold uppercase opacity-60 tracking-widest mt-1">Người giao: {selectedTask.assignerName}</div>
              </div>
              <div className="flex items-center gap-1">
                {selectedTask.assignerId === currentUser.id && (
                  <>
                    <button onClick={() => { setFormData(selectedTask); setShowForm(true); }} className="p-2 hover:bg-white/10 rounded-lg"><Edit2 size={20}/></button>
                    <button onClick={async () => { if(confirm("Xóa công việc này?")) { await dbClient.delete('tasks', selectedTask.id); setSelectedTask(null); onRefresh(); }}} className="p-2 hover:bg-red-500 rounded-lg"><Trash2 size={20}/></button>
                  </>
                )}
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {isLeader && selectedTask.extensionRequest?.status === 'pending' && selectedTask.assignerId === currentUser.id && (
                <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[28px] space-y-4">
                  <h4 className="text-xs font-black text-red-600 uppercase flex items-center gap-2"><AlertTriangle size={16}/> ĐỀ NGHỊ GIA HẠN</h4>
                  <div className="bg-white p-4 rounded-xl border border-red-100 text-xs font-bold space-y-2">
                    <p>Lý do: <span className="italic">"{selectedTask.extensionRequest.reason}"</span></p>
                    <p>Đề xuất hạn mới: <span className="text-red-600 underline font-black">{selectedTask.extensionRequest.requestedDate}</span></p>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => approveExtension(selectedTask)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-black uppercase text-[9px]">Duyệt</button>
                      <button onClick={async () => { await dbClient.update('tasks', selectedTask.id, { extensionRequest: { ...selectedTask.extensionRequest!, status: 'rejected' } }); onRefresh(); setSelectedTask(null); }} className="flex-1 bg-slate-200 text-slate-600 py-2 rounded-lg font-black uppercase text-[9px]">Từ chối</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Chỉ đạo (Chủ trì)</h4>
                  <p className="text-sm font-bold text-slate-700 whitespace-pre-line">{selectedTask.content}</p>
                </div>
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                  <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Chỉ đạo (Phối hợp)</h4>
                  <p className="text-sm font-bold text-blue-700 whitespace-pre-line">{selectedTask.coordinationInstructions || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={14}/> Kết quả thực hiện</h4>
                <div className="bg-slate-50 border-2 rounded-2xl p-4 text-slate-700 font-bold text-sm min-h-[80px]">
                  {selectedTask.executionResults || 'Chưa có báo cáo kết quả.'}
                </div>
                {(selectedTask.primaryAssigneeIds.includes(currentUser.id) || selectedTask.supportAssigneeIds.includes(currentUser.id)) && (
                   <button onClick={() => handleAddTimeline(selectedTask)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase">
                     Báo cáo kết quả & Tiến độ
                   </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase">Trạng thái</h4>
                  <select className={`w-full p-3 rounded-xl text-[10px] font-black uppercase border-2 ${statusStyle[selectedTask.status]}`} value={selectedTask.status} onChange={(e) => handleUpdateStatus(selectedTask, e.target.value as TaskStatus)} disabled={selectedTask.assignerId !== currentUser.id && !selectedTask.primaryAssigneeIds.includes(currentUser.id)}>
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                   <h4 className="text-[9px] font-black text-slate-400 uppercase">Tiến độ</h4>
                   <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full"><div className="h-full bg-blue-600" style={{ width: `${selectedTask.progress}%` }} /></div>
                      <span className="font-black text-blue-600 text-xs">{selectedTask.progress}%</span>
                   </div>
                </div>
              </div>

              {!isLeader && selectedTask.primaryAssigneeIds.includes(currentUser.id) && (
                <div className="bg-red-50 p-6 rounded-[32px] border-2 border-red-100 space-y-4">
                  <h4 className="text-xs font-black text-red-600 uppercase flex items-center gap-2"><Timer size={16}/> ĐỀ NGHỊ GIA HẠN</h4>
                  {selectedTask.extensionRequest?.status === 'pending' ? (
                    <div className="text-center py-2"><span className="text-red-500 font-black text-[10px] uppercase animate-pulse">Đang đợi lãnh đạo phê duyệt...</span></div>
                  ) : (
                    <div className="space-y-3">
                      <input id="extDate" type="date" className="w-full border p-3 rounded-xl font-black text-xs" />
                      <textarea id="extReason" className="w-full border p-3 rounded-xl font-bold text-xs h-20" placeholder="Lý do gia hạn..." />
                      <button onClick={async () => {
                        const date = (document.getElementById('extDate') as HTMLInputElement).value;
                        const reason = (document.getElementById('extReason') as HTMLTextAreaElement).value;
                        if(!date || !reason) return alert("Vui lòng điền đủ ngày và lý do!");
                        await dbClient.update('tasks', selectedTask.id, { extensionRequest: { requestedDate: date, reason, status: 'pending', requestDate: new Date().toISOString() } });
                        onRefresh(); setSelectedTask(null); alert("Đã gửi đề nghị!");
                      }} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-red-100">Gửi đề nghị gia hạn</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-8 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="bg-slate-800 text-white px-10 py-3 rounded-xl font-black text-xs uppercase">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
