import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  writeBatch,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db as firestoreDb, auth } from './firebase';
import { isSameData, captureActiveInput, restoreActiveInput } from '../utils/syncUtils';
import { sanitizeUserForCloud } from '../utils/passwordCrypto';
import { sessionStore } from '../utils/sessionStore';
import type {
  DonVi,
  ChuongTrinhKtGs,
  PdfKhoItem,
  DonThu,
  User,
  HoSoDiaBanFile,
  BaoCaoThangItem,
} from '../types';

export interface Tombstone {
  id: string;
  collection: string;
  deleted_at: string;
  deleted_by?: string;
}

export const VERSIONED_COLLECTIONS = new Set([
  'chuong_trinh',
  'ho_so_dia_ban_records',
  'don_vi',
  'bao_cao_thang',
]);

export const META_KEYS = new Set([
  'version',
  'updated_at',
  'updated_by',
  'created_at',
  'created_by',
  'sync_status',
  'is_deleted',
  'thoi_diem_cap_nhat_gan_nhat',
  'nguoi_cap_nhat_gan_nhat',
]);

export function getBusinessContentDiff(localData: any, cloudData: any): string[] {
  const diffKeys: string[] = [];
  const allKeys = new Set([
    ...Object.keys(localData || {}),
    ...Object.keys(cloudData || {}),
  ]);

  for (const k of allKeys) {
    if (META_KEYS.has(k)) continue;
    const vLocal = localData?.[k];
    const vCloud = cloudData?.[k];
    const isLocalEmpty = vLocal === undefined || vLocal === null || vLocal === '';
    const isCloudEmpty = vCloud === undefined || vCloud === null || vCloud === '';
    if (isLocalEmpty && isCloudEmpty) {
      continue;
    }
    if (!isSameData(vLocal, vCloud)) {
      diffKeys.push(k);
    }
  }
  return diffKeys;
}

export interface VersionConflictPayload {
  collectionName: string;
  id: string;
  localData: any;
  cloudData: any;
  localVersion: number;
  cloudVersion: number;
  updatedBy: string;
  updatedAt: string;
  diffKeys?: string[];
}

export class VersionConflictError extends Error {
  conflict: VersionConflictPayload;
  constructor(conflict: VersionConflictPayload) {
    const timeFormatted = conflict.updatedAt
      ? (() => {
          try {
            const d = new Date(conflict.updatedAt);
            return isNaN(d.getTime()) ? conflict.updatedAt : d.toLocaleString('vi-VN');
          } catch {
            return conflict.updatedAt;
          }
        })()
      : 'vừa xong';
    super(`Bản ghi vừa được ${conflict.updatedBy} sửa lúc ${timeFormatted}.`);
    this.name = 'VersionConflictError';
    this.conflict = conflict;
  }
}

export interface SaveDocOptions {
  expectedVersion?: number;
  forceOverwrite?: boolean;
  skipConflictDialog?: boolean;
}

function getCurrentUserName(): string {
  const u = sessionStore.getCurrentUser();
  return u?.ho_ten || u?.ten_dang_nhap || 'Cán bộ hệ thống';
}

interface ConflictQueueItem {
  conflict: VersionConflictPayload;
  resolve: (action: 'reload' | 'overwrite') => void;
}

let conflictQueue: ConflictQueueItem[] = [];
let isResolvingConflict = false;

function processNextConflict(): void {
  if (isResolvingConflict || conflictQueue.length === 0) return;
  if (typeof window === 'undefined') {
    while (conflictQueue.length > 0) {
      const item = conflictQueue.shift();
      item?.resolve('reload');
    }
    return;
  }

  isResolvingConflict = true;
  const current = conflictQueue[0];

  window.dispatchEvent(
    new CustomEvent('ubkt_version_conflict', {
      detail: {
        conflict: current.conflict,
        resolve: (action: 'reload' | 'overwrite') => {
          isResolvingConflict = false;
          conflictQueue.shift();
          current.resolve(action);
          setTimeout(processNextConflict, 150);
        },
      },
    })
  );
}

export function requestConflictResolution(conflict: VersionConflictPayload): Promise<'reload' | 'overwrite'> {
  return new Promise((resolve) => {
    conflictQueue.push({ conflict, resolve });
    processNextConflict();
  });
}

// Bộ nhớ đệm thời gian thực trong tiến trình (In-Memory Real-Time Cache)
interface DataCache {
  donViList: DonVi[];
  chuongTrinhList: ChuongTrinhKtGs[];
  hoSoDiaBanRecords: any[];
  hoSoDiaBanFiles: HoSoDiaBanFile[];
  baoCaoThangList: BaoCaoThangItem[];
  pdfFiles: PdfKhoItem[];
  donThuList: DonThu[];
  users: User[];
  phanCongList: any[];
  tombstones: Set<string>;
  systemConfig: Record<string, any>;
  isInitialized: boolean;
}

const memoryCache: DataCache = {
  donViList: [],
  chuongTrinhList: [],
  hoSoDiaBanRecords: [],
  hoSoDiaBanFiles: [],
  baoCaoThangList: [],
  pdfFiles: [],
  donThuList: [],
  users: [],
  phanCongList: [],
  tombstones: new Set<string>(),
  systemConfig: {},
  isInitialized: false,
};

const activeListeners = new Map<string, Unsubscribe>();
let isListening = false;
let currentListeningUid: string | null = null;

function getCurrentUserRole(): string | null {
  return sessionStore.getCurrentUser()?.vai_tro || null;
}

function isCurrentUserAdmin(): boolean {
  return getCurrentUserRole() === 'ADMIN';
}

// Tải nhanh từ localStorage khi vừa khởi động để UI hiển thị tức thì (Cache-First)
function loadInitialFromLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawMock = localStorage.getItem('ubkt_mock_db');
    if (rawMock) {
      const parsed = JSON.parse(rawMock);
      if (Array.isArray(parsed.donViList)) memoryCache.donViList = parsed.donViList;
      if (Array.isArray(parsed.chuongTrinhList)) memoryCache.chuongTrinhList = parsed.chuongTrinhList;
      if (Array.isArray(parsed.pdfFiles)) memoryCache.pdfFiles = parsed.pdfFiles;
      if (Array.isArray(parsed.donThuList)) memoryCache.donThuList = parsed.donThuList;
      if (Array.isArray(parsed.users)) memoryCache.users = parsed.users;
    }

    const rawHsdb = localStorage.getItem('ubkt_ho_so_dia_ban_records');
    if (rawHsdb) memoryCache.hoSoDiaBanRecords = JSON.parse(rawHsdb);

    const rawFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
    if (rawFiles) memoryCache.hoSoDiaBanFiles = JSON.parse(rawFiles);

    const rawBc = localStorage.getItem('ubkt_bao_cao_thang');
    if (rawBc) memoryCache.baoCaoThangList = JSON.parse(rawBc);

    const rawPc = localStorage.getItem('ubkt_phan_cong_dia_ban');
    if (rawPc) memoryCache.phanCongList = JSON.parse(rawPc);

    const rawTomb = localStorage.getItem('ubkt_tombstones');
    if (rawTomb) memoryCache.tombstones = new Set(JSON.parse(rawTomb));
  } catch (err) {
    console.warn('[CentralData] Lỗi nạp cache localStorage:', err);
  }
}

// Lưu phản chiếu ngược vào localStorage để đảm bảo tương thích ngược và xem ngoại tuyến
function persistCacheToLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    const mockDb = {
      users: memoryCache.users,
      donViList: memoryCache.donViList,
      chuongTrinhList: memoryCache.chuongTrinhList,
      pdfFiles: memoryCache.pdfFiles,
      donThuList: memoryCache.donThuList,
      auditLogs: [],
    };
    localStorage.setItem('ubkt_mock_db', JSON.stringify(mockDb));
    localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(memoryCache.hoSoDiaBanRecords));
    localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(memoryCache.hoSoDiaBanFiles));
    localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(memoryCache.baoCaoThangList));
    localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(memoryCache.phanCongList));
    localStorage.setItem('ubkt_tombstones', JSON.stringify(Array.from(memoryCache.tombstones)));
  } catch (err) {
    console.warn('[CentralData] Lỗi lưu cache localStorage:', err);
  }
}

// Khởi tạo cache ban đầu
loadInitialFromLocalStorage();

export const centralDataService = {
  // Lấy dữ liệu từ cache thời gian thực
  getDonViList(): DonVi[] {
    return memoryCache.donViList.filter((d) => !d.deleted_at && !memoryCache.tombstones.has(d.id));
  },

  getChuongTrinhList(): ChuongTrinhKtGs[] {
    return memoryCache.chuongTrinhList.filter((c) => !memoryCache.tombstones.has(c.id));
  },

  getHoSoDiaBanRecords(): any[] {
    return memoryCache.hoSoDiaBanRecords.filter((r) => !memoryCache.tombstones.has(r.id));
  },

  getHoSoDiaBanFiles(): HoSoDiaBanFile[] {
    return memoryCache.hoSoDiaBanFiles.filter((f) => !memoryCache.tombstones.has(f.id));
  },

  getBaoCaoThangList(): BaoCaoThangItem[] {
    return memoryCache.baoCaoThangList.filter((b) => !memoryCache.tombstones.has(b.id));
  },

  getPdfFiles(): PdfKhoItem[] {
    return memoryCache.pdfFiles.filter((p) => !memoryCache.tombstones.has(p.id));
  },

  getDonThuList(): DonThu[] {
    return memoryCache.donThuList.filter((d) => !memoryCache.tombstones.has(d.id));
  },

  getUsers(): User[] {
    return memoryCache.users.filter((u) => !memoryCache.tombstones.has(u.id));
  },

  getPhanCongList(): any[] {
    return memoryCache.phanCongList.filter((p) => !memoryCache.tombstones.has(p.id));
  },

  isReady(): boolean {
    return memoryCache.isInitialized;
  },

  // ── HỦY ĐĂNG KÝ TẤT CẢ ONSNAPSHOT KHI ĐĂNG XUẤT ──────────────────────────────
  stopRealtimeSync(): void {
    if (activeListeners.size > 0) {
      activeListeners.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      activeListeners.clear();
    }
    isListening = false;
    currentListeningUid = null;
  },

  // ── 1. KẾT NỐI REAL-TIME FIRESTORE (onSnapshot cho tất cả bảng) ──────────────
  initRealtimeSync(): () => void {
    if (!auth.currentUser) {
      this.stopRealtimeSync();
      return () => {};
    }
    if (isListening && currentListeningUid === auth.currentUser.uid && activeListeners.size > 0) {
      return () => this.stopRealtimeSync();
    }
    // Hủy các listener cũ (nếu đổi tài khoản) trước khi gắn mới để đảm bảo mỗi collection chỉ gắn 1 lần
    this.stopRealtimeSync();
    isListening = true;
    currentListeningUid = auth.currentUser.uid;

    const registerOnce = (key: string, subscribeFn: () => Unsubscribe) => {
      const existing = activeListeners.get(key);
      if (existing) {
        try {
          existing();
        } catch {}
      }
      activeListeners.set(key, subscribeFn());
    };

    console.log('[CentralData] Khởi động Realtime Firestore Listeners (1 listener/collection)...');

    // Lắng nghe Tombstones (bản ghi đã xoá trên toàn hệ thống)
    registerOnce('tombstones', () =>
      onSnapshot(
        collection(firestoreDb, 'tombstones'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          let changed = false;
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              memoryCache.tombstones.add(d.id);
              changed = true;
            }
          });
          if (changed) {
            persistCacheToLocalStorage();
          }
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe tombstones:', err)
      )
    );

    // Lắng nghe Đơn vị
    registerOnce('don_vi', () =>
      onSnapshot(
        collection(firestoreDb, 'don_vi'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: DonVi[] = [];
          snap.docs.forEach((d) => {
            const data = d.data() as DonVi;
            if (!data.deleted_at && !memoryCache.tombstones.has(d.id)) {
              items.push({ ...data, id: d.id });
            }
          });
          // Sắp xếp thứ tự
          items.sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
          if (isSameData(memoryCache.donViList, items)) return;
          memoryCache.donViList = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_don_vi_updated'));
          window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe don_vi:', err)
      )
    );

    // Lắng nghe Chương trình KT-GS
    registerOnce('chuong_trinh', () =>
      onSnapshot(
        collection(firestoreDb, 'chuong_trinh'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: ChuongTrinhKtGs[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...(d.data() as ChuongTrinhKtGs), id: d.id });
            }
          });
          if (isSameData(memoryCache.chuongTrinhList, items)) return;
          memoryCache.chuongTrinhList = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
          window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe chuong_trinh:', err)
      )
    );

    // Lắng nghe Hồ sơ địa bàn
    registerOnce('ho_so_dia_ban_records', () =>
      onSnapshot(
        collection(firestoreDb, 'ho_so_dia_ban_records'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: any[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...d.data(), id: d.id });
            }
          });
          if (isSameData(memoryCache.hoSoDiaBanRecords, items)) return;
          memoryCache.hoSoDiaBanRecords = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe ho_so_dia_ban_records:', err)
      )
    );

    // Lắng nghe File hồ sơ địa bàn
    registerOnce('ho_so_dia_ban_files', () =>
      onSnapshot(
        collection(firestoreDb, 'ho_so_dia_ban_files'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: HoSoDiaBanFile[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...(d.data() as HoSoDiaBanFile), id: d.id });
            }
          });
          if (isSameData(memoryCache.hoSoDiaBanFiles, items)) return;
          memoryCache.hoSoDiaBanFiles = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
          window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe ho_so_dia_ban_files:', err)
      )
    );

    // Lắng nghe Báo cáo tháng
    registerOnce('bao_cao_thang', () =>
      onSnapshot(
        collection(firestoreDb, 'bao_cao_thang'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: BaoCaoThangItem[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...(d.data() as BaoCaoThangItem), id: d.id });
            }
          });
          if (isSameData(memoryCache.baoCaoThangList, items)) return;
          memoryCache.baoCaoThangList = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
          window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe bao_cao_thang:', err)
      )
    );

    // Lắng nghe Kho PDF
    registerOnce('pdf_files', () =>
      onSnapshot(
        collection(firestoreDb, 'pdf_files'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: PdfKhoItem[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...(d.data() as PdfKhoItem), id: d.id });
            }
          });
          if (isSameData(memoryCache.pdfFiles, items)) return;
          memoryCache.pdfFiles = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe pdf_files:', err)
      )
    );

    // Lắng nghe Đơn thư
    registerOnce('don_thu', () =>
      onSnapshot(
        collection(firestoreDb, 'don_thu'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: DonThu[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...(d.data() as DonThu), id: d.id });
            }
          });
          if (isSameData(memoryCache.donThuList, items)) return;
          memoryCache.donThuList = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_don_thu_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe don_thu:', err)
      )
    );

    // Lắng nghe Users (ADMIN đọc tất cả; người dùng khác chỉ đọc hồ sơ của chính mình; không có trường mật khẩu)
    if (isCurrentUserAdmin()) {
      registerOnce('users', () =>
        onSnapshot(
          collection(firestoreDb, 'users'),
          (snap) => {
            if (snap.metadata.hasPendingWrites) return;
            const items: User[] = [];
            snap.docs.forEach((d) => {
              if (!memoryCache.tombstones.has(d.id)) {
                const rawData = d.data() as Record<string, any>;
                if ('mat_khau' in rawData || 'mat_khau_hash' in rawData) {
                  setDoc(
                    d.ref,
                    { mat_khau: deleteField(), mat_khau_hash: deleteField() },
                    { merge: true }
                  ).catch(() => {});
                }
                const cleanUser = sanitizeUserForCloud(rawData) as User;
                items.push({ ...cleanUser, id: d.id });
              }
            });
            if (isSameData(memoryCache.users, items)) return;
            memoryCache.users = items;
            persistCacheToLocalStorage();
            const activeSnap = captureActiveInput();
            window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
            restoreActiveInput(activeSnap);
          },
          (err) => console.warn('[Realtime] Lỗi lắng nghe users:', err)
        )
      );
    } else if (auth.currentUser?.uid) {
      const currentUid = auth.currentUser.uid;
      registerOnce('users_self', () =>
        onSnapshot(
          doc(firestoreDb, 'users', currentUid),
          (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) return;
            if (!docSnap.exists()) return;
            const cleanUser = sanitizeUserForCloud(docSnap.data() as Record<string, any>) as User;
            const selfItem = { ...cleanUser, id: docSnap.id };
            const idx = memoryCache.users.findIndex((u) => u.id === selfItem.id);
            if (idx !== -1) {
              if (isSameData(memoryCache.users[idx], selfItem)) return;
              memoryCache.users[idx] = selfItem;
            } else {
              memoryCache.users.push(selfItem);
            }
            persistCacheToLocalStorage();
            window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
          },
          (err) => console.warn('[Realtime] Lỗi lắng nghe hồ sơ cá nhân:', err)
        )
      );
    }

    // Lắng nghe Phân công địa bàn
    registerOnce('phan_cong_dia_ban', () =>
      onSnapshot(
        collection(firestoreDb, 'phan_cong_dia_ban'),
        (snap) => {
          if (snap.metadata.hasPendingWrites) return;
          const items: any[] = [];
          snap.docs.forEach((d) => {
            if (!memoryCache.tombstones.has(d.id)) {
              items.push({ ...d.data(), id: d.id });
            }
          });
          if (isSameData(memoryCache.phanCongList, items)) return;
          memoryCache.phanCongList = items;
          persistCacheToLocalStorage();
          const activeSnap = captureActiveInput();
          window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
          restoreActiveInput(activeSnap);
        },
        (err) => console.warn('[Realtime] Lỗi lắng nghe phan_cong_dia_ban:', err)
      )
    );

    memoryCache.isInitialized = true;

    return () => {
      this.stopRealtimeSync();
    };
  },

  // ── 2. GHI DỮ LIỆU ĐỒNG BỘ TRỰC TIẾP LÊN FIRESTORE (DÙNG TRANSACTION KIỂM TRA VERSION) ──
  async saveDoc<T extends { id: string }>(
    collectionName: string,
    id: string,
    data: T,
    options?: SaveDocOptions
  ): Promise<T> {
    if (!id) throw new Error('ID bản ghi không hợp lệ');

    const now = new Date().toISOString();
    const actorName = (data as any).updated_by || getCurrentUserName();
    const cleanPayload: any = {
      ...data,
      id,
      updated_at: now,
      updated_by: actorName,
      is_deleted: false,
    };
    if (!cleanPayload.created_at) {
      cleanPayload.created_at = now;
    }

    // Gỡ bỏ undefined để tránh lỗi Firestore
    Object.keys(cleanPayload).forEach((k) => {
      if (cleanPayload[k] === undefined) delete cleanPayload[k];
    });

    // Không bao giờ đẩy bất kỳ trường mật khẩu nào lên Firestore collection users
    const firestorePayload: any = { ...cleanPayload };
    if (collectionName === 'users') {
      delete cleanPayload.mat_khau;
      delete cleanPayload.mat_khau_hash;
      delete cleanPayload.password;
      delete cleanPayload.passwordHash;
      delete firestorePayload.mat_khau;
      delete firestorePayload.mat_khau_hash;
      delete firestorePayload.password;
      delete firestorePayload.passwordHash;
      firestorePayload.mat_khau = deleteField();
      firestorePayload.mat_khau_hash = deleteField();
    }

    const docRef = doc(firestoreDb, collectionName, id);

    if (VERSIONED_COLLECTIONS.has(collectionName)) {
      const expectedVersion =
        options?.expectedVersion !== undefined
          ? options.expectedVersion
          : typeof (data as any).version === 'number'
          ? (data as any).version
          : undefined;

      try {
        await runTransaction(firestoreDb, async (transaction) => {
          const snap = await transaction.get(docRef);
          if (snap.exists()) {
            const cloudData = snap.data();
            const cloudVersion =
              typeof cloudData.version === 'number' && Number.isInteger(cloudData.version)
                ? cloudData.version
                : 0;

            if (
              !options?.forceOverwrite &&
              cloudVersion > 0 &&
              expectedVersion !== undefined &&
              expectedVersion !== cloudVersion
            ) {
              const diffKeys = getBusinessContentDiff(cleanPayload, cloudData);

              if (diffKeys.length === 0) {
                // Hai bản chỉ khác nhau ở các trường meta: tự dùng version Cloud và tiếp tục ghi
                console.info(
                  `[saveDoc] Chỉ khác trường meta (${collectionName}/${id}), tự dùng cloudVersion v${cloudVersion} và tiếp tục lưu.`
                );
              } else {
                throw new VersionConflictError({
                  collectionName,
                  id,
                  localData: cleanPayload,
                  cloudData: { ...cloudData, id },
                  localVersion: expectedVersion,
                  cloudVersion,
                  diffKeys,
                  updatedBy:
                    cloudData.updated_by ||
                    cloudData.nguoi_cap_nhat_ten ||
                    cloudData.nguoi_cap_nhat_gan_nhat ||
                    cloudData.can_bo_ten ||
                    'Cán bộ khác',
                  updatedAt:
                    cloudData.updated_at ||
                    cloudData.thoi_diem_cap_nhat_gan_nhat ||
                    now,
                });
              }
            }

            const nextVersion = cloudVersion > 0 ? cloudVersion + 1 : 1;
            cleanPayload.version = nextVersion;
            firestorePayload.version = nextVersion;
          } else {
            cleanPayload.version = 1;
            firestorePayload.version = 1;
          }

          transaction.set(docRef, firestorePayload, { merge: true });
        });
      } catch (err) {
        if (err instanceof VersionConflictError) {
          if (options?.skipConflictDialog) {
            throw err;
          }
          const action = await requestConflictResolution(err.conflict);
          if (action === 'overwrite') {
            return this.saveDoc(collectionName, id, data, {
              ...options,
              forceOverwrite: true,
            });
          } else {
            // Người dùng chọn "Tải lại": cập nhật cache bằng dữ liệu mới trên Cloud và báo làm mới UI
            this._updateMemoryCacheItem(collectionName, err.conflict.cloudData);
            persistCacheToLocalStorage();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
              window.dispatchEvent(new CustomEvent('ubkt_don_vi_updated'));
              window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
              window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
            }
            throw new Error(err.message + ' Đã tải lại dữ liệu mới nhất từ Cloud.');
          }
        }
        throw err;
      }
    } else {
      // 1. Ghi thẳng lên Firestore Cloud và chờ xác nhận
      await setDoc(docRef, firestorePayload, { merge: true });
    }

    // 2. Nếu ID này từng nằm trong tombstones, xóa khỏi tombstones (chỉ ADMIN mới có quyền ghi/xóa tombstones)
    if (memoryCache.tombstones.has(id)) {
      memoryCache.tombstones.delete(id);
      if (isCurrentUserAdmin()) {
        deleteDoc(doc(firestoreDb, 'tombstones', id)).catch(() => {});
      }
    }

    // 3. Cập nhật cache cục bộ tức thì
    this._updateMemoryCacheItem(collectionName, cleanPayload);
    persistCacheToLocalStorage();

    return cleanPayload;
  },

  /**
   * Ghi tự động hồ sơ địa bàn trong nền (không do người dùng trực tiếp bấm lưu).
   * Luôn dùng skipConflictDialog: true.
   * Khi gặp VersionConflictError: lấy bản Cloud mới nhất, áp lại CHỈ các trường tự suy ra
   * lên bản Cloud rồi thử lại tối đa 2 lần. Nếu vẫn lỗi thì console.warn và bỏ qua.
   * TUYỆT ĐỐI không bao giờ làm hiện hộp thoại xung đột cho người dùng.
   */
  async saveBackgroundDiaBanRecord(
    id: string,
    record: any,
    derivedFieldKeys: string[] = [
      'can_bo_phu_trach_id',
      'can_bo_phu_trach_ids',
      'can_bo_phu_trach_ten',
      'can_bo_chuc_vu',
      'thoi_gian_phan_cong',
      'lich_su_phu_trach',
    ]
  ): Promise<any | null> {
    if (!id) return null;

    let payload = { ...record };
    let retries = 2;

    while (retries >= 0) {
      try {
        const saved = await this.saveDoc('ho_so_dia_ban_records', id, payload, {
          skipConflictDialog: true,
          expectedVersion: typeof payload.version === 'number' ? payload.version : undefined,
        });
        return saved;
      } catch (err: any) {
        if (err instanceof VersionConflictError && retries > 0) {
          retries--;
          const cloudData = err.conflict.cloudData || {};
          const merged = { ...cloudData };
          // Áp lại CHỈ các trường tự suy ra lên bản Cloud
          derivedFieldKeys.forEach((key) => {
            if (record[key] !== undefined) {
              merged[key] = record[key];
            }
          });
          merged.version = err.conflict.cloudVersion;
          payload = merged;
          continue;
        }

        console.warn(`[BackgroundSync] Bỏ qua ghi tự động hồ sơ địa bàn ${id} do xung đột hoặc lỗi:`, err?.message || err);
        return null;
      }
    }
    return null;
  },

  // ── 3. XOÁ BẢN GHI AN TOÀN (TOMBSTONE TRÊN CLOUD - CHỐNG HỒI SINH) ───────────
  async deleteDoc(collectionName: string, id: string, actor_name?: string): Promise<void> {
    if (!id) return;

    const now = new Date().toISOString();
    const tombstoneDoc = {
      id,
      collection: collectionName,
      deleted_at: now,
      deleted_by: actor_name || 'Người dùng hệ thống',
    };

    // 1. Đánh dấu tombstone trên Firestore Cloud (chỉ ADMIN được quyền ghi tombstones theo Rules)
    if (isCurrentUserAdmin()) {
      await setDoc(doc(firestoreDb, 'tombstones', id), tombstoneDoc).catch(() => {});
    }

    // 2. Xóa tài liệu khỏi Firestore
    await deleteDoc(doc(firestoreDb, collectionName, id));

    // 3. Cập nhật bộ nhớ cục bộ
    memoryCache.tombstones.add(id);
    this._removeMemoryCacheItem(collectionName, id);
    persistCacheToLocalStorage();

    console.log(`[CentralData] Đã xóa an toàn ${collectionName}/${id}`);
  },

  // ── 4. XOÁ HÀNG LOẠT (CHỈ ADMIN ĐƯỢC PHÉP, CHẶN XÓA HÀNG LOẠT TRÁI PHÉP) ────
  async batchDelete(collectionName: string, ids: string[], actor_name?: string): Promise<void> {
    if (!ids || ids.length === 0) return;
    if (!isCurrentUserAdmin()) {
      throw new Error('Từ chối truy cập: Hệ thống không cho phép xóa dữ liệu hàng loạt.');
    }
    const now = new Date().toISOString();
    const batch = writeBatch(firestoreDb);

    ids.forEach((id) => {
      // Đánh dấu tombstone
      const tombRef = doc(firestoreDb, 'tombstones', id);
      batch.set(tombRef, {
        id,
        collection: collectionName,
        deleted_at: now,
        deleted_by: actor_name || 'Người dùng hệ thống',
      });
      // Xoá tài liệu chính
      const itemRef = doc(firestoreDb, collectionName, id);
      batch.delete(itemRef);

      memoryCache.tombstones.add(id);
      this._removeMemoryCacheItem(collectionName, id);
    });

    await batch.commit();
    persistCacheToLocalStorage();
    console.log(`[CentralData] Đã xóa hàng loạt ${ids.length} bản ghi khỏi ${collectionName}`);
  },

  // ── HÀM BỔ TRỢ CẬP NHẬT CACHE NỘI BỘ ────────────────────────────────────────
  _updateMemoryCacheItem(collectionName: string, item: any) {
    switch (collectionName) {
      case 'don_vi': {
        const idx = memoryCache.donViList.findIndex((d) => d.id === item.id);
        if (idx !== -1) memoryCache.donViList[idx] = item;
        else memoryCache.donViList.push(item);
        memoryCache.donViList.sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
        break;
      }
      case 'chuong_trinh': {
        const idx = memoryCache.chuongTrinhList.findIndex((c) => c.id === item.id);
        if (idx !== -1) memoryCache.chuongTrinhList[idx] = item;
        else memoryCache.chuongTrinhList.push(item);
        break;
      }
      case 'ho_so_dia_ban_records': {
        const idx = memoryCache.hoSoDiaBanRecords.findIndex((r) => r.id === item.id);
        if (idx !== -1) memoryCache.hoSoDiaBanRecords[idx] = item;
        else memoryCache.hoSoDiaBanRecords.push(item);
        break;
      }
      case 'ho_so_dia_ban_files': {
        const idx = memoryCache.hoSoDiaBanFiles.findIndex((f) => f.id === item.id);
        if (idx !== -1) memoryCache.hoSoDiaBanFiles[idx] = item;
        else memoryCache.hoSoDiaBanFiles.push(item);
        break;
      }
      case 'bao_cao_thang': {
        const idx = memoryCache.baoCaoThangList.findIndex((b) => b.id === item.id);
        if (idx !== -1) memoryCache.baoCaoThangList[idx] = item;
        else memoryCache.baoCaoThangList.push(item);
        break;
      }
      case 'pdf_files': {
        const idx = memoryCache.pdfFiles.findIndex((p) => p.id === item.id);
        if (idx !== -1) memoryCache.pdfFiles[idx] = item;
        else memoryCache.pdfFiles.push(item);
        break;
      }
      case 'don_thu': {
        const idx = memoryCache.donThuList.findIndex((d) => d.id === item.id);
        if (idx !== -1) memoryCache.donThuList[idx] = item;
        else memoryCache.donThuList.push(item);
        break;
      }
      case 'users': {
        const idx = memoryCache.users.findIndex((u) => u.id === item.id);
        if (idx !== -1) memoryCache.users[idx] = item;
        else memoryCache.users.push(item);
        break;
      }
      case 'phan_cong_dia_ban': {
        const targetKey = item.user_id || item.id;
        const idx = memoryCache.phanCongList.findIndex((p) => (p.user_id || p.id) === targetKey);
        if (idx !== -1) memoryCache.phanCongList[idx] = item;
        else memoryCache.phanCongList.push(item);
        break;
      }
    }
  },

  _removeMemoryCacheItem(collectionName: string, id: string) {
    switch (collectionName) {
      case 'don_vi':
        memoryCache.donViList = memoryCache.donViList.filter((d) => d.id !== id);
        break;
      case 'chuong_trinh':
        memoryCache.chuongTrinhList = memoryCache.chuongTrinhList.filter((c) => c.id !== id);
        break;
      case 'ho_so_dia_ban_records':
        memoryCache.hoSoDiaBanRecords = memoryCache.hoSoDiaBanRecords.filter((r) => r.id !== id);
        break;
      case 'ho_so_dia_ban_files':
        memoryCache.hoSoDiaBanFiles = memoryCache.hoSoDiaBanFiles.filter((f) => f.id !== id);
        break;
      case 'bao_cao_thang':
        memoryCache.baoCaoThangList = memoryCache.baoCaoThangList.filter((b) => b.id !== id);
        break;
      case 'pdf_files':
        memoryCache.pdfFiles = memoryCache.pdfFiles.filter((p) => p.id !== id);
        break;
      case 'don_thu':
        memoryCache.donThuList = memoryCache.donThuList.filter((d) => d.id !== id);
        break;
      case 'users':
        memoryCache.users = memoryCache.users.filter((u) => u.id !== id);
        break;
      case 'phan_cong_dia_ban':
        memoryCache.phanCongList = memoryCache.phanCongList.filter((p) => (p.user_id || p.id) !== id);
        break;
    }
  },

  // ── 5. ĐỒNG BỘ HỢP NHẤT KHỞI TẠO NẾU CLOUD RỖNG ────────────────────────────
  async ensureProductionSeed(): Promise<void> {
    if (!auth.currentUser || !isCurrentUserAdmin()) return;
    try {
      const donViSnap = await getDocs(collection(firestoreDb, 'don_vi'));
      if (donViSnap.empty) {
        console.log('[CentralData] Firestore don_vi đang trống. Tiến hành nạp dữ liệu gốc chuẩn...');
        const initialRootUnit: DonVi = {
          id: '01918a00-0000-7000-8000-000000000001',
          ten: 'Đảng ủy cơ sở',
          loai: 'DANG_BO',
          don_vi_cha_id: null,
          ma: 'DU-01',
          thu_tu: 1,
          ghi_chu: 'Cơ quan lãnh đạo cao nhất của Đảng bộ cơ sở (Bấm chỉnh sửa để đổi tên theo đúng cơ quan thực tế)',
          version: 1,
          sync_status: 'synced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
        await setDoc(doc(firestoreDb, 'don_vi', initialRootUnit.id), initialRootUnit);
      }
    } catch (e) {
      console.warn('[CentralData] Lỗi kiểm tra khởi tạo seed:', e);
    }
  },
};
