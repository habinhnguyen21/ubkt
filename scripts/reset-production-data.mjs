import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: "AIzaSyAh78sfl7JkHiywbPZrU-NQBQuiwXEm70o",
  authDomain: "ubkt-bf611.firebaseapp.com",
  projectId: "ubkt-bf611",
  storageBucket: "ubkt-bf611.firebasestorage.app",
  messagingSenderId: "210498839763",
  appId: "1:210498839763:web:dfe0b5eda7a32398dea026",
  measurementId: "G-FD6B0DCJJW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const now = new Date().toISOString();

const cleanData = {
  users: [
    {
      id: "01918a00-0000-7000-8000-000000000000",
      ten_dang_nhap: "admin",
      mat_khau: "Admin@123456",
      ho_ten: "Quản trị viên Hệ thống",
      vai_tro: "ADMIN",
      chuc_danh: "Chủ nhiệm UBKT",
      trang_thai: 1,
      must_change_password: false,
      created_at: now,
      updated_at: now
    }
  ],
  donViList: [
    {
      id: "01918a00-0000-7000-8000-000000000001",
      ten: "Đảng ủy cơ sở",
      loai: "DANG_BO",
      don_vi_cha_id: null,
      ma: "DU-01",
      thu_tu: 1,
      ghi_chu: "Cơ quan lãnh đạo cao nhất của Đảng bộ cơ sở (Bấm chỉnh sửa để đổi tên theo đúng cơ quan thực tế)",
      version: 1,
      sync_status: "synced",
      created_at: now,
      updated_at: now,
      deleted_at: null
    }
  ],
  chuongTrinhList: [],
  donThuList: [],
  auditLogs: [
    {
      id: "log-init",
      nguoi_dung_id: "01918a00-0000-7000-8000-000000000000",
      ten_nguoi_dung: "Quản trị viên",
      hanh_dong: "Khởi tạo hệ thống dữ liệu chính thức",
      bang_anh_huong: "system",
      ban_ghi_id: "init",
      du_lieu_cu: null,
      du_lieu_moi: null,
      thoi_gian: now
    }
  ],
  pdfFiles: []
};

async function resetAll() {
  console.log('🧹 1. Làm sạch file database cục bộ server/data/database.json...');
  const dbPath = path.resolve(__dirname, '../server/data/database.json');
  fs.writeFileSync(dbPath, JSON.stringify(cleanData, null, 2), 'utf-8');
  console.log('   ✓ Đã ghi lại database.json sạch sẽ (chỉ giữ admin và tổ chức gốc).');

  console.log('🧹 2. Làm sạch Firebase Firestore...');
  const collections = ['chuong_trinh', 'don_thu', 'don_vi', 'users', 'audit_logs', 'pdf_files'];
  for (const colName of collections) {
    const snap = await getDocs(collection(db, colName));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
    console.log(`   ✓ Đã xóa sạch dữ liệu cũ trong collection '${colName}'.`);
  }

  console.log('🌱 3. Nạp tài khoản admin và đơn vị gốc vào Firestore...');
  await setDoc(doc(db, 'users', cleanData.users[0].id), cleanData.users[0]);
  await setDoc(doc(db, 'don_vi', cleanData.donViList[0].id), cleanData.donViList[0]);
  await setDoc(doc(db, 'audit_logs', cleanData.auditLogs[0].id), cleanData.auditLogs[0]);
  await setDoc(doc(db, 'system', 'meta'), {
    last_synced: now,
    status: 'PRODUCTION_READY',
    total_users: 1,
    total_units: 1,
    total_programs: 0,
    total_complaints: 0
  });

  console.log('🎉 TOÀN BỘ DỮ LIỆU CHẠY THỬ ĐÃ ĐƯỢC XÓA SẠCH! HỆ THỐNG SẴN SÀNG CHẠY CHÍNH THỨC.');
}

resetAll().catch(console.error);
