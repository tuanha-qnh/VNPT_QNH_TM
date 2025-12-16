
export const SQL_SETUP_SCRIPT = `
-- 1. Bật Extension UUID để tự sinh ID
create extension if not exists "uuid-ossp";

-- 2. Tạo bảng Đơn vị (units)
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

-- 3. Tạo bảng Nhân sự (users)
create table if not exists users (
  id uuid default uuid_generate_v4() primary key,
  hrm_code text,
  full_name text,
  email text,
  username text unique,
  password text,
  title text,
  unit_id uuid references units(id),
  is_first_login boolean default true,
  can_manage boolean default false,
  avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Tạo bảng Công việc (tasks)
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
  ext_request jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Cấp quyền truy cập (RLS)
alter table units enable row level security;
create policy "Allow All Units" on units for all using (true) with check (true);

alter table users enable row level security;
create policy "Allow All Users" on users for all using (true) with check (true);

alter table tasks enable row level security;
create policy "Allow All Tasks" on tasks for all using (true) with check (true);

-- 6. KHỞI TẠO DỮ LIỆU MẶC ĐỊNH (SEEDING)
DO $$
DECLARE
  rootId uuid;
BEGIN
  -- Tạo Unit gốc nếu chưa có
  IF NOT EXISTS (SELECT 1 FROM units WHERE code = 'VNPT_QN') THEN
    INSERT INTO units (code, name, level) VALUES ('VNPT_QN', 'VNPT Quảng Ninh (Gốc)', 0) RETURNING id INTO rootId;
  ELSE
    SELECT id INTO rootId FROM units WHERE code = 'VNPT_QN';
  END IF;

  -- Tạo User Admin nếu chưa có
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO users (hrm_code, full_name, email, username, password, title, unit_id, can_manage, is_first_login)
    VALUES ('ADMIN', 'Quản Trị Viên', 'admin@vnpt.vn', 'admin', '123', 'Giám đốc', rootId, true, false);
  END IF;
END $$;
`;
