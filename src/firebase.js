import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCF-KKaQYvkwd4kNv5lrj4XEmi-ALRlIZY",
    authDomain: "weekly-report-23d39.firebaseapp.com",
    projectId: "weekly-report-23d39",
    storageBucket: "weekly-report-23d39.firebasestorage.app",
    messagingSenderId: "20651391300",
    appId: "1:20651391300:web:3ff01f1a28237558bdbf11",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
