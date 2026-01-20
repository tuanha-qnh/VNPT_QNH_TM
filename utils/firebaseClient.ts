
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
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
        const localData = JSON.parse(localStorage.getItem(`vnpt_db_${colName}`) || '[]');
        const newItem = { ...data, id };
        const idx = localData.findIndex((i: any) => i.id === id);
        
        if (idx >= 0) localData[idx] = newItem;
        else localData.push(newItem);
        
        localStorage.setItem(`vnpt_db_${colName}`, JSON.stringify(localData));

        if (db) {
            try {
                // Với Firebase NoSQL, ta lưu thẳng Object, không cần quan tâm snake_case hay camelCase
                await setDoc(doc(db, colName, id), data, { merge: true });
                return true;
            } catch (e) {
                console.error("Firebase Sync Error:", e);
                throw e;
            }
        }
        return true;
    },

    async update(colName: string, id: string, data: any) {
        // Hàm cập nhật từng phần (partial update)
        if (db) {
            try {
                await updateDoc(doc(db, colName, id), data);
                // Sau đó cập nhật lại local cache
                await this.getAll(colName);
                return true;
            } catch (e) {
                console.error("Firebase Update Error:", e);
                throw e;
            }
        }
    },

    async delete(colName: string, id: string) {
        const localData = JSON.parse(localStorage.getItem(`vnpt_db_${colName}`) || '[]');
        const filtered = localData.filter((i: any) => i.id !== id);
        localStorage.setItem(`vnpt_db_${colName}`, JSON.stringify(filtered));

        if (db) {
            try {
                await deleteDoc(doc(db, colName, id));
                return true;
            } catch (e) {
                console.error("Firebase Delete Error:", e);
                throw e;
            }
        }
        return true;
    }
};
