
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
        // Loại bỏ các key camelCase có thể gây lỗi schema cache nếu lỡ tay truyền vào
        const cleanData: any = {};
        Object.entries(data).forEach(([key, value]) => {
            // Chỉ giữ lại các key có dấu gạch dưới (snake_case) hoặc các key id, email, username...
            if (!/[A-Z]/.test(key)) {
                cleanData[key] = value;
            }
        });
        
        const { error } = await supabase.from(table).upsert({ ...cleanData, id }, { onConflict: 'id' });
        if (error) throw error;
        return true;
    },
    async delete(table: string, id: string) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};
