import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

// Cấu hình Firebase Web App của dự án UBKT (ưu tiên biến môi trường VITE_FIREBASE_*)
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAh78sfl7JkHiywbPZrU-NQBQuiwXEm70o",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "ubkt-bf611.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "ubkt-bf611",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "ubkt-bf611.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "210498839763",
  appId: env.VITE_FIREBASE_APP_ID || "1:210498839763:web:dfe0b5eda7a32398dea026",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-FD6B0DCJJW",
};

export const AUTH_EMAIL_DOMAIN = 'ubkt.local';

/**
 * Ánh xạ tên đăng nhập (ví dụ: 'admin', 'nguyenvana') sang địa chỉ email chuẩn của Firebase Auth
 * dạng '<tendangnhap>@ubkt.local'. Nếu đã là email có '@' thì giữ nguyên.
 */
export function usernameToAuthEmail(tenDangNhap: string): string {
  const cleaned = String(tenDangNhap || '')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  if (cleaned.includes('@')) return cleaned;
  return `${cleaned}@${AUTH_EMAIL_DOMAIN}`;
}

// Khởi tạo Firebase App chính (Tránh khởi tạo nhiều lần)
export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Khởi tạo các dịch vụ chính
export const auth: Auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions: Functions = getFunctions(app, 'asia-southeast1');

/**
 * Cờ cấu hình cho biết dự án đã nâng cấp lên gói Blaze và triển khai Cloud Functions hay chưa.
 * Mặc định false vì dự án hiện đang chạy trên gói Spark (miễn phí).
 */
export const IS_CLOUD_FUNCTIONS_ENABLED = env.VITE_USE_CLOUD_FUNCTIONS === 'true';

/**
 * Khởi tạo Secondary Firebase Auth instance dành riêng cho ADMIN khi tạo tài khoản mới
 * để không làm đăng xuất phiên làm việc hiện tại của ADMIN trên trình duyệt.
 */
const SECONDARY_APP_NAME = 'SecondaryAdminAuthApp';
export function getSecondaryAuth(): Auth {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existing || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(secondaryApp);
}

// Analytics (Chỉ kích hoạt trên trình duyệt hỗ trợ)
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((err) => {
      console.warn('Firebase Analytics not supported in this environment:', err);
    });
}

export default app;
