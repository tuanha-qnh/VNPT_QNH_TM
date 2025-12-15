import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, ExtensionRequest } from '../types';
import { Calendar, LayoutList, Plus, Search, MoreHorizontal, User as UserIcon, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';

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
  
  // Extension State
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');

  const [newTask, setNewTask] = useState<Partial<Task>>({
    type: 'Single',
    primaryAssigneeIds: [],
    supportAssigneeIds: []
  });

  const handleCreateTask = () => {
    if (!newTask.name || !newTask.deadline) return alert("Vui lòng nhập tên công việc và hạn hoàn thành");

    const task: Task = {
      id: `t${Date.now()}`,
      name: newTask.name || 'Công việc mới',
      content: newTask.content || '',
      type: newTask.type as any,
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      progress: 0,
      createdAt: new Date().toISOString(),
      deadline: newTask.deadline || new Date().toISOString(),
      assignerId: currentUser.id, // Fixed: Assigner is current user
      primaryAssigneeIds: newTask.primaryAssigneeIds || [],
      supportAssigneeIds: newTask.supportAssigneeIds || [],
      projectId: newTask.type === 'Project' ? newTask.projectId : undefined
    };
    setTasks([...tasks, task]);
    setShowCreateForm(false);
    setNewTask({ type: 'Single', primaryAssigneeIds: [], supportAssigneeIds: [] });
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
      if (confirm("Xóa công việc này?")) {
          setTasks(tasks.filter(t => t.id !== taskId));
          setSelectedTask(null);
      }
  };

  // Helper for Multi-Select
  const toggleSelection = (id: string, field: 'primaryAssigneeIds' | 'supportAssigneeIds') => {
      const current = newTask[field] || [];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setNewTask({ ...newTask, [field]: updated });
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
           <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md ml-2"><Plus size={16} /> Giao việc mới</button>
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
                         <tr key={task.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => setSelectedTask(task)}>
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
        
        {/* Basic timeline placeholder (keeping existing logic simplifed) */}
        {viewMode === 'timeline' && <div className="p-8 text-center text-slate-400">Chế độ Timeline (như cũ)</div>}
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
                        <input className="w-full border rounded-lg p-2.5" value={newTask.name || ''} onChange={e => setNewTask({...newTask, name: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Nội dung</label>
                        <textarea className="w-full border rounded-lg p-2.5 h-20" value={newTask.content || ''} onChange={e => setNewTask({...newTask, content: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hạn hoàn thành</label>
                        <input type="date" className="w-full border rounded-lg p-2.5" onChange={e => setNewTask({...newTask, deadline: new Date(e.target.value).toISOString()})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Loại công việc</label>
                        <select className="w-full border rounded-lg p-2.5" onChange={e => setNewTask({...newTask, type: e.target.value as any})}><option value="Single">Giao việc lẻ</option><option value="Project">Dự án</option></select>
                    </div>
                    {/* Multi-Select Simulation */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                             <div className="text-sm font-bold mb-2 text-blue-700">Người chủ trì</div>
                             {users.map(u => (
                                 <label key={`p-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50">
                                     <input type="checkbox" checked={newTask.primaryAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'primaryAssigneeIds')} />
                                     {u.fullName}
                                 </label>
                             ))}
                        </div>
                        <div className="border p-3 rounded-lg max-h-40 overflow-y-auto">
                             <div className="text-sm font-bold mb-2 text-slate-600">Người phối hợp</div>
                             {users.map(u => (
                                 <label key={`s-${u.id}`} className="flex items-center gap-2 text-sm py-1 hover:bg-slate-50">
                                     <input type="checkbox" checked={newTask.supportAssigneeIds?.includes(u.id)} onChange={() => toggleSelection(u.id, 'supportAssigneeIds')} />
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
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{selectedTask.name}</h2>
                        <div className="text-sm text-slate-500 mt-1 flex gap-4">
                            <span className="flex items-center gap-1"><UserIcon size={14}/> Người giao: {users.find(u => u.id === selectedTask.assignerId)?.fullName}</span>
                            <span className="flex items-center gap-1"><Clock size={14}/> Deadline: {new Date(selectedTask.deadline).toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedTask(null)}><X size={24} className="text-slate-400 hover:text-red-500" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-sm text-slate-700 mb-2">Nội dung thực hiện</h4>
                                <p className="text-slate-600 whitespace-pre-wrap">{selectedTask.content}</p>
                            </div>

                            {/* Staff Action Area */}
                            <div className="border rounded-lg p-4">
                                <h4 className="font-bold text-sm text-slate-700 mb-4">Cập nhật tiến độ (Dành cho nhân viên)</h4>
                                <div className="flex items-center gap-4">
                                    <select 
                                        className="border rounded px-3 py-2"
                                        value={selectedTask.status}
                                        onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value as TaskStatus, selectedTask.progress)}
                                    >
                                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={selectedTask.progress}
                                        onChange={(e) => handleUpdateStatus(selectedTask.id, selectedTask.status, parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="font-bold w-12 text-right">{selectedTask.progress}%</span>
                                </div>
                            </div>
                            
                            {/* Extension Request Area */}
                            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={16}/> Gia hạn Deadline</h4>
                                {selectedTask.extensionRequest?.status === 'pending' ? (
                                    <div className="text-sm bg-white p-3 rounded border border-orange-200">
                                        <p><strong>Ngày xin gia hạn:</strong> {new Date(selectedTask.extensionRequest.requestedDate).toLocaleDateString()}</p>
                                        <p><strong>Lý do:</strong> {selectedTask.extensionRequest.reason}</p>
                                        <p className="mt-2 italic text-orange-600">Đang chờ phê duyệt...</p>
                                        
                                        {/* Approval Actions for Leader */}
                                        {selectedTask.assignerId === currentUser.id && (
                                            <div className="mt-3 flex gap-2">
                                                <button onClick={() => handleApproveExtension(selectedTask.id, true)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Đồng ý</button>
                                                <button onClick={() => handleApproveExtension(selectedTask.id, false)} className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold">Từ chối</button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-600">Ngày mong muốn</label>
                                            <input type="date" className="w-full border p-1.5 rounded text-sm bg-white" onChange={e => setExtensionDate(e.target.value)} />
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="text-xs font-bold text-slate-600">Lý do</label>
                                            <input type="text" className="w-full border p-1.5 rounded text-sm bg-white" placeholder="Tại sao cần gia hạn?" onChange={e => setExtensionReason(e.target.value)} />
                                        </div>
                                        <button onClick={handleExtensionRequest} className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-orange-600">Gửi yêu cầu</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar Info */}
                        <div className="space-y-4">
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
                            {selectedTask.assignerId === currentUser.id && (
                                <button onClick={() => handleDeleteTask(selectedTask.id)} className="w-full py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold">Xóa công việc</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
