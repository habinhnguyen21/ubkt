import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
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

let activeUnsubscribes: Unsubscribe[] = [];
let isListening = false;

// Tải nhanh từ localStorage khi vừa khởi động để UI hiển thị tức thì (Cache-First)
function loadInitialFromLocalStorage() {
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

  // ── 1. KẾT NỐI REAL-TIME FIRESTORE (onSnapshot cho tất cả bảng) ──────────────
  initRealtimeSync(): () => void {
    if (isListening) return () => {};
    isListening = true;

    console.log('[CentralData] Khởi động Realtime Firestore Listeners cho tất cả bảng...');

    // Lắng nghe Tombstones (bản ghi đã xoá trên toàn hệ thống)
    const unsubTombstones = onSnapshot(
      collection(firestoreDb, 'tombstones'),
      (snap) => {
        snap.docs.forEach((d) => {
          memoryCache.tombstones.add(d.id);
        });
        persistCacheToLocalStorage();
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe tombstones:', err)
    );
    activeUnsubscribes.push(unsubTombstones);

    // Lắng nghe Đơn vị
    const unsubDonVi = onSnapshot(
      collection(firestoreDb, 'don_vi'),
      (snap) => {
        const items: DonVi[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as DonVi;
          if (!data.deleted_at && !memoryCache.tombstones.has(d.id)) {
            items.push({ ...data, id: d.id });
          }
        });
        // Sắp xếp thứ tự
        items.sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
        memoryCache.donViList = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_don_vi_updated'));
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe don_vi:', err)
    );
    activeUnsubscribes.push(unsubDonVi);

    // Lắng nghe Chương trình KT-GS
    const unsubCt = onSnapshot(
      collection(firestoreDb, 'chuong_trinh'),
      (snap) => {
        const items: ChuongTrinhKtGs[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as ChuongTrinhKtGs), id: d.id });
          }
        });
        memoryCache.chuongTrinhList = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe chuong_trinh:', err)
    );
    activeUnsubscribes.push(unsubCt);

    // Lắng nghe Hồ sơ địa bàn
    const unsubDiaBan = onSnapshot(
      collection(firestoreDb, 'ho_so_dia_ban_records'),
      (snap) => {
        const items: any[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...d.data(), id: d.id });
          }
        });
        memoryCache.hoSoDiaBanRecords = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe ho_so_dia_ban_records:', err)
    );
    activeUnsubscribes.push(unsubDiaBan);

    // Lắng nghe File hồ sơ địa bàn
    const unsubFiles = onSnapshot(
      collection(firestoreDb, 'ho_so_dia_ban_files'),
      (snap) => {
        const items: HoSoDiaBanFile[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as HoSoDiaBanFile), id: d.id });
          }
        });
        memoryCache.hoSoDiaBanFiles = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe ho_so_dia_ban_files:', err)
    );
    activeUnsubscribes.push(unsubFiles);

    // Lắng nghe Báo cáo tháng
    const unsubBc = onSnapshot(
      collection(firestoreDb, 'bao_cao_thang'),
      (snap) => {
        const items: BaoCaoThangItem[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as BaoCaoThangItem), id: d.id });
          }
        });
        memoryCache.baoCaoThangList = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe bao_cao_thang:', err)
    );
    activeUnsubscribes.push(unsubBc);

    // Lắng nghe Kho PDF
    const unsubPdf = onSnapshot(
      collection(firestoreDb, 'pdf_files'),
      (snap) => {
        const items: PdfKhoItem[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as PdfKhoItem), id: d.id });
          }
        });
        memoryCache.pdfFiles = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe pdf_files:', err)
    );
    activeUnsubscribes.push(unsubPdf);

    // Lắng nghe Đơn thư
    const unsubDonThu = onSnapshot(
      collection(firestoreDb, 'don_thu'),
      (snap) => {
        const items: DonThu[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as DonThu), id: d.id });
          }
        });
        memoryCache.donThuList = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_don_thu_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe don_thu:', err)
    );
    activeUnsubscribes.push(unsubDonThu);

    // Lắng nghe Users
    const unsubUsers = onSnapshot(
      collection(firestoreDb, 'users'),
      (snap) => {
        const items: User[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...(d.data() as User), id: d.id });
          }
        });
        memoryCache.users = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe users:', err)
    );
    activeUnsubscribes.push(unsubUsers);

    // Lắng nghe Phân công địa bàn
    const unsubPhanCong = onSnapshot(
      collection(firestoreDb, 'phan_cong_dia_ban'),
      (snap) => {
        const items: any[] = [];
        snap.docs.forEach((d) => {
          if (!memoryCache.tombstones.has(d.id)) {
            items.push({ ...d.data(), id: d.id });
          }
        });
        memoryCache.phanCongList = items;
        persistCacheToLocalStorage();
        window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      },
      (err) => console.warn('[Realtime] Lỗi lắng nghe phan_cong_dia_ban:', err)
    );
    activeUnsubscribes.push(unsubPhanCong);

    memoryCache.isInitialized = true;

    return () => {
      activeUnsubscribes.forEach((unsub) => unsub());
      activeUnsubscribes = [];
      isListening = false;
    };
  },

  // ── 2. GHI DỮ LIỆU ĐỒNG BỘ TRỰC TIẾP LÊN FIRESTORE (AWAIT XÁC NHẬN) ──────────
  async saveDoc<T extends { id: string }>(
    collectionName: string,
    id: string,
    data: T
  ): Promise<T> {
    if (!id) throw new Error('ID bản ghi không hợp lệ');

    const now = new Date().toISOString();
    const cleanPayload: any = {
      ...data,
      id,
      updated_at: now,
      is_deleted: false,
    };
    if (!cleanPayload.created_at) {
      cleanPayload.created_at = now;
    }

    // Gỡ bỏ undefined để tránh lỗi Firestore
    Object.keys(cleanPayload).forEach((k) => {
      if (cleanPayload[k] === undefined) delete cleanPayload[k];
    });

    // 1. Ghi thẳng lên Firestore Cloud và chờ xác nhận
    await setDoc(doc(firestoreDb, collectionName, id), cleanPayload, { merge: true });

    // 2. Nếu ID này từng nằm trong tombstones, xóa khỏi tombstones
    if (memoryCache.tombstones.has(id)) {
      memoryCache.tombstones.delete(id);
      deleteDoc(doc(firestoreDb, 'tombstones', id)).catch(() => {});
    }

    // 3. Cập nhật cache cục bộ tức thì
    this._updateMemoryCacheItem(collectionName, cleanPayload);
    persistCacheToLocalStorage();

    return cleanPayload;
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

    // 1. Đánh dấu tombstone trên Firestore Cloud để tất cả các máy khác biết và không bao giờ đẩy lại
    await setDoc(doc(firestoreDb, 'tombstones', id), tombstoneDoc);

    // 2. Xóa tài liệu khỏi Firestore
    await deleteDoc(doc(firestoreDb, collectionName, id)).catch(() => {});

    // 3. Cập nhật bộ nhớ cục bộ
    memoryCache.tombstones.add(id);
    this._removeMemoryCacheItem(collectionName, id);
    persistCacheToLocalStorage();

    console.log(`[CentralData] Đã xóa an toàn và tạo tombstone cho ${collectionName}/${id}`);
  },

  // ── 4. XOÁ HÀNG LOẠT (BATCH DELETE) ─────────────────────────────────────────
  async batchDelete(collectionName: string, ids: string[], actor_name?: string): Promise<void> {
    if (!ids || ids.length === 0) return;
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
        const idx = memoryCache.phanCongList.findIndex((p) => p.id === item.id);
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
        memoryCache.phanCongList = memoryCache.phanCongList.filter((p) => p.id !== id);
        break;
    }
  },

  // ── 5. ĐỒNG BỘ HỢP NHẤT KHỞI TẠO NẾU CLOUD RỖNG ────────────────────────────
  async ensureProductionSeed(): Promise<void> {
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
