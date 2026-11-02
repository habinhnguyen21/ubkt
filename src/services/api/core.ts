import type {
  ChuongTrinhKtGs,
  DiaBanRecord,
  DonThu,
  DonVi,
  HoSoDiaBanFile,
  NhatKy,
  PdfKhoItem,
  PhanCongDiaBan,
  User,
} from '../../types';
import { cloudSyncService } from '../cloudSyncService';
import { INITIAL_SEED_ADMIN_HASH } from '../../utils/passwordCrypto';

export const STORAGE_DELETED_DON_VI_IDS = 'ubkt_deleted_don_vi_ids';
export const STORAGE_DELETED_CHUONG_TRINH_IDS = 'ubkt_deleted_chuong_trinh_ids';
export const STORAGE_DELETED_DIABAN_IDS = 'ubkt_deleted_diaban_ids';
export const STORAGE_DELETED_PDF_IDS = 'ubkt_deleted_pdf_ids';
export const STORAGE_DELETED_PDF_NAMES = 'ubkt_deleted_pdf_names';
export const MOCK_STORAGE_KEY = 'ubkt_mock_db';

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

export function getDeletedDiaBanIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_DIABAN_IDS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedDiaBanId(id: string) {
  try {
    const set = getDeletedDiaBanIds();
    set.add(id);
    localStorage.setItem(STORAGE_DELETED_DIABAN_IDS, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Lỗi lưu ID địa bàn đã xóa:', err);
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

export function getDeletedPdfIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_PDF_IDS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedPdfId(id: string) {
  try {
    const set = getDeletedPdfIds();
    set.add(id);
    localStorage.setItem(STORAGE_DELETED_PDF_IDS, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Lỗi lưu ID PDF đã xóa:', err);
  }
}

export function getDeletedPdfNames(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_PDF_NAMES);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedPdfName(name: string) {
  if (!name) return;
  try {
    const set = getDeletedPdfNames();
    set.add(name);
    localStorage.setItem(STORAGE_DELETED_PDF_NAMES, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Lỗi lưu tên PDF đã xóa:', err);
  }
}

export interface MockDb {
  users: User[];
  donViList: DonVi[];
  chuongTrinhList: ChuongTrinhKtGs[];
  auditLogs: NhatKy[];
  pdfFiles?: PdfKhoItem[];
  donThuList?: DonThu[];
  diaBanRecords?: DiaBanRecord[];
  hoSoDiaBanFiles?: HoSoDiaBanFile[];
  phanCongDiaBan?: PhanCongDiaBan[];
}

export function getInitialProductionDb(): MockDb {
  const now = new Date().toISOString();
  const seedAdmin: User & { mat_khau_hash?: string } = {
    id: '01918a00-0000-7000-8000-000000000000',
    ten_dang_nhap: 'admin',
    ho_ten: 'Quản trị viên Hệ thống',
    vai_tro: 'ADMIN',
    chuc_danh: 'Chủ nhiệm UBKT',
    trang_thai: 1,
    must_change_password: true,
    mat_khau_hash: INITIAL_SEED_ADMIN_HASH,
    created_at: now,
    updated_at: now,
  };
  return {
    users: [seedAdmin],
    donViList: [
      {
        id: '01918a00-0000-7000-8000-000000000001',
        ten: 'Đảng ủy cơ sở',
        loai: 'DANG_BO',
        don_vi_cha_id: null,
        ma: 'DU-01',
        thu_tu: 1,
        ghi_chu:
          'Cơ quan lãnh đạo cao nhất của Đảng bộ cơ sở (Bấm chỉnh sửa để đổi tên theo đúng cơ quan thực tế)',
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

export function getMockDb(): MockDb {
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
        parsed.donViList = parsed.donViList.filter(
          (d) => !deletedDvIds.has(d.id) && !d.deleted_at
        );
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

export function saveMockDb(db: MockDb) {
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
      await cloudSyncService.smartSync();
    } catch (err) {
      console.warn('Lỗi đồng bộ từ Firestore (dùng dữ liệu bộ nhớ đệm):', err);
    }
  })();
  return firestoreSyncPromise;
}

export type MockCommandHandler = (
  db: MockDb,
  args?: Record<string, unknown>
) => Promise<unknown>;

const commandRegistry = new Map<string, MockCommandHandler>();

export function registerMockCommands(handlers: Record<string, MockCommandHandler>) {
  for (const [cmd, handler] of Object.entries(handlers)) {
    commandRegistry.set(cmd, handler);
  }
}

export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await ensureFirestoreSynced();
  const db = getMockDb();
  const handler = commandRegistry.get(cmd);
  if (!handler) {
    throw new Error(`Command not recognized: ${cmd}`);
  }
  return (await handler(db, args)) as T;
}

export async function requestApi<T>(
  endpoint: string,
  method = 'GET',
  body?: unknown,
  fallbackCmd?: string,
  fallbackArgs?: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = localStorage.getItem('ubkt_session_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers,
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const errJson = await res.json().catch(() => null);
    const errorMessage = errJson?.message || `Lỗi máy chủ trực tuyến (${res.status})`;

    if (res.status === 401 || res.status === 403) {
      throw new Error(errorMessage);
    }

    throw new Error(errorMessage);
  } catch (err: unknown) {
    const errText = err instanceof Error ? err.message : String(err);
    if (
      errText.includes('401') ||
      errText.includes('403') ||
      errText.includes('Từ chối truy cập') ||
      errText.includes('Yêu cầu đăng nhập')
    ) {
      throw err;
    }

    if (fallbackCmd) {
      return mockInvoke<T>(fallbackCmd, fallbackArgs);
    }
    throw err;
  }
}

