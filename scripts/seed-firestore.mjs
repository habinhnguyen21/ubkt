import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';
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

async function seed() {
  console.log('🚀 Đang đọc dữ liệu từ server/data/database.json...');
  const dbPath = path.resolve(__dirname, '../server/data/database.json');
  const rawData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  console.log('1. Đồng bộ người dùng (users)...');
  for (const user of rawData.users || []) {
    await setDoc(doc(db, 'users', user.id || user.ten_dang_nhap), user);
  }
  console.log(`   ✓ Đã đồng bộ ${rawData.users?.length || 0} người dùng.`);

  console.log('2. Đồng bộ danh mục tổ chức đơn vị (don_vi)...');
  for (const dv of rawData.donViList || []) {
    await setDoc(doc(db, 'don_vi', dv.id), dv);
  }
  console.log(`   ✓ Đã đồng bộ ${rawData.donViList?.length || 0} đơn vị tổ chức.`);

  console.log('3. Đồng bộ chương trình kiểm tra, giám sát (chuong_trinh)...');
  for (const ct of rawData.chuongTrinhList || []) {
    const cleanCt = { ...ct };
    // Nếu file_pdf_url là chuỗi base64 quá lớn (>500KB), bỏ base64 để không vượt giới hạn 1MB của Firestore
    if (cleanCt.file_pdf_url && cleanCt.file_pdf_url.length > 500000) {
      cleanCt.file_pdf_url = null; // Giữ lại metadata: file_pdf_ten, dung_luong, ghi_chu
    }
    await setDoc(doc(db, 'chuong_trinh', cleanCt.id), cleanCt);
  }
  console.log(`   ✓ Đã đồng bộ ${rawData.chuongTrinhList?.length || 0} chương trình KT-GS.`);

  console.log('4. Đồng bộ đơn thư khiếu nại tố cáo (don_thu)...');
  for (const dt of rawData.donThuList || []) {
    await setDoc(doc(db, 'don_thu', dt.id), dt);
  }
  console.log(`   ✓ Đã đồng bộ ${rawData.donThuList?.length || 0} đơn thư.`);

  console.log('5. Đồng bộ nhật ký kiểm toán (audit_logs)...');
  for (const log of (rawData.auditLogs || []).slice(0, 50)) {
    await setDoc(doc(db, 'audit_logs', log.id), log);
  }
  console.log(`   ✓ Đã đồng bộ ${Math.min(50, rawData.auditLogs?.length || 0)} nhật ký.`);

  // Đánh dấu bản snapshot tổng hợp
  await setDoc(doc(db, 'system', 'meta'), {
    last_synced: new Date().toISOString(),
    total_users: rawData.users?.length || 0,
    total_units: rawData.donViList?.length || 0,
    total_programs: rawData.chuongTrinhList?.length || 0,
    total_complaints: rawData.donThuList?.length || 0,
  });

  console.log('🎉 TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC ĐỒNG BỘ THÀNH CÔNG LÊN FIREBASE FIRESTORE!');
}

seed().catch(console.error);
