
export const SQL_SETUP_SCRIPT = `
-- 0. KHẮC PHỤC LỖI CẤU TRÚC (QUAN TRỌNG)
-- Xóa ràng buộc Unique trên cột password nếu lỡ bị tạo nhầm
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_key;
DROP INDEX IF EXISTS users_password_key;

-- 1. XÓA SẠCH DỮ LIỆU CŨ (RESET HOÀN TOÀN)
TRUNCATE TABLE tasks, users, units RESTART IDENTITY CASCADE;

-- 2. Bật Extension UUID
create extension if not exists "uuid-ossp";

-- 3. Tạo bảng (Nếu chưa có)
create table if not exists units (
  id uuid default uuid_generate_v4() primary key,
  code text not null,
  name text not null,
  parent_id uuid, 
  manager_ids text[] default '{}',
  address text,
  phone text,
  level int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists users (
  id uuid default uuid_generate_v4() primary key,
  hrm_code text,
  full_name text,
  email text,
  username text unique,
  password text, -- Cột này KHÔNG ĐƯỢC để unique
  title text,
  unit_id uuid references units(id),
  is_first_login boolean default true,
  can_manage boolean default false,
  avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  name text,
  content text,
  type text,
  status text,
  priority text,
  progress int default 0,
  deadline timestamp with time zone,
  assigner_id uuid references users(id),
  primary_ids text[] default '{}',
  support_ids text[] default '{}',
  project_id text,
  ext_request jsonb, -- Chứa thông tin xin gia hạn {date, reason, status}
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Cấp quyền truy cập (RLS - Cho phép tất cả để đơn giản hóa demo)
alter table units enable row level security;
drop policy if exists "Allow All Units" on units;
create policy "Allow All Units" on units for all using (true) with check (true);

alter table users enable row level security;
drop policy if exists "Allow All Users" on users;
create policy "Allow All Users" on users for all using (true) with check (true);

alter table tasks enable row level security;
drop policy if exists "Allow All Tasks" on tasks;
create policy "Allow All Tasks" on tasks for all using (true) with check (true);

-- 5. KHỞI TẠO DỮ LIỆU: CHỈ TẠO 1 ĐƠN VỊ GỐC VÀ 1 ADMIN
DO $$
DECLARE
  rootId uuid;
BEGIN
  -- Tạo Unit Gốc VNPT Quảng Ninh
  INSERT INTO units (code, name, level, address) 
  VALUES ('VNPT_QN', 'VNPT Quảng Ninh', 0, '20 Lê Thánh Tông') 
  RETURNING id INTO rootId;

  -- Tạo User Admin (Mật khẩu 123 -> MD5: 202cb962ac59075b964b07152d234b70)
  INSERT INTO users (hrm_code, full_name, email, username, password, title, unit_id, can_manage, is_first_login)
  VALUES ('ADMIN', 'Quản Trị Viên (System)', 'admin@vnpt.vn', 'admin', '202cb962ac59075b964b07152d234b70', 'Giám đốc', rootId, true, false);
END $$;
`;
