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
        const records = diaBanSnap.docs.map((d) => d.data());
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

  // ── ĐỒNG BỘ 2 CHIỀU THÔNG MINH (SMART 2-WAY SYNC) ──────────────────────────
  async smartSync(onProgress?: (msg: string) => void): Promise<{ success: boolean; action: 'pushed' | 'pulled' | 'merged'; counts: any }> {
    try {
      onProgress?.('Kiểm tra dữ liệu trên Cloud...');
      const [donViSnap, ctSnap, diaBanSnap] = await Promise.all([
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_records')),
      ]);

      const cloudTotal = donViSnap.size + ctSnap.size + diaBanSnap.size;

      // Đếm dữ liệu cục bộ
      let localMockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) localMockDb = JSON.parse(raw);
      } catch {}

      let localDiaBan: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
        if (raw) localDiaBan = JSON.parse(raw);
      } catch {}

      const localTotal =
        (localMockDb.donViList?.length || 0) +
        (localMockDb.chuongTrinhList?.length || 0) +
        (localDiaBan.length || 0);

      // Trường hợp 1: Cloud hoàn toàn trống mà máy này có dữ liệu -> Tự động đẩy lên Cloud
      if (cloudTotal === 0 && localTotal > 0) {
        onProgress?.('Phát hiện Cloud trống: Đang tự động tải dữ liệu máy này lên Cloud...');
        const pushRes = await this.pushAllToCloud(onProgress);
        return { success: pushRes.success, action: 'pushed', counts: pushRes.counts };
      }

      // Trường hợp 2: Cloud đã có dữ liệu -> Kéo dữ liệu mới nhất từ Cloud về
      onProgress?.('Đang cập nhật dữ liệu mới nhất từ Cloud về máy này...');
      const pullRes = await this.pullAllFromCloud(onProgress);
      return { success: pullRes.success, action: 'pulled', counts: pullRes.counts };
    } catch (err: any) {
      console.error('[CloudSync] Lỗi đồng bộ thông minh:', err);
      return { success: false, action: 'merged', counts: {} };
    }
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
