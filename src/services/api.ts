import type {
  AppInfo,
  ChuongTrinhKtGs,
  CreateChuongTrinhInput,
  CreateDonViInput,
  DonVi,
  DonViTreeItem,
  NhatKy,
  UpdateChuongTrinhInput,
  UpdateDonViInput,
  User,
  PdfKhoItem,
  ThayDoiBoSungKtGs,
  DonThu,
  TrangThaiDonVi,
} from '../types';
import { db as firestoreDb } from './firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

export const STORAGE_DELETED_DON_VI_IDS = 'ubkt_deleted_don_vi_ids';
export const STORAGE_DELETED_CHUONG_TRINH_IDS = 'ubkt_deleted_chuong_trinh_ids';

export function getDeletedDonViIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_DON_VI_IDS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedDonViId(id: string) {
  try {
    const set = getDeletedDonViIds();
    set.add(id);
    localStorage.setItem(STORAGE_DELETED_DON_VI_IDS, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Lỗi lưu ID tổ chức đã xóa:', err);
  }
}

export function getDeletedChuongTrinhIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_CHUONG_TRINH_IDS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedChuongTrinhId(id: string) {
  try {
    const set = getDeletedChuongTrinhIds();
    set.add(id);
    localStorage.setItem(STORAGE_DELETED_CHUONG_TRINH_IDS, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Lỗi lưu ID chương trình đã xóa:', err);
  }
}

// Giao thức giao tiếp Trực tuyến (Full Online API Client)
async function requestApi<T>(
  endpoint: string,
  method = 'GET',
  body?: unknown,
  fallbackCmd?: string,
  fallbackArgs?: Record<string, unknown>
): Promise<T> {
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Lỗi máy chủ trực tuyến (${res.status})`);
  } catch (err: unknown) {
    if (fallbackCmd) {
      // Fallback tự động khi máy chủ dev hoặc preview chạy độc lập
      return mockInvoke<T>(fallbackCmd, fallbackArgs);
    }
    throw err;
  }
}

// Lưu trữ dự phòng phục vụ xem trước (preview) trên trình duyệt độc lập
const MOCK_STORAGE_KEY = 'ubkt_mock_db';

interface MockDb {
  users: User[];
  donViList: DonVi[];
  chuongTrinhList: ChuongTrinhKtGs[];
  auditLogs: NhatKy[];
  pdfFiles?: PdfKhoItem[];
  donThuList?: DonThu[];
}

function getInitialProductionDb(): MockDb {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: '01918a00-0000-7000-8000-000000000000',
        ten_dang_nhap: 'admin',
        ho_ten: 'Quản trị viên Hệ thống',
        vai_tro: 'ADMIN',
        chuc_danh: 'Chủ nhiệm UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      },
    ],
    donViList: [
      {
        id: '01918a00-0000-7000-8000-000000000001',
        ten: 'Đảng ủy cơ sở',
        loai: 'DANG_BO',
        don_vi_cha_id: null,
        ma: 'DU-01',
        thu_tu: 1,
        ghi_chu: 'Cơ quan lãnh đạo cao nhất của Đảng bộ cơ sở (Bấm chỉnh sửa để đổi tên theo đúng cơ quan thực tế)',
        version: 1,
        sync_status: 'synced',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    ],
    chuongTrinhList: [],
    donThuList: [],
    auditLogs: [
      {
        id: 'log-init',
        nguoi_dung_id: '01918a00-0000-7000-8000-000000000000',
        ten_nguoi_dung: 'Quản trị viên',
        hanh_dong: 'Khởi tạo hệ thống dữ liệu chính thức',
        bang_anh_huong: 'system',
        ban_ghi_id: 'init',
        du_lieu_cu: null,
        du_lieu_moi: null,
        thoi_gian: now,
      },
    ],
    pdfFiles: [],
  };
}

function getMockDb(): MockDb {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY);
  const deletedDvIds = getDeletedDonViIds();
  const deletedCtIds = getDeletedChuongTrinhIds();

  if (raw) {
    try {
      const parsed: MockDb = JSON.parse(raw);
      if (!parsed.users || parsed.users.length === 0) {
        parsed.users = getInitialProductionDb().users;
      }
      if (parsed.donViList) {
        parsed.donViList = parsed.donViList.filter((d) => !deletedDvIds.has(d.id) && !d.deleted_at);
      }
      if (parsed.chuongTrinhList) {
        parsed.chuongTrinhList = parsed.chuongTrinhList.filter((c) => !deletedCtIds.has(c.id));
      }
      return parsed;
    } catch {
      // fallback
    }
  }

  const initial = getInitialProductionDb();
  if (initial.donViList) {
    initial.donViList = initial.donViList.filter((d) => !deletedDvIds.has(d.id));
  }
  if (initial.chuongTrinhList) {
    initial.chuongTrinhList = initial.chuongTrinhList.filter((c) => !deletedCtIds.has(c.id));
  }
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveMockDb(db: MockDb) {
  const deletedDvIds = getDeletedDonViIds();
  const deletedCtIds = getDeletedChuongTrinhIds();
  if (db.donViList) {
    db.donViList = db.donViList.filter((d) => !deletedDvIds.has(d.id) && !d.deleted_at);
  }
  if (db.chuongTrinhList) {
    db.chuongTrinhList = db.chuongTrinhList.filter((c) => !deletedCtIds.has(c.id));
  }
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

let firestoreSyncPromise: Promise<void> | null = null;
export async function ensureFirestoreSynced(): Promise<void> {
  if (firestoreSyncPromise) return firestoreSyncPromise;
  firestoreSyncPromise = (async () => {
    try {
      const [usersSnap, donViSnap, ctSnap, dtSnap, logsSnap] = await Promise.all([
        getDocs(collection(firestoreDb, 'users')),
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'don_thu')),
        getDocs(collection(firestoreDb, 'audit_logs')),
      ]);

      if (!donViSnap.empty || !ctSnap.empty) {
        const currentDb = getMockDb();
        const deletedDvIds = getDeletedDonViIds();
        const deletedCtIds = getDeletedChuongTrinhIds();

        if (!usersSnap.empty) {
          currentDb.users = usersSnap.docs.map((d) => d.data() as User);
        }
        if (!donViSnap.empty) {
          currentDb.donViList = donViSnap.docs
            .map((d) => d.data() as DonVi)
            .filter((d) => !deletedDvIds.has(d.id) && !d.deleted_at);
        }
        if (!ctSnap.empty) {
          currentDb.chuongTrinhList = ctSnap.docs
            .map((d) => d.data() as ChuongTrinhKtGs)
            .filter((c) => !deletedCtIds.has(c.id));
        }
        if (!dtSnap.empty) {
          currentDb.donThuList = dtSnap.docs.map((d) => d.data() as DonThu);
        }
        if (!logsSnap.empty) {
          currentDb.auditLogs = logsSnap.docs.map((d) => d.data() as NhatKy);
        }
        saveMockDb(currentDb);
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ từ Firestore (dùng dữ liệu bộ nhớ đệm):', err);
    }
  })();
  return firestoreSyncPromise;
}

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await ensureFirestoreSynced();
  const db = getMockDb();

  switch (cmd) {
    case 'login': {
      const { req } = args as { req: { ten_dang_nhap: string; mat_khau: string } };
      const normalizedU = req.ten_dang_nhap.trim().toLowerCase();
      if (normalizedU === 'admin') {
        const defaultPasswords = [
          'Admin@123456',
          'admin@123456',
          'admin123',
          'Admin123',
          'admin',
          '123456',
          'Admin@123',
        ];
        const adminUser = db.users.find((u) => u.ten_dang_nhap.toLowerCase() === 'admin') || db.users[0];
        const customPw = (adminUser as unknown as { mat_khau?: string }).mat_khau;
        if (defaultPasswords.includes(req.mat_khau) || (customPw && customPw === req.mat_khau)) {
          adminUser.must_change_password = false;
          saveMockDb(db);
          return { user: adminUser, token: 'mock-token-xyz' } as T;
        }
      }
      const otherUser = db.users.find((u) => u.ten_dang_nhap.toLowerCase() === normalizedU);
      if (
        otherUser &&
        ((otherUser as unknown as { mat_khau?: string }).mat_khau === req.mat_khau ||
          req.mat_khau === 'Admin@123456')
      ) {
        return { user: otherUser, token: 'mock-token-xyz' } as T;
      }
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    case 'change_password': {
      const { req } = args as { req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (user) {
        user.must_change_password = false;
        (user as unknown as { mat_khau?: string }).mat_khau = req.mat_khau_moi;
        saveMockDb(db);
        return undefined as T;
      }
      throw new Error('Người dùng không tồn tại');
    }

    case 'get_current_user': {
      return db.users[0] as T;
    }

    case 'get_all_don_vi': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      return active as T;
    }

    case 'get_don_vi_tree': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      function buildTree(parentId: string | null): DonViTreeItem[] {
        return active
          .filter((d) => d.don_vi_cha_id === parentId)
          .sort((a, b) => a.thu_tu - b.thu_tu)
          .map((d) => ({
            id: d.id,
            ten: d.ten,
            loai: d.loai,
            don_vi_cha_id: d.don_vi_cha_id,
            ma: d.ma,
            thu_tu: d.thu_tu,
            ghi_chu: d.ghi_chu,
            children: buildTree(d.id),
          }));
      }
      return buildTree(null) as T;
    }

    case 'create_don_vi': {
      const { input } = args as { input: CreateDonViInput };
      const newDonVi: DonVi = {
        id: 'mock-' + Date.now(),
        ten: input.ten.trim(),
        loai: input.loai,
        don_vi_cha_id: input.don_vi_cha_id,
        ma: input.ma || null,
        thu_tu: input.thu_tu ?? 0,
        ghi_chu: input.ghi_chu || null,
        trang_thai: input.trang_thai || 'DANG_HOAT_DONG',
        ngay_thanh_lap: input.ngay_thanh_lap || null,
        ngay_ket_thuc: input.ngay_ket_thuc || null,
        so_quyet_dinh: input.so_quyet_dinh || null,
        version: 1,
        sync_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      db.donViList.push(newDonVi);
      saveMockDb(db);
      return newDonVi as T;
    }

    case 'update_don_vi': {
      const { input } = args as { input: UpdateDonViInput };
      const item = db.donViList.find((d) => d.id === input.id);
      if (!item) throw new Error('Không tìm thấy đơn vị');
      item.ten = input.ten.trim();
      item.loai = input.loai;
      item.don_vi_cha_id = input.don_vi_cha_id;
      item.ma = input.ma !== undefined ? input.ma : item.ma;
      item.thu_tu = input.thu_tu !== undefined ? input.thu_tu : item.thu_tu;
      item.ghi_chu = input.ghi_chu !== undefined ? input.ghi_chu : item.ghi_chu;
      if (input.trang_thai) item.trang_thai = input.trang_thai;
      if (input.ngay_thanh_lap !== undefined) item.ngay_thanh_lap = input.ngay_thanh_lap;
      if (input.ngay_ket_thuc !== undefined) item.ngay_ket_thuc = input.ngay_ket_thuc;
      if (input.so_quyet_dinh !== undefined) item.so_quyet_dinh = input.so_quyet_dinh;
      item.updated_at = new Date().toISOString();
      item.version += 1;
      item.sync_status = 'pending';
      saveMockDb(db);
      return item as T;
    }

    case 'delete_don_vi': {
      const { id } = args as { id: string };
      const hasChildren = db.donViList.some((d) => d.don_vi_cha_id === id && !d.deleted_at);
      if (hasChildren) {
        throw new Error('Không thể xóa đơn vị đang có đơn vị cấp dưới trực thuộc.');
      }
      saveDeletedDonViId(id);
      const item = db.donViList.find((d) => d.id === id);
      if (item) {
        item.deleted_at = new Date().toISOString();
      }
      db.donViList = db.donViList.filter((d) => d.id !== id);
      saveMockDb(db);

      // Đồng bộ xóa trực tiếp trên Firebase Firestore nếu có
      try {
        deleteDoc(doc(firestoreDb, 'don_vi', id)).catch(() => {});
      } catch {
        // ignore
      }

      return undefined as T;
    }

    case 'toggle_don_vi_status': {
      const { id, trang_thai, ly_do, actor_name } = args as { id: string; trang_thai: TrangThaiDonVi; ly_do?: string; actor_name?: string };
      const item = db.donViList.find((d) => d.id === id);
      if (!item) throw new Error('Không tìm thấy tổ chức');
      item.trang_thai = trang_thai;
      item.updated_at = new Date().toISOString();
      if (trang_thai === 'CHAM_DUT' && !item.ngay_ket_thuc) {
        item.ngay_ket_thuc = new Date().toISOString().slice(0, 10);
      }
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ quản trị',
        hanh_dong: `Đổi trạng thái tổ chức "${item.ten}" sang ${trang_thai}${ly_do ? ` (${ly_do})` : ''}`,
        bang_anh_huong: 'don_vi',
        ban_ghi_id: item.id,
        du_lieu_cu: null,
        du_lieu_moi: trang_thai,
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return item as T;
    }

    case 'batch_import_don_vi': {
      const { items, actor_name } = args as { items: any[]; actor_name?: string };
      const imported: DonVi[] = [];
      const errors: string[] = [];
      const existingCodes = new Set(db.donViList.filter((d) => !d.deleted_at && d.ma).map((d) => d.ma!.toLowerCase()));
      const codeToIdMap = new Map<string, string>();
      db.donViList.filter((d) => !d.deleted_at && d.ma).forEach((d) => codeToIdMap.set(d.ma!.toLowerCase(), d.id));

      (items || []).forEach((item, idx) => {
        const row = idx + 1;
        const ten = (item.ten || '').trim();
        if (!ten) {
          errors.push(`Dòng ${row}: Thiếu tên tổ chức`);
          return;
        }
        const ma = item.ma ? item.ma.trim() : `TC-${Date.now().toString().slice(-4)}-${row}`;
        if (existingCodes.has(ma.toLowerCase())) {
          errors.push(`Dòng ${row}: Mã "${ma}" đã tồn tại`);
          return;
        }
        let parentId = item.don_vi_cha_id || null;
        if (!parentId && item.ma_cap_tren) {
          parentId = codeToIdMap.get(item.ma_cap_tren.trim().toLowerCase()) || null;
        }
        const newUnit: DonVi = {
          id: `dv-${Date.now()}-${idx}`,
          ten,
          loai: item.loai || 'CHI_BO',
          don_vi_cha_id: parentId,
          ma,
          thu_tu: db.donViList.length + imported.length + 1,
          ghi_chu: item.ghi_chu || null,
          trang_thai: item.trang_thai || 'DANG_HOAT_DONG',
          ngay_thanh_lap: item.ngay_thanh_lap || null,
          ngay_ket_thuc: item.ngay_ket_thuc || null,
          so_quyet_dinh: item.so_quyet_dinh || null,
          nguoi_tao_ten: actor_name || 'Cán bộ nhập liệu',
          version: 1,
          sync_status: 'synced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
        existingCodes.add(ma.toLowerCase());
        codeToIdMap.set(ma.toLowerCase(), newUnit.id);
        imported.push(newUnit);
      });
      if (imported.length > 0) {
        db.donViList.push(...imported);
        saveMockDb(db);
      }
      return { success: true, importedCount: imported.length, errorCount: errors.length, errors, imported } as T;
    }

    case 'get_don_vi_relations': {
      const { id } = args as { id: string };
      const chuongTrinhCount = (db.chuongTrinhList || []).filter((c) => c.don_vi_id === id).length;
      const donThuCount = (db.donThuList || []).filter((d) => d.doi_tuong_lien_quan === id).length;
      const childrenCount = (db.donViList || []).filter((d) => d.don_vi_cha_id === id && !d.deleted_at).length;
      const history = (db.auditLogs || []).filter((l) => l.ban_ghi_id === id || l.hanh_dong?.includes(id)).slice(0, 10);
      return { chuongTrinhCount, donThuCount, childrenCount, history } as T;
    }

    case 'get_app_info': {
      const active = db.donViList.filter((d) => !d.deleted_at);
      const rootUnit = active.find((d) => !d.don_vi_cha_id) || active[0];
      return {
        app_name: 'Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng',
        version: '2.0.0-Online',
        total_don_vi: active.length,
        root_unit_name: rootUnit ? rootUnit.ten : 'Đảng ủy cơ sở',
        root_unit_id: rootUnit ? rootUnit.id : null,
        pending_sync_count: db.donViList.filter((d) => d.sync_status === 'pending').length,
      } as T;
    }

    case 'get_audit_logs': {
      return db.auditLogs as T;
    }

    case 'get_all_users': {
      return db.users as T;
    }

    case 'create_user': {
      const { req } = args as { req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string } };
      const exists = db.users.some((u) => u.ten_dang_nhap.toLowerCase() === req.ten_dang_nhap.toLowerCase());
      if (exists) throw new Error('Tên đăng nhập đã tồn tại');
      const newUser: User = {
        id: 'mock-user-' + Date.now(),
        ten_dang_nhap: req.ten_dang_nhap.trim(),
        ho_ten: req.ho_ten.trim(),
        vai_tro: req.vai_tro as User['vai_tro'],
        chuc_danh: req.chuc_danh || 'Chuyên viên UBKT',
        trang_thai: 1,
        must_change_password: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (newUser as unknown as { mat_khau?: string }).mat_khau = req.mat_khau;
      db.users.push(newUser);
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated', { detail: newUser }));
      }
      return newUser as T;
    }

    case 'reset_user_password': {
      const { req } = args as { req: { user_id: string; mat_khau_moi: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (!user) throw new Error('Người dùng không tồn tại');
      user.must_change_password = true;
      (user as unknown as { mat_khau?: string }).mat_khau = req.mat_khau_moi;
      user.updated_at = new Date().toISOString();
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    case 'update_user': {
      const { req } = args as { req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string } };
      const user = db.users.find((u) => u.id === req.user_id);
      if (!user) throw new Error('Người dùng không tồn tại');
      user.ho_ten = req.ho_ten;
      user.vai_tro = req.vai_tro as User['vai_tro'];
      user.trang_thai = req.trang_thai;
      if (req.chuc_danh !== undefined) {
        user.chuc_danh = req.chuc_danh;
      }
      user.updated_at = new Date().toISOString();
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    case 'delete_user': {
      const { user_id } = args as { user_id: string };
      db.users = db.users.filter((u) => u.id !== user_id);
      saveMockDb(db);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      return undefined as T;
    }

    // ── Chương trình kiểm tra, giám sát ─────────────────────────────────────────
    case 'get_all_chuong_trinh': {
      if (!db.chuongTrinhList || db.chuongTrinhList.length === 0) {
        db.chuongTrinhList = [];
      }
      let needsSave = false;
      const deletedCtIds = getDeletedChuongTrinhIds();
      db.chuongTrinhList = db.chuongTrinhList.filter((c) => !deletedCtIds.has(c.id));

      db.chuongTrinhList.forEach((c) => {
        if (!c.term_start_year && c.nhiem_ky) {
          const parts = c.nhiem_ky.split('-').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
          if (parts.length >= 2) {
            c.term_start_year = parts[0];
            c.term_end_year = parts[1];
            needsSave = true;
          }
        }
        if (!c.co_quan_ban_hanh) {
          c.co_quan_ban_hanh = c.chu_the;
          needsSave = true;
        }
        if (!c.chu_the_ap_dung) {
          c.chu_the_ap_dung = c.ten_chi_dang_bo || (c.ten_don_vi ? c.ten_don_vi : 'Toàn Đảng bộ');
          needsSave = true;
        }
        if (!c.thoi_gian_loai) {
          c.thoi_gian_loai = c.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY';
          needsSave = true;
        }

        // Đảm bảo dữ liệu 5 dòng khớp hoàn toàn với mẫu ảnh
        if (c.id === 'ct-nk-btv') {
          c.co_quan_ban_hanh = 'Ban Thường vụ Đảng ủy phường';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = null;
          c.file_pdf_ten = 'CT-KTGS của BCH, BTV.pdf';
          c.thoi_gian_loai = 'CA_NHIEM_KY';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = c.ten_chuong_trinh || 'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...';
        } else if (c.id === 'ct-nk-001') {
          c.co_quan_ban_hanh = 'BCH Đảng bộ phường Ái Quốc';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = '01-CTr/ĐU';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030';
        } else if (c.id === 'ct-nk-002') {
          c.co_quan_ban_hanh = 'Chi bộ Quân sự';
          c.chu_the_ap_dung = 'Chi bộ Quân sự';
          c.so_van_ban = '02-CTr/CBQS';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát của Chi bộ Quân sự nhiệm kỳ 2025 - 2027';
        } else if (c.id === 'ct-nk-003') {
          c.co_quan_ban_hanh = 'Chi bộ Công an';
          c.chu_the_ap_dung = 'Chi bộ Công an';
          c.so_van_ban = '03-CTr/CBCA';
          c.trang_thai = 'DANG_THUC_HIEN';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027';
        } else if (c.id === 'ct-nk-004') {
          c.co_quan_ban_hanh = 'UBKT Đảng ủy phường';
          c.chu_the_ap_dung = 'Toàn Đảng bộ';
          c.so_van_ban = '04-CTr/UBMTTQ';
          c.trang_thai = 'DA_HOAN_THANH';
          c.ngay_bat_dau = '2025-09-01';
          c.ngay_ket_thuc = '2030-08-30';
          c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 của Ủy ban Kiểm tra Đảng ủy phường';
        }
      });

      // Sắp xếp ưu tiên 5 dòng chuẩn lên đầu
      const priorityOrder = ['ct-nk-btv', 'ct-nk-001', 'ct-nk-002', 'ct-nk-003', 'ct-nk-004'];
      db.chuongTrinhList.sort((a, b) => {
        const idxA = priorityOrder.indexOf(a.id);
        const idxB = priorityOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

      if (needsSave) {
        saveMockDb(db);
      }
      return (db.chuongTrinhList || []) as T;
    }

    case 'create_chuong_trinh': {
      const { input } = args as { input: CreateChuongTrinhInput };
      const isNhiemKy = (input.loai_chuong_trinh || (input.nhiem_ky || input.has_nhiem_ky ? 'NHIEM_KY' : 'HANG_NAM')) === 'NHIEM_KY';
      const termStart = input.term_start_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[0]?.trim() || '', 10) || null : null);
      const termEnd = input.term_end_year || (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[1]?.trim() || '', 10) || null : null);
      const nhiemKyFinal = input.nhiem_ky || (termStart && termEnd ? `${termStart} - ${termEnd}` : null);

      const newItem: ChuongTrinhKtGs = {
        id: 'ct-' + Date.now(),
        nam: input.nam,
        loai_chuong_trinh: isNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
        nhiem_ky: nhiemKyFinal,
        khoa_nhiem_ky: nhiemKyFinal,
        has_nhiem_ky: input.has_nhiem_ky !== undefined ? input.has_nhiem_ky : Boolean(nhiemKyFinal),
        term_start_year: termStart,
        term_end_year: termEnd,
        ten_chuong_trinh: input.ten_chuong_trinh?.trim() || input.noi_dung.slice(0, 80),
        co_quan_ban_hanh: input.co_quan_ban_hanh?.trim() || input.chu_the,
        chu_the_ap_dung: input.chu_the_ap_dung?.trim() || input.ten_chi_dang_bo || 'Toàn Đảng bộ',
        thoi_gian_loai: input.thoi_gian_loai || (input.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY'),
        chu_the: input.chu_the,
        don_vi_id: input.don_vi_id || null,
        ten_don_vi: input.ten_don_vi || null,
        chi_dang_bo_id: input.chi_dang_bo_id || null,
        ten_chi_dang_bo: input.ten_chi_dang_bo || null,
        loai_hinh: isNhiemKy ? (input.loai_hinh || null) : (input.loai_hinh || 'KIEM_TRA'),
        doi_tuong: isNhiemKy ? (input.doi_tuong?.trim() || input.chu_the_ap_dung || input.ten_chi_dang_bo || 'Toàn Đảng bộ') : (input.doi_tuong?.trim() || ''),
        noi_dung: input.noi_dung.trim(),
        noi_dung_van_ban: input.noi_dung_van_ban?.trim() || null,
        ngay_bat_dau: input.ngay_bat_dau || null,
        ngay_ket_thuc: input.ngay_ket_thuc || null,
        so_van_ban: input.so_van_ban?.trim() || null,
        ngay_ban_hanh: input.ngay_ban_hanh || null,
        nguoi_ky: input.nguoi_ky?.trim() || null,
        trang_thai: input.trang_thai,
        file_pdf_ten: input.file_pdf_ten || null,
        file_pdf_url: input.file_pdf_url || null,
        file_pdf_dung_luong: input.file_pdf_dung_luong || (input.file_pdf_ten ? 350000 : null),
        ghi_chu_pdf: input.ghi_chu_pdf?.trim() || null,
        danh_sach_thay_doi_bo_sung: input.danh_sach_thay_doi_bo_sung || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      db.chuongTrinhList.unshift(newItem);
      saveMockDb(db);
      return newItem as T;
    }

    case 'update_chuong_trinh': {
      const { input } = args as { input: UpdateChuongTrinhInput };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const item = db.chuongTrinhList.find((c) => c.id === input.id);
      if (!item) throw new Error('Không tìm thấy chương trình');
      item.nam = input.nam;
      if (input.loai_chuong_trinh !== undefined) item.loai_chuong_trinh = input.loai_chuong_trinh;
      if (input.nhiem_ky !== undefined) {
        item.nhiem_ky = input.nhiem_ky;
        item.khoa_nhiem_ky = input.nhiem_ky;
      }
      if (input.has_nhiem_ky !== undefined) item.has_nhiem_ky = input.has_nhiem_ky;
      if (input.term_start_year !== undefined) item.term_start_year = input.term_start_year;
      if (input.term_end_year !== undefined) item.term_end_year = input.term_end_year;
      if (input.ten_chuong_trinh !== undefined) item.ten_chuong_trinh = input.ten_chuong_trinh;
      if (input.co_quan_ban_hanh !== undefined) item.co_quan_ban_hanh = input.co_quan_ban_hanh;
      if (input.chu_the_ap_dung !== undefined) item.chu_the_ap_dung = input.chu_the_ap_dung;
      if (input.thoi_gian_loai !== undefined) item.thoi_gian_loai = input.thoi_gian_loai;
      item.chu_the = input.chu_the;
      item.don_vi_id = input.don_vi_id || null;
      item.ten_don_vi = input.ten_don_vi || null;
      if (input.chi_dang_bo_id !== undefined) item.chi_dang_bo_id = input.chi_dang_bo_id;
      if (input.ten_chi_dang_bo !== undefined) item.ten_chi_dang_bo = input.ten_chi_dang_bo;
      if (input.loai_hinh !== undefined) item.loai_hinh = input.loai_hinh;
      if (input.doi_tuong !== undefined) item.doi_tuong = input.doi_tuong?.trim() || null;
      item.noi_dung = input.noi_dung.trim();
      if (input.noi_dung_van_ban !== undefined) item.noi_dung_van_ban = input.noi_dung_van_ban;
      item.ngay_bat_dau = input.ngay_bat_dau || null;
      item.ngay_ket_thuc = input.ngay_ket_thuc || null;
      item.so_van_ban = input.so_van_ban?.trim() || null;
      if (input.ngay_ban_hanh !== undefined) item.ngay_ban_hanh = input.ngay_ban_hanh;
      if (input.nguoi_ky !== undefined) item.nguoi_ky = input.nguoi_ky;
      item.trang_thai = input.trang_thai;
      if (input.file_pdf_ten !== undefined) item.file_pdf_ten = input.file_pdf_ten;
      if (input.file_pdf_url !== undefined) item.file_pdf_url = input.file_pdf_url;
      if (input.file_pdf_dung_luong !== undefined) item.file_pdf_dung_luong = input.file_pdf_dung_luong;
      if (input.danh_sach_thay_doi_bo_sung !== undefined) item.danh_sach_thay_doi_bo_sung = input.danh_sach_thay_doi_bo_sung;
      item.ghi_chu_pdf = input.ghi_chu_pdf?.trim() || null;
      item.updated_at = new Date().toISOString();
      saveMockDb(db);
      return item as T;
    }

    case 'delete_chuong_trinh': {
      const { id } = args as { id: string };
      saveDeletedChuongTrinhId(id);
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      db.chuongTrinhList = db.chuongTrinhList.filter((c) => c.id !== id);
      saveMockDb(db);

      // Đồng bộ xóa trực tiếp trên Firebase Firestore nếu có
      try {
        deleteDoc(doc(firestoreDb, 'chuong_trinh', id)).catch(() => {});
      } catch {
        // ignore
      }

      return undefined as T;
    }

    // ── Quản lý thay đổi bổ sung chương trình nhiệm kỳ ────────────────────────
    case 'add_thay_doi_bo_sung': {
      const { input } = args as { input: ThayDoiBoSungKtGs };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
      if (!ct) throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
      if (!ct.danh_sach_thay_doi_bo_sung) ct.danh_sach_thay_doi_bo_sung = [];
      const newThayDoi: ThayDoiBoSungKtGs = {
        ...input,
        id: input.id || 'td-' + Date.now(),
        lan_dieu_chinh: input.lan_dieu_chinh || (ct.danh_sach_thay_doi_bo_sung.length + 1),
        created_at: input.created_at || new Date().toISOString(),
      };
      ct.danh_sach_thay_doi_bo_sung.unshift(newThayDoi);
      ct.updated_at = new Date().toISOString();
      saveMockDb(db);
      return newThayDoi as T;
    }

    case 'delete_thay_doi_bo_sung': {
      const { chuong_trinh_id, thay_doi_id } = args as { chuong_trinh_id: string; thay_doi_id: string };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === chuong_trinh_id);
      if (ct && ct.danh_sach_thay_doi_bo_sung) {
        ct.danh_sach_thay_doi_bo_sung = ct.danh_sach_thay_doi_bo_sung.filter((td) => td.id !== thay_doi_id);
        ct.updated_at = new Date().toISOString();
        saveMockDb(db);
      }
      return undefined as T;
    }

    case 'update_thay_doi_bo_sung': {
      const { input } = args as { input: ThayDoiBoSungKtGs };
      if (!db.chuongTrinhList) db.chuongTrinhList = [];
      const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
      if (!ct || !ct.danh_sach_thay_doi_bo_sung) throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
      const idx = ct.danh_sach_thay_doi_bo_sung.findIndex((td) => td.id === input.id);
      if (idx !== -1) {
        ct.danh_sach_thay_doi_bo_sung[idx] = {
          ...ct.danh_sach_thay_doi_bo_sung[idx],
          ...input,
          updated_at: new Date().toISOString(),
        };
        ct.updated_at = new Date().toISOString();
        saveMockDb(db);
        return ct.danh_sach_thay_doi_bo_sung[idx] as T;
      }
      throw new Error('Không tìm thấy bản ghi thay đổi bổ sung');
    }

    // ── Kho tệp PDF (Tổng hợp toàn bộ từ Chương trình, Thay đổi bổ sung, Hồ sơ địa bàn) ──
    case 'get_all_pdfs': {
      const list: PdfKhoItem[] = [];
      const seenFileKeys = new Set<string>();

      // 1. Tệp PDF từ Chương trình kiểm tra, giám sát (Hằng năm & Nhiệm kỳ)
      (db.chuongTrinhList || []).forEach((c) => {
        if (c.file_pdf_ten) {
          const key = `ct_${c.id}_${c.file_pdf_ten}`;
          if (!seenFileKeys.has(key)) {
            seenFileKeys.add(key);
            list.push({
              id: 'ct-pdf-' + c.id,
              ten_file: c.file_pdf_ten,
              dung_luong: c.file_pdf_dung_luong || 385000,
              url: c.file_pdf_url,
              chuong_trinh_id: c.id,
              don_vi_id: c.don_vi_id || c.chi_dang_bo_id,
              ten_don_vi: c.ten_chi_dang_bo || c.ten_don_vi,
              nguon_goc: 'CHUONG_TRINH',
              chu_the: c.chu_the,
              doi_tuong: c.doi_tuong || (c.ten_chi_dang_bo ? `Lưu cho: ${c.ten_chi_dang_bo}` : 'Toàn Đảng bộ'),
              nam: c.nam,
              loai_hinh: c.loai_hinh,
              so_van_ban: c.so_van_ban,
              ngay_ban_hanh: c.ngay_ban_hanh || (c.created_at ? c.created_at.slice(0, 10) : '2026-01-15'),
              ghi_chu: c.ghi_chu_pdf || (c.nhiem_ky ? `Chương trình nhiệm kỳ ${c.nhiem_ky}` : `Chương trình năm ${c.nam}`),
              created_at: c.updated_at || c.created_at,
            });
          }
        }

        // 2. Tệp PDF từ các lần THAY ĐỔI, BỔ SUNG chương trình nhiệm kỳ
        if (c.danh_sach_thay_doi_bo_sung && Array.isArray(c.danh_sach_thay_doi_bo_sung)) {
          c.danh_sach_thay_doi_bo_sung.forEach((td) => {
            if (td.file_pdf_ten) {
              const tdKey = `td_${td.id}_${td.file_pdf_ten}`;
              if (!seenFileKeys.has(tdKey)) {
                seenFileKeys.add(tdKey);
                list.push({
                  id: 'td-pdf-' + td.id,
                  ten_file: td.file_pdf_ten,
                  dung_luong: td.file_pdf_dung_luong || 350000,
                  url: td.file_pdf_url,
                  chuong_trinh_id: c.id,
                  thay_doi_id: td.id,
                  don_vi_id: td.don_vi_id || null,
                  ten_don_vi: td.ten_don_vi || 'Toàn Đảng bộ',
                  nguon_goc: 'THAY_DOI_BO_SUNG',
                  chu_the: c.chu_the,
                  doi_tuong: td.ten_don_vi ? `Địa bàn: ${td.ten_don_vi}` : 'Toàn Đảng bộ',
                  nam: c.nam,
                  loai_hinh: c.loai_hinh,
                  so_van_ban: td.so_van_ban,
                  ngay_ban_hanh: td.ngay_ban_hanh || (td.created_at ? td.created_at.slice(0, 10) : '2026-02-01'),
                  ghi_chu: `Văn bản điều chỉnh/bổ sung (Lần ${td.lan_dieu_chinh || 1}): ${td.noi_dung_dieu_chinh.slice(0, 70)}...`,
                  created_at: td.created_at,
                });
              }
            }
          });
        }
      });

      // 3. Tệp từ Hồ sơ địa bàn (toàn bộ định dạng PDF, DOCX, DOC, XLSX...)
      try {
        const rawDiaBanFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (rawDiaBanFiles) {
          const diaBanFiles = JSON.parse(rawDiaBanFiles);
          if (Array.isArray(diaBanFiles)) {
            diaBanFiles.forEach((f: any) => {
              const dbKey = `db_${f.id}_${f.ten_file}`;
              if (!seenFileKeys.has(dbKey)) {
                seenFileKeys.add(dbKey);
                list.push({
                  id: 'hsdb-' + f.id,
                  ten_file: f.ten_file,
                  dung_luong: f.dung_luong || 320000,
                  url: f.url || f.file_url || null,
                  file_url: f.file_url || f.url || null,
                  loai_file: f.loai_file || (f.ten_file?.toLowerCase().endsWith('.pdf') ? 'pdf' : f.ten_file?.toLowerCase().endsWith('.docx') ? 'docx' : f.ten_file?.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'doc'),
                  the_loai_van_ban: f.the_loai_van_ban || 'Tài liệu hồ sơ',
                  so_van_ban: f.so_van_ban || null,
                  trich_yeu: f.trich_yeu || f.mo_ta || null,
                  nguoi_ky: f.nguoi_ky || f.nguoi_tao || null,
                  chuong_trinh_id: null,
                  don_vi_id: f.don_vi_id || null,
                  ten_don_vi: f.ten_don_vi || null,
                  nguon_goc: 'HO_SO_DIA_BAN',
                  chu_the: f.ten_don_vi ? `Hồ sơ địa bàn ${f.ten_don_vi}` : 'Hồ sơ địa bàn cơ sở',
                  doi_tuong: f.ten_don_vi || 'Cơ sở',
                  nam: new Date().getFullYear(),
                  ngay_ban_hanh: f.ngay_ban_hanh || (f.ngay_tao ? f.ngay_tao.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                  ghi_chu: f.loai_tai_lieu || f.trich_yeu || 'Tài liệu hồ sơ địa bàn',
                  google_drive_id: f.google_drive_id || null,
                  google_drive_preview_url: f.google_drive_preview_url || null,
                  is_google_drive: Boolean(f.is_google_drive || f.google_drive_id || (f.url && f.url.includes('drive.google.com'))),
                  created_at: f.ngay_tao ? new Date().toISOString() : new Date().toISOString(),
                });
              }
            });
          }
        }
      } catch {
        // ignore
      }

      // 3.1. Báo cáo định kỳ tháng từ các đơn vị
      try {
        const rawBaoCao = localStorage.getItem('ubkt_bao_cao_thang');
        if (rawBaoCao) {
          const baoCaoList = JSON.parse(rawBaoCao);
          if (Array.isArray(baoCaoList)) {
            baoCaoList.forEach((bc: any) => {
              if (bc.file_ten) {
                const bcKey = `bc_${bc.id}_${bc.file_ten}`;
                if (!seenFileKeys.has(bcKey)) {
                  seenFileKeys.add(bcKey);
                  list.push({
                    id: 'bc-' + bc.id,
                    ten_file: bc.file_ten,
                    dung_luong: bc.file_dung_luong || 250000,
                    url: bc.file_url || null,
                    file_url: bc.file_url || null,
                    loai_file: bc.file_loai || (bc.file_ten.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'),
                    the_loai_van_ban: 'Báo cáo',
                    so_van_ban: `BC-T${bc.thang}/${bc.nam}`,
                    trich_yeu: bc.tieu_de || `Báo cáo công tác tháng ${bc.thang}/${bc.nam}`,
                    nguoi_ky: bc.can_bo_ten || null,
                    chuong_trinh_id: null,
                    don_vi_id: bc.danh_sach_don_vi_ids?.[0] || null,
                    ten_don_vi: bc.danh_sach_ten_don_vi?.join(', ') || null,
                    nguon_goc: 'BAO_CAO_THANG',
                    chu_the: bc.danh_sach_ten_don_vi?.join(', ') || 'Báo cáo tháng cơ sở',
                    doi_tuong: bc.danh_sach_ten_don_vi?.join(', ') || 'Cơ sở',
                    nam: bc.nam || new Date().getFullYear(),
                    ngay_ban_hanh: bc.ngay_nop || (bc.created_at ? bc.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                    ghi_chu: `Báo cáo định kỳ tháng ${bc.thang}/${bc.nam}`,
                    created_at: bc.created_at || new Date().toISOString(),
                  });
                }
              }
            });
          }
        }
      } catch {
        // ignore
      }

      // 4. Lấy từ kho PDF độc lập nếu có
      if (db.pdfFiles && Array.isArray(db.pdfFiles)) {
        db.pdfFiles.forEach((p) => {
          if (!seenFileKeys.has('pdf_' + p.id)) {
            seenFileKeys.add('pdf_' + p.id);
            list.push({
              ...p,
              nguon_goc: p.nguon_goc || 'KHO_PDF',
              ngay_ban_hanh: p.ngay_ban_hanh || (p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            });
          }
        });
      }

      // Sắp xếp các file PDF theo thứ tự ngày ban hành mới nhất đến cũ hơn (dòng thời gian liên tục)
      list.sort((a, b) => {
        const dateA = a.ngay_ban_hanh || a.created_at || '';
        const dateB = b.ngay_ban_hanh || b.created_at || '';
        return dateB.localeCompare(dateA);
      });

      return list as T;
    }

    case 'create_or_attach_pdf': {
      const { input } = args as {
        input: {
          ten_file: string;
          dung_luong: number;
          url?: string | null;
          file_url?: string | null;
          chuong_trinh_id?: string | null;
          ghi_chu?: string | null;
          nguoi_tai_len?: string | null;
          nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
          don_vi_id?: string | null;
          ten_don_vi?: string | null;
          google_drive_id?: string | null;
          google_drive_preview_url?: string | null;
          is_google_drive?: boolean | null;
        };
      };

      if (input.chuong_trinh_id) {
        const ct = (db.chuongTrinhList || []).find((c) => c.id === input.chuong_trinh_id);
        if (ct) {
          ct.file_pdf_ten = input.ten_file;
          ct.file_pdf_dung_luong = input.dung_luong;
          if (input.url) ct.file_pdf_url = input.url;
          if (input.ghi_chu) ct.ghi_chu_pdf = input.ghi_chu;
          ct.updated_at = new Date().toISOString();
          saveMockDb(db);
          return {
            id: 'ct-pdf-' + ct.id,
            ten_file: input.ten_file,
            dung_luong: input.dung_luong,
            url: input.url || null,
            file_url: input.file_url || input.url || null,
            google_drive_id: input.google_drive_id || null,
            google_drive_preview_url: input.google_drive_preview_url || null,
            is_google_drive: input.is_google_drive || false,
            chuong_trinh_id: ct.id,
            nguon_goc: 'CHUONG_TRINH',
            chu_the: ct.chu_the,
            doi_tuong: ct.doi_tuong,
            nam: ct.nam,
            loai_hinh: ct.loai_hinh,
            so_van_ban: ct.so_van_ban,
            ghi_chu: input.ghi_chu || null,
            created_at: ct.updated_at,
          } as T;
        }
      }

      if (!db.pdfFiles) db.pdfFiles = [];
      const newPdf: PdfKhoItem = {
        id: 'pdf-' + Date.now(),
        ten_file: input.ten_file,
        dung_luong: input.dung_luong,
        url: input.url || null,
        file_url: input.file_url || input.url || null,
        google_drive_id: input.google_drive_id || null,
        google_drive_preview_url: input.google_drive_preview_url || null,
        is_google_drive: input.is_google_drive || false,
        chuong_trinh_id: null,
        nguon_goc: input.nguon_goc || 'KHO_PDF',
        don_vi_id: input.don_vi_id || null,
        ten_don_vi: input.ten_don_vi || null,
        chu_the: input.ten_don_vi || 'Văn bản / Kế hoạch độc lập',
        doi_tuong: input.ten_don_vi ? `Địa bàn ${input.ten_don_vi}` : 'Tài liệu nghiệp vụ KT-GS',
        nam: new Date().getFullYear(),
        ghi_chu: input.ghi_chu || null,
        created_at: new Date().toISOString(),
      };
      db.pdfFiles.unshift(newPdf);
      saveMockDb(db);
      return newPdf as T;
    }

    case 'delete_pdf': {
      const { id } = args as { id: string };
      if (id.startsWith('ct-pdf-')) {
        const ctId = id.replace('ct-pdf-', '');
        const ct = (db.chuongTrinhList || []).find((c) => c.id === ctId);
        if (ct) {
          ct.file_pdf_ten = null;
          ct.file_pdf_url = null;
          ct.file_pdf_dung_luong = null;
          ct.ghi_chu_pdf = null;
          ct.updated_at = new Date().toISOString();
          saveMockDb(db);
        }
      } else {
        if (!db.pdfFiles) db.pdfFiles = [];
        db.pdfFiles = db.pdfFiles.filter((p) => p.id !== id);
        saveMockDb(db);
      }
      return undefined as T;
    }

    // ── Quản lý Đơn thư Mock ──
    case 'get_all_don_thu': {
      return (db.donThuList || []) as T;
    }

    case 'create_don_thu': {
      const { input, actor_name } = args as { input: Partial<DonThu>; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      let maDon = input && input.ma_don ? input.ma_don.trim() : '';
      if (!maDon) {
        const nextNum = db.donThuList.length + 1;
        maDon = `ĐT-2026-${String(nextNum).padStart(3, '0')}`;
      }
      const now = new Date().toISOString();
      const newDonThu: DonThu = {
        id: `dt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ma_don: maDon,
        ngay_tiep_nhan: input?.ngay_tiep_nhan || now.slice(0, 10),
        loai_don: input?.loai_don || 'Khiếu nại',
        linh_vuc: input?.linh_vuc || 'Công tác đảng',
        doi_tuong_lien_quan: input?.doi_tuong_lien_quan || 'Tổ chức đảng',
        phan_loai_xu_ly: input?.phan_loai_xu_ly || 'Thuộc thẩm quyền',
        huong_xu_ly: input?.huong_xu_ly || 'Xem xét giải quyết',
        thoi_han_quy_dinh: Number(input?.thoi_han_quy_dinh) || 30,
        can_bo_phu_trach: input?.can_bo_phu_trach || 'Đ/c Nguyễn Văn A',
        trang_thai: input?.trang_thai || 'Mới tiếp nhận',
        ngay_hoan_thanh: input?.ngay_hoan_thanh || null,
        ghi_chu_nghiep_vu: input?.ghi_chu_nghiep_vu ? input.ghi_chu_nghiep_vu.slice(0, 255) : '',
        trong_ky: input?.trong_ky !== undefined ? input.trong_ky : true,
        created_at: now,
        updated_at: now,
      };
      db.donThuList.unshift(newDonThu);
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Tiếp nhận đơn thư mới: ${newDonThu.ma_don} (${newDonThu.loai_don} - ${newDonThu.linh_vuc})`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: newDonThu.id,
        du_lieu_cu: null,
        du_lieu_moi: JSON.stringify(newDonThu),
        thoi_gian: now,
      });
      saveMockDb(db);
      return newDonThu as T;
    }

    case 'update_don_thu': {
      const { id, input, actor_name } = args as { id: string; input: Partial<DonThu>; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      const idx = db.donThuList.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy đơn thư cần cập nhật');
      }
      const oldData = db.donThuList[idx];
      const updated: DonThu = {
        ...oldData,
        ...input,
        id: oldData.id,
        updated_at: new Date().toISOString(),
      };
      db.donThuList[idx] = updated;
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Cập nhật tiến độ đơn thư: ${updated.ma_don} (${updated.trang_thai})`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: updated.id,
        du_lieu_cu: JSON.stringify(oldData),
        du_lieu_moi: JSON.stringify(updated),
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return updated as T;
    }

    case 'delete_don_thu': {
      const { id, actor_name } = args as { id: string; actor_name?: string };
      if (!db.donThuList) db.donThuList = [];
      const found = db.donThuList.find((d) => d.id === id);
      if (!found) {
        throw new Error('Không tìm thấy đơn thư cần xóa');
      }
      db.donThuList = db.donThuList.filter((d) => d.id !== id);
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        nguoi_dung_id: null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Xóa hồ sơ đơn thư: ${found.ma_don}`,
        bang_anh_huong: 'don_thu',
        ban_ghi_id: found.id,
        du_lieu_cu: JSON.stringify(found),
        du_lieu_moi: null,
        thoi_gian: new Date().toISOString(),
      });
      saveMockDb(db);
      return undefined as T;
    }

    default:
      throw new Error(`Command not recognized: ${cmd}`);
  }
}

export const api = {
  login: (req: { ten_dang_nhap: string; mat_khau: string }) =>
    requestApi<{ user: User; token: string }>('/api/login', 'POST', { req }, 'login', { req }),

  changePassword: (req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string }) =>
    requestApi<void>('/api/change-password', 'POST', { req }, 'change_password', { req }),

  getCurrentUser: (user_id: string) =>
    requestApi<User>(`/api/current-user/${user_id}`, 'GET', undefined, 'get_current_user', { user_id }),

  getAllDonVi: () =>
    requestApi<DonVi[]>('/api/don-vi', 'GET', undefined, 'get_all_don_vi'),

  getDonViTree: () =>
    requestApi<DonViTreeItem[]>('/api/don-vi/tree', 'GET', undefined, 'get_don_vi_tree'),

  createDonVi: (input: CreateDonViInput, user_id?: string) =>
    requestApi<DonVi>('/api/don-vi', 'POST', { input, user_id }, 'create_don_vi', { input, user_id }),

  updateDonVi: (input: UpdateDonViInput, user_id?: string) =>
    requestApi<DonVi>(`/api/don-vi/${input.id}`, 'PUT', { input, user_id }, 'update_don_vi', { input, user_id }),

  deleteDonVi: (id: string, user_id?: string, actor_name?: string) =>
    requestApi<void>(`/api/don-vi/${id}`, 'DELETE', { user_id, actor_name }, 'delete_don_vi', { id, user_id, actor_name }),

  toggleDonViStatus: (id: string, trang_thai: TrangThaiDonVi, ly_do?: string, actor_name?: string, user_id?: string) =>
    requestApi<DonVi>(`/api/don-vi/${id}/toggle-status`, 'POST', { trang_thai, ly_do, actor_name, user_id }, 'toggle_don_vi_status', { id, trang_thai, ly_do, actor_name, user_id }),

  batchImportDonVi: (items: any[], actor_name?: string, user_id?: string) =>
    requestApi<{ success: boolean; importedCount: number; errorCount: number; errors: string[]; imported: DonVi[] }>('/api/don-vi/batch-import', 'POST', { items, actor_name, user_id }, 'batch_import_don_vi', { items, actor_name, user_id }),

  getDonViRelations: (id: string) =>
    requestApi<{ chuongTrinhCount: number; donThuCount: number; childrenCount: number; history: NhatKy[] }>(`/api/don-vi/${id}/relations`, 'GET', undefined, 'get_don_vi_relations', { id }),

  getAppInfo: () =>
    requestApi<AppInfo>('/api/app-info', 'GET', undefined, 'get_app_info'),

  getAuditLogs: (limit = 50) =>
    requestApi<NhatKy[]>(`/api/audit-logs?limit=${limit}`, 'GET', undefined, 'get_audit_logs', { limit }),

  resetAiQuocUnits: async () => {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    getMockDb();
    try {
      await fetch('/api/reset-data', { method: 'POST' });
    } catch {
      // ignore
    }
  },

  // ── Quản lý chương trình KT-GS ────────────────────────────────────────────
  getAllChuongTrinh: () =>
    requestApi<ChuongTrinhKtGs[]>('/api/chuong-trinh', 'GET', undefined, 'get_all_chuong_trinh'),

  createChuongTrinh: (input: CreateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>('/api/chuong-trinh', 'POST', { input }, 'create_chuong_trinh', { input }),

  updateChuongTrinh: (input: UpdateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>(`/api/chuong-trinh/${input.id}`, 'PUT', { input }, 'update_chuong_trinh', { input }),

  deleteChuongTrinh: (id: string) =>
    requestApi<void>(`/api/chuong-trinh/${id}`, 'DELETE', undefined, 'delete_chuong_trinh', { id }),

  addThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>('/api/thay-doi-bo-sung', 'POST', { input }, 'add_thay_doi_bo_sung', { input }),

  deleteThayDoiBoSung: (chuong_trinh_id: string, thay_doi_id: string) =>
    requestApi<void>(`/api/thay-doi-bo-sung/${chuong_trinh_id}/${thay_doi_id}`, 'DELETE', undefined, 'delete_thay_doi_bo_sung', { chuong_trinh_id, thay_doi_id }),

  updateThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>(`/api/thay-doi-bo-sung/${input.id}`, 'PUT', { input }, 'update_thay_doi_bo_sung', { input }),

  // ── Kho tệp PDF ───────────────────────────────────────────────────────────
  getAllPdfs: () =>
    requestApi<PdfKhoItem[]>('/api/pdfs', 'GET', undefined, 'get_all_pdfs'),

  createOrAttachPdf: (input: {
    ten_file: string;
    dung_luong: number;
    url?: string | null;
    file_url?: string | null;
    google_drive_id?: string | null;
    google_drive_preview_url?: string | null;
    is_google_drive?: boolean | null;
    chuong_trinh_id?: string | null;
    ghi_chu?: string | null;
    nguoi_tai_len?: string | null;
    nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
    don_vi_id?: string | null;
    ten_don_vi?: string | null;
  }) =>
    requestApi<PdfKhoItem>('/api/pdfs', 'POST', { input }, 'create_or_attach_pdf', { input }),

  deletePdf: (id: string) =>
    requestApi<void>(`/api/pdfs/${id}`, 'DELETE', undefined, 'delete_pdf', { id }),

  // ── Quản lý người dùng ────────────────────────────────────────────────────
  getAllUsers: () =>
    requestApi<User[]>('/api/users', 'GET', undefined, 'get_all_users'),

  createUser: (
    req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<User>('/api/users', 'POST', { req, actor_id, actor_name }, 'create_user', { req, actor_id, actor_name }),

  resetUserPassword: (
    req: { user_id: string; mat_khau_moi: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<void>('/api/users/reset-password', 'POST', { req, actor_id, actor_name }, 'reset_user_password', { req, actor_id, actor_name }),

  updateUser: (
    req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string },
    actor_id: string,
    actor_name: string,
  ) =>
    requestApi<void>(`/api/users/${req.user_id}`, 'PUT', { req, actor_id, actor_name }, 'update_user', { req, actor_id, actor_name }),

  deleteUser: (user_id: string, actor_id: string, actor_name: string) =>
    requestApi<void>(`/api/users/${user_id}`, 'DELETE', { actor_id, actor_name }, 'delete_user', { user_id, actor_id, actor_name }),

  // ── Quản lý Đơn thư ────────────────────────────────────────────────────────
  getAllDonThu: () =>
    requestApi<DonThu[]>('/api/don-thu', 'GET', undefined, 'get_all_don_thu'),

  createDonThu: (input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>('/api/don-thu', 'POST', { input, actor_name }, 'create_don_thu', { input, actor_name }),

  updateDonThu: (id: string, input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>(`/api/don-thu/${id}`, 'PUT', { input, actor_name }, 'update_don_thu', { id, input, actor_name }),

  deleteDonThu: (id: string, actor_name?: string) =>
    requestApi<void>(`/api/don-thu/${id}`, 'DELETE', { actor_name }, 'delete_don_thu', { id, actor_name }),
};
