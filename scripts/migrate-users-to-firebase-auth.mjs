/**
 * Script chuyển đổi (di trú) người dùng hiện có từ Firestore / Local DB sang Firebase Authentication
 * (<tendangnhap>@ubkt.local) và cập nhật lại khóa phân công địa bàn sang UID mới của Firebase Auth.
 *
 * Cách chạy:
 *   MIGRATE_INIT_PASSWORD="<MatKhauKhoiTaoManh>" node scripts/migrate-users-to-firebase-auth.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyAh78sfl7JkHiywbPZrU-NQBQuiwXEm70o",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "ubkt-bf611.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "ubkt-bf611",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "ubkt-bf611.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "210498839763",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:210498839763:web:dfe0b5eda7a32398dea026",
};

const INIT_PASSWORD = process.env.MIGRATE_INIT_PASSWORD;
if (!INIT_PASSWORD || INIT_PASSWORD.length < 8) {
  console.error(
    '❌ Vui lòng cung cấp biến môi trường MIGRATE_INIT_PASSWORD (tối thiểu 8 ký tự, có chữ hoa, chữ thường, số) để đặt mật khẩu khởi tạo khi di trú sang Firebase Auth.'
  );
  process.exit(1);
}

function usernameToAuthEmail(tenDangNhap) {
  const cleaned = String(tenDangNhap || '').trim().toLowerCase();
  if (cleaned.includes('@')) return cleaned;
  return `${cleaned}@ubkt.local`;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function migrateUsers() {
  console.log('🔄 Đang tải danh sách users và phan_cong_dia_ban từ Firestore...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const phanCongSnap = await getDocs(collection(db, 'phan_cong_dia_ban'));

  const phanCongList = phanCongSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  const now = new Date().toISOString();

  for (const userDoc of usersSnap.docs) {
    const raw = userDoc.data();
    const oldId = userDoc.id;
    const username = String(raw.ten_dang_nhap || '').trim().toLowerCase();
    if (!username) continue;

    const email = usernameToAuthEmail(username);
    let uid = null;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, INIT_PASSWORD);
      uid = cred.user.uid;
      console.log(`✅ Đã tạo tài khoản Firebase Auth mới cho "${username}" (${email}) -> UID: ${uid}`);
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const signCred = await signInWithEmailAndPassword(auth, email, INIT_PASSWORD);
          uid = signCred.user.uid;
          console.log(`ℹ️ Tài khoản "${username}" (${email}) đã tồn tại trên Firebase Auth -> UID: ${uid}`);
        } catch {
          console.warn(
            `⚠️ Tài khoản "${username}" (${email}) đã tồn tại trên Firebase Auth với mật khẩu riêng. Bỏ qua bước tạo lại.`
          );
        }
      } else {
        console.error(`❌ Lỗi tạo Firebase Auth cho "${username}":`, err.message || err);
      }
    }

    if (uid) {
      const cleanProfile = {
        id: uid,
        ten_dang_nhap: raw.ten_dang_nhap,
        email,
        ho_ten: raw.ho_ten || username,
        vai_tro: raw.vai_tro || (username === 'admin' ? 'ADMIN' : 'BIEN_TAP'),
        chuc_danh: raw.chuc_danh || 'Chuyên viên UBKT',
        trang_thai: raw.trang_thai ?? 1,
        must_change_password: true,
        created_at: raw.created_at || now,
        updated_at: now,
      };

      await setDoc(doc(db, 'users', uid), cleanProfile);

      // Chuyển phân công địa bàn sang UID mới
      for (const pc of phanCongList) {
        if (pc.user_id === oldId || pc._docId === oldId) {
          const { _docId, ...pcClean } = pc;
          await setDoc(doc(db, 'phan_cong_dia_ban', uid), {
            ...pcClean,
            id: uid,
            user_id: uid,
            updated_at: now,
          });
          if (pc._docId !== uid) {
            await deleteDoc(doc(db, 'phan_cong_dia_ban', pc._docId)).catch(() => {});
          }
          console.log(`   ↳ Đã chuyển phân công địa bàn của "${username}" từ ${oldId} -> ${uid}`);
        }
      }

      if (oldId !== uid) {
        await deleteDoc(doc(db, 'users', oldId)).catch(() => {});
        console.log(`   ↳ Đã xóa bản ghi cũ users/${oldId} (chứa mật khẩu cũ)`);
      }
    }

    await signOut(auth).catch(() => {});
  }

  console.log('🎉 Hoàn tất chuyển đổi người dùng sang Firebase Authentication!');
}

migrateUsers().catch((err) => {
  console.error('❌ Lỗi di trú:', err);
  process.exit(1);
});

