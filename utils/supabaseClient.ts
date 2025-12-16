
import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN LẤY THÔNG TIN NÀY ---
// 1. Vào supabase.com -> Chọn Project của bạn
// 2. Vào Settings (Bánh răng) -> API
// 3. Copy "Project URL" dán vào biến supabaseUrl bên dưới
// 4. Copy "anon public" key dán vào biến supabaseKey bên dưới

const supabaseUrl = 'https://cxqyxylgwmepnswwhprn.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXl4eWxnd21lcG5zd3docHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTEzODYsImV4cCI6MjA4MTM4NzM4Nn0.EqaULnMXqR1vraQX_qpJab1B4aTengXAYNUN0cHUiU4';

export const supabase = createClient(supabaseUrl, supabaseKey);
