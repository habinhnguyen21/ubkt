import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Cấu hình Firebase Web App của dự án UBKT
export const firebaseConfig = {
  apiKey: "AIzaSyAh78sfl7JkHiywbPZrU-NQBQuiwXEm70o",
  authDomain: "ubkt-bf611.firebaseapp.com",
  projectId: "ubkt-bf611",
  storageBucket: "ubkt-bf611.firebasestorage.app",
  messagingSenderId: "210498839763",
  appId: "1:210498839763:web:dfe0b5eda7a32398dea026",
  measurementId: "G-FD6B0DCJJW"
};

// Khởi tạo Firebase App (Tránh khởi tạo nhiều lần)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Khởi tạo các dịch vụ chính
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics (Chỉ kích hoạt trên trình duyệt hỗ trợ)
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.warn('Firebase Analytics not supported in this environment:', err);
  });
}

export default app;
