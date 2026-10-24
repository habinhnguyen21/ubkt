import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
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
      await setDoc(docRef, cleanData, { merge: true });
    } catch (err) {
      console.warn(`[CloudSync] Lỗi lưu ${collectionName}/${id}:`, err);
    }
  },

  // Xóa 1 bản ghi khỏi Firestore
  async deleteItemFromCloud(collectionName: string, id: string): Promise<void> {
    try {
      if (!id) return;
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
              batch.set(ref, clean, { merge: true });
            }
          });
          await batch.commit();
        }
      };

      onProgress?.(`Đang đẩy ${donViList.length} cơ cấu tổ chức lên Cloud...`);
      await saveArrayToCollection('don_vi', donViList, (d) => d.id);

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

      onProgress?.(`Đang đẩy ${users.length} tài khoản người dùng lên Cloud...`);
      await saveArrayToCollection('users', users, (u) => u.id);

      if (auditLogs.length > 0) {
        await saveArrayToCollection('audit_logs', auditLogs, (l) => l.id || `log-${Date.now()}`);
      }

      if (phanCongList.length > 0) {
        onProgress?.('Đang lưu thông tin phân công cán bộ...');
        await saveArrayToCollection('phan_cong_dia_ban', phanCongList, (p) => p.don_vi_id || p.id || 'pc');
      }

      // Lưu cấu hình hệ thống
      if (gdriveConfig) {
        onProgress?.('Đang lưu cấu hình Google Drive...');
        await setDoc(doc(firestoreDb, 'system_config', 'google_drive'), JSON.parse(JSON.stringify(gdriveConfig)), { merge: true });
      }

      // Lưu nhật ký đồng bộ
      const syncTime = new Date().toLocaleString('vi-VN');
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
      onProgress?.('Đang kết nối Firestore Cloud...');

      const [
        donViSnap,
        ctSnap,
        diaBanSnap,
        filesSnap,
        bcSnap,
        pdfSnap,
        donThuSnap,
        usersSnap,
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
        getDocs(collection(firestoreDb, 'users')),
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
      if (!usersSnap.empty) {
        const cloudUsers = usersSnap.docs.map((d) => d.data() as User & { mat_khau?: string });
        const localUsers = ((currentMockDb.users || []) as (User & { mat_khau?: string })[]);

        const mergedMap = new Map<string, User & { mat_khau?: string }>();
        // 1. Nạp cloud users
        cloudUsers.forEach((cu) => {
          const key = cu.id || cu.ten_dang_nhap?.toLowerCase();
          if (key) mergedMap.set(key, cu);
        });

        // 2. Bảo lưu local users và giữ lại mat_khau nếu cloud bị thiếu
        localUsers.forEach((lu) => {
          const key = lu.id || lu.ten_dang_nhap?.toLowerCase();
          const target = key ? mergedMap.get(key) : undefined;
          if (target) {
            if (!target.mat_khau && lu.mat_khau) {
              target.mat_khau = lu.mat_khau;
            }
          } else if (key) {
            mergedMap.set(key, lu);
            this.saveItemToCloud('users', lu.id, lu).catch(() => {});
          }
        });

        currentMockDb.users = Array.from(mergedMap.values());
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
          users: usersSnap.size,
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

  // Bắt đầu chu trình tự động đồng bộ ẩn định kỳ (mặc định 30s)
  startAutoSync() {
    this.stopAutoSync();
    if (!this.isAutoSyncEnabled()) return;

    const intervalSec = this.getAutoSyncInterval();
    console.log(`[CloudSync] Đã kích hoạt tự động đồng bộ 2 chiều ẩn định kỳ mỗi ${intervalSec} giây.`);

    this._autoSyncTimer = setInterval(async () => {
      // Bỏ qua nếu mất kết nối mạng hoặc đang bận đồng bộ
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (this._isSyncing) return;

      try {
        await this.performTwoWaySync(true);
      } catch {
        // Chạy ngầm bỏ qua lỗi tạm thời
      }
    }, intervalSec * 1000);
  },

  stopAutoSync() {
    if (this._autoSyncTimer) {
      clearInterval(this._autoSyncTimer);
      this._autoSyncTimer = null;
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
    this._isSyncing = true;
    if (silent) {
      window.dispatchEvent(new CustomEvent('ubkt_silent_sync_start'));
    }

    try {
      onProgress?.('Đang kết nối Firestore Cloud...');

      const [
        donViSnap,
        ctSnap,
        diaBanSnap,
        filesSnap,
        bcSnap,
        pdfSnap,
        donThuSnap,
        usersSnap,
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
        getDocs(collection(firestoreDb, 'users')),
        getDocs(collection(firestoreDb, 'phan_cong_dia_ban')),
        getDoc(doc(firestoreDb, 'system_config', 'google_drive')),
      ]);

      onProgress?.('Đang hợp nhất dữ liệu 2 chiều...');

      let currentMockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) currentMockDb = JSON.parse(raw);
      } catch {}

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

      const itemsToPushToCloud: { collection: string; id: string; data: any }[] = [];

      // A. ĐƠN VỊ (don_vi)
      const cloudDonViList = donViSnap.docs.map((d) => d.data() as DonVi);
      const localDonViList: DonVi[] = currentMockDb.donViList || [];
      const donViMap = new Map<string, DonVi>();

      localDonViList.forEach((item) => {
        if (!deletedDvIds.has(item.id) && !item.deleted_at) {
          donViMap.set(item.id, item);
        } else if (item.deleted_at) {
          deletedDvIds.add(item.id);
        }
      });

      cloudDonViList.forEach((cloudItem) => {
        if (deletedDvIds.has(cloudItem.id) || cloudItem.deleted_at) {
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
        if (!cloudDvIdSet.has(localItem.id) && !deletedDvIds.has(localItem.id) && !localItem.deleted_at) {
          itemsToPushToCloud.push({ collection: 'don_vi', id: localItem.id, data: localItem });
        }
      });
      currentMockDb.donViList = Array.from(donViMap.values());
      localStorage.setItem('ubkt_deleted_don_vi_ids', JSON.stringify(Array.from(deletedDvIds)));

      // B. CHƯƠNG TRÌNH KT-GS (chuong_trinh)
      const cloudCtList = ctSnap.docs.map((d) => d.data() as ChuongTrinhKtGs);
      const localCtList: ChuongTrinhKtGs[] = currentMockDb.chuongTrinhList || [];
      const ctMap = new Map<string, ChuongTrinhKtGs>();

      localCtList.forEach((item) => {
        if (!deletedCtIds.has(item.id)) ctMap.set(item.id, item);
      });

      cloudCtList.forEach((cloudItem) => {
        if (deletedCtIds.has(cloudItem.id)) {
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
        if (!cloudCtIdSet.has(localItem.id) && !deletedCtIds.has(localItem.id)) {
          itemsToPushToCloud.push({ collection: 'chuong_trinh', id: localItem.id, data: localItem });
        }
      });
      currentMockDb.chuongTrinhList = Array.from(ctMap.values());
      localStorage.setItem('ubkt_deleted_chuong_trinh_ids', JSON.stringify(Array.from(deletedCtIds)));

      // C. HỒ SƠ ĐỊA BÀN (ho_so_dia_ban_records)
      const cloudDiaBan = diaBanSnap.docs.map((d) => d.data());
      const diaBanMap = new Map<string, any>();
      currentDiaBan.forEach((r) => {
        if (!deletedDiaBanIds.has(r.id)) {
          diaBanMap.set(r.id, r);
        }
      });
      cloudDiaBan.forEach((c) => {
        if (deletedDiaBanIds.has(c.id)) {
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
        if (!cloudDbSet.has(r.id) && !deletedDiaBanIds.has(r.id)) {
          itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_records', id: r.id, data: r });
        }
      });
      const mergedDiaBan = Array.from(diaBanMap.values());
      localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(mergedDiaBan));
      localStorage.setItem('ubkt_deleted_diaban_ids', JSON.stringify(Array.from(deletedDiaBanIds)));

      // D. FILE ĐỊA BÀN (ho_so_dia_ban_files)
      const cloudFiles = filesSnap.docs.map((d) => d.data() as HoSoDiaBanFile);
      const filesMap = new Map<string, any>();
      currentFiles.forEach((f) => filesMap.set(f.id, f));
      cloudFiles.forEach((c) => {
        if (!filesMap.has(c.id)) filesMap.set(c.id, c);
      });
      const cloudFilesSet = new Set(cloudFiles.map((f) => f.id));
      currentFiles.forEach((f) => {
        if (!cloudFilesSet.has(f.id)) {
          itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_files', id: f.id, data: f });
        }
      });
      const mergedFiles = Array.from(filesMap.values());
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(mergedFiles));

      // E. BÁO CÁO THÁNG (bao_cao_thang)
      const cloudBc = bcSnap.docs.map((d) => d.data() as BaoCaoThangItem);
      const bcMap = new Map<string, any>();
      currentBc.forEach((b) => bcMap.set(b.id, b));
      cloudBc.forEach((c) => {
        if (!bcMap.has(c.id)) bcMap.set(c.id, c);
      });
      const cloudBcSet = new Set(cloudBc.map((b) => b.id));
      currentBc.forEach((b) => {
        if (!cloudBcSet.has(b.id)) {
          itemsToPushToCloud.push({ collection: 'bao_cao_thang', id: b.id, data: b });
        }
      });
      const mergedBc = Array.from(bcMap.values());
      localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(mergedBc));

      // F. KHO PDF (pdf_files)
      const cloudPdf = pdfSnap.docs.map((d) => d.data() as PdfKhoItem);
      const localPdf: PdfKhoItem[] = currentMockDb.pdfFiles || [];
      const pdfMap = new Map<string, PdfKhoItem>();
      localPdf.forEach((p) => pdfMap.set(p.id, p));
      cloudPdf.forEach((c) => {
        if (!pdfMap.has(c.id)) pdfMap.set(c.id, c);
      });
      const cloudPdfSet = new Set(cloudPdf.map((p) => p.id));
      localPdf.forEach((p) => {
        if (!cloudPdfSet.has(p.id)) {
          itemsToPushToCloud.push({ collection: 'pdf_files', id: p.id, data: p });
        }
      });
      currentMockDb.pdfFiles = Array.from(pdfMap.values());

      // G. ĐƠN THƯ (don_thu)
      const cloudDonThu = donThuSnap.docs.map((d) => d.data() as DonThu);
      const localDonThu: DonThu[] = currentMockDb.donThuList || [];
      const donThuMap = new Map<string, DonThu>();
      localDonThu.forEach((d) => donThuMap.set(d.id, d));
      cloudDonThu.forEach((c) => {
        if (!donThuMap.has(c.id)) donThuMap.set(c.id, c);
      });
      const cloudDonThuSet = new Set(cloudDonThu.map((d) => d.id));
      localDonThu.forEach((d) => {
        if (!cloudDonThuSet.has(d.id)) {
          itemsToPushToCloud.push({ collection: 'don_thu', id: d.id, data: d });
        }
      });
      currentMockDb.donThuList = Array.from(donThuMap.values());

      // H. TÀI KHOẢN (users)
      const cloudUsers = usersSnap.docs.map((d) => d.data() as User & { mat_khau?: string });
      const localUsers: (User & { mat_khau?: string })[] = currentMockDb.users || [];
      const userMap = new Map<string, User & { mat_khau?: string }>();
      localUsers.forEach((u) => {
        const k = u.id || u.ten_dang_nhap?.toLowerCase();
        if (k) userMap.set(k, u);
      });
      cloudUsers.forEach((cu) => {
        const k = cu.id || cu.ten_dang_nhap?.toLowerCase();
        if (!k) return;
        const lu = userMap.get(k);
        if (!lu) {
          userMap.set(k, cu);
        } else {
          if (!cu.mat_khau && lu.mat_khau) {
            cu.mat_khau = lu.mat_khau;
          }
          userMap.set(k, cu);
        }
      });
      const cloudUserKeys = new Set(cloudUsers.map((u) => u.id || u.ten_dang_nhap?.toLowerCase()));
      localUsers.forEach((lu) => {
        const k = lu.id || lu.ten_dang_nhap?.toLowerCase();
        if (k && !cloudUserKeys.has(k)) {
          itemsToPushToCloud.push({ collection: 'users', id: lu.id, data: lu });
        }
      });
      currentMockDb.users = Array.from(userMap.values());

      // I. PHÂN CÔNG ĐỊA BÀN (phan_cong_dia_ban)
      const cloudPhanCong = phanCongSnap.docs.map((d) => d.data());
      const pcMap = new Map<string, any>();
      currentPhanCong.forEach((p) => {
        const k = p.id || p.don_vi_id;
        if (k) pcMap.set(k, p);
      });
      cloudPhanCong.forEach((c) => {
        const k = c.id || c.don_vi_id;
        if (k && !pcMap.has(k)) pcMap.set(k, c);
      });
      const cloudPcKeys = new Set(cloudPhanCong.map((p) => p.id || p.don_vi_id));
      currentPhanCong.forEach((p) => {
        const k = p.id || p.don_vi_id;
        if (k && !cloudPcKeys.has(k)) {
          itemsToPushToCloud.push({ collection: 'phan_cong_dia_ban', id: p.id || p.don_vi_id, data: p });
        }
      });
      localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(Array.from(pcMap.values())));

      // Cấu hình Google Drive
      if (gdriveDoc.exists()) {
        const gcfg = gdriveDoc.data();
        localStorage.setItem('ubkt_google_drive_config', JSON.stringify(gcfg));
      }

      // Lưu trữ cơ sở dữ liệu local
      localStorage.setItem('ubkt_mock_db', JSON.stringify(currentMockDb));

      // Đẩy các mục mới ở máy này lên Cloud
      if (itemsToPushToCloud.length > 0) {
        onProgress?.(`Đang đồng bộ ${itemsToPushToCloud.length} mục mới lên Cloud...`);
        for (const item of itemsToPushToCloud) {
          await this.saveItemToCloud(item.collection, item.id, item.data);
        }
      }

      const syncTime = new Date().toLocaleTimeString('vi-VN');
      this.setLastSyncedAt(syncTime);
      localStorage.setItem('ubkt_prod_clean_done', 'true');

      // Phát sự kiện cập nhật
      window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_sync_status_changed', {
        detail: {
          isSyncing: false,
          lastSyncedAt: syncTime,
          mode: silent ? 'auto' : 'manual',
          pushedCount: itemsToPushToCloud.length,
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
      if (silent) {
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
