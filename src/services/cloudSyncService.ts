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
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db as firestoreDb, auth, ensureFirebaseAuthReady } from './firebase';
import { isSameData, captureActiveInput, restoreActiveInput } from '../utils/syncUtils';
import { sanitizeUserForCloud } from '../utils/passwordCrypto';
import { sessionStore } from '../utils/sessionStore';
import { indexedDbStorage } from './indexedDbStorage';
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
const STORAGE_DIRTY_QUEUE = 'ubkt_dirty_sync_queue';
const TAB_HIDDEN_FULL_SYNC_THRESHOLD_MS = 10 * 60 * 1000; // 10 phút

export interface DirtySyncEntry {
  collection: string;
  id: string;
  data?: any;
  action: 'upsert' | 'delete';
  updatedAt: number;
}

export const cloudSyncService = {
  _dirtyMap: new Map<string, DirtySyncEntry>(),
  _dirtyLoaded: false,
  _hiddenAtTimestamp: null as number | null,

  _loadDirtyQueue() {
    if (this._dirtyLoaded) return;
    this._dirtyLoaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_DIRTY_QUEUE);
      if (raw) {
        const entries: DirtySyncEntry[] = JSON.parse(raw);
        if (Array.isArray(entries)) {
          entries.forEach((e) => {
            if (e && e.collection && e.id) {
              this._dirtyMap.set(`${e.collection}:${e.id}`, e);
            }
          });
        }
      }
    } catch {}
  },

  _persistDirtyQueue() {
    try {
      const arr: DirtySyncEntry[] = Array.from(this._dirtyMap.values());
      if (arr.length === 0) {
        localStorage.removeItem(STORAGE_DIRTY_QUEUE);
      } else {
        localStorage.setItem(STORAGE_DIRTY_QUEUE, JSON.stringify(arr));
      }
    } catch {}
  },

  markDirty(collectionName: string, id: string, data?: any, action: 'upsert' | 'delete' = 'upsert') {
    if (!collectionName || !id) return;
    this._loadDirtyQueue();
    this._dirtyMap.set(`${collectionName}:${id}`, {
      collection: collectionName,
      id: String(id),
      data,
      action,
      updatedAt: Date.now(),
    });
    this._persistDirtyQueue();
  },

  clearDirty(collectionName: string, id: string) {
    if (!collectionName || !id) return;
    this._loadDirtyQueue();
    if (this._dirtyMap.delete(`${collectionName}:${id}`)) {
      this._persistDirtyQueue();
    }
  },

  isDirty(): boolean {
    this._loadDirtyQueue();
    return this._dirtyMap.size > 0;
  },

  // Kiểm tra xem lỗi trả về có phải lỗi từ chối quyền (PERMISSION_DENIED) của Firestore Rules hay không
  isPermissionDeniedError(err: any): boolean {
    if (!err) return false;
    const code = String(err.code || err.status || '');
    const message = String(err.message || '').toLowerCase();
    return (
      code === 'permission-denied' ||
      code === 'firestore/permission-denied' ||
      message.includes('permission-denied') ||
      message.includes('permission_denied') ||
      message.includes('missing or insufficient permissions') ||
      message.includes('permission denied')
    );
  },

  // Xử lý khi bị từ chối quyền ghi do vi phạm Single-Session: dừng đồng bộ, khóa màn hình và yêu cầu xác thực lại
  handleSessionPermissionDenied(err: any): void {
    console.warn(
      '[CloudSync] Quyền ghi bị từ chối (PERMISSION_DENIED) do phiên làm việc đã bị thay thế bởi thiết bị khác:',
      err
    );
    this.stopAutoSync();
    this._isSyncing = false;
    sessionStore.setSessionLocked(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ubkt_session_locked', {
          detail: {
            reason: 'permission_denied',
            message:
              'Tài khoản của bạn đã được đăng nhập trên một thiết bị khác hoặc phiên làm việc đã hết hạn. Vui lòng mở khóa lại để tiếp tục.',
          },
        })
      );
      window.dispatchEvent(new CustomEvent('ubkt_lock_session'));
    }
  },

  /**
   * Đảm bảo hồ sơ users/{uid} đã tồn tại trên Firestore
   */
  async ensureCurrentUserDoc(): Promise<boolean> {
    const currentAuth = auth.currentUser;
    if (!currentAuth) return false;
    const uid = currentAuth.uid;
    try {
      const snap = await getDoc(doc(firestoreDb, 'users', uid));
      if (!snap.exists()) {
        const currentUser = sessionStore.getCurrentUser();
        const now = new Date().toISOString();
        const newProfile: User = {
          id: uid,
          firebaseUid: uid,
          ten_dang_nhap: currentUser?.ten_dang_nhap || currentAuth.email?.split('@')[0] || uid,
          ho_ten: currentUser?.ho_ten || 'Cán bộ UBKT',
          vai_tro: currentUser?.vai_tro || 'BIEN_TAP',
          chuc_danh: currentUser?.chuc_danh || 'Chuyên viên UBKT',
          trang_thai: 1,
          must_change_password: currentUser?.must_change_password ?? false,
          don_vi_id: currentUser?.don_vi_id || null,
          pham_vi_quan_ly: currentUser?.pham_vi_quan_ly || null,
          created_at: currentUser?.created_at || now,
          updated_at: now,
        };
        const currentSessionId = sessionStore.getSessionId();
        await setDoc(
          doc(firestoreDb, 'users', uid),
          {
            ...sanitizeUserForCloud(newProfile),
            ...(currentSessionId ? { activeSessionId: currentSessionId } : {}),
          },
          { merge: true }
        );
      }

      // Đảm bảo phan_cong_dia_ban/{uid} cũng tồn tại
      try {
        const pcSnap = await getDoc(doc(firestoreDb, 'phan_cong_dia_ban', uid));
        if (!pcSnap.exists()) {
          const rawPc = typeof localStorage !== 'undefined' ? localStorage.getItem('ubkt_phan_cong_dia_ban') : null;
          const pcList = rawPc ? JSON.parse(rawPc) : [];
          const currentUser = sessionStore.getCurrentUser();
          const normUsername = currentUser?.ten_dang_nhap?.toLowerCase();
          const found = pcList.find(
            (p: any) =>
              p.user_id === uid ||
              (normUsername && p.ten_dang_nhap?.toLowerCase() === normUsername) ||
              (currentUser?.id && p.user_id === currentUser.id)
          );
          if (found && Array.isArray(found.don_vi_ids)) {
            await setDoc(
              doc(firestoreDb, 'phan_cong_dia_ban', uid),
              {
                ...found,
                id: uid,
                user_id: uid,
                updated_at: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      } catch {}
      return true;
    } catch {
      return false;
    }
  },

  // Chỉ đẩy các bản ghi có thay đổi local (dirty flag) lên Cloud, KHÔNG đọc lại toàn bộ 11 collection
  async flushDirtyChanges(): Promise<{ pushed: number }> {
    this._loadDirtyQueue();
    if (this._dirtyMap.size === 0) return { pushed: 0 };
    const currentAuth = await ensureFirebaseAuthReady(2500);
    if (!currentAuth) return { pushed: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { pushed: 0 };
    if (this._isSyncing) return { pushed: 0 };

    const entries: DirtySyncEntry[] = Array.from(this._dirtyMap.values());
    let pushed = 0;
    for (const entry of entries) {
      if (sessionStore.isSessionLocked()) {
        break;
      }
      if (entry.action === 'delete') {
        await this.deleteItemFromCloud(entry.collection, entry.id);
      } else {
        await this.saveItemToCloud(entry.collection, entry.id, entry.data);
      }
      if (sessionStore.isSessionLocked()) {
        break;
      }
      pushed++;
    }
    return { pushed };
  },

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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.markDirty(collectionName, String(id), data, 'upsert');
        return;
      }
      const docRef = doc(firestoreDb, collectionName, String(id));
      // Loại bỏ undefined để Firestore không báo lỗi
      const cleanData = JSON.parse(JSON.stringify(data));
      if (collectionName === 'users') {
        delete cleanData.mat_khau;
        delete cleanData.mat_khau_hash;
        delete cleanData.password;
        delete cleanData.passwordHash;
        delete cleanData.activeSessionId;
        delete cleanData.lastLoginDevice;
        delete cleanData.lastActiveAt;
        cleanData.mat_khau = deleteField();
        cleanData.mat_khau_hash = deleteField();
      } else {
        // Đính kèm sessionId hiện tại để Firestore Rules kiểm tra tính hợp lệ của phiên
        const currentSessionId = sessionStore.getSessionId();
        if (currentSessionId) {
          cleanData.sessionId = currentSessionId;
        }
      }
      await setDoc(docRef, cleanData, { merge: true });
      this.clearDirty(collectionName, String(id));
      // Xoá tombstone nếu bản ghi được tạo lại (chỉ ADMIN có quyền ghi/xóa tombstones)
      const isAdmin = sessionStore.getCurrentUser()?.vai_tro === 'ADMIN';
      if (isAdmin) {
        const tombRef = doc(firestoreDb, 'tombstones', String(id));
        deleteDoc(tombRef).catch(() => {});
      }
    } catch (err: any) {
      if (this.isPermissionDeniedError(err)) {
        this.clearDirty(collectionName, String(id));
        this.handleSessionPermissionDenied(err);
        return;
      }
      this.markDirty(collectionName, String(id), data, 'upsert');
      console.warn(`[CloudSync] Lỗi lưu ${collectionName}/${id} (đã đánh dấu dirty để đẩy lại sau):`, err);
    }
  },

  // Xóa 1 bản ghi khỏi Firestore kèm ghi nhận Tombstone chống hồi sinh dữ liệu
  async deleteItemFromCloud(collectionName: string, id: string): Promise<void> {
    try {
      if (!id) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.markDirty(collectionName, String(id), undefined, 'delete');
        return;
      }

      const currentSessionId = sessionStore.getSessionId();
      const currentUser = sessionStore.getCurrentUser();

      // Kiểm tra xem phiên làm việc có bị đá bởi thiết bị khác không trước khi xóa
      if (currentUser?.id) {
        const userSnap = await getDoc(doc(firestoreDb, 'users', currentUser.id)).catch(() => null);
        if (userSnap && userSnap.exists()) {
          const cloudSessionId = userSnap.data()?.activeSessionId;
          if (cloudSessionId && currentSessionId && cloudSessionId !== currentSessionId) {
            const permErr: any = new Error(
              'PERMISSION_DENIED: Phiên làm việc đã hết hạn hoặc được mở trên thiết bị khác'
            );
            permErr.code = 'permission-denied';
            throw permErr;
          }
        }
      }

      const isAdmin = currentUser?.vai_tro === 'ADMIN';
      if (isAdmin) {
        // Ghi tombstone vào Firestore trước để các máy khác biết và không bao giờ đẩy lại
        const tombRef = doc(firestoreDb, 'tombstones', String(id));
        await setDoc(
          tombRef,
          {
            id: String(id),
            collection: collectionName,
            deleted_at: new Date().toISOString(),
            sessionId: currentSessionId || '',
          },
          { merge: true }
        );
      }

      const docRef = doc(firestoreDb, collectionName, String(id));
      await deleteDoc(docRef);
      this.clearDirty(collectionName, String(id));
    } catch (err: any) {
      if (this.isPermissionDeniedError(err)) {
        this.clearDirty(collectionName, String(id));
        this.handleSessionPermissionDenied(err);
        return;
      }
      this.markDirty(collectionName, String(id), undefined, 'delete');
      console.warn(`[CloudSync] Lỗi xóa ${collectionName}/${id} (đã đánh dấu dirty để xóa lại sau):`, err);
    }
  },

  // ── ĐẨY TOÀN BỘ DỮ LIỆU TỪ MÁY NÀY LÊN CLOUD ──────────────────────────────
  async pushAllToCloud(onProgress?: (msg: string) => void): Promise<{ success: boolean; error?: string; counts: any }> {
    try {
      const currentAuth = await ensureFirebaseAuthReady(4000);
      if (!currentAuth) {
        const stored = sessionStore.getCurrentUser();
        return {
          success: false,
          error: stored
            ? 'Phiên xác thực Firebase Auth chưa sẵn sàng hoặc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục đồng bộ.'
            : 'Vui lòng đăng nhập trước khi đồng bộ dữ liệu với Cloud.',
          counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0, donThu: 0, users: 0 },
        };
      }
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
      const currentSessionId = sessionStore.getSessionId();
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
                delete clean.activeSessionId;
                delete clean.lastLoginDevice;
                delete clean.lastActiveAt;
                clean.mat_khau = deleteField();
                clean.mat_khau_hash = deleteField();
              } else if (currentSessionId) {
                clean.sessionId = currentSessionId;
              }
              batch.set(ref, clean, { merge: true });
            }
          });
          await batch.commit();
        }
      };

      const isAdminUser = sessionStore.getCurrentUser()?.vai_tro === 'ADMIN';

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
        const gdrivePayload = JSON.parse(JSON.stringify(gdriveConfig));
        if (currentSessionId) gdrivePayload.sessionId = currentSessionId;
        await setDoc(doc(firestoreDb, 'system_config', 'google_drive'), gdrivePayload, { merge: true });
      }

      // Lưu nhật ký đồng bộ
      const syncTime = new Date().toLocaleString('vi-VN');
      if (isAdminUser) {
        const syncMetaPayload: any = {
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
        };
        if (currentSessionId) syncMetaPayload.sessionId = currentSessionId;
        await setDoc(doc(firestoreDb, 'system_config', 'sync_meta'), syncMetaPayload, { merge: true });
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
      if (this.isPermissionDeniedError(err)) {
        this.handleSessionPermissionDenied(err);
      }
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
      const currentAuth = await ensureFirebaseAuthReady(4000);
      if (!currentAuth) {
        const stored = sessionStore.getCurrentUser();
        return {
          success: false,
          error: stored
            ? 'Phiên xác thực Firebase Auth chưa sẵn sàng hoặc đã hết hạn. Vui lòng thử lại hoặc đăng nhập lại.'
            : 'Vui lòng đăng nhập trước khi đồng bộ dữ liệu với Cloud.',
          counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0, donThu: 0, users: 0 },
        };
      }
      onProgress?.('Đang kết nối Firestore Cloud...');

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
        getDocs(collection(firestoreDb, 'pdf_files')).catch(() => ({ docs: [], size: 0 }) as unknown as QuerySnapshot<DocumentData>),
        getDocs(collection(firestoreDb, 'don_thu')),
        getDocs(collection(firestoreDb, 'users'))
          .then((s) => s.docs)
          .catch(() =>
            getDoc(doc(firestoreDb, 'users', currentAuth.uid)).then((d) => (d.exists() ? [d] : []))
          ),
        getDocs(collection(firestoreDb, 'phan_cong_dia_ban')),
        getDoc(doc(firestoreDb, 'system_config', 'google_drive')),
      ]);

      onProgress?.('Đang nạp dữ liệu từ Cloud vào bộ nhớ máy...');

      // 1. Cập nhật ubkt_mock_db (so sánh dữ liệu cũ để chỉ bắn sự kiện khi thật sự đổi)
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

      let prevDiaBan: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
        if (raw) prevDiaBan = JSON.parse(raw);
      } catch {}

      let prevFiles: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (raw) prevFiles = JSON.parse(raw);
      } catch {}

      let prevBc: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_bao_cao_thang');
        if (raw) prevBc = JSON.parse(raw);
      } catch {}

      let prevPhanCong: any[] = [];
      try {
        const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
        if (raw) prevPhanCong = JSON.parse(raw);
      } catch {}

      let prevGdrive: any = null;
      try {
        const raw = localStorage.getItem('ubkt_google_drive_config');
        if (raw) prevGdrive = JSON.parse(raw);
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
        const cloudUsers = usersDocs.map((d) => {
          const uData = d.data() as User;
          return sanitizeUserForCloud({
            ...uData,
            id: d.id,
            firebaseUid: uData.firebaseUid || (d.id.length >= 20 ? d.id : undefined),
          }) as User;
        });
        const existingUsers: User[] = currentMockDb.users || [];
        const userMap = new Map<string, User>();
        existingUsers.forEach((u) => {
          const k = u.ten_dang_nhap?.toLowerCase() || u.id;
          if (k) userMap.set(k, u);
        });
        cloudUsers.forEach((cu) => {
          const k = cu.ten_dang_nhap?.toLowerCase() || cu.id;
          if (k) {
            const ex = userMap.get(k);
            userMap.set(k, { ...(ex || {}), ...cu });
          }
        });
        currentMockDb.users = Array.from(userMap.values());

        // Đồng bộ readNotificationIds / dismissed_reminders của người dùng hiện tại về thiết bị này
        const currentUid = currentAuth.uid;
        if (currentUid) {
          const myUserDoc = cloudUsers.find((u) => u.id === currentUid);
          if (myUserDoc) {
            const cloudReadIds = (myUserDoc as any).readNotificationIds || (myUserDoc as any).dismissed_reminders;
            if (Array.isArray(cloudReadIds)) {
              try {
                const localKey = `ubkt_dismissed_reminders_${currentUid}`;
                const localRaw = localStorage.getItem(localKey);
                const localList = localRaw ? JSON.parse(localRaw) : [];
                const merged = Array.from(new Set([...cloudReadIds, ...localList])).slice(-500);
                localStorage.setItem(localKey, JSON.stringify(merged));
                const curUser = sessionStore.getCurrentUser();
                if (curUser && curUser.id === currentUid) {
                  curUser.readNotificationIds = merged;
                  curUser.dismissed_reminders = merged;
                  sessionStore.setCurrentUser(curUser);
                }
              } catch {}
            }
          }
        }
      }

      const donViChanged = !isSameData(prevDonVi, currentMockDb.donViList || []);
      const ctChanged = !isSameData(prevCt, currentMockDb.chuongTrinhList || []);
      const pdfChanged = !isSameData(prevPdf, currentMockDb.pdfFiles || []);
      const donThuChanged = !isSameData(prevDonThu, currentMockDb.donThuList || []);
      const usersChanged = !isSameData(prevUsers, currentMockDb.users || []);

      if (donViChanged || ctChanged || pdfChanged || donThuChanged || usersChanged) {
        localStorage.setItem('ubkt_mock_db', JSON.stringify(currentMockDb));
      }

      // 2. Cập nhật ubkt_ho_so_dia_ban_records
      let diaBanChanged = false;
      if (!diaBanSnap.empty) {
        let deletedDiaBanIds = new Set<string>();
        try {
          const raw = localStorage.getItem('ubkt_deleted_diaban_ids');
          if (raw) deletedDiaBanIds = new Set(JSON.parse(raw));
        } catch {}
        const records = diaBanSnap.docs
          .map((d) => d.data())
          .filter((r) => !deletedDiaBanIds.has(r.id));
        diaBanChanged = !isSameData(prevDiaBan, records);
        if (diaBanChanged) {
          localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(records));
        }
      }

      // 3. Cập nhật ubkt_ho_so_dia_ban_files
      let filesChanged = false;
      if (!filesSnap.empty) {
        const files = filesSnap.docs.map((d) => d.data() as HoSoDiaBanFile);
        filesChanged = !isSameData(prevFiles, files);
        if (filesChanged) {
          localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(files));
        }
      }

      // 4. Cập nhật ubkt_bao_cao_thang
      let bcChanged = false;
      if (!bcSnap.empty) {
        const reports = bcSnap.docs.map((d) => d.data() as BaoCaoThangItem);
        bcChanged = !isSameData(prevBc, reports);
        if (bcChanged) {
          localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(reports));
        }
      }

      // 5. Cập nhật ubkt_phan_cong_dia_ban
      let phanCongChanged = false;
      if (!phanCongSnap.empty) {
        const phanCongs = phanCongSnap.docs.map((d) => d.data());
        phanCongChanged = !isSameData(prevPhanCong, phanCongs);
        if (phanCongChanged) {
          localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(phanCongs));
        }
      }

      // 6. Cập nhật cấu hình Google Drive
      let gdriveChanged = false;
      if (gdriveDoc.exists()) {
        const gcfg = gdriveDoc.data();
        gdriveChanged = !isSameData(prevGdrive, gcfg);
        if (gdriveChanged) {
          localStorage.setItem('ubkt_google_drive_config', JSON.stringify(gcfg));
        }
      }

      const syncTime = new Date().toLocaleString('vi-VN');
      this.setLastSyncedAt(syncTime);

      // Đánh dấu đã sẵn sàng
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

      // 7. Chỉ phát các sự kiện tương ứng khi dữ liệu thực sự thay đổi
      const activeSnap = captureActiveInput();
      if (anyDataChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      }
      // Luôn phát ubkt_reminders_sync để NotificationBell tính toán lại nhắc việc từ dữ liệu chuẩn
      window.dispatchEvent(new CustomEvent('ubkt_reminders_sync'));
      // Luôn phát ubkt_reminders_sync để NotificationBell tính toán lại nhắc việc từ dữ liệu chuẩn
      window.dispatchEvent(new CustomEvent('ubkt_reminders_sync'));
      if (ctChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      }
      if (diaBanChanged || filesChanged || bcChanged || donViChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      }
      if (pdfChanged || filesChanged || bcChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      }
      if (phanCongChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      }
      if (gdriveChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated'));
      }
      if (usersChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
      }
      restoreActiveInput(activeSnap);

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
  _onlineHandler: null as (() => void) | null,
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
      // Bỏ qua nếu tab đang ẩn, mất kết nối mạng, đang bận hoặc KHÔNG có thay đổi local (dirty flag = false)
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (this._isSyncing) return;
      if (!this.isDirty()) return;

      try {
        await this.flushDirtyChanges();
      } catch {
        // Giữ nguyên dữ liệu trong hàng đợi dirty để thử lại lần sau
      }
    }, intervalSec * 1000);
  },

  // Bắt đầu quản lý đồng bộ nền (KHÔNG polling getDocs 11 collection mỗi 30s; dữ liệu về qua onSnapshot)
  startAutoSync() {
    this.stopAutoSync();
    if (!this.isAutoSyncEnabled()) return;

    console.log('[CloudSync] Đã kích hoạt chế độ Realtime (onSnapshot) + chỉ đẩy khi có dirty flag hoặc quay lại tab sau > 10 phút.');

    this._startSyncTimer();

    if (typeof document !== 'undefined') {
      this._visibilityHandler = () => {
        if (!this.isAutoSyncEnabled()) return;
        if (document.hidden || document.visibilityState === 'hidden') {
          this._hiddenAtTimestamp = Date.now();
          this._clearSyncTimer();
        } else if (document.visibilityState === 'visible') {
          const hiddenDuration = this._hiddenAtTimestamp ? Date.now() - this._hiddenAtTimestamp : 0;
          this._hiddenAtTimestamp = null;

          if (typeof navigator === 'undefined' || navigator.onLine) {
            if (hiddenDuration >= TAB_HIDDEN_FULL_SYNC_THRESHOLD_MS) {
              // Chỉ đồng bộ đầy đủ 2 chiều khi tab quay lại sau hơn 10 phút ẩn
              this.performTwoWaySync(true).catch(() => {});
            } else if (this.isDirty()) {
              // Nếu dưới 10 phút và có thay đổi local chưa đẩy thì chỉ đẩy thay đổi đó
              this.flushDirtyChanges().catch(() => {});
            }
          }
          this._startSyncTimer();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    if (typeof window !== 'undefined') {
      this._onlineHandler = () => {
        if (this.isDirty()) {
          this.flushDirtyChanges().catch(() => {});
        }
      };
      window.addEventListener('online', this._onlineHandler);
    }
  },

  stopAutoSync() {
    this._clearSyncTimer();
    this._hiddenAtTimestamp = null;
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
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
    const currentAuth = await ensureFirebaseAuthReady(4000);
    if (!currentAuth) {
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

      const isAdminSync = sessionStore.getCurrentUser()?.vai_tro === 'ADMIN';

      // Đảm bảo document users/{uid} đã có sẵn trên Cloud để quy tắc bảo mật không chặn
      await this.ensureCurrentUserDoc().catch(() => {});

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
        getDocs(collection(firestoreDb, 'pdf_files')).catch(() => ({ docs: [], size: 0 }) as unknown as QuerySnapshot<DocumentData>),
        getDocs(collection(firestoreDb, 'don_thu')),
        getDocs(collection(firestoreDb, 'users'))
          .then((s) => s.docs)
          .catch(() =>
            getDoc(doc(firestoreDb, 'users', currentAuth.uid)).then((d) => (d.exists() ? [d] : []))
          ),
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
          donViMap.set(cloudItem.id, cloudItem);
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
          ctMap.set(cloudItem.id, cloudItem);
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
          diaBanMap.set(c.id, c);
        }
      });
      const cloudDbSet = new Set(cloudDiaBan.map((d) => d.id));
      currentDiaBan.forEach((r) => {
        if (!cloudDbSet.has(r.id) && !deletedDiaBanIds.has(r.id) && !cloudTombstones.has(r.id)) {
          const curUser = sessionStore.getCurrentUser();
          const canPush =
            isAdminSync ||
            Boolean(curUser && (r.can_bo_phu_trach_id === curUser.id || r.can_bo_phu_trach_ids?.includes(curUser.id)));
          if (canPush) {
            itemsToPushToCloud.push({ collection: 'ho_so_dia_ban_records', id: r.id, data: r });
          }
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
      const cloudUsers = usersDocs.map((d) => {
        const data = d.data() as User;
        return sanitizeUserForCloud({
          ...data,
          id: d.id,
          firebaseUid: data.firebaseUid || (d.id.length >= 20 ? d.id : undefined),
        });
      });
      const localUsers: User[] = (currentMockDb.users || []).filter(
        (u: User) => !cloudTombstones.has(u.id)
      );
      const userMap = new Map<string, User>();

      for (const u of localUsers) {
        const k = u.ten_dang_nhap?.trim().toLowerCase() || u.id;
        if (!k || cloudTombstones.has(u.id)) continue;
        userMap.set(k, sanitizeUserForCloud(u) as User);
      }

      for (const cu of cloudUsers) {
        const k = cu.ten_dang_nhap?.trim().toLowerCase() || cu.id;
        if (!k || cloudTombstones.has(cu.id)) continue;
        const existing = userMap.get(k);
        if (existing) {
          userMap.set(k, {
            ...existing,
            ...cu,
            id: cu.id && cu.id.length >= 20 ? cu.id : (existing.id || cu.id),
            firebaseUid: cu.firebaseUid || (cu.id.length >= 20 ? cu.id : existing.firebaseUid),
          });
        } else {
          userMap.set(k, cu);
        }
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

      // Đồng bộ readNotificationIds / dismissed_reminders của người dùng hiện tại về thiết bị này
      const currentUidInSync = currentAuth.uid;
      if (currentUidInSync) {
        const myUserDoc = cloudUsers.find((u) => u.id === currentUidInSync);
        if (myUserDoc) {
          const cloudReadIds = (myUserDoc as any).readNotificationIds || (myUserDoc as any).dismissed_reminders;
          if (Array.isArray(cloudReadIds)) {
            try {
              const localKey = `ubkt_dismissed_reminders_${currentUidInSync}`;
              const localRaw = localStorage.getItem(localKey);
              const localList = localRaw ? JSON.parse(localRaw) : [];
              const merged = Array.from(new Set([...cloudReadIds, ...localList])).slice(-500);
              localStorage.setItem(localKey, JSON.stringify(merged));
              const curUser = sessionStore.getCurrentUser();
              if (curUser && curUser.id === currentUidInSync) {
                curUser.readNotificationIds = merged;
                curUser.dismissed_reminders = merged;
                sessionStore.setCurrentUser(curUser);
              }
            } catch {}
          }
        }
      }

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
      const isAdminUser = sessionStore.getCurrentUser()?.vai_tro === 'ADMIN';

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
        indexedDbStorage.setItem('ubkt_mock_db', currentMockDb).catch(() => {});
      }
      indexedDbStorage.setItem('ubkt_ho_so_dia_ban_records', mergedDiaBan).catch(() => {});
      indexedDbStorage.setItem('ubkt_ho_so_dia_ban_files', mergedFiles).catch(() => {});
      indexedDbStorage.setItem('ubkt_bao_cao_thang', mergedBc).catch(() => {});

      // Đẩy các mục mới ở máy này lên Cloud (lọc theo quyền hạn của vai trò hiện tại để không vi phạm Firestore Rules)
      const filteredItemsToPush = itemsToPushToCloud.filter((item) => {
        if (isAdminSync) return true;
        const userRole = sessionStore.getCurrentUser()?.vai_tro || null;
        if (userRole !== 'BIEN_TAP') return false;
        const adminOnlyColls = new Set(['don_vi', 'users', 'phan_cong_dia_ban', 'system_config', 'tombstones']);
        if (adminOnlyColls.has(item.collection)) return false;

        // Với BIEN_TAP: chỉ đẩy các bản ghi thuộc đơn vị được phân công
        const myUid = currentAuth.uid;
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

      // Bảo vệ ô input đang nhập và chỉ phát sự kiện khi thực sự có dữ liệu thay đổi
      const activeInputSnapshot = captureActiveInput();
      if (anyDataChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      }
      // Luôn phát ubkt_reminders_sync để NotificationBell tính toán lại nhắc việc từ dữ liệu chuẩn
      window.dispatchEvent(new CustomEvent('ubkt_reminders_sync'));
      if (ctChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      }
      if (diaBanChanged || filesChanged || bcChanged || donViChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      }
      if (pdfChanged || filesChanged || bcChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      }
      if (phanCongChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      }
      if (gdriveChanged) {
        window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated'));
      }
      if (usersChanged) {
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
      console.error('[CloudSync] Lỗi đồng bộ 2 chiều:', err);
      const isPerm = this.isPermissionDeniedError(err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ubkt_sync_error', {
            detail: {
              message: isPerm
                ? 'Lỗi quyền truy cập Firestore. Vui lòng kiểm tra trạng thái tài khoản.'
                : `Lỗi đồng bộ dữ liệu: ${err?.message || String(err)}`,
            },
          })
        );
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
  async getCloudSummary(): Promise<{
    isOnline: boolean;
    counts: any;
    lastMeta?: any;
    authEmail?: string | null;
    authUid?: string | null;
    authReady?: boolean;
  }> {
    try {
      const currentAuth = await ensureFirebaseAuthReady(4000);
      if (!currentAuth) {
        console.warn('[CloudSync] Chưa có phiên Firebase Auth hợp lệ khi lấy số liệu Cloud.');
        return {
          isOnline: false,
          counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0 },
          authEmail: null,
          authUid: null,
          authReady: false,
        };
      }

      const [donViSnap, ctSnap, diaBanSnap, filesSnap, bcSnap, pdfSnap, metaDoc] = await Promise.all([
        getDocs(collection(firestoreDb, 'don_vi')),
        getDocs(collection(firestoreDb, 'chuong_trinh')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_records')),
        getDocs(collection(firestoreDb, 'ho_so_dia_ban_files')),
        getDocs(collection(firestoreDb, 'bao_cao_thang')),
        getDocs(collection(firestoreDb, 'pdf_files')).catch(() => ({ docs: [], size: 0 }) as unknown as QuerySnapshot<DocumentData>),
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
        authEmail: currentAuth.email,
        authUid: currentAuth.uid,
        authReady: true,
      };
    } catch (err) {
      console.warn('[CloudSync] Không kết nối được Cloud:', err);
      return {
        isOnline: false,
        counts: { donVi: 0, chuongTrinh: 0, hoSoDiaBan: 0, hoSoFiles: 0, baoCaoThang: 0, pdfFiles: 0 },
        authEmail: auth.currentUser?.email || null,
        authUid: auth.currentUser?.uid || null,
        authReady: !!auth.currentUser,
      };
    }
  },

  getFirebaseAuthUser(): import('firebase/auth').User | null {
    return auth.currentUser;
  },

  async ensureFirebaseAuthReady(timeoutMs = 4000): Promise<import('firebase/auth').User | null> {
    return ensureFirebaseAuthReady(timeoutMs);
  },

  // ── SAO LƯU & KHÔI PHỤC DỮ LIỆU TOÀN HỆ THỐNG (JSON) ─────────────────────
  stripSensitiveBackupFields(input: any): any {
    const SENSITIVE_KEYS = new Set([
      'mat_khau',
      'mat_khau_hash',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'apiKey',
      'api_key',
      'secret',
      'clientSecret',
      'client_secret',
      'privateKey',
      'private_key',
    ]);
    if (Array.isArray(input)) {
      return input.map((item) => this.stripSensitiveBackupFields(item));
    }
    if (input && typeof input === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(input)) {
        if (SENSITIVE_KEYS.has(k)) continue;
        cleaned[k] = this.stripSensitiveBackupFields(v);
      }
      return cleaned;
    }
    return input;
  },

  exportFullBackupJson(): { filename: string; jsonString: string; counts: Record<string, number> } {
    let mockDb: any = {};
    try {
      const raw = localStorage.getItem('ubkt_mock_db');
      if (raw) mockDb = JSON.parse(raw);
    } catch {}

    let diaBanRecords: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      if (raw) diaBanRecords = JSON.parse(raw);
    } catch {}

    let diaBanFiles: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      if (raw) diaBanFiles = JSON.parse(raw);
    } catch {}

    let baoCaoThang: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_bao_cao_thang');
      if (raw) baoCaoThang = JSON.parse(raw);
    } catch {}

    let phanCongDiaBan: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
      if (raw) phanCongDiaBan = JSON.parse(raw);
    } catch {}

    const rawCollections = {
      don_vi: Array.isArray(mockDb.donViList) ? mockDb.donViList : [],
      chuong_trinh: Array.isArray(mockDb.chuongTrinhList) ? mockDb.chuongTrinhList : [],
      ho_so_dia_ban_records: Array.isArray(diaBanRecords) ? diaBanRecords : [],
      ho_so_dia_ban_files: Array.isArray(diaBanFiles) ? diaBanFiles : [],
      bao_cao_thang: Array.isArray(baoCaoThang) ? baoCaoThang : [],
      pdf_files: Array.isArray(mockDb.pdfFiles) ? mockDb.pdfFiles : [],
      don_thu: Array.isArray(mockDb.donThuList) ? mockDb.donThuList : [],
      users: Array.isArray(mockDb.users) ? mockDb.users : [],
      phan_cong_dia_ban: Array.isArray(phanCongDiaBan) ? phanCongDiaBan : [],
    };

    const sanitizedCollections = this.stripSensitiveBackupFields(rawCollections);
    const counts: Record<string, number> = {
      don_vi: sanitizedCollections.don_vi.length,
      chuong_trinh: sanitizedCollections.chuong_trinh.length,
      ho_so_dia_ban_records: sanitizedCollections.ho_so_dia_ban_records.length,
      ho_so_dia_ban_files: sanitizedCollections.ho_so_dia_ban_files.length,
      bao_cao_thang: sanitizedCollections.bao_cao_thang.length,
      pdf_files: sanitizedCollections.pdf_files.length,
      don_thu: sanitizedCollections.don_thu.length,
      users: sanitizedCollections.users.length,
      phan_cong_dia_ban: sanitizedCollections.phan_cong_dia_ban.length,
    };

    const backupPayload = {
      format: 'UBKT_FULL_BACKUP_V1',
      exportedAt: new Date().toISOString(),
      counts,
      collections: sanitizedCollections,
    };

    const dateTag = new Date().toISOString().slice(0, 10);
    return {
      filename: `ubkt_backup_${dateTag}.json`,
      jsonString: JSON.stringify(backupPayload, null, 2),
      counts,
    };
  },

  async restoreFromBackupJson(
    parsedData: any,
    onProgress?: (msg: string) => void
  ): Promise<{ success: boolean; counts: Record<string, number>; error?: string }> {
    try {
      const cols = parsedData?.collections || parsedData;
      if (!cols || typeof cols !== 'object') {
        throw new Error('File sao lưu không đúng định dạng JSON hợp lệ (thiếu đối tượng collections).');
      }

      const sanitized = this.stripSensitiveBackupFields(cols);
      const donViList = Array.isArray(sanitized.don_vi) ? sanitized.don_vi : [];
      const chuongTrinhList = Array.isArray(sanitized.chuong_trinh) ? sanitized.chuong_trinh : [];
      const diaBanRecords = Array.isArray(sanitized.ho_so_dia_ban_records) ? sanitized.ho_so_dia_ban_records : [];
      const diaBanFiles = Array.isArray(sanitized.ho_so_dia_ban_files) ? sanitized.ho_so_dia_ban_files : [];
      const baoCaoThang = Array.isArray(sanitized.bao_cao_thang) ? sanitized.bao_cao_thang : [];
      const pdfFiles = Array.isArray(sanitized.pdf_files) ? sanitized.pdf_files : [];
      const donThuList = Array.isArray(sanitized.don_thu) ? sanitized.don_thu : [];
      const users = Array.isArray(sanitized.users) ? sanitized.users : [];
      const phanCongDiaBan = Array.isArray(sanitized.phan_cong_dia_ban) ? sanitized.phan_cong_dia_ban : [];

      onProgress?.('Đang khôi phục dữ liệu vào bộ nhớ cục bộ...');

      let currentMockDb: any = {};
      try {
        const raw = localStorage.getItem('ubkt_mock_db');
        if (raw) currentMockDb = JSON.parse(raw);
      } catch {}

      currentMockDb.donViList = donViList;
      currentMockDb.chuongTrinhList = chuongTrinhList;
      currentMockDb.pdfFiles = pdfFiles;
      currentMockDb.donThuList = donThuList;
      if (users.length > 0) {
        currentMockDb.users = users;
      }

      localStorage.setItem('ubkt_mock_db', JSON.stringify(currentMockDb));
      localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(diaBanRecords));
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(diaBanFiles));
      localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(baoCaoThang));
      localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(phanCongDiaBan));

      onProgress?.('Đang đồng bộ dữ liệu khôi phục lên Firestore Cloud...');
      await this.pushAllToCloud(onProgress);

      window.dispatchEvent(new CustomEvent('ubkt_data_synced'));
      window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));

      return {
        success: true,
        counts: {
          don_vi: donViList.length,
          chuong_trinh: chuongTrinhList.length,
          ho_so_dia_ban_records: diaBanRecords.length,
          ho_so_dia_ban_files: diaBanFiles.length,
          bao_cao_thang: baoCaoThang.length,
          pdf_files: pdfFiles.length,
          don_thu: donThuList.length,
          users: users.length,
          phan_cong_dia_ban: phanCongDiaBan.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        counts: {},
        error: err?.message || String(err),
      };
    }
  },
};
