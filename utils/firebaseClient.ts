
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

// ĐÂY LÀ CONFIG MẪU. 
// Bạn hãy tạo 1 Project tại: https://console.firebase.google.com/
// Sau đó Copy cấu hình của bạn vào đây. 
// Firestore có gói MIỄN PHÍ VĨNH VIỄN (Spark Plan) rất tốt cho dự án này.
const firebaseConfig = {
  apiKey: "AIzaSyAs-Fake-Key-For-Setup",
  authDomain: "vnpt-qn-task.firebaseapp.com",
  projectId: "vnpt-qn-task",
  storageBucket: "vnpt-qn-task.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Các helper function để thao tác dữ liệu giống như một Database thực thụ
export const dbClient = {
    async getAll(colName: string) {
        try {
            const querySnapshot = await getDocs(collection(db, colName));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn(`Lỗi Firebase (${colName}), sử dụng LocalStorage làm fallback`);
            const local = localStorage.getItem(`db_${colName}`);
            return local ? JSON.parse(local) : [];
        }
    },
    async upsert(colName: string, id: string, data: any) {
        try {
            await setDoc(doc(db, colName, id), data, { merge: true });
        } catch (e) {
            console.error("Lỗi lưu Firebase:", e);
        }
        // Luôn lưu một bản vào LocalStorage để tránh lỗi màn hình trắng
        const local = await this.getAll(colName);
        const index = local.findIndex((item: any) => item.id === id);
        if (index >= 0) local[index] = { ...local[index], ...data, id };
        else local.push({ ...data, id });
        localStorage.setItem(`db_${colName}`, JSON.stringify(local));
    },
    async delete(colName: string, id: string) {
        try {
            await deleteDoc(doc(db, colName, id));
        } catch (e) { console.error(e); }
        const local = await this.getAll(colName);
        localStorage.setItem(`db_${colName}`, JSON.stringify(local.filter((i: any) => i.id !== id)));
    }
};
