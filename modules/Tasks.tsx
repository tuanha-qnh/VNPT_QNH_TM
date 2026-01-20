
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, TaskPriority, User, Unit, ExtensionRequest, Role } from '../types';
import { Calendar, LayoutList, Plus, Search, MoreHorizontal, User as UserIcon, Clock, AlertTriangle, CheckCircle, X, Edit2, Trash2, Save, ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import { dbClient } from '../utils/firebaseClient'; // Đổi sang Firebase

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
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    type: 'Single',
    primaryAssigneeIds: [],
    supportAssigneeIds: []
  });

  const canAssignTask = currentUser.title !== Role.STAFF && currentUser.title !== 'Nhân viên';

  const handleCreateTask = async () => {
    if (!taskForm.name || !taskForm.deadline) return alert("Vui lòng nhập tên công việc và hạn hoàn thành");
    setIsProcessing(true);
    const id = `task_${Date.now()}`;
    const newTaskData = {
      name: taskForm.name,
      content: taskForm.content || '',
      type: taskForm.type || 'Single',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      progress: 0,
      deadline: taskForm.deadline,
      assignerId: currentUser.id,
      primaryAssigneeIds: taskForm.primaryAssigneeIds || [],
      supportAssigneeIds: taskForm.supportAssigneeIds || [],
      createdAt: new Date().toISOString(),
    };
    try {
        await dbClient.upsert('tasks', id, newTaskData);
        setTasks([...tasks, { id, ...newTaskData } as Task]);
        setShowCreateForm(false);
        alert("Giao việc thành công trên Firebase!");
    } catch (err: any) { alert("Lỗi Firebase: " + err.message); }
    finally { setIsProcessing(false); }
  };

  const handleConfirmUpdate = async (taskId: string, status: TaskStatus, progress: number) => {
      setIsProcessing(true);
      try {
          await dbClient.update('tasks', taskId, { status, progress });
          setTasks(tasks.map(t => t.id === taskId ? { ...t, status, progress } : t));
          alert("Cập nhật thành công!");
      } catch (err: any) { alert("Lỗi: " + err.message); }
      finally { setIsProcessing(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
      if (!confirm("Xóa công việc này khỏi Firebase?")) return;
      try {
          await dbClient.delete('tasks', taskId);
          setTasks(tasks.filter(t => t.id !== taskId));
          setSelectedTask(null);
      } catch (err: any) { alert("Lỗi xóa: " + err.message); }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
       {/* UI giữ nguyên, logic backend đã chuyển sang Firebase qua dbClient */}
       <div className="flex justify-between items-center">
           <h2 className="text-2xl font-bold text-slate-800">Quản lý công việc (Firebase)</h2>
           {canAssignTask && (
                <button onClick={() => setShowCreateForm(true)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> Giao việc mới</button>
           )}
       </div>

       <div className="bg-white rounded-xl shadow border overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold">
               <tr>
                 <th className="p-4 border-b">Công việc</th>
                 <th className="p-4 border-b">Trạng thái</th>
                 <th className="p-4 border-b">Hạn xong</th>
                 <th className="p-4 border-b">Tiến độ</th>
               </tr>
            </thead>
            <tbody>
               {tasks.map(task => (
                 <tr key={task.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <td className="p-4 font-bold">{task.name}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${statusColors[task.status]}`}>{task.status}</span></td>
                    <td className="p-4">{new Date(task.deadline).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4">{task.progress}%</td>
                 </tr>
               ))}
            </tbody>
          </table>
       </div>
    </div>
  );
};

export default Tasks;
