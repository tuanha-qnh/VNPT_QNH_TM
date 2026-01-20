
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxqyxylgwmepnswwhprn.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXl4eWxnd21lcG5zd3docHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTEzODYsImV4cCI6MjA4MTM4NzM4Nn0.EqaULnMXqR1vraQX_qpJab1B4aTengXAYNUN0cHUiU4';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Bộ Client chung để thay thế dbClient (Firebase cũ)
export const dbClient = {
    async getAll(table: string) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return data || [];
    },
    async upsert(table: string, id: string, data: any) {
        // Chuyển đổi CamelCase sang snake_case trước khi lưu nếu cần (hoặc dùng data trực tiếp)
        const { error } = await supabase.from(table).upsert({ ...data, id }, { onConflict: 'id' });
        if (error) throw error;
        return true;
    },
    async delete(table: string, id: string) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};
