
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, ExtensionRequest } from '../types';
import { Calendar, LayoutList, Plus, Search, MoreHorizontal, User as UserIcon, Clock, AlertTriangle, CheckCircle, X, Edit2, Trash2, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient'; // Import Supabase

interface TasksProps {
  tasks: Task[];
  users: User[];
  units: Unit[];
  currentUser: User;
  setTasks: (tasks: Task[]) => void;
}

const statusColors = {
  [TaskStatus.COMPLETED]: 'bg-green-100 text-green-700 border-green-200',
  [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700 border-blue-200',
  [TaskStatus.PENDING]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TaskStatus.OVERDUE]: 'bg-red-100 text-red-700 border-red-200',
  [TaskStatus.STUCK]: 'bg-orange-100 text-orange-700 border-orange-200',
};

const taskStatusColorsHex = {
    [TaskStatus.COMPLETED]: '#22c55e',
    [TaskStatus.IN_PROGRESS]: '#3b82f6',
    [TaskStatus.PENDING]: '#94a3b8',
    [TaskStatus.OVERDUE]: '#ef4444',
    [TaskStatus.STUCK]: '#f97316',
};

const Tasks: React.FC<TasksProps> = ({ tasks, users, units, currentUser, setTasks }) => {
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'report'>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Extension State
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');

  // Form State (Create & Edit)
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    type: 'Single',
    primaryAssigneeIds: [],
    supportAssigneeIds: []
  });

  // Timeline State
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [timelineStart, setTimelineStart] = useState(new Date());

  const resetForm = () => {
    setTaskForm({ type: 'Single', primaryAssigneeIds: [], supportAssigneeIds: [] });
    setExtensionReason('');
    setExtensionDate('');
    setIsEditingTask(false);
  };

  const openCreateModal = () => {
      resetForm();
      setShowCreateForm(true);
  };

  // --- LOGIC GIAO VIỆC MỚI (LƯU DB) ---
  const handleCreateTask = async () => {
    if (!taskForm.name || !taskForm.deadline) return alert("Vui lòng nhập tên công việc và hạn hoàn thành");
    setIsProcessing(true);

    const dbTask = {
      name: taskForm.name,
      content: taskForm.content || '',
      type: taskForm.type,
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      progress: 0,
      deadline: taskForm.deadline,
      assigner_id: currentUser.id,
      primary_ids: taskForm.primaryAssigneeIds || [],
      support_ids: taskForm.supportAssigneeIds || [],
      project_id: taskForm.type === 'Project' ? taskForm.projectId : null
    };

    try {
        const { data, error } = await supabase.from('tasks').insert([dbTask]).select();
        if (error) throw error;
        
        if (data && data[0]) {
            // Map back to App Type
            const t = data[0];
            const newTask: Task = {
                 id: t.id, name: t.name, content: t.content, type: t.type, status: t.status,
                 priority: t.priority, progress: t.progress, deadline: t.deadline,
                 assignerId: t.assigner_id, primaryAssigneeIds: t.primary_ids, supportAssigneeIds: t.support_ids,
                 createdAt: t.created_at, projectId: t.project_id
            };
            setTasks([...tasks, newTask]);
            setShowCreateForm(false);
            resetForm();
            alert("Giao việc thành công!");
        }
    } catch (err: any) {
        alert("Lỗi khi giao việc: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- LOGIC CẬP NHẬT TRẠNG THÁI (LƯU DB) ---
  const handleUpdateStatus = async (taskId: string, status: TaskStatus, progress: number) => {
    const newProgress = status === TaskStatus.COMPLETED ? 100 : progress;
    
    // Update Local State Optimistically
    const oldTasks = [...tasks];
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status, progress: newProgress } : t));
    
    // Update DB
    const { error } = await supabase.from('tasks').update({ status, progress: newProgress }).eq('id', taskId);
    if (error) {
        alert("Lỗi cập nhật: " + error.message);
        setTasks(oldTasks); // Revert if failed
    } else {
        if (selectedTask && selectedTask.id === taskId) {
            setSelectedTask({ ...selectedTask, status, progress: newProgress });
        }
    }
  };

  // --- LOGIC LƯU SỬA CÔNG VIỆC ---
  const handleSaveEdit = async () => {
      if (!selectedTask || !taskForm.name) return;
      setIsProcessing(true);

      const updatePayload = {
          name: taskForm.name,
          content: taskForm.content || '',
          deadline: taskForm.deadline || selectedTask.deadline,
          type: taskForm.type,
          project_id: taskForm.projectId,
          primary_ids: taskForm.primaryAssigneeIds || [],
          support_ids: taskForm.supportAssigneeIds || []
      };

      try {
          const { error } = await supabase.from('tasks').update(updatePayload).eq('id', selectedTask.id);
          if (error) throw error;
          
          const updatedTask: Task = { ...selectedTask, ...taskForm } as Task;
          setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
          setSelectedTask(updatedTask);
          setIsEditingTask(false);
      } catch(err: any) {
          alert("Lỗi cập nhật: " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDeleteTask = async (taskId: string) => {
      if (!confirm("Bạn có chắc chắn muốn xóa công việc này không?")) return;
      try {
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (error) throw error;
          setTasks(tasks.filter(t => t.id !== taskId));
          setSelectedTask(null);
      } catch (err: any) {
          alert("Lỗi xóa: " + err.message);
      }
  };

  // ... (Giữ nguyên logic Timeline và UI render)
  const toggleSelection = (id: string, field: 'primaryAssigneeIds' | 'supportAssigneeIds') => {
      const current = taskForm[field] || [];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setTaskForm({ ...taskForm, [field]: updated });
  };

  const isTaskOwner = selectedTask 
    ? (currentUser.id === selectedTask.assignerId || currentUser.hrmCode === 'ADMIN') 
    : false;
    
  const handleStartEdit = () => {
      if (!selectedTask) return;
      setTaskForm({
          ...selectedTask
      });
      setIsEditingTask(true);
  };
  
  // Logic Timeline (Giữ nguyên)
  const dayWidth = 40;
  const daysToRender = 30; 
  const getDaysArray = () => {
      const arr = [];
      const start = new Date(timelineStart);
      start.setDate(start.getDate() - 3); 
      for (let i = 0; i < daysToRender; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          arr.push(d);
      }
      return arr;
  };
  const days = getDaysArray();
  const getTaskPosition = (task: Task) => {
      const taskStart = new Date(task.createdAt);
      const taskEnd = new Date(task.deadline);
      const viewStart = days[0];
      const diffStart = Math.max(0, (taskStart.getTime() - viewStart.getTime()) / (1000 * 3600 * 24));
      const duration = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 3600 * 24));
      return { left: diffStart * dayWidth, width: duration * dayWidth };
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Quản lý công việc</h2>
           <p className="text-sm text-slate-500">Người dùng: <span className="font-semibold text-blue-600">{currentUser.fullName}</span></p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}><LayoutList size={20}/></button>
           <button onClick={() => setViewMode('timeline')} className={`p-2 rounded-lg ${viewMode === 'timeline' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}><Calendar size={20}/></button>
           <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md ml-2"><Plus size={16} /> Giao việc mới</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {viewMode === 'list' && (
          <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm">
                   <tr>
                     <th className="px-4 py-3 border-b">Tên công việc</th>
                     <th className="px-4 py-3 border-b">Người giao</th>
                     <th className="px-4 py-3 border-b">Chủ trì</th>
                     <th className="px-4 py-3 border-b">Phối hợp</th>
                     <th className="px-4 py-3 border-b w-32">Trạng thái</th>
                     <th className="px-4 py-3 border-b w-32">Hạn xong</th>
                     <th className="px-4 py-3 border-b w-24">Tiến độ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {tasks.map(task => {
                       const assigner = users.find(u => u.id === task.assignerId);
                       const primaries = task.primaryAssigneeIds.map(id => users.find(u => u.id === id)?.fullName).join(', ');
                       const supports = task.supportAssigneeIds.map(id => users.find(u => u.id === id)?.fullName).join(', ');
                       return (
                         <tr key={task.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => { setSelectedTask(task); setIsEditingTask(false); }}>
                            <td className="px-4 py-3 font-medium text-slate-800">
                                {task.name}
                                {task.extensionRequest?.status === 'pending' && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-1 rounded">Xin gia hạn</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{assigner?.fullName}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{primaries}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{supports}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs border ${statusColors[task.status]}`}>{task.status}</span></td>
                            <td className="px-4 py-3 font-mono text-slate-600">{new Date(task.deadline).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{width: `${task.progress}%`}}></div></div>
                                    <span className="text-xs">{task.progress}%</span>
                                </div>
                            </td>
                         </tr>
                       )
                   })}
                </tbody>
              </table>
          </div>
        )}
        
        {viewMode === 'timeline' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-2 border-b bg-slate-50">
                     <div className="flex gap-2">
                        <button onClick={() => { const d = new Date(timelineStart); d.setDate(d.getDate()-7); setTimelineStart(d); }} className="p-1 hover:bg-slate-200 rounded"><ChevronLeft size={20}/></button>
                        <span className="font-bold text-slate-700 flex items-center">{days[0].toLocaleDateString('vi-VN')} - {days[days.length-1].toLocaleDateString('vi-VN')}</span>
                        <button onClick={() => { const d = new Date(timelineStart); d.setDate(d.getDate()+7); setTimelineStart(d); }} className="p-1 hover:bg-slate-200 rounded"><ChevronRight size={20}/></button>
                     </div>
                     <div className="flex gap-2 text-xs">
                         {Object.entries(taskStatusColorsHex).map(([status, color]) => (
                             <div key={status} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{backgroundColor: color}}></span>{status}</div>
                         ))}
                     </div>
                </div>
                
                <div className="flex-1 overflow-auto relative" ref={timelineScrollRef}>
                    <div className="flex sticky top-0 z-10 bg-white border-b h-10 min-w-max">
                        <div className="w-64 sticky left-0 bg-white border-r z-20 flex items-center px-4 font-bold text-sm text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Công việc</div>
                        {days.map((day, i) => (
                            <div key={i} className={`flex-shrink-0 border-r flex flex-col items-center justify-center text-xs ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50' : ''}`} style={{width: dayWidth}}>
                                <span className="font-bold">{day.getDate()}</span>
                                <span className="text-[10px] text-slate-400">T{day.getDay() + 1 === 1 ? 'CN' : day.getDay() + 1}</span>
                            </div>
                        ))}
                    </div>
                    <div className="min-w-max">
                        {tasks.map((task) => {
                            const pos = getTaskPosition(task);
                            const primary = users.find(u => u.id === task.primaryAssigneeIds[0]);
                            return (
                                <div key={task.id} className="flex h-12 border-b group hover:bg-slate-50">
                                    <div className="w-64 sticky left-0 bg-white group-hover:bg-slate-50 border-r z-10 flex items-center px-4 text-sm font-medium text-slate-700 truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer" onClick={() => { setSelectedTask(task); setIsEditingTask(false); }}>
                                        <div className="truncate" title={task.name}>{task.name}</div>
                                    </div>
                                    <div className="relative flex-1 h-full">
                                        {days.map((day, i) => (
                                            <div key={i} className={`absolute top-0 bottom-0 border-r ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50/50' : ''}`} style={{left: i * dayWidth, width: dayWidth}}></div>
                                        ))}
                                        <div 
                                            className="absolute top-2 h-8 rounded-md shadow-sm text-white text-xs flex items-center px-2 cursor-pointer hover:opacity-90 transition-opacity truncate overflow-hidden"
                                            style={{ left: pos.left, width: pos.width, backgroundColor: taskStatusColorsHex[task.status] }}
                                            onClick={() => { setSelectedTask(task); setIsEditingTask(false); }}
                                            title={`${task.name} (${task.progress}%)`}
                                        >
                                            {task.progress}% - {primary?.fullName || 'Chưa gán'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg">Giao việc mới</h3>
              <button onClick={() => setShowCreateForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Tên công việc</label>
                        <input className="w-full border rounded-lg p-2.5" value={taskForm.name || ''} onChange={e => setTaskForm({...taskForm, name: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Nội dung</label>
                        <textarea className="w-full border rounded-lg p-2.5 h-20" value={taskForm.content || ''} onChange={e => setTaskForm({...taskForm, content: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hạn hoàn thành</label>
                        <input type="date" className="w-full border rounded-lg p-2.5" onChange={e => setTaskForm({...taskForm, deadline: new Date(e.target.value).toISOString()})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Loại công việc</label>
                        <select className="w-full border rounded-lg p-2.5" onChange={e => setTaskForm({...taskForm, type: e.target.value as any})}><option value="Single">Giao việc lẻ</option><option value="Project">Dự án</option></select>
                    </div>
                    {/* Multi-Select Simulation */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                             <div className="text-sm font-bold mb-2 text-blue-700">Người chủ trì</div>
                             {users.map(u => (
                                 <label key={`p-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50">
                                     <input type="checkbox" checked={taskForm.primaryAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'primaryAssigneeIds')} />
                                     {u.fullName}
                                 </label>
                             ))}
                        </div>
                        <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                             <div className="text-sm font-bold mb-2 text-slate-600">Người phối hợp</div>
                             {users.map(u => (
                                 <label key={`s-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50">
                                     <input type="checkbox" checked={taskForm.supportAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'supportAssigneeIds')} />
                                     {u.fullName}
                                 </label>
                             ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                <button onClick={handleCreateTask} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2">
                   {isProcessing ? <Loader2 className="animate-spin" size={16}/> : 'Giao việc'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL POPUP (Giữ nguyên logic Edit/Delete) */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[95vh]">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-start">
                    <div className="flex-1 mr-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">
                                {isEditingTask ? "Chỉnh sửa công việc" : selectedTask.name}
                            </h2>
                            {isTaskOwner && !isEditingTask && (
                                <div className="flex gap-2">
                                    <button onClick={handleStartEdit} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 text-sm font-bold">
                                        <Edit2 size={16} /> <span className="hidden sm:inline">Sửa</span>
                                    </button>
                                    <button onClick={() => handleDeleteTask(selectedTask.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-2 text-sm font-bold">
                                        <Trash2 size={16} /> <span className="hidden sm:inline">Xóa</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        {!isEditingTask && (
                            <div className="text-sm text-slate-500 mt-1 flex gap-4">
                                <span className="flex items-center gap-1"><UserIcon size={14}/> Người giao: {users.find(u => u.id === selectedTask.assignerId)?.fullName}</span>
                                <span className="flex items-center gap-1"><Clock size={14}/> Deadline: {new Date(selectedTask.deadline).toLocaleDateString('vi-VN')}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setSelectedTask(null)}><X size={24} className="text-slate-400 hover:text-red-500" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {isEditingTask ? (
                         <div className="space-y-4">
                             {/* Form Edit tương tự Form Create */}
                             <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Tên công việc</label>
                                    <input className="w-full border rounded-lg p-2.5" value={taskForm.name || ''} onChange={e => setTaskForm({...taskForm, name: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Nội dung</label>
                                    <textarea className="w-full border rounded-lg p-2.5 h-32" value={taskForm.content || ''} onChange={e => setTaskForm({...taskForm, content: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Hạn hoàn thành</label>
                                    <input type="date" className="w-full border rounded-lg p-2.5" value={taskForm.deadline ? new Date(taskForm.deadline).toISOString().split('T')[0] : ''} onChange={e => setTaskForm({...taskForm, deadline: new Date(e.target.value).toISOString()})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Loại công việc</label>
                                    <select className="w-full border rounded-lg p-2.5" value={taskForm.type} onChange={e => setTaskForm({...taskForm, type: e.target.value as any})}><option value="Single">Giao việc lẻ</option><option value="Project">Dự án</option></select>
                                </div>
                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    {/* Assignee Selection Reuse */}
                                    <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                                        <div className="text-sm font-bold mb-2 text-blue-700">Người chủ trì</div>
                                        {users.map(u => <label key={`p-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50"><input type="checkbox" checked={taskForm.primaryAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'primaryAssigneeIds')} />{u.fullName}</label>)}
                                    </div>
                                    <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                                        <div className="text-sm font-bold mb-2 text-slate-600">Người phối hợp</div>
                                        {users.map(u => <label key={`s-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50"><input type="checkbox" checked={taskForm.supportAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'supportAssigneeIds')} />{u.fullName}</label>)}
                                    </div>
                                </div>
                             </div>
                             <div className="flex justify-end gap-2 pt-4 border-t">
                                 <button onClick={() => setIsEditingTask(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                                 <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2">
                                     {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Lưu thay đổi
                                 </button>
                             </div>
                         </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <h4 className="font-bold text-sm text-slate-700 mb-2">Nội dung thực hiện</h4>
                                    <p className="text-slate-600 whitespace-pre-wrap">{selectedTask.content}</p>
                                </div>
                                {/* Staff Update Status */}
                                {!isTaskOwner && (
                                    <div className="border rounded-lg p-4 bg-white shadow-sm">
                                        <h4 className="font-bold text-sm text-slate-700 mb-4">Cập nhật tiến độ</h4>
                                        <div className="flex items-center gap-4">
                                            <select className="border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" value={selectedTask.status} onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus, selectedTask.progress)}>{Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                                            <input type="range" min="0" max="100" value={selectedTask.progress} onChange={(e) => handleUpdateStatus(selectedTask.id, selectedTask.status, parseInt(e.target.value))} className="flex-1 accent-blue-600"/>
                                            <span className="font-bold w-12 text-right">{selectedTask.progress}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="border p-4 rounded-lg bg-slate-50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Trạng thái hiện tại</h4>
                                    <div className="flex items-center gap-2 mb-2"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[selectedTask.status]}`}>{selectedTask.status}</span></div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 mb-1"><div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${selectedTask.progress}%`}}></div></div>
                                    <div className="text-right text-xs font-bold text-blue-700">{selectedTask.progress}%</div>
                                </div>
                                {/* Assignee List */}
                                <div className="border p-4 rounded-lg"><h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Người chủ trì</h4>{selectedTask.primaryAssigneeIds.map(id => <div key={id} className="text-sm">{users.find(x => x.id === id)?.fullName}</div>)}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
