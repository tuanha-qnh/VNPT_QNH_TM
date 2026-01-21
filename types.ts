
export enum Role {
  DIRECTOR = 'Giám đốc',
  VICE_DIRECTOR = 'Phó Giám đốc',
  MANAGER = 'Trưởng phòng',
  VICE_MANAGER = 'Phó phòng',
  SPECIALIST = 'Chuyên viên',
  STAFF = 'Nhân viên'
}

export interface Unit {
  id: string;
  code: string; 
  parentId: string | null; 
  name: string;
  level: number; 
  // Added properties to match mock data in utils/mockData.ts
  managerIds?: string[];
  address?: string;
  phone?: string;
}

export interface User {
  id: string;
  hrmCode: string;
  fullName: string;
  email: string;
  title: Role | string;
  unitId: string;
  username: string;
  password?: string; 
  isFirstLogin: boolean;
  avatar?: string;
  canManageUsers?: boolean; // Quyền SubAdmin
}

export enum TaskStatus {
  PENDING = 'Chưa thực hiện',
  IN_PROGRESS = 'Đang thực hiện',
  COMPLETED = 'Đã hoàn thành',
  NOT_PERFORMED = 'Không thực hiện',
  OVERDUE = 'Quá hạn',
  STUCK = 'Vướng mắc'
}

export enum TaskPriority {
  LOW = 'Thấp',
  MEDIUM = 'Trung bình',
  HIGH = 'Cao'
}

export interface ExtensionRequest {
  requestedDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
}

export interface TaskTimeline {
  date: string;
  comment: string;
  progress: number;
}

export interface Task {
  id: string;
  name: string;
  content: string;
  assignerId: string; 
  assignerName: string;
  dateAssigned: string; // ISO Date YYYY-MM-DD
  primaryAssigneeIds: string[]; 
  supportAssigneeIds: string[]; 
  deadline: string;
  status: TaskStatus;
  progress: number; // 0-100
  priority: TaskPriority;
  note?: string;
  difficulties?: string; // Báo cáo vướng mắc
  extensionRequest?: ExtensionRequest;
  timeline?: TaskTimeline[];
  // Added properties to match mock data in utils/mockData.ts
  type?: string;
  projectId?: string;
  createdAt?: string;
}

export const KPI_KEYS = {
  fiber: "Phát triển thuê bao FiberVNN",
  mytv: "Phát triển thuê bao MyTV",
  mesh: "Phát triển thiết bị Mesh",
  camera: "Phát triển thiết bị Camera",
  mobile_ptm: "Thuê bao Di động PTM",
  mobile_rev: "Doanh thu di động PTM",
  revenue: "Doanh thu dịch vụ VT-CNTT"
};

export type KPIKey = keyof typeof KPI_KEYS;

export interface KPIRecord {
  id: string;
  period: string; // YYYY-MM
  entityId: string; // hrmCode hoặc unitCode
  type: 'personal' | 'group';
  targets: {
    [key: string]: {
      target: number;
      actual: number;
    }
  };
}
