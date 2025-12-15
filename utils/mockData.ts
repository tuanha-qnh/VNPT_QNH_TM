import { User, Unit, Task, TaskStatus, TaskPriority, Role, KPI_KEYS } from '../types';

// Initial Mock Data
const initialUnits: Unit[] = [
  { id: 'u1', parentId: null, name: 'VNPT Quảng Ninh (Cấp Tỉnh)', managerIds: ['usr_admin'], address: '20 Lê Thánh Tông', phone: '', level: 0 },
  { id: 'u2', parentId: 'u1', name: 'Phòng Kỹ thuật - Đầu tư', managerIds: ['usr1'], address: 'Tầng 3', phone: '02033123456', level: 1 },
  { id: 'u3', parentId: 'u1', name: 'Phòng Kinh doanh', managerIds: ['usr3'], address: 'Tầng 2', phone: '02033987654', level: 1 },
  { id: 'u4', parentId: 'u1', name: 'Trung tâm Viễn thông 1', managerIds: ['usr5'], address: 'Hạ Long', phone: '02033666777', level: 1 },
  { id: 'u5', parentId: 'u4', name: 'Tổ Kỹ thuật (Thuộc TTVT1)', managerIds: [], address: 'Hạ Long', phone: '', level: 2 },
];

const initialUsers: User[] = [
  { id: 'usr_admin', hrmCode: 'ADMIN', fullName: 'Quản Trị Viên', title: Role.ADMIN, unitId: 'u1', username: 'admin', password: '123', isFirstLogin: false, canManageUsers: true },
  { id: 'usr1', hrmCode: 'VNPT001', fullName: 'Nguyễn Văn A', title: Role.MANAGER, unitId: 'u2', username: 'anv', password: '123456', isFirstLogin: true, avatar: 'https://picsum.photos/40/40?random=1' },
  { id: 'usr2', hrmCode: 'VNPT002', fullName: 'Trần Thị B', title: Role.STAFF, unitId: 'u2', username: 'btt', password: '123456', isFirstLogin: true, avatar: 'https://picsum.photos/40/40?random=2' },
  { id: 'usr3', hrmCode: 'VNPT003', fullName: 'Lê Văn C', title: Role.DIRECTOR, unitId: 'u3', username: 'clv', password: '123456', isFirstLogin: true, avatar: 'https://picsum.photos/40/40?random=3' },
  { id: 'usr4', hrmCode: 'VNPT004', fullName: 'Phạm Thị D', title: Role.STAFF, unitId: 'u3', username: 'dpt', password: '123456', isFirstLogin: true, avatar: 'https://picsum.photos/40/40?random=4' },
  { id: 'usr5', hrmCode: 'VNPT005', fullName: 'Hoàng Văn E', title: Role.MANAGER, unitId: 'u4', username: 'ehv', password: '123456', isFirstLogin: true, avatar: 'https://picsum.photos/40/40?random=5', canManageUsers: true }, // Sub-admin example
];

const initialTasks: Task[] = [
  {
    id: 't1',
    name: 'Triển khai hạ tầng khu đô thị X',
    content: 'Khảo sát và lắp đặt tủ cáp quang',
    type: 'Project',
    projectId: 'PRJ-001',
    assignerId: 'usr1',
    primaryAssigneeIds: ['usr2'],
    supportAssigneeIds: ['usr4'],
    deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: TaskStatus.IN_PROGRESS,
    progress: 45,
    priority: TaskPriority.HIGH,
    createdAt: new Date().toISOString(),
  },
  {
    id: 't2',
    name: 'Báo cáo doanh thu tháng 10',
    content: 'Tổng hợp số liệu từ các đơn vị',
    type: 'Single',
    assignerId: 'usr3',
    primaryAssigneeIds: ['usr4'],
    supportAssigneeIds: [],
    deadline: new Date(Date.now() - 86400000).toISOString(),
    status: TaskStatus.OVERDUE,
    progress: 80,
    priority: TaskPriority.MEDIUM,
    createdAt: new Date().toISOString(),
  },
];

// Helper to load/save from localStorage
export const loadData = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initial;
};

export const saveData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const mockUnits = initialUnits;
export const mockUsers = initialUsers;
export const mockTasks = initialTasks;
