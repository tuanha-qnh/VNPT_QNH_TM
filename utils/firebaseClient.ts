
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Cấu hình Firebase thật từ người dùng
const firebaseConfig = {
  apiKey: "AIzaSyCcHAEparoAlnn47JWGB0cXYD_opdfd5XE",
  authDomain: "task-manager-99a19.firebaseapp.com",
  projectId: "task-manager-99a19",
  storageBucket: "task-manager-99a19.firebasestorage.app",
  messagingSenderId: "223177187508",
  appId: "1:223177187508:web:5617a47052c9e295e0b7e1",
  measurementId: "G-5QHXWXKGWG"
};

// Khởi tạo Firebase
let db: any = null;
let analytics: any = null;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    // Analytics chỉ chạy trong môi trường trình duyệt
    if (typeof window !== 'undefined') {
        analytics = getAnalytics(app);
    }
} catch (e) {
    console.warn("Firebase initialization failed, using LocalStorage mode.");
}

export const dbClient = {
    async getAll(colName: string) {
        try {
            if (db) {
                const querySnapshot = await getDocs(collection(db, colName));
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Lưu cache vào LocalStorage để hỗ trợ offline
                localStorage.setItem(`vnpt_db_${colName}`, JSON.stringify(data));
                return data;
            }
        } catch (e) {
            console.warn(`Firebase error for ${colName}, falling back to local storage.`);
        }
        const local = localStorage.getItem(`vnpt_db_${colName}`);
        return local ? JSON.parse(local) : [];
    },

    async upsert(colName: string, id: string, data: any) {
        // Cập nhật LocalStorage ngay lập tức để UI phản hồi nhanh
        const localData = JSON.parse(localStorage.getItem(`vnpt_db_${colName}`) || '[]');
        const newItem = { ...data, id };
        const idx = localData.findIndex((i: any) => i.id === id);
        
        if (idx >= 0) localData[idx] = newItem;
        else localData.push(newItem);
        
        localStorage.setItem(`vnpt_db_${colName}`, JSON.stringify(localData));

        // Sau đó đẩy dữ liệu lên Cloud Firestore
        if (db) {
            try {
                await setDoc(doc(db, colName, id), data, { merge: true });
            } catch (e) {
                console.error("Firebase Sync Error:", e);
            }
        }
    },

    async delete(colName: string, id: string) {
        // Xóa tại Local
        const localData = JSON.parse(localStorage.getItem(`vnpt_db_${colName}`) || '[]');
        const filtered = localData.filter((i: any) => i.id !== id);
        localStorage.setItem(`vnpt_db_${colName}`, JSON.stringify(filtered));

        // Xóa trên Cloud
        if (db) {
            try {
                await deleteDoc(doc(db, colName, id));
            } catch (e) {
                console.error("Firebase Delete Error:", e);
            }
        }
    }
};
