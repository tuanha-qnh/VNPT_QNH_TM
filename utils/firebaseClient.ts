
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCcHAEparoAlnn47JWGB0cXYD_opdfd5XE",
  authDomain: "task-manager-99a19.firebaseapp.com",
  projectId: "task-manager-99a19",
  storageBucket: "task-manager-99a19.firebasestorage.app",
  messagingSenderId: "223177187508",
  appId: "1:223177187508:web:5617a47052c9e295e0b7e1",
  measurementId: "G-5QHXWXKGWG"
};

let db: any = null;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase init failed");
}

export const dbClient = {
    async getAll(colName: string) {
        if (!db) return [];
        const querySnapshot = await getDocs(collection(db, colName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getByFilter(colName: string, field: string, value: any) {
        if (!db) return [];
        const q = query(collection(db, colName), where(field, "==", value));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async upsert(colName: string, id: string, data: any) {
        if (!db) return;
        await setDoc(doc(db, colName, id), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    },

    async update(colName: string, id: string, data: any) {
        if (!db) return;
        await updateDoc(doc(db, colName, id), data);
    },

    async delete(colName: string, id: string) {
        if (!db) return;
        await deleteDoc(doc(db, colName, id));
    }
};
