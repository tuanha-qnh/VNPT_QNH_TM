
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

// ĐÂY LÀ CONFIG MẪU. 
// Bạn hãy tạo 1 Project tại: https://console.firebase.google.com/
// Sau đó Copy cấu hình của bạn vào đây. 
// Firestore có gói MIỄN PHÍ VĨNH VIỄN (Spark Plan) rất tốt cho dự án này.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdNg-BYCKVyIXmwJVpKAVhJuK4RrMrDG8",
  authDomain: "dhkd-task-manager.firebaseapp.com",
  projectId: "dhkd-task-manager",
  storageBucket: "dhkd-task-manager.firebasestorage.app",
  messagingSenderId: "1068491178770",
  appId: "1:1068491178770:web:1327d65223772d5e9ce9cb",
  measurementId: "G-F0X5S2NXS7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

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
