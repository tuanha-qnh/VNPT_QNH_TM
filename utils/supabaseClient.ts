
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxqyxylgwmepnswwhprn.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXl4eWxnd21lcG5zd3docHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTEzODYsImV4cCI6MjA4MTM4NzM4Nn0.EqaULnMXqR1vraQX_qpJab1B4aTengXAYNUN0cHUiU4';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const dbClient = {
    async getAll(table: string) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return data || [];
    },
    async upsert(table: string, id: string, data: any) {
        // Chỉ giữ lại các trường hợp lệ theo chuẩn snake_case của Postgres
        const cleanData: any = {};
        const validColumns: Record<string, string[]> = {
            'units': ['id', 'code', 'name', 'parent_id', 'manager_ids', 'address', 'phone', 'level'],
            'users': ['id', 'hrm_code', 'full_name', 'email', 'username', 'password', 'title', 'unit_id', 'is_first_login', 'can_manage', 'avatar'],
            'tasks': ['id', 'name', 'content', 'type', 'status', 'priority', 'progress', 'deadline', 'assigner_id', 'primary_ids', 'support_ids', 'project_id', 'ext_request']
        };

        const allowed = validColumns[table] || [];
        
        Object.entries(data).forEach(([key, value]) => {
            // Mapping ngược nếu lỡ truyền camelCase
            let targetKey = key;
            if (key === 'hrmCode') targetKey = 'hrm_code';
            if (key === 'fullName') targetKey = 'full_name';
            if (key === 'unitId') targetKey = 'unit_id';
            if (key === 'isFirstLogin') targetKey = 'is_first_login';
            if (key === 'canManageUsers') targetKey = 'can_manage';
            
            if (allowed.includes(targetKey)) {
                cleanData[targetKey] = value === undefined ? null : value;
            }
        });
        
        const { error } = await supabase.from(table).upsert({ ...cleanData, id }, { onConflict: 'id' });
        if (error) {
            console.error(`Lỗi Upsert table ${table}:`, error);
            throw error;
        }
        return true;
    },
    async delete(table: string, id: string) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};
