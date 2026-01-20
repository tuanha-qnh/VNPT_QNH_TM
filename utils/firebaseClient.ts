
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAs-DEMO-KEY-ONLY",
  authDomain: "vnpt-qn-task.firebaseapp.com",
  projectId: "vnpt-qn-task",
  storageBucket: "vnpt-qn-task.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Chỉ khởi tạo Firebase nếu API Key hợp lệ
let db: any = null;
try {
    if (!firebaseConfig.apiKey.includes("VUI-LONG-THAY") && !firebaseConfig.apiKey.includes("DEMO-KEY")) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
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
                await setDoc(doc(db, colName, id), data, { merge: true });
            } catch (e) {
                console.error("Firebase Sync Error:", e);
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
            } catch (e) {
                console.error("Firebase Delete Error:", e);
            }
        }
    }
};
