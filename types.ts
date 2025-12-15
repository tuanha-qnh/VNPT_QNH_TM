export enum Role {
  ADMIN = 'Quản trị viên (Admin)',
  SUB_ADMIN = 'Quản trị đơn vị (Sub-Admin)',
  DIRECTOR = 'Giám đốc',
  VICE_DIRECTOR = 'Phó Giám đốc',
  MANAGER = 'Trưởng phòng',
  VICE_MANAGER = 'Phó phòng',
  STAFF = 'Nhân viên'
}

export interface Unit {
  id: string;
  parentId: string | null; // For tree structure
  name: string;
  managerIds: string[]; 
  address?: string;
  phone?: string;
  level: number; // 0 for root, 1 for child, etc.
}

export interface User {
  id: string;
  hrmCode: string;
  fullName: string;
  title: Role | string;
  unitId: string;
  username: string;
  password?: string; 
  isFirstLogin: boolean; // Force password change
  avatar?: string;
  canManageUsers?: boolean; // Sub-admin permission
}

export enum TaskStatus {
  PENDING = 'Chưa thực hiện',
  IN_PROGRESS = 'Đang thực hiện',
  COMPLETED = 'Đã hoàn thành',
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

export interface Task {
  id: string;
  name: string;
  content: string;
  type: 'Single' | 'Project';
  projectId?: string;
  assignerId: string; // Creates the task
  primaryAssigneeIds: string[]; // Multi-select
  supportAssigneeIds: string[]; // Multi-select
  deadline: string;
  status: TaskStatus;
  progress: number;
  priority: TaskPriority;
  note?: string;
  createdAt: string;
  extensionRequest?: ExtensionRequest;
}

export interface KPIData {
  hrmCode: string;
  fullName: string;
  unitId: string;
  targets: {
    [key: string]: {
      target: number;
      actual: number;
    }
  }
}

// KPI Keys map to readable names
export const KPI_KEYS = {
  fiber: "Phát triển thuê bao FiberVNN",
  mytv: "Phát triển thuê bao MyTV",
  mesh: "Phát triển thiết bị Mesh",
  camera: "Phát triển thiết bị Camera",
  mobile_ptm: "Thuê bao Di động PTM",
  mobile_rev: "Doanh thu di động PTM",
  channel_dbl: "Kênh ĐBL",
  channel_duq: "Kênh ĐUQ",
  channel_gara: "Kênh Gara ô tô",
  channel_ctv: "CTV liên kết"
};

export type KPIKey = keyof typeof KPI_KEYS;
