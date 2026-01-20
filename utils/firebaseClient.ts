
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

/**
 * HƯỚNG DẪN DÁN CẤU HÌNH:
 * 1. Mở Firebase Console -> Project Settings.
 * 2. Copy đoạn firebaseConfig của bạn và thay thế toàn bộ object bên dưới.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAs-VUI-LONG-THAY-KEY-THAT-CUA-BAN",
  authDomain: "vnpt-qn-task.firebaseapp.com",
  projectId: "vnpt-qn-task",
  storageBucket: "vnpt-qn-task.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const dbClient = {
    // Lấy toàn bộ dữ liệu từ một bảng (collection)
    async getAll(colName: string) {
        try {
            // Kiểm tra xem đã thay config chưa
            if (firebaseConfig.apiKey.includes("VUI-LONG-THAY")) {
                throw new Error("Chưa cấu hình Firebase");
            }
            const querySnapshot = await getDocs(collection(db, colName));
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Backup vào LocalStorage đề phòng mất mạng
            localStorage.setItem(`backup_${colName}`, JSON.stringify(data));
            return data;
        } catch (e) {
            console.warn(`Sử dụng dữ liệu dự phòng cho ${colName}`);
            const local = localStorage.getItem(`backup_${colName}`);
            return local ? JSON.parse(local) : [];
        }
    },

    // Lưu hoặc Cập nhật một bản ghi
    async upsert(colName: string, id: string, data: any) {
        try {
            const docRef = doc(db, colName, id);
            await setDoc(docRef, data, { merge: true });
        } catch (e) {
            console.error("Lỗi lưu Firebase:", e);
            // Fallback lưu tạm vào LocalStorage nếu Firebase lỗi
            const local = JSON.parse(localStorage.getItem(`backup_${colName}`) || '[]');
            const idx = local.findIndex((i: any) => i.id === id);
            if (idx >= 0) local[idx] = { ...local[idx], ...data, id };
            else local.push({ ...data, id });
            localStorage.setItem(`backup_${colName}`, JSON.stringify(local));
        }
    },

    // Xóa một bản ghi
    async delete(colName: string, id: string) {
        try {
            await deleteDoc(doc(db, colName, id));
        } catch (e) {
            console.error(e);
        }
    }
};
