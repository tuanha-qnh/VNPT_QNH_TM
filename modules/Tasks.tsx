
import React, { useState, useMemo, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, Role } from '../types';
import { Plus, Search, X, Edit2, Trash2, Save, Loader2, MessageSquare, Timer, Filter, CheckCircle2, AlertTriangle, Clock, ChevronRight, History, Hash, Smartphone, MessageCircle, MoreHorizontal } from 'lucide-react';
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
    priority: TaskPriority.MEDIUM
  });

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
      timeline: formData.timeline || [],
      assignmentSource: formData.assignmentSource || 'Direct',
      eOfficeNumber: formData.eOfficeNumber || '',
      coordinationInstructions: formData.coordinationInstructions || ''
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
    const comment = prompt("Nội dung cập nhật / Kết quả chi tiết?");
    if (progress !== null && comment) {
      const newTimeline = [...(task.timeline || []), { date: new Date().toISOString(), comment, progress: Number(progress) }];
      await dbClient.update('tasks', task.id, { 
        timeline: newTimeline, 
        progress: Number(progress),
        executionResults: comment // Cập nhật kết quả mới nhất vào trường Execution Results
      });
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
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">HỆ THỐNG ĐIỀU HÀNH VÀ GIÁM SÁT</p>
        </div>
        {isLeader && (
          <button onClick={() => { setFormData({ assignmentSource: 'Direct', priority: TaskPriority.MEDIUM }); setShowForm(true); }} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
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
                <th className="p-5 min-w-[300px]">Nguồn & Tên công việc</th>
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
                      {task.extensionRequest?.status === 'pending' && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[9px] font-black animate-pulse">CHỜ DUYỆT GIA HẠN</span>}
                    </div>
                    <div className="font-black text-slate-800 text-base group-hover:text-blue-600 transition-colors">{task.name}</div>
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
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GIAO VIỆC / CHỈNH SỬA */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-4xl shadow-2xl overflow-hidden border animate-zoom-in">
            <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{formData.id ? 'CHỈNH SỬA CÔNG VIỆC' : 'GIAO VIỆC MỚI'}</h3>
              <button onClick={() => setShowForm(false)} className="p-3 hover:bg-red-50 text-slate-400 rounded-full transition-all"><X size={28}/></button>
            </div>
            <div className="p-12 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hình thức giao việc</label>
                  <select className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.assignmentSource} onChange={e => setFormData({...formData, assignmentSource: e.target.value})}>
                    <option value="Direct">Giao việc trực tiếp</option>
                    <option value="eOffice">Trên eOffice</option>
                    <option value="Zalo">Trên nhóm Zalo</option>
                  </select>
                </div>
                {formData.assignmentSource === 'eOffice' && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số EOFFICE</label>
                    <input className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none" placeholder="Nhập số văn bản..." value={formData.eOfficeNumber || ''} onChange={e => setFormData({...formData, eOfficeNumber: e.target.value})} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Độ ưu tiên</label>
                  <select className="w-full border-2 p-4 rounded-2xl bg-slate-50 font-bold outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}>
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên công việc</label>
                <input className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-black text-slate-800 outline-none focus:border-blue-500" placeholder="Tiêu đề chính của công việc..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung chỉ đạo thực hiện (Chủ trì)</label>
                  <textarea className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-bold text-slate-600 outline-none h-32" placeholder="Chi tiết các nội dung cần thực hiện..." value={formData.content || ''} onChange={e => setFormData({...formData, content: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung chỉ đạo phối hợp</label>
                  <textarea className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-bold text-slate-600 outline-none h-32" placeholder="Các yêu cầu dành cho nhân sự phối hợp..." value={formData.coordinationInstructions || ''} onChange={e => setFormData({...formData, coordinationInstructions: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Người chủ trì</label>
                  <select multiple className="w-full border-2 p-4 rounded-[24px] bg-slate-50 font-bold text-sm h-40" value={formData.primaryAssigneeIds || []} onChange={e => setFormData({...formData, primaryAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.title})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Người phối hợp</label>
                  <select multiple className="w-full border-2 p-4 rounded-[24px] bg-slate-50 font-bold text-sm h-40" value={formData.supportAssigneeIds || []} onChange={e => setFormData({...formData, supportAssigneeIds: Array.from(e.target.selectedOptions, (o: any) => o.value)})}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hạn định hoàn thành</label>
                <input type="date" className="w-full border-2 p-5 rounded-[24px] bg-slate-50 font-black outline-none" value={formData.deadline || ''} onChange={e => setFormData({...formData, deadline: e.target.value})} />
              </div>
            </div>
            <div className="p-10 border-t bg-slate-50/50 flex justify-end gap-5">
              <button onClick={() => setShowForm(false)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase hover:text-slate-600 transition-all">Hủy bỏ</button>
              <button onClick={handleCreate} disabled={isProcessing} className="bg-blue-600 text-white px-16 py-5 rounded-[28px] font-black text-xs uppercase shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-3">
                {isProcessing ? <Loader2 className="animate-spin" /> : 'LƯU CÔNG VIỆC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHI TIẾT TƯƠNG TÁC (Side-panel) */}
      {selectedTask && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl animate-slide-in flex flex-col">
            <div className="p-10 border-b flex justify-between items-center bg-blue-600 text-white">
              <div className="flex-1 pr-4">
                <div className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-1 flex items-center gap-2">
                  <Clock size={12}/> CHI TIẾT CÔNG VIỆC #{selectedTask.id.slice(-6)}
                </div>
                <h3 className="text-2xl font-black truncate">{selectedTask.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Quyền sửa/xóa dành cho người giao việc */}
                {selectedTask.assignerId === currentUser.id && (
                  <>
                    <button onClick={() => { setFormData(selectedTask); setShowForm(true); }} className="p-3 hover:bg-white/20 rounded-xl transition-all"><Edit2 size={24}/></button>
                    <button onClick={async () => { if(confirm("Xóa vĩnh viễn công việc này?")) { await dbClient.delete('tasks', selectedTask.id); setSelectedTask(null); onRefresh(); }}} className="p-3 hover:bg-red-500 rounded-xl transition-all"><Trash2 size={24}/></button>
                  </>
                )}
                <button onClick={() => setSelectedTask(null)} className="p-3 hover:bg-white/20 rounded-full transition-all"><X size={28}/></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-8">
              {/* PHẦN DUYỆT GIA HẠN (Chỉ hiện cho lãnh đạo khi có đề nghị) */}
              {isLeader && selectedTask.extensionRequest?.status === 'pending' && selectedTask.assignerId === currentUser.id && (
                <div className="bg-red-50 border-2 border-red-200 p-8 rounded-[32px] animate-pulse-slow">
                  <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={18}/> ĐỀ NGHỊ GIA HẠN THỜI GIAN</h4>
                  <div className="bg-white p-6 rounded-2xl border-2 border-red-100 space-y-3">
                    <p className="text-xs font-bold text-slate-700">Lý do: <span className="italic font-medium">"{selectedTask.extensionRequest.reason}"</span></p>
                    <p className="text-xs font-black text-slate-800">Hạn cũ: {selectedTask.deadline} → <span className="text-red-600 underline">Đề xuất: {selectedTask.extensionRequest.requestedDate}</span></p>
                    <div className="flex gap-3 pt-2">
                      <button onClick={async () => { 
                        await dbClient.update('tasks', selectedTask.id, { 
                          deadline: selectedTask.extensionRequest!.requestedDate, 
                          extensionRequest: { ...selectedTask.extensionRequest!, status: 'approved' } 
                        }); 
                        onRefresh(); 
                        setSelectedTask(prev => prev ? {...prev, deadline: prev.extensionRequest!.requestedDate, extensionRequest: {...prev.extensionRequest!, status: 'approved'}} : null);
                        alert("Đã phê duyệt gia hạn!"); 
                      }} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase">CHẤP THUẬN</button>
                      <button onClick={async () => { 
                        await dbClient.update('tasks', selectedTask.id, { 
                          extensionRequest: { ...selectedTask.extensionRequest!, status: 'rejected' } 
                        }); 
                        onRefresh(); 
                        setSelectedTask(prev => prev ? {...prev, extensionRequest: {...prev.extensionRequest!, status: 'rejected'}} : null);
                      }} className="flex-1 bg-slate-200 text-slate-600 py-3 rounded-xl font-black text-[10px] uppercase">TỪ CHỐI</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-3xl border">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Chỉ đạo Chủ trì:</h4>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-line">{selectedTask.content}</p>
                </div>
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Chỉ đạo Phối hợp:</h4>
                  <p className="text-sm font-bold text-blue-700 leading-relaxed whitespace-pre-line">{selectedTask.coordinationInstructions || 'Không có chỉ đạo phối hợp riêng.'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={16}/> Kết quả thực hiện</h4>
                <div className="bg-slate-50 border-2 rounded-3xl p-6 min-h-[100px] text-slate-700 font-bold text-sm whitespace-pre-line">
                  {selectedTask.executionResults || 'Chưa có báo cáo kết quả thực hiện.'}
                </div>
                {!isLeader && (selectedTask.primaryAssigneeIds.includes(currentUser.id) || selectedTask.supportAssigneeIds.includes(currentUser.id)) && (
                   <button onClick={() => handleAddTimeline(selectedTask)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all">
                     <Edit2 size={14}/> Cập nhật kết quả & Tiến độ
                   </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái công việc</h4>
                  <select 
                    className={`w-full p-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 ${statusStyle[selectedTask.status]}`}
                    value={selectedTask.status}
                    onChange={(e) => handleUpdateStatus(selectedTask, e.target.value as TaskStatus)}
                    disabled={!isLeader && !selectedTask.primaryAssigneeIds.includes(currentUser.id)}
                  >
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ hiện tại</h4>
                   <div className="flex items-center gap-4">
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${selectedTask.progress}%` }} />
                      </div>
                      <span className="font-black text-blue-600 text-lg">{selectedTask.progress}%</span>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16}/> Báo cáo vướng mắc (Nếu có)</h4>
                <textarea 
                  className="w-full border-2 rounded-[24px] p-6 text-sm font-bold bg-slate-50 outline-none focus:border-orange-500 min-h-[120px] transition-all"
                  placeholder="Ghi nhận các vướng mắc, khó khăn cần hỗ trợ..."
                  defaultValue={selectedTask.difficulties}
                  onBlur={async (e) => {
                    await dbClient.update('tasks', selectedTask.id, { difficulties: e.target.value });
                    onRefresh();
                  }}
                  disabled={!isLeader && !selectedTask.primaryAssigneeIds.includes(currentUser.id)}
                />
              </div>

              {/* KHU VỰC GIA HẠN (Chỉ dành cho nhân sự được giao việc) */}
              {!isLeader && (selectedTask.primaryAssigneeIds.includes(currentUser.id)) && (
                <div className="bg-red-50 p-8 rounded-[40px] border-2 border-red-100 space-y-6">
                  <div>
                    <h4 className="text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                      <Timer size={18}/> ĐỀ NGHỊ GIA HẠN DEADLINE
                    </h4>
                    <p className="text-[10px] font-bold text-red-400 uppercase mt-1">Yêu cầu sẽ được gửi tới Lãnh đạo giao việc duyệt</p>
                  </div>
                  
                  {selectedTask.extensionRequest?.status === 'pending' ? (
                    <div className="bg-white p-6 rounded-2xl border-2 border-red-100 text-center">
                       <span className="text-red-500 font-black text-[10px] uppercase animate-pulse tracking-widest">Đang chờ Lãnh đạo phê duyệt...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ngày mong muốn gia hạn đến</label>
                          <input id="extDate" type="date" className="w-full border-2 p-4 rounded-xl font-black text-sm outline-none focus:border-red-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Lý do đề nghị gia hạn</label>
                          <textarea id="extReason" className="w-full border-2 p-4 rounded-xl font-bold text-sm outline-none focus:border-red-400 h-24" placeholder="Giải trình lý do chưa hoàn thành đúng hạn..." />
                        </div>
                      </div>
                      <button onClick={async () => {
                        const dateEl = document.getElementById('extDate') as HTMLInputElement;
                        const reasonEl = document.getElementById('extReason') as HTMLTextAreaElement;
                        const date = dateEl.value;
                        const reason = reasonEl.value;
                        if(!date || !reason) return alert("Vui lòng điền đầy đủ ngày và lý do!");
                        
                        await dbClient.update('tasks', selectedTask.id, { 
                          extensionRequest: { 
                            requestedDate: date, 
                            reason, 
                            status: 'pending', 
                            requestDate: new Date().toISOString() 
                          } 
                        });
                        onRefresh();
                        setSelectedTask(prev => prev ? {...prev, extensionRequest: { requestedDate: date, reason, status: 'pending', requestDate: new Date().toISOString() }} : null);
                        alert("Đã gửi đề nghị gia hạn!");
                      }} className="w-full py-4 bg-red-600 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all">Gửi đề nghị phê duyệt</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-10 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="bg-slate-800 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">Đóng cửa sổ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
