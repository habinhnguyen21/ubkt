/**
 * Bộ kiểm thử tự động cho Firestore Security Rules (firestore.rules)
 * sử dụng @firebase/rules-unit-testing trên Firebase Firestore Emulator.
 *
 * Cách chạy:
 *   npm run test:rules
 *   (hoặc: npx firebase emulators:exec --only firestore "node --test tests/firestore.rules.test.mjs")
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

const PROJECT_ID = 'ubkt-rules-test';
const ADMIN_UID = 'uid-admin-001';
const BIEN_TAP_UID = 'uid-bientap-001';
const ASSIGNED_UNIT_ID = 'dv-duoc-phan-cong';
const UNASSIGNED_UNIT_ID = 'dv-khong-duoc-phan-cong';

let testEnv;

describe('Firestore Security Rules (firestore.rules)', () => {
  before(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Khởi tạo dữ liệu nền (bỏ qua Rules bằng withSecurityRulesDisabled)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      // 1. Hồ sơ ADMIN
      await setDoc(doc(adminDb, 'users', ADMIN_UID), {
        id: ADMIN_UID,
        ten_dang_nhap: 'admin',
        ho_ten: 'Quản trị viên Hệ thống',
        vai_tro: 'ADMIN',
        trang_thai: 1,
        must_change_password: false,
      });

      // 2. Hồ sơ BIEN_TAP
      await setDoc(doc(adminDb, 'users', BIEN_TAP_UID), {
        id: BIEN_TAP_UID,
        ten_dang_nhap: 'bientap1',
        ho_ten: 'Cán bộ Biên tập 1',
        vai_tro: 'BIEN_TAP',
        trang_thai: 1,
        must_change_password: false,
      });

      // 3. Phân công BIEN_TAP phụ trách duy nhất đơn vị ASSIGNED_UNIT_ID
      await setDoc(doc(adminDb, 'phan_cong_dia_ban', BIEN_TAP_UID), {
        id: BIEN_TAP_UID,
        user_id: BIEN_TAP_UID,
        user_name: 'Cán bộ Biên tập 1',
        don_vi_ids: [ASSIGNED_UNIT_ID],
      });

      // 4. Hai đơn vị mẫu
      await setDoc(doc(adminDb, 'don_vi', ASSIGNED_UNIT_ID), {
        id: ASSIGNED_UNIT_ID,
        ten: 'Chi bộ Được Phân Công',
        loai: 'CHI_BO',
      });
      await setDoc(doc(adminDb, 'don_vi', UNASSIGNED_UNIT_ID), {
        id: UNASSIGNED_UNIT_ID,
        ten: 'Chi bộ Không Được Phân Công',
        loai: 'CHI_BO',
      });
    });
  });

  // ── TRƯỜNG HỢP 1: CHƯA ĐĂNG NHẬP (UNAUTHENTICATED) ─────────────────────────
  it('1. Người dùng chưa đăng nhập bị từ chối đọc và ghi mọi collection', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(unauthDb, 'users', ADMIN_UID)));
    await assertFails(getDocs(collection(unauthDb, 'don_vi')));
    await assertFails(getDocs(collection(unauthDb, 'chuong_trinh')));

    await assertFails(
      setDoc(doc(unauthDb, 'chuong_trinh', 'ct-unauth'), {
        id: 'ct-unauth',
        chu_the: 'UBKT Đảng ủy',
        noi_dung: 'Nội dung kiểm tra',
        nam: 2026,
        trang_thai: 'DANG_THUC_HIEN',
        don_vi_id: ASSIGNED_UNIT_ID,
      })
    );
  });

  // ── TRƯỜNG HỢP 2: BIEN_TAP GHI VÀO ĐƠN VỊ KHÔNG ĐƯỢC PHÂN CÔNG vs ĐƯỢC PHÂN CÔNG
  it('2. BIEN_TAP bị từ chối ghi vào đơn vị không được phân công, nhưng ghi được vào đơn vị được phân công', async () => {
    const bienTapDb = testEnv.authenticatedContext(BIEN_TAP_UID).firestore();

    // 2.1. Ghi vào đơn vị KHÔNG được phân công -> BỊ TỪ CHỐI
    await assertFails(
      setDoc(doc(bienTapDb, 'chuong_trinh', 'ct-trai-phep'), {
        id: 'ct-trai-phep',
        chu_the: 'Chi bộ Không Được Phân Công',
        noi_dung: 'Kiểm tra đảng viên chấp hành',
        nam: 2026,
        trang_thai: 'CHUA_THUC_HIEN',
        don_vi_id: UNASSIGNED_UNIT_ID,
      })
    );

    await assertFails(
      setDoc(doc(bienTapDb, 'ho_so_dia_ban_records', UNASSIGNED_UNIT_ID), {
        id: UNASSIGNED_UNIT_ID,
        ten_dia_ban: 'Chi bộ Không Được Phân Công',
      })
    );

    // 2.2. Ghi vào đơn vị ĐƯỢC phân công -> THÀNH CÔNG
    await assertSucceeds(
      setDoc(doc(bienTapDb, 'chuong_trinh', 'ct-hop-le'), {
        id: 'ct-hop-le',
        chu_the: 'Chi bộ Được Phân Công',
        noi_dung: 'Giám sát chuyên đề năm 2026',
        nam: 2026,
        trang_thai: 'DANG_THUC_HIEN',
        don_vi_id: ASSIGNED_UNIT_ID,
      })
    );

    await assertSucceeds(
      setDoc(doc(bienTapDb, 'ho_so_dia_ban_records', ASSIGNED_UNIT_ID), {
        id: ASSIGNED_UNIT_ID,
        ten_dia_ban: 'Chi bộ Được Phân Công',
      })
    );

    // 2.3. BIEN_TAP bị từ chối ghi vào don_vi, phan_cong_dia_ban, users và bị từ chối đọc hồ sơ của người khác
    await assertFails(
      setDoc(doc(bienTapDb, 'don_vi', 'dv-moi'), {
        id: 'dv-moi',
        ten: 'Chi bộ Mới',
        loai: 'CHI_BO',
      })
    );
    await assertFails(getDoc(doc(bienTapDb, 'users', ADMIN_UID)));
    await assertSucceeds(getDoc(doc(bienTapDb, 'users', BIEN_TAP_UID)));
  });

  // ── TRƯỜNG HỢP 3: ADMIN GHI BÌNH THƯỜNG & CHẶN LƯU MẬT KHẨU TRONG FIRESTORE ──
  it('3. ADMIN ghi bình thường trên mọi đơn vị/collection nhưng bị chặn nếu lưu trường mật khẩu vào users', async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

    // 3.1. ADMIN tạo đơn vị mới, chương trình mới ở bất kỳ đơn vị nào -> THÀNH CÔNG
    await assertSucceeds(
      setDoc(doc(adminDb, 'don_vi', 'dv-admin-created'), {
        id: 'dv-admin-created',
        ten: 'Chi bộ Trực thuộc Mới',
        loai: 'CHI_BO',
      })
    );

    await assertSucceeds(
      setDoc(doc(adminDb, 'chuong_trinh', 'ct-admin-1'), {
        id: 'ct-admin-1',
        chu_the: 'Ủy ban Kiểm tra Đảng ủy',
        noi_dung: 'Kiểm tra tài chính đảng',
        nam: 2026,
        trang_thai: 'DA_HOAN_THANH',
        don_vi_id: UNASSIGNED_UNIT_ID,
      })
    );

    // 3.2. ADMIN tạo user hợp lệ (KHÔNG có trường mật khẩu) -> THÀNH CÔNG
    await assertSucceeds(
      setDoc(doc(adminDb, 'users', 'uid-new-user'), {
        id: 'uid-new-user',
        ten_dang_nhap: 'canbomoi',
        ho_ten: 'Đ/c Cán Bộ Mới',
        vai_tro: 'BIEN_TAP',
        trang_thai: 1,
        must_change_password: true,
      })
    );

    // 3.3. ADMIN cố tình ghi trường mat_khau hoặc mat_khau_hash vào users -> BỊ TỪ CHỐI
    await assertFails(
      setDoc(doc(adminDb, 'users', 'uid-bad-user'), {
        id: 'uid-bad-user',
        ten_dang_nhap: 'baduser',
        ho_ten: 'User Lộ Mật Khẩu',
        vai_tro: 'XEM',
        trang_thai: 1,
        mat_khau: 'PlaintextSecret123',
      })
    );

    await assertFails(
      setDoc(doc(adminDb, 'users', 'uid-bad-hash'), {
        id: 'uid-bad-hash',
        ten_dang_nhap: 'badhash',
        ho_ten: 'User Lưu Hash',
        vai_tro: 'XEM',
        trang_thai: 1,
        mat_khau_hash: '$2b$10$abcdefghijklmnopqrstuv',
      })
    );

    // 3.4. Xóa tài khoản khác thành công, nhưng không được tự xóa chính mình
    await assertSucceeds(deleteDoc(doc(adminDb, 'users', 'uid-new-user')));
    await assertFails(deleteDoc(doc(adminDb, 'users', ADMIN_UID)));
  });
});

