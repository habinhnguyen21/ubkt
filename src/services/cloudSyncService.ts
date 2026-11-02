import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  deleteField,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db as firestoreDb, auth } from './firebase';
import { isSameData, captureActiveInput, restoreActiveInput } from '../utils/syncUtils';
import { sanitizeUserForCloud } from '../utils/passwordCrypto';
import type {
  DonVi,
  ChuongTrinhKtGs,
  PdfKhoItem,
  DonThu,
  User,
  NhatKy,
  HoSoDiaBanFile,
  BaoCaoThangItem,
} from '../types';

export interface CloudSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage: string | null;
  counts: {
    donVi: number;
    chuongTrinh: number;
    hoSoDiaBan: number;
    hoSoFiles: number;
    baoCaoThang: number;
    pdfFiles: number;
    donThu: number;
    users: number;
  };
}

const STORAGE_LAST_SYNCED = 'ubkt_cloud_last_synced_at';

export const cloudSyncService = {
  // Lấy thời điểm đồng bộ gần nhất
  getLastSyncedAt(): string | null {
    try {
      return localStorage.getItem(STORAGE_LAST_SYNCED);
    } catch {
      return null;
    }
  },

  setLastSyncedAt(timeStr: string) {
    try {
      localStorage.setItem(STORAGE_LAST_SYNCED, timeStr);
    } catch {}
  },

  // Đồng bộ nhanh 1 bản ghi lên Firestore
  async saveItemToCloud(collectionName: string, id: string, data: any): Promise<void> {
    try {
      if (!id) return;
      const docRef = doc(firestoreDb, collectionName, String(id));
      // Loại bỏ undefined để Firestore không báo lỗi
      const cleanData = JSON.parse(JSON.stringify(data));
      if (collectionName === 'users') {
        delete cleanData.mat_khau;
        delete cleanData.mat_khau_hash;
        delete cleanData.password;
        delete cleanData.passwordHash;
        cleanData.mat_khau = deleteField();
        cleanData.mat_khau_hash = deleteField();
      }
      await setDoc(docRef, cleanData, { merge: true });
      // Xoá tombstone nếu bản ghi được tạo lại (chỉ ADMIN có quyền ghi/xóa tombstones)
      const isAdmin = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();
      if (isAdmin) {
        const tombRef = doc(firestoreDb, 'tombstones', String(id));
        deleteDoc(tombRef).catch(() => {});
      }
    } catch (err) {
      console.warn(`[CloudSync] Lỗi lưu ${collectionName}/${id}:`, err);
    }
  },

  // Xóa 1 bản ghi khỏi Firestore kèm ghi nhận Tombstone chống hồi sinh dữ liệu
  async deleteItemFromCloud(collectionName: string, id: string): Promise<void> {
    try {
      if (!id) return;
      const isAdmin = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();
      if (isAdmin) {
        // Ghi tombstone vào Firestore trước để các máy khác biết và không bao giờ đẩy lại
        const tombRef = doc(firestoreDb, 'tombstones', String(id));
        await setDoc(tombRef, {
          id: String(id),
          collection: collectionName,
          deleted_at: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }

      const docRef = doc(firestoreDb, collectionName, String(id));
      await deleteDoc(docRef);
    } catch (err) {
      console.warn(`[CloudSync] Lỗi xóa ${collectionName}/${id}:`, err);
    }
  },

  // ── ĐẨY TOÀN BỘ DỮ LIỆU TỪ MÁY NÀY LÊN CLOUD ──────────────────────────────
  async pushAllToCloud(onProgress?: (msg: string) => void): Promise<{ success: boolean; error?: string; counts: any }> {
    try {
      onProgress?.('Đang nạp dữ liệu cục bộ...');
      // 1. Nạp từ ubkt_mock_db
      let mockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) mockDb = JSON.parse(raw);
      } catch {}

      // 2. Nạp từ các key cục bộ riêng
      let diaBanRecords: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
        if (raw) diaBanRecords = JSON.parse(raw);
      } catch {}

      let diaBanFiles: HoSoDiaBanFile[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (raw) diaBanFiles = JSON.parse(raw);
      } catch {}

      let baoCaoList: BaoCaoThangItem[] = [];
      try {
        const raw = localStorage.getItem('ubkt_bao_cao_thang');
        if (raw) baoCaoList = JSON.parse(raw);
      } catch {}

      let phanCongList: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
        if (raw) phanCongList = JSON.parse(raw);
      } catch {}

      let gdriveConfig: any = null;
      try {
        const raw = localStorage.getItem('ubkt_google_drive_config');
        if (raw) gdriveConfig = JSON.parse(raw);
      } catch {}

      const donViList: DonVi[] = mockDb.donViList || [];
      const chuongTrinhList: ChuongTrinhKtGs[] = mockDb.chuongTrinhList || [];
      const pdfFiles: PdfKhoItem[] = mockDb.pdfFiles || [];
      const donThuList: DonThu[] = mockDb.donThuList || [];
      const users: User[] = mockDb.users || [];
      const auditLogs: NhatKy[] = mockDb.auditLogs || [];

      // Hàm phụ trợ lưu mảng lên Firestore bằng batch (mỗi batch tối đa 400 docs)
      const saveArrayToCollection = async (collName: string, items: any[], getId: (item: any) => string) => {
        if (!items || items.length === 0) return;
        const BATCH_SIZE = 400;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const chunk = items.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(firestoreDb);
          chunk.forEach((item) => {
            const id = getId(item);
            if (id) {
              const ref = doc(firestoreDb, collName, String(id));
              const clean = JSON.parse(JSON.stringify(item));
              if (collName === 'users') {
                delete clean.mat_khau;
                delete clean.mat_khau_hash;
                delete clean.password;
                delete clean.passwordHash;
                clean.mat_khau = deleteField();
                clean.mat_khau_hash = deleteField();
              }
              batch.set(ref, clean, { merge: true });
            }
          });
          await batch.commit();
        }
      };

      const isAdminUser = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();

      if (isAdminUser) {
        onProgress?.(`Đang đẩy ${donViList.length} cơ cấu tổ chức lên Cloud...`);
        await saveArrayToCollection('don_vi', donViList, (d) => d.id);
      }

      onProgress?.(`Đang đẩy ${chuongTrinhList.length} chương trình KT-GS lên Cloud...`);
      await saveArrayToCollection('chuong_trinh', chuongTrinhList, (c) => c.id);

      onProgress?.(`Đang đẩy ${diaBanRecords.length} hồ sơ địa bàn lên Cloud...`);
      await saveArrayToCollection('ho_so_dia_ban_records', diaBanRecords, (d) => d.id);

      onProgress?.(`Đang đẩy ${diaBanFiles.length} tệp tài liệu hồ sơ lên Cloud...`);
      await saveArrayToCollection('ho_so_dia_ban_files', diaBanFiles, (f) => f.id);

      onProgress?.(`Đang đẩy ${baoCaoList.length} báo cáo tháng lên Cloud...`);
      await saveArrayToCollection('bao_cao_thang', baoCaoList, (b) => b.id);

      onProgress?.(`Đang đẩy ${pdfFiles.length} tệp trong Kho dữ liệu lên Cloud...`);
      await saveArrayToCollection('pdf_files', pdfFiles, (p) => p.id);

      onProgress?.(`Đang đẩy ${donThuList.length} đơn thư lên Cloud...`);
      await saveArrayToCollection('don_thu', donThuList, (d) => d.id);

      if (isAdminUser) {
        onProgress?.(`Đang đẩy ${users.length} tài khoản người dùng lên Cloud...`);
        await saveArrayToCollection('users', users, (u) => u.id);
      }

      if (auditLogs.length > 0) {
        await saveArrayToCollection('audit_logs', auditLogs, (l) => l.id || `log-${Date.now()}`);
      }

      if (isAdminUser && phanCongList.length > 0) {
        onProgress?.('Đang lưu thông tin phân công cán bộ...');
        await saveArrayToCollection('phan_cong_dia_ban', phanCongList, (p) => p.user_id || p.id || 'pc');
      }

      // Lưu cấu hình hệ thống (chỉ ADMIN có quyền ghi system_config)
      if (isAdminUser && gdriveConfig) {
        onProgress?.('Đang lưu cấu hình Google Drive...');
        await setDoc(doc(firestoreDb, 'system_config', 'google_drive'), JSON.parse(JSON.stringify(gdriveConfig)), { merge: true });
      }

      // Lưu nhật ký đồng bộ
      const syncTime = new Date().toLocaleString('vi-VN');
      if (isAdminUser) {
        await setDoc(doc(firestoreDb, 'system_config', 'sync_meta'), {
          last_synced_at: syncTime,
          timestamp: new Date().toISOString(),
          counts: {
            donVi: donViList.length,
            chuongTrinh: chuongTrinhList.length,
            hoSoDiaBan: diaBanRecords.length,
            hoSoFiles: diaBanFiles.length,
            baoCaoThang: baoCaoList.length,
            pdfFiles: pdfFiles.length,
            donThu: donThuList.length,
            users: users.length,
          },
        }, { merge: true });
      }

      this.setLastSyncedAt(syncTime);

      return {
        success: true,
        counts: {
          donVi: donViList.length,
          chuongTrinh: chuongTrinhList.length,
          hoSoDiaBan: diaBanRecords.length,
          hoSoFiles: diaBanFiles.length,
          baoCaoThang: baoCaoList.length,
          pdfFiles: pdfFiles.length,
          donThu: donThuList.length,
          users: users.length,
        },
      };
    } catch (err: any) {
      console.error('[CloudSync] Lỗi đẩy dữ liệu lên Cloud:', err);
      return {
        success: false,
        error: err.message || String(err),
        counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0, donThu: 0, users: 0 },
      };
    }
  },

  // ── KÉO TOÀN BỘ DỮ LIỆU TỪ CLOUD VỀ MÁY NÀY ──────────────────────────────
  async pullAllFromCloud(onProgress?: (msg: string) => void): Promise<{ success: boolean; error?: string; counts: any }> {
    try {
      if (!auth.currentUser) {
        return {
          success: false,
          error: 'Vui lòng đăng nhập trước khi đồng bộ dữ liệu với Cloud.',
          counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0, donThu: 0, users: 0 },
        };
      }
      onProgress?.('Đang kết nối Firestore Cloud...');

      const isAdminPull = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();

      const [
        donViSnap,
        ctSnap,
        diaBanSnap,
        filesSnap,
        bcSnap,
        pdfSnap,
        donThuSnap,
        usersDocs,
        phanCongSnap,
        gdriveDoc,
      ] = await Promise.all([
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_records')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_files')),
        getDocs(collection(firestoreDb, 'bao_cao_thang')),
        getDocs(collection(firestoreDb, 'pdf_files')),
        getDocs(collection(firestoreDb, 'don_thu')),
        isAdminPull
          ? getDocs(collection(firestoreDb, 'users')).then((s) => s.docs)
          : getDoc(doc(firestoreDb, 'users', auth.currentUser.uid)).then((d) => (d.exists() ? [d] : [])),
        getDocs(collection(firestoreDb, 'phan_cong_dia_ban')),
        getDoc(doc(firestoreDb, 'system_config', 'google_drive')),
      ]);

      onProgress?.('Đang nạp dữ liệu từ Cloud vào bộ nhớ máy...');

      // 1. Cập nhật ubkt_mock_db
      let currentMockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) currentMockDb = JSON.parse(raw);
      } catch {}

      if (!donViSnap.empty) {
        currentMockDb.donViList = donViSnap.docs.map((d) => d.data() as DonVi);
      }
      if (!ctSnap.empty) {
        currentMockDb.chuongTrinhList = ctSnap.docs.map((d) => d.data() as ChuongTrinhKtGs);
      }
      if (!pdfSnap.empty) {
        currentMockDb.pdfFiles = pdfSnap.docs.map((d) => d.data() as PdfKhoItem);
      }
      if (!donThuSnap.empty) {
        currentMockDb.donThuList = donThuSnap.docs.map((d) => d.data() as DonThu);
      }
      if (usersDocs.length > 0) {
        const cloudUsers = usersDocs.map((d) => sanitizeUserForCloud(d.data() as User));
        currentMockDb.users = cloudUsers;
      }
      localStorage.setItem('ubkt_mock_db', JSON.stringify(currentMockDb));

      // 2. Cập nhật ubkt_ho_so_dia_ban_records
      if (!diaBanSnap.empty) {
        let deletedDiaBanIds = new Set<string>();
        try {
          const raw = localStorage.getItem('ubkt_deleted_diaban_ids');
          if (raw) deletedDiaBanIds = new Set(JSON.parse(raw));
        } catch {}
        const records = diaBanSnap.docs
          .map((d) => d.data())
          .filter((r) => !deletedDiaBanIds.has(r.id));
        localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(records));
      }

      // 3. Cập nhật ubkt_ho_so_dia_ban_files
      if (!filesSnap.empty) {
        const files = filesSnap.docs.map((d) => d.data() as HoSoDiaBanFile);
        localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(files));
      }

      // 4. Cập nhật ubkt_bao_cao_thang
      if (!bcSnap.empty) {
        const reports = bcSnap.docs.map((d) => d.data() as BaoCaoThangItem);
        localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(reports));
      }

      // 5. Cập nhật ubkt_phan_cong_dia_ban
      if (!phanCongSnap.empty) {
        const phanCongs = phanCongSnap.docs.map((d) => d.data());
        localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(phanCongs));
      }

      // 6. Cập nhật cấu hình Google Drive
      if (gdriveDoc.exists()) {
        const gcfg = gdriveDoc.data();
        localStorage.setItem('ubkt_google_drive_config', JSON.stringify(gcfg));
      }

      const syncTime = new Date().toLocaleString('vi-VN');
      this.setLastSyncedAt(syncTime);

      // Đánh dấu đã sẵn sàng
      localStorage.setItem('ubkt_prod_clean_done', 'true');

      // 7. Phát toàn bộ sự kiện đồng bộ để các màn hình cập nhật ngay lập tức
      window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));

      return {
        success: true,
        counts: {
          donVi: donViSnap.size,
          chuongTrinh: ctSnap.size,
          hoSoDiaBan: diaBanSnap.size,
          hoSoFiles: filesSnap.size,
          baoCaoThang: bcSnap.size,
          pdfFiles: pdfSnap.size,
          donThu: donThuSnap.size,
          users: usersDocs.length,
        },
      };
    } catch (err: any) {
      console.error('[CloudSync] Lỗi kéo dữ liệu từ Cloud:', err);
      return {
        success: false,
        error: err.message || String(err),
        counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0, donThu: 0, users: 0 },
      };
    }
  },

  _autoSyncTimer: null as any,
  _visibilityHandler: null as (() => void) | null,
  _isSyncing: false,

  // Trạng thái bật/tắt tự động đồng bộ ẩn
  isAutoSyncEnabled(): boolean {
    try {
      return localStorage.getItem('ubkt_cloud_auto_sync_enabled') !== 'false';
    } catch {
      return true;
    }
  },

  setAutoSyncEnabled(enabled: boolean) {
    try {
      localStorage.setItem('ubkt_cloud_auto_sync_enabled', enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('ubkt_auto_sync_config_changed', { detail: { enabled } }));
    } catch {}
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  },

  getAutoSyncInterval(): number {
    try {
      const v = localStorage.getItem('ubkt_cloud_auto_sync_interval');
      const parsed = v ? parseInt(v, 10) : 30;
      return parsed >= 10 ? parsed : 30;
    } catch {
      return 30;
    }
  },

  setAutoSyncInterval(seconds: number) {
    try {
      localStorage.setItem('ubkt_cloud_auto_sync_interval', String(seconds));
    } catch {}
    if (this.isAutoSyncEnabled()) {
      this.startAutoSync();
    }
  },

  _clearSyncTimer() {
    if (this._autoSyncTimer) {
      clearInterval(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }
  },

  _startSyncTimer() {
    this._clearSyncTimer();
    if (!this.isAutoSyncEnabled()) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const intervalSec = this.getAutoSyncInterval();
    this._autoSyncTimer = setInterval(async () => {
      // Bỏ qua nếu tab đang ẩn, mất kết nối mạng hoặc đang bận đồng bộ
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (this._isSyncing) return;

      try {
        await this.performTwoWaySync(true);
      } catch {
        // Chạy ngầm bỏ qua lỗi tạm thời, giữ nguyên dữ liệu cũ
      }
    }, intervalSec * 1000);
  },

  // Bắt đầu chu trình tự động đồng bộ ẩn định kỳ (mặc định 30s) + lắng nghe visibilitychange
  startAutoSync() {
    this.stopAutoSync();
    if (!this.isAutoSyncEnabled()) return;

    const intervalSec = this.getAutoSyncInterval();
    console.log(`[CloudSync] Đã kích hoạt tự động đồng bộ 2 chiều ẩn định kỳ mỗi ${intervalSec} giây.`);

    this._startSyncTimer();

    if (typeof document !== 'undefined') {
      this._visibilityHandler = () => {
        if (!this.isAutoSyncEnabled()) return;
        if (document.hidden || document.visibilityState === 'hidden') {
          // Tạm dừng đồng bộ khi tab bị ẩn
          this._clearSyncTimer();
        } else if (document.visibilityState === 'visible') {
          // Đồng bộ lại ngay khi người dùng quay lại tab và khởi động lại bộ đếm
          if (typeof navigator === 'undefined' || navigator.onLine) {
            this.performTwoWaySync(true).catch(() => {});
          }
          this._startSyncTimer();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }
  },

  stopAutoSync() {
    this._clearSyncTimer();
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  },

  // ── ĐỒNG BỘ 2 CHIỀU THỰC SỰ (TRUE 2-WAY MERGE SYNC) ──────────────────────
  async performTwoWaySync(silent = false, onProgress?: (msg: string) => void): Promise<{
    success: boolean;
    error?: string;
    action: 'merged';
    counts: any;
  }> {
    if (this._isSyncing) {
      return { success: true, action: 'merged', counts: {} };
    }
    if (!auth.currentUser) {
      return { success: false, error: 'Chưa đăng nhập Firebase Auth', action: 'merged', counts: {} };
    }
    if (silent && typeof document !== 'undefined' && document.hidden) {
      return { success: true, action: 'merged', counts: {} };
    }
    this._isSyncing = true;
    // Chỉ phát tín hiệu cho đồng bộ thủ công, không hiện spinner khi đồng bộ nền (silent)
    if (!silent) {
      window.dispatchEvent(new CustomEvent('ubkt_silent_sync_start'));
    }

    try {
      onProgress?.('Đang kết nối Firestore Cloud...');

      const isAdminSync = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();

      const [
        donViSnap,
        ctSnap,
        diaBanSnap,
        filesSnap,
        bcSnap,
        pdfSnap,
        donThuSnap,
        usersDocs,
        phanCongSnap,
        gdriveDoc,
        tombstonesSnap,
      ] = await Promise.all([
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_records')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_files')),
        getDocs(collection(firestoreDb, 'bao_cao_thang')),
        getDocs(collection(firestoreDb, 'pdf_files')),
        getDocs(collection(firestoreDb, 'don_thu')),
        isAdminSync
          ? getDocs(collection(firestoreDb, 'users')).then((s) => s.docs)
          : getDoc(doc(firestoreDb, 'users', auth.currentUser.uid)).then((d) => (d.exists() ? [d] : [])),
        getDocs(collection(firestoreDb, 'phan_cong_dia_ban')),
        getDoc(doc(firestoreDb, 'system_config', 'google_drive')),
        getDocs(collection(firestoreDb, 'tombstones')),
      ]);

      onProgress?.('Đang hợp nhất dữ liệu 2 chiều...');

      const cloudTombstones = new Set<string>();
      tombstonesSnap.docs.forEach((d) => cloudTombstones.add(d.id));

      let currentMockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) currentMockDb = JSON.parse(raw);
      } catch {}

      const prevDonVi: DonVi[] = currentMockDb.donViList || [];
      const prevCt: ChuongTrinhKtGs[] = currentMockDb.chuongTrinhList || [];
      const prevPdf: PdfKhoItem[] = currentMockDb.pdfFiles || [];
      const prevDonThu: DonThu[] = currentMockDb.donThuList || [];
      const prevUsers: User[] = currentMockDb.users || [];

      let currentDiaBan: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
        if (raw) currentDiaBan = JSON.parse(raw);
      } catch {}

      let currentFiles: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (raw) currentFiles = JSON.parse(raw);
      } catch {}

      let currentBc: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_bao_cao_thang');
        if (raw) currentBc = JSON.parse(raw);
      } catch {}

      let currentPhanCong: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
        if (raw) currentPhanCong = JSON.parse(raw);
      } catch {}

      let prevGdrive: any = null;
      try {
        const raw = localStorage.getItem('ubkt_google_drive_config');
        if (raw) prevGdrive = JSON.parse(raw);
      } catch {}

      let deletedDvIds = new Set<string>();
      try {
        const raw = localStorage.getItem('ubkt_deleted_don_vi_ids');
        if (raw) deletedDvIds = new Set(JSON.parse(raw));
      } catch {}

      let deletedCtIds = new Set<string>();
      try {
        const raw = localStorage.getItem('ubkt_deleted_chuong_trinh_ids');
        if (raw) deletedCtIds = new Set(JSON.parse(raw));
      } catch {}

      let deletedDiaBanIds = new Set<string>();
      try {
        const raw = localStorage.getItem('ubkt_deleted_diaban_ids');
        if (raw) deletedDiaBanIds = new Set(JSON.parse(raw));
      } catch {}

      let deletedPdfIds = new Set<string>();
      try {
        const raw = localStorage.getItem('ubkt_deleted_pdf_ids');
        if (raw) deletedPdfIds = new Set(JSON.parse(raw));
      } catch {}

      let deletedPdfNames = new Set<string>();
      try {
        const raw = localStorage.getItem('ubkt_deleted_pdf_names');
        if (raw) deletedPdfNames = new Set(JSON.parse(raw));
      } catch {}

      // Đồng bộ toàn bộ tombstones vào các tập xoá cục bộ
      cloudTombstones.forEach((id) => {
        deletedDvIds.add(id);
        deletedCtIds.add(id);
        deletedDiaBanIds.add(id);
        deletedPdfIds.add(id);
      });

      const itemsToPushToCloud: { collection: string; id: string; data: any }[] = [];

      // A. ĐƠN VỊ (don_vi)
      const cloudDonViList = donViSnap.docs.map((d) => d.data() as DonVi);
      const localDonViList: DonVi[] = (currentMockDb.donViList || []).filter((d: DonVi) => !cloudTombstones.has(d.id));
      const donViMap = new Map<string, DonVi>();

      localDonViList.forEach((item) => {
        if (!deletedDvIds.has(item.id) && !item.deleted_at && !cloudTombstones.has(item.id)) {
          donViMap.set(item.id, item);
        } else if (item.deleted_at) {
          deletedDvIds.add(item.id);
        }
      });

      cloudDonViList.forEach((cloudItem) => {
        if (deletedDvIds.has(cloudItem.id) || cloudItem.deleted_at || cloudTombstones.has(cloudItem.id)) {
          donViMap.delete(cloudItem.id);
          deletedDvIds.add(cloudItem.id);
          // Gỡ bỏ vĩnh viễn khỏi Firestore Cloud nếu đã xóa
          this.deleteItemFromCloud('don_vi', cloudItem.id).catch(() => {});
        } else {
          const localItem = donViMap.get(cloudItem.id);
          if (!localItem) {
            donViMap.set(cloudItem.id, cloudItem);
          } else {
            const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at || 0).getTime();
            const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
            if (cloudTime > localTime) {
              donViMap.set(cloudItem.id, cloudItem);
            } else if (localTime > cloudTime) {
              itemsToPushToCloud.push({ collection: 'don_vi', id: localItem.id, data: localItem });
            }
          }
        }
      });

      const cloudDvIdSet = new Set(cloudDonViList.map((d) => d.id));
      localDonViList.forEach((localItem) => {
        if (!cloudDvIdSet.has(localItem.id) && !deletedDvIds.has(localItem.id) && !localItem.deleted_at && !cloudTombstones.has(localItem.id)) {
          itemsToPushToCloud.push({ collection: 'don_vi', id: localItem.id, data: localItem });
        }
      });
      currentMockDb.donViList = Array.from(donViMap.values());
      localStorage.setItem('ubkt_deleted_don_vi_ids', JSON.stringify(Array.from(deletedDvIds)));

      // B. CHƯƠNG TRÌNH KT-GS (chuong_trinh)
      const cloudCtList = ctSnap.docs.map((d) => d.data() as ChuongTrinhKtGs);
      const localCtList: ChuongTrinhKtGs[] = (currentMockDb.chuongTrinhList || []).filter((c: ChuongTrinhKtGs) => !cloudTombstones.has(c.id));
      const ctMap = new Map<string, ChuongTrinhKtGs>();

      localCtList.forEach((item) => {
        if (!deletedCtIds.has(item.id) && !cloudTombstones.has(item.id)) ctMap.set(item.id, item);
      });

      cloudCtList.forEach((cloudItem) => {
        if (deletedCtIds.has(cloudItem.id) || cloudTombstones.has(cloudItem.id)) {
          ctMap.delete(cloudItem.id);
          this.deleteItemFromCloud('chuong_trinh', cloudItem.id).catch(() => {});
        } else {
          const localItem = ctMap.get(cloudItem.id);
          if (!localItem) {
            ctMap.set(cloudItem.id, cloudItem);
          } else {
            const cloudTime = new Date((cloudItem as any).updated_at || (cloudItem as any).created_at || 0).getTime();
            const localTime = new Date((localItem as any).updated_at || (localItem as any).created_at || 0).getTime();
            if (cloudTime > localTime) {
              ctMap.set(cloudItem.id, cloudItem);
            } else if (localTime > cloudTime) {
              itemsToPushToCloud.push({ collection: 'chuong_trinh', id: localItem.id, data: localItem });
            }
          }
        }
      });

      const cloudCtIdSet = new Set(cloudCtList.map((c) => c.id));
      localCtList.forEach((localItem) => {
        if (!cloudCtIdSet.has(localItem.id) && !deletedCtIds.has(localItem.id) && !cloudTombstones.has(localItem.id)) {
          itemsToPushToCloud.push({ collection: 'chuong_trinh', id: localItem.id, data: localItem });
        }
      });
      currentMockDb.chuongTrinhList = Array.from(ctMap.values());
      localStorage.setItem('ubkt_deleted_chuong_trinh_ids', JSON.stringify(Array.from(deletedCtIds)));

      // C. HỒ SƠ ĐỊA BÀN (ho_so_dia_ban_records)
      const cloudDiaBan = diaBanSnap.docs.map((d) => d.data());
      const diaBanMap = new Map<string, any>();
      currentDiaBan.forEach((r) => {
        if (!deletedDiaBanIds.has(r.id) && !cloudTombstones.has(r.id)) {
          diaBanMap.set(r.id, r);
        }
      });
      cloudDiaBan.forEach((c) => {
        if (deletedDiaBanIds.has(c.id) || cloudTombstones.has(c.id)) {
          diaBanMap.delete(c.id);
          // Gỡ bỏ vĩnh viễn khỏi Firestore Cloud
          this.deleteItemFromCloud('ho_so_dia_ban_records', c.id).catch(() => {});
        } else {
          const local = diaBanMap.get(c.id);
          if (!local) {
            diaBanMap.set(c.id, c);
          } else {
            const cTime = new Date(c.updated_at || c.thoi_gian_tao || 0).getTime();
            const lTime = new Date(local.updated_at || local.thoi_gian_tao || 0).getTime();
            if (cTime > lTime) {
              diaBanMap.set(c.id, c);
            } else if (lTime > cTime) {
              itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_records', id: local.id, data: local });
            }
          }
        }
      });
      const cloudDbSet = new Set(cloudDiaBan.map((d) => d.id));
      currentDiaBan.forEach((r) => {
        if (!cloudDbSet.has(r.id) && !deletedDiaBanIds.has(r.id) && !cloudTombstones.has(r.id)) {
          itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_records', id: r.id, data: r });
        }
      });
      const mergedDiaBan = Array.from(diaBanMap.values());
      localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(mergedDiaBan));
      localStorage.setItem('ubkt_deleted_diaban_ids', JSON.stringify(Array.from(deletedDiaBanIds)));

      // D. FILE ĐỊA BÀN (ho_so_dia_ban_files)
      const cloudFiles = filesSnap.docs.map((d) => d.data() as HoSoDiaBanFile);
      const filesMap = new Map<string, any>();
      currentFiles.forEach((f) => {
        if (!deletedPdfNames.has(f.ten_file) && !deletedPdfIds.has(f.id) && !deletedPdfIds.has('hsdb-' + f.id) && !cloudTombstones.has(f.id) && !cloudTombstones.has('hsdb-' + f.id)) {
          filesMap.set(f.id, f);
        }
      });
      cloudFiles.forEach((c) => {
        if (deletedPdfNames.has(c.ten_file) || deletedPdfIds.has(c.id) || deletedPdfIds.has('hsdb-' + c.id) || cloudTombstones.has(c.id) || cloudTombstones.has('hsdb-' + c.id)) {
          filesMap.delete(c.id);
          this.deleteItemFromCloud('ho_so_dia_ban_files', c.id).catch(() => {});
        } else {
          if (!filesMap.has(c.id)) filesMap.set(c.id, c);
        }
      });
      const cloudFilesSet = new Set(cloudFiles.map((f) => f.id));
      currentFiles.forEach((f) => {
        if (
          !cloudFilesSet.has(f.id) &&
          !deletedPdfNames.has(f.ten_file) &&
          !deletedPdfIds.has(f.id) &&
          !deletedPdfIds.has('hsdb-' + f.id) &&
          !cloudTombstones.has(f.id) &&
          !cloudTombstones.has('hsdb-' + f.id)
        ) {
          itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_files', id: f.id, data: f });
        }
      });
      const mergedFiles = Array.from(filesMap.values());
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(mergedFiles));

      // E. BÁO CÁO THÁNG (bao_cao_thang)
      const cloudBc = bcSnap.docs.map((d) => d.data() as BaoCaoThangItem);
      const bcMap = new Map<string, any>();
      currentBc.forEach((b) => {
        if (!cloudTombstones.has(b.id) && !cloudTombstones.has('bc-' + b.id)) {
          bcMap.set(b.id, b);
        }
      });
      cloudBc.forEach((c) => {
        if (cloudTombstones.has(c.id) || cloudTombstones.has('bc-' + c.id)) {
          bcMap.delete(c.id);
          this.deleteItemFromCloud('bao_cao_thang', c.id).catch(() => {});
        } else if (!bcMap.has(c.id)) {
          bcMap.set(c.id, c);
        }
      });
      const cloudBcSet = new Set(cloudBc.map((b) => b.id));
      currentBc.forEach((b) => {
        if (!cloudBcSet.has(b.id) && !cloudTombstones.has(b.id) && !cloudTombstones.has('bc-' + b.id)) {
          itemsToPushToCloud.push({ collection: 'bao_cao_thang', id: b.id, data: b });
        }
      });
      const mergedBc = Array.from(bcMap.values());
      localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(mergedBc));

      // F. KHO PDF (pdf_files)
      const cloudPdf = pdfSnap.docs.map((d) => d.data() as PdfKhoItem);
      const localPdf: PdfKhoItem[] = (currentMockDb.pdfFiles || []).filter((p: PdfKhoItem) => !cloudTombstones.has(p.id));
      const pdfMap = new Map<string, PdfKhoItem>();

      localPdf.forEach((p) => {
        if (
          !deletedPdfIds.has(p.id) &&
          !deletedPdfNames.has(p.ten_file) &&
          !(p.chuong_trinh_id && deletedCtIds.has(p.chuong_trinh_id)) &&
          !cloudTombstones.has(p.id)
        ) {
          pdfMap.set(p.id, p);
        }
      });

      cloudPdf.forEach((c) => {
        if (
          deletedPdfIds.has(c.id) ||
          deletedPdfNames.has(c.ten_file) ||
          (c.chuong_trinh_id && deletedCtIds.has(c.chuong_trinh_id)) ||
          cloudTombstones.has(c.id)
        ) {
          pdfMap.delete(c.id);
          deletedPdfIds.add(c.id);
          if (c.ten_file) deletedPdfNames.add(c.ten_file);
          // Gỡ bỏ vĩnh viễn khỏi Firestore Cloud
          this.deleteItemFromCloud('pdf_files', c.id).catch(() => {});
        } else {
          if (!pdfMap.has(c.id)) pdfMap.set(c.id, c);
        }
      });

      const cloudPdfSet = new Set(cloudPdf.map((p) => p.id));
      localPdf.forEach((p) => {
        if (
          !cloudPdfSet.has(p.id) &&
          !deletedPdfIds.has(p.id) &&
          !deletedPdfNames.has(p.ten_file) &&
          !(p.chuong_trinh_id && deletedCtIds.has(p.chuong_trinh_id)) &&
          !cloudTombstones.has(p.id)
        ) {
          itemsToPushToCloud.push({ collection: 'pdf_files', id: p.id, data: p });
        }
      });
      currentMockDb.pdfFiles = Array.from(pdfMap.values());
      localStorage.setItem('ubkt_deleted_pdf_ids', JSON.stringify(Array.from(deletedPdfIds)));
      localStorage.setItem('ubkt_deleted_pdf_names', JSON.stringify(Array.from(deletedPdfNames)));

      // G. ĐƠN THƯ (don_thu)
      const cloudDonThu = donThuSnap.docs.map((d) => d.data() as DonThu);
      const localDonThu: DonThu[] = (currentMockDb.donThuList || []).filter((d: DonThu) => !cloudTombstones.has(d.id));
      const donThuMap = new Map<string, DonThu>();
      localDonThu.forEach((d) => {
        if (!cloudTombstones.has(d.id)) donThuMap.set(d.id, d);
      });
      cloudDonThu.forEach((c) => {
        if (cloudTombstones.has(c.id)) {
          donThuMap.delete(c.id);
          this.deleteItemFromCloud('don_thu', c.id).catch(() => {});
        } else if (!donThuMap.has(c.id)) {
          donThuMap.set(c.id, c);
        }
      });
      const cloudDonThuSet = new Set(cloudDonThu.map((d) => d.id));
      localDonThu.forEach((d) => {
        if (!cloudDonThuSet.has(d.id) && !cloudTombstones.has(d.id)) {
          itemsToPushToCloud.push({ collection: 'don_thu', id: d.id, data: d });
        }
      });
      currentMockDb.donThuList = Array.from(donThuMap.values());

      // H. TÀI KHOẢN (users) — Không lưu mật khẩu trong Firestore; chỉ ADMIN quản lý danh sách users
      const cloudUsers = usersDocs.map((d) => sanitizeUserForCloud(d.data() as User));
      const localUsers: User[] = (currentMockDb.users || []).filter(
        (u: User) => !cloudTombstones.has(u.id)
      );
      const userMap = new Map<string, User>();

      for (const u of localUsers) {
        const k = u.id || u.ten_dang_nhap?.toLowerCase();
        if (!k || cloudTombstones.has(u.id)) continue;
        userMap.set(k, sanitizeUserForCloud(u) as User);
      }

      for (const cu of cloudUsers) {
        const k = cu.id || cu.ten_dang_nhap?.toLowerCase();
        if (!k || cloudTombstones.has(cu.id)) continue;
        userMap.set(k, sanitizeUserForCloud(cu) as User);
      }

      if (isAdminSync) {
        const cloudUserKeys = new Set(cloudUsers.map((u) => u.id || u.ten_dang_nhap?.toLowerCase()));
        for (const lu of userMap.values()) {
          const k = lu.id || lu.ten_dang_nhap?.toLowerCase();
          if (k && !cloudUserKeys.has(k) && !cloudTombstones.has(lu.id)) {
            itemsToPushToCloud.push({
              collection: 'users',
              id: lu.id,
              data: sanitizeUserForCloud(lu),
            });
          }
        }
      }
      currentMockDb.users = Array.from(userMap.values());

      // I. PHÂN CÔNG ĐỊA BÀN (phan_cong_dia_ban)
      const cloudPhanCong = phanCongSnap.docs.map((d) => d.data());
      const pcMap = new Map<string, any>();
      currentPhanCong.forEach((p) => {
        const k = p.user_id || p.id;
        if (k && !cloudTombstones.has(k)) pcMap.set(k, p);
      });
      cloudPhanCong.forEach((c) => {
        const k = c.user_id || c.id;
        if (k && cloudTombstones.has(k)) {
          pcMap.delete(k);
          this.deleteItemFromCloud('phan_cong_dia_ban', k).catch(() => {});
        } else if (k && !pcMap.has(k)) {
          pcMap.set(k, c);
        }
      });
      const cloudPcKeys = new Set(cloudPhanCong.map((p) => p.user_id || p.id));
      const isAdminUser = (() => {
        try {
          const raw = localStorage.getItem('ubkt_current_user');
          return raw ? JSON.parse(raw)?.vai_tro === 'ADMIN' : false;
        } catch {
          return false;
        }
      })();

      if (isAdminUser) {
        currentPhanCong.forEach((p) => {
          const k = p.user_id || p.id;
          if (k && !cloudPcKeys.has(k)) {
            itemsToPushToCloud.push({ collection: 'phan_cong_dia_ban', id: k, data: p });
          }
        });
      }
      const mergedPhanCong = Array.from(pcMap.values());
      const phanCongChanged = !isSameData(currentPhanCong, mergedPhanCong);
      if (phanCongChanged) {
        localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(mergedPhanCong));
      }

      // Cấu hình Google Drive
      let gdriveChanged = false;
      if (gdriveDoc.exists()) {
        const gcfg = gdriveDoc.data();
        gdriveChanged = !isSameData(prevGdrive, gcfg);
        if (gdriveChanged) {
          localStorage.setItem('ubkt_google_drive_config', JSON.stringify(gcfg));
        }
      }

      const donViChanged = !isSameData(prevDonVi, currentMockDb.donViList);
      const ctChanged = !isSameData(prevCt, currentMockDb.chuongTrinhList);
      const diaBanChanged = !isSameData(currentDiaBan, mergedDiaBan);
      const filesChanged = !isSameData(currentFiles, mergedFiles);
      const bcChanged = !isSameData(currentBc, mergedBc);
      const pdfChanged = !isSameData(prevPdf, currentMockDb.pdfFiles);
      const donThuChanged = !isSameData(prevDonThu, currentMockDb.donThuList);
      const usersChanged = !isSameData(prevUsers, currentMockDb.users);

      const mockDbChanged = donViChanged || ctChanged || pdfChanged || donThuChanged || usersChanged;
      if (mockDbChanged || !silent) {
        localStorage.setItem('ubkt_mock_db', JSON.stringify(currentMockDb));
      }

      // Đẩy các mục mới ở máy này lên Cloud (lọc theo quyền hạn của vai trò hiện tại để không vi phạm Firestore Rules)
      const filteredItemsToPush = itemsToPushToCloud.filter((item) => {
        if (isAdminSync) return true;
        const userRole = (() => {
          try {
            const raw = localStorage.getItem('ubkt_current_user');
            return raw ? JSON.parse(raw)?.vai_tro : null;
          } catch {
            return null;
          }
        })();
        if (userRole !== 'BIEN_TAP') return false;
        const adminOnlyColls = new Set(['don_vi', 'users', 'phan_cong_dia_ban', 'system_config', 'tombstones']);
        if (adminOnlyColls.has(item.collection)) return false;

        // Với BIEN_TAP: chỉ đẩy các bản ghi thuộc đơn vị được phân công
        const myUid = auth.currentUser?.uid;
        const myAssign = mergedPhanCong.find((p) => (p.user_id || p.id) === myUid);
        const myUnitIds = new Set<string>(myAssign?.don_vi_ids || []);
        if (myUnitIds.size === 0) return false;

        if (item.collection === 'ho_so_dia_ban_records') {
          return myUnitIds.has(item.id) || (item.data?.don_vi_id && myUnitIds.has(item.data.don_vi_id));
        }
        if (item.collection === 'bao_cao_thang') {
          const unitId = item.data?.don_vi_id || item.data?.danh_sach_don_vi_ids?.[0];
          return Boolean(unitId && myUnitIds.has(unitId));
        }
        const recordUnitId =
          item.data?.don_vi_id || item.data?.doi_tuong_don_vi_id || item.data?.chi_dang_bo_id;
        return Boolean(recordUnitId && myUnitIds.has(recordUnitId));
      });

      if (filteredItemsToPush.length > 0) {
        onProgress?.(`Đang đồng bộ ${filteredItemsToPush.length} mục mới lên Cloud...`);
        for (const item of filteredItemsToPush) {
          await this.saveItemToCloud(item.collection, item.id, item.data);
        }
      }

      const syncTime = new Date().toLocaleTimeString('vi-VN');
      this.setLastSyncedAt(syncTime);
      localStorage.setItem('ubkt_prod_clean_done', 'true');

      const anyDataChanged =
        donViChanged ||
        ctChanged ||
        diaBanChanged ||
        filesChanged ||
        bcChanged ||
        pdfChanged ||
        donThuChanged ||
        usersChanged ||
        phanCongChanged ||
        gdriveChanged;

      // Bảo vệ ô input đang nhập và chỉ phát sự kiện khi thực sự có dữ liệu thay đổi (hoặc đồng bộ thủ công)
      const activeInputSnapshot = captureActiveInput();
      if (anyDataChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      }
      if (ctChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      }
      if (diaBanChanged || filesChanged || bcChanged || donViChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      }
      if (pdfChanged || filesChanged || bcChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      }
      if (phanCongChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      }
      if (gdriveChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated'));
      }
      if (usersChanged || !silent) {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      restoreActiveInput(activeInputSnapshot);

      window.dispatchEvent(new CustomEvent('ubkt_sync_status_changed', {
        detail: {
          isSyncing: false,
          lastSyncedAt: syncTime,
          mode: silent ? 'auto' : 'manual',
          pushedCount: itemsToPushToCloud.length,
          hasChanges: anyDataChanged,
        },
      }));

      return {
        success: true,
        action: 'merged',
        counts: {
          donVi: currentMockDb.donViList?.length || 0,
          chuongTrinh: currentMockDb.chuongTrinhList?.length || 0,
          hoSoDiaBan: mergedDiaBan.length,
          hoSoFiles: mergedFiles.length,
          baoCaoThang: mergedBc.length,
          pdfFiles: currentMockDb.pdfFiles?.length || 0,
          donThu: currentMockDb.donThuList?.length || 0,
          users: currentMockDb.users?.length || 0,
        },
      };
    } catch (err: any) {
      if (!silent) {
        console.error('[CloudSync] Lỗi đồng bộ 2 chiều:', err);
      }
      return {
        success: false,
        error: err.message || String(err),
        action: 'merged',
        counts: {},
      };
    } finally {
      this._isSyncing = false;
      if (!silent) {
        window.dispatchEvent(new CustomEvent('ubkt_silent_sync_end'));
      }
    }
  },

  // ── ĐỒNG BỘ 2 CHIỀU THÔNG MINH (SMART 2-WAY SYNC) ──────────────────────────
  async smartSync(onProgress?: (msg: string) => void): Promise<{ success: boolean; action: 'pushed' | 'pulled' | 'merged'; counts: any }> {
    return this.performTwoWaySync(false, onProgress);
  },

  // Lấy tóm tắt số lượng bản ghi hiện có trên Cloud
  async getCloudSummary(): Promise<{ isOnline: boolean; counts: any; lastMeta?: any }> {
    try {
      const [donViSnap, ctSnap, diaBanSnap, filesSnap, bcSnap, pdfSnap, metaDoc] = await Promise.all([
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_records')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_files')),
        getDocs(collection(firestoreDb, 'bao_cao_thang')),
        getDocs(collection(firestoreDb, 'pdf_files')),
        getDoc(doc(firestoreDb, 'system_config', 'sync_meta')),
      ]);

      return {
        isOnline: true,
        counts: {
          donVi: donViSnap.size,
          chuongTrinh: ctSnap.size,
          hoSoDiaBan: diaBanSnap.size,
          hoSoFiles: filesSnap.size,
          baoCaoThang: bcSnap.size,
          pdfFiles: pdfSnap.size,
        },
        lastMeta: metaDoc.exists() ? metaDoc.data() : null,
      };
    } catch (err) {
      console.warn('[CloudSync] Không kết nối được Cloud:', err);
      return {
        isOnline: false,
        counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0 },
      };
    }
  },
};
