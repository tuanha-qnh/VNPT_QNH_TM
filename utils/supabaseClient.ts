
import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN LẤY THÔNG TIN NÀY ---
// 1. Vào supabase.com -> Chọn Project của bạn
// 2. Vào Settings (Bánh răng) -> API
// 3. Copy "Project URL" dán vào biến supabaseUrl bên dưới
// 4. Copy "anon public" key dán vào biến supabaseKey bên dưới

const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co'; 
const supabaseKey = 'YOUR_ANON_PUBLIC_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
