
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, ExtensionRequest } from '../types';
import { Calendar, LayoutList, Plus, Search, MoreHorizontal, User as UserIcon, Clock, AlertTriangle, CheckCircle, X, Edit2, Trash2, Save } from 'lucide-react';

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

const Tasks: React.FC<TasksProps> = ({ tasks, users, units, currentUser, setTasks }) => {
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'report'>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  
  // Extension State
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');

  // Form State (Create & Edit)
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    type: 'Single',
    primaryAssigneeIds: [],
    supportAssigneeIds: []
  });

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

  const handleCreateTask = () => {
    if (!taskForm.name || !taskForm.deadline) return alert("Vui lòng nhập tên công việc và hạn hoàn thành");

    const task: Task = {
      id: `t${Date.now()}`,
      name: taskForm.name || 'Công việc mới',
      content: taskForm.content || '',
      type: taskForm.type as any,
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      progress: 0,
      createdAt: new Date().toISOString(),
      deadline: taskForm.deadline || new Date().toISOString(),
      assignerId: currentUser.id,
      primaryAssigneeIds: taskForm.primaryAssigneeIds || [],
      supportAssigneeIds: taskForm.supportAssigneeIds || [],
      projectId: taskForm.type === 'Project' ? taskForm.projectId : undefined
    };
    setTasks([...tasks, task]);
    setShowCreateForm(false);
    resetForm();
  };

  const handleUpdateStatus = (taskId: string, status: TaskStatus, progress: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status, progress: status === TaskStatus.COMPLETED ? 100 : progress } : t));
    if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, status, progress: status === TaskStatus.COMPLETED ? 100 : progress });
    }
  };

  const handleExtensionRequest = () => {
    if (!selectedTask || !extensionDate || !extensionReason) return;
    const updatedTask: Task = {
        ...selectedTask,
        extensionRequest: {
            requestedDate: new Date(extensionDate).toISOString(),
            reason: extensionReason,
            status: 'pending',
            requestDate: new Date().toISOString()
        }
    };
    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
    alert("Đã gửi yêu cầu gia hạn!");
  };

  const handleApproveExtension = (taskId: string, approved: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.extensionRequest) return;

    const updatedTask: Task = {
        ...task,
        deadline: approved ? task.extensionRequest.requestedDate : task.deadline,
        extensionRequest: {
            ...task.extensionRequest,
            status: approved ? 'approved' : 'rejected'
        }
    };
    setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
    if (selectedTask?.id === taskId) setSelectedTask(updatedTask);
  };

  const handleDeleteTask = (taskId: string) => {
      if (confirm("Bạn có chắc chắn muốn xóa công việc này không?")) {
          setTasks(tasks.filter(t => t.id !== taskId));
          setSelectedTask(null);
      }
  };

  const handleStartEdit = () => {
      if (!selectedTask) return;
      setTaskForm({
          ...selectedTask
      });
      setIsEditingTask(true);
  };

  const handleSaveEdit = () => {
      if (!selectedTask || !taskForm.name) return;
      
      const updatedTask: Task = {
          ...selectedTask,
          name: taskForm.name,
          content: taskForm.content || '',
          deadline: taskForm.deadline || selectedTask.deadline,
          type: taskForm.type as any,
          projectId: taskForm.projectId,
          primaryAssigneeIds: taskForm.primaryAssigneeIds || [],
          supportAssigneeIds: taskForm.supportAssigneeIds || []
      };

      setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
      setSelectedTask(updatedTask);
      setIsEditingTask(false);
  };

  // Helper for Multi-Select
  const toggleSelection = (id: string, field: 'primaryAssigneeIds' | 'supportAssigneeIds') => {
      const current = taskForm[field] || [];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setTaskForm({ ...taskForm, [field]: updated });
  };

  // Permission Check
  // Admin or Assigner (Task Owner) has specific rights
  const isTaskOwner = selectedTask 
    ? (currentUser.id === selectedTask.assignerId || currentUser.hrmCode === 'ADMIN') 
    : false;

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
        
        {viewMode === 'timeline' && <div className="p-8 text-center text-slate-400">Chế độ Timeline (Đang phát triển)</div>}
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
                <button onClick={handleCreateTask} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Giao việc</button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL POPUP */}
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
                         // --- EDIT MODE FORM ---
                         <div className="space-y-4">
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
                                    <input 
                                        type="date" 
                                        className="w-full border rounded-lg p-2.5" 
                                        value={taskForm.deadline ? new Date(taskForm.deadline).toISOString().split('T')[0] : ''}
                                        onChange={e => setTaskForm({...taskForm, deadline: new Date(e.target.value).toISOString()})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Loại công việc</label>
                                    <select className="w-full border rounded-lg p-2.5" value={taskForm.type} onChange={e => setTaskForm({...taskForm, type: e.target.value as any})}><option value="Single">Giao việc lẻ</option><option value="Project">Dự án</option></select>
                                </div>
                                {/* Assignee Selection in Edit Mode */}
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
                             <div className="flex justify-end gap-2 pt-4 border-t">
                                 <button onClick={() => setIsEditingTask(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                                 <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2"><Save size={16}/> Lưu thay đổi</button>
                             </div>
                         </div>
                    ) : (
                         // --- VIEW MODE ---
                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 space-y-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    <h4 className="font-bold text-sm text-slate-700 mb-2">Nội dung thực hiện</h4>
                                    <p className="text-slate-600 whitespace-pre-wrap">{selectedTask.content}</p>
                                </div>

                                {/* Staff Action Area - HIDDEN FOR OWNER/ADMIN */}
                                {!isTaskOwner && (
                                    <div className="border rounded-lg p-4 bg-white shadow-sm">
                                        <h4 className="font-bold text-sm text-slate-700 mb-4">Cập nhật tiến độ (Dành cho nhân viên)</h4>
                                        <div className="flex items-center gap-4">
                                            <select 
                                                className="border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedTask.status}
                                                onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus, selectedTask.progress)}
                                            >
                                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={selectedTask.progress}
                                                onChange={(e) => handleUpdateStatus(selectedTask.id, selectedTask.status, parseInt(e.target.value))}
                                                className="flex-1 accent-blue-600"
                                            />
                                            <span className="font-bold w-12 text-right">{selectedTask.progress}%</span>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Extension Request Area */}
                                <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                    <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={16}/> Quản lý hạn hoàn thành</h4>
                                    
                                    {selectedTask.extensionRequest?.status === 'pending' ? (
                                        <div className="text-sm bg-white p-3 rounded border border-orange-200 shadow-sm">
                                            <p className="mb-1"><strong>Ngày xin gia hạn:</strong> {new Date(selectedTask.extensionRequest.requestedDate).toLocaleDateString()}</p>
                                            <p className="mb-1"><strong>Lý do:</strong> {selectedTask.extensionRequest.reason}</p>
                                            <p className="mt-2 text-orange-600 font-medium italic">Trạng thái: Đang chờ phê duyệt</p>
                                            
                                            {/* Approval Actions for Leader */}
                                            {isTaskOwner && (
                                                <div className="mt-3 flex gap-2 pt-2 border-t border-orange-100">
                                                    <button onClick={() => handleApproveExtension(selectedTask.id, true)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-green-700">Đồng ý</button>
                                                    <button onClick={() => handleApproveExtension(selectedTask.id, false)} className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-red-600">Từ chối</button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // Request Form - ONLY FOR ASSIGNEE (NOT OWNER)
                                        !isTaskOwner ? (
                                            <div className="flex flex-col sm:flex-row gap-2 items-end">
                                                <div className="flex-1 w-full">
                                                    <label className="text-xs font-bold text-slate-600 block mb-1">Ngày mong muốn</label>
                                                    <input type="date" className="w-full border p-2 rounded text-sm bg-white" onChange={e => setExtensionDate(e.target.value)} />
                                                </div>
                                                <div className="flex-[2] w-full">
                                                    <label className="text-xs font-bold text-slate-600 block mb-1">Lý do gia hạn</label>
                                                    <input type="text" className="w-full border p-2 rounded text-sm bg-white" placeholder="Nhập lý do..." onChange={e => setExtensionReason(e.target.value)} />
                                                </div>
                                                <button onClick={handleExtensionRequest} className="bg-orange-500 text-white px-3 py-2 rounded text-sm font-bold hover:bg-orange-600 w-full sm:w-auto">Gửi</button>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 italic">Không có yêu cầu gia hạn nào.</div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-4">
                                <div className="border p-4 rounded-lg bg-slate-50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Trạng thái hiện tại</h4>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[selectedTask.status]}`}>{selectedTask.status}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 mb-1">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${selectedTask.progress}%`}}></div>
                                    </div>
                                    <div className="text-right text-xs font-bold text-blue-700">{selectedTask.progress}%</div>
                                </div>

                                <div className="border p-4 rounded-lg">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Người chủ trì</h4>
                                    <div className="space-y-2">
                                        {selectedTask.primaryAssigneeIds.map(id => {
                                            const u = users.find(x => x.id === id);
                                            return <div key={id} className="flex items-center gap-2 text-sm font-medium"><div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs text-blue-600">{u?.fullName[0]}</div> {u?.fullName}</div>
                                        })}
                                    </div>
                                </div>
                                <div className="border p-4 rounded-lg">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Người phối hợp</h4>
                                    <div className="space-y-2">
                                        {selectedTask.supportAssigneeIds.map(id => {
                                            const u = users.find(x => x.id === id);
                                            return <div key={id} className="flex items-center gap-2 text-sm text-slate-600"><div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-500">{u?.fullName[0]}</div> {u?.fullName}</div>
                                        })}
                                    </div>
                                </div>
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
