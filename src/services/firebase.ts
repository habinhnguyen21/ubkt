import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
  type Auth,
} from 'firebase/auth';
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

/**
 * Đợi Firebase Auth hoàn tất khôi phục trạng thái xác thực từ bộ nhớ trình duyệt (IndexedDB / localStorage).
 * Tránh lỗi auth.currentUser bị null khi mới tải trang hoặc ngay sau khi đăng nhập trên mobile (Safari / Chrome).
 */
export async function ensureFirebaseAuthReady(timeoutMs = 4000): Promise<import('firebase/auth').User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await Promise.race([
        (auth as any).authStateReady(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
      if (auth.currentUser) return auth.currentUser;
    } catch (err) {
      console.warn('[Firebase Auth] Lỗi chờ authStateReady:', err);
    }
  }
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsub();
        resolve(auth.currentUser || null);
      }
    }, timeoutMs);
    const unsub = auth.onAuthStateChanged((user) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      }
    });
  });
}
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
  const secAuth = getAuth(secondaryApp);
  if (typeof window !== 'undefined') {
    setPersistence(secAuth, inMemoryPersistence).catch(() => {});
  }
  return secAuth;
}

/**
 * Khởi tạo Firebase Auth instance phụ tạm thời để tạo hoặc liên kết tài khoản Firebase Auth
 * cho nhân viên / cán bộ mà KHÔNG làm thay đổi hoặc đăng xuất phiên Admin hiện tại.
 */
export async function provisionFirebaseUserForStaff(
  username: string,
  password: string
): Promise<{ uid: string; email: string }> {
  const normalizedU = String(username || '').trim().toLowerCase();
  if (!normalizedU) {
    throw new Error('Tên đăng nhập không hợp lệ');
  }
  const internalEmail = usernameToAuthEmail(normalizedU);

  const tempAppName = `SecondaryProvisioner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, tempAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    if (typeof window !== 'undefined') {
      await setPersistence(secondaryAuth, inMemoryPersistence).catch(() => {});
    }

    let uid = '';
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, password);
      uid = cred.user.uid;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        // Tài khoản đã tồn tại trên Firebase Auth từ trước -> Thử đăng nhập bằng mật khẩu để lấy lại UID
        try {
          const signCred = await signInWithEmailAndPassword(secondaryAuth, internalEmail, password);
          uid = signCred.user.uid;
        } catch {
          // Thử nếu mật khẩu mẫu hoặc mặc định khớp để cập nhật mật khẩu mới
          try {
            const fallbackCred = await signInWithEmailAndPassword(secondaryAuth, internalEmail, 'Ubkt@2026!');
            uid = fallbackCred.user.uid;
            await updatePassword(fallbackCred.user, password).catch(() => {});
          } catch {
            throw new Error(
              `Tài khoản @${normalizedU} (${internalEmail}) đã tồn tại trên Firebase Auth nhưng không khớp mật khẩu. Vui lòng sử dụng tính năng "Đặt lại mật khẩu" hoặc "Đồng bộ UID".`
            );
          }
        }
      } else {
        throw new Error(err?.message || `Lỗi khi khởi tạo Firebase Authentication cho @${normalizedU}`);
      }
    }

    if (!uid) {
      throw new Error(`Không thể cấp Firebase UID cho tài khoản @${normalizedU}`);
    }

    return { uid, email: internalEmail };
  } finally {
    try {
      await signOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});
    } catch {}
  }
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
