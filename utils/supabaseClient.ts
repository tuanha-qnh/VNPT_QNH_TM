
import { createClient } from '@supabase/supabase-js';

// Đã cập nhật thông tin thật từ yêu cầu của bạn
const supabaseUrl = 'https://cxqyxylgwmepnswwhprn.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXl4eWxnd21lcG5zd3docHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTEzODYsImV4cCI6MjA4MTM4NzM4Nn0.EqaULnMXqR1vraQX_qpJab1B4aTengXAYNUN0cHUiU4';

export const supabase = createClient(supabaseUrl, supabaseKey);
