import type { DiaBanRecord, HoSoDiaBanFile, PhanCongDiaBan } from '../../types';
import { centralDataService } from '../centralDataService';
import { registerMockCommands, requestApi } from './core';

registerMockCommands({
  get_dia_ban_records: async (db) => {
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      const list: DiaBanRecord[] = raw ? JSON.parse(raw) : [];
      const activeUnits = (db.donViList || []).filter((d) => !d.deleted_at);
      const unitMap = new Map(activeUnits.map((u) => [u.id, u]));

      const map = new Map(list.map((r) => [r.id, r]));
      activeUnits.forEach((u) => {
        const ex = map.get(u.id);
        if (ex) {
          ex.ten_dia_ban = u.ten;
          ex.loai_to_chuc = u.loai;
        } else {
          map.set(u.id, {
            id: u.id,
            ten_dia_ban: u.ten,
            loai_to_chuc: u.loai,
            can_bo_phu_trach_id: undefined,
            can_bo_phu_trach_ten: 'Chưa phân công',
            can_bo_chuc_vu: '',
            thoi_gian_phan_cong: 'Chưa có',
            van_ban_phan_cong: 'Chưa ban hành',
            tinh_trang_bao_cao_thang: 'CHUA_NOP',
            thang_hien_tai: 'T10/2026',
            so_van_de_theo_doi: 0,
            danh_sach_van_de: [],
            so_chi_dao_chua_hoan_thanh: 0,
            danh_sach_chi_dao: [],
            thoi_diem_cap_nhat_gan_nhat: new Date().toISOString(),
            nguoi_cap_nhat_gan_nhat: 'Hệ thống',
            so_luong_tai_lieu: 0,
            trang_thai_ho_so: u.trang_thai === 'CHAM_DUT' ? 'DA_KET_THUC' : 'DANG_THEO_DOI',
          });
        }
      });
      const synced = Array.from(map.values()).filter((r) => unitMap.has(r.id));
      localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(synced));
      return synced;
    } catch {
      return [];
    }
  },

  save_dia_ban_records: async (_db, args) => {
    const { records } = args as { records: DiaBanRecord[] };
    localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(records || []));
    for (const r of records || []) {
      await centralDataService.saveDoc('ho_so_dia_ban_records', r.id, r);
    }
    return { success: true, count: (records || []).length };
  },

  update_dia_ban_record: async (_db, args) => {
    const { record } = args as { record: DiaBanRecord };
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      const list: DiaBanRecord[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((r) => r.id === record.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...record };
      else list.push(record);
      localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(list));
      await centralDataService.saveDoc('ho_so_dia_ban_records', record.id, record);
      return record;
    } catch {
      return record;
    }
  },

  get_phan_cong_dia_ban: async (db) => {
    try {
      const rawUser = localStorage.getItem('ubkt_current_user');
      const currentUser = rawUser ? JSON.parse(rawUser) : null;
      if (!currentUser) {
        return [];
      }
      const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
      if (raw) {
        return JSON.parse(raw);
      }
      const fromCentral = centralDataService.getPhanCongList();
      if (Array.isArray(fromCentral) && fromCentral.length > 0) {
        localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(fromCentral));
        return fromCentral;
      }
      if (db.phanCongDiaBan && Array.isArray(db.phanCongDiaBan)) {
        return db.phanCongDiaBan;
      }
      return [];
    } catch {
      return [];
    }
  },

  save_phan_cong_dia_ban: async (_db, args) => {
    const rawUser = localStorage.getItem('ubkt_current_user');
    const currentUser = rawUser ? JSON.parse(rawUser) : null;
    if (currentUser?.vai_tro !== 'ADMIN') {
      throw new Error(
        'Từ chối truy cập: Tài khoản Biên tập viên không có quyền chỉnh sửa dữ liệu phân công quản lý.'
      );
    }
    const { assignments } = args as { assignments: PhanCongDiaBan[] };
    localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(assignments || []));
    for (const as of assignments || []) {
      await centralDataService.saveDoc('phan_cong_dia_ban', as.user_id, {
        ...as,
        id: as.id || as.user_id,
      });
    }
    return { success: true };
  },

  get_ho_so_files: async (_db, args) => {
    const { don_vi_id } = (args || {}) as { don_vi_id?: string };
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      let files: HoSoDiaBanFile[] = raw ? JSON.parse(raw) : [];
      if (don_vi_id) files = files.filter((f) => f.don_vi_id === don_vi_id);
      return files;
    } catch {
      return [];
    }
  },

  add_ho_so_file: async (_db, args) => {
    const file = (args as unknown) as HoSoDiaBanFile;
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      const files: HoSoDiaBanFile[] = raw ? JSON.parse(raw) : [];
      files.unshift(file);
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(files));
      await centralDataService.saveDoc('ho_so_dia_ban_files', file.id, file);
      return file;
    } catch {
      return file;
    }
  },

  delete_ho_so_file: async (_db, args) => {
    const { id } = args as { id: string };
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      let files: HoSoDiaBanFile[] = raw ? JSON.parse(raw) : [];
      files = files.filter((f) => f.id !== id);
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(files));
      await centralDataService.deleteDoc('ho_so_dia_ban_files', id);
      return { success: true };
    } catch {
      return { success: true };
    }
  },
});

export const diabanApi = {
  getDiaBanRecords: () =>
    requestApi<DiaBanRecord[]>('/api/dia-ban', 'GET', undefined, 'get_dia_ban_records'),

  saveDiaBanRecords: (records: DiaBanRecord[]) =>
    requestApi<{ success: boolean; count: number }>(
      '/api/dia-ban',
      'POST',
      { records },
      'save_dia_ban_records',
      { records }
    ),

  updateDiaBanRecord: (record: DiaBanRecord) =>
    requestApi<DiaBanRecord>(
      `/api/dia-ban/${record.id}`,
      'PUT',
      { record },
      'update_dia_ban_record',
      { record }
    ),

  getPhanCongDiaBan: () =>
    requestApi<PhanCongDiaBan[]>('/api/phan-cong-dia-ban', 'GET', undefined, 'get_phan_cong_dia_ban'),

  savePhanCongDiaBan: (assignments: PhanCongDiaBan[], actor_name?: string, user_id?: string) =>
    requestApi<{ success: boolean }>(
      '/api/phan-cong-dia-ban',
      'POST',
      { assignments, actor_name, user_id },
      'save_phan_cong_dia_ban',
      { assignments, actor_name, user_id }
    ),

  getHoSoDiaBanFiles: (don_vi_id?: string) =>
    requestApi<HoSoDiaBanFile[]>(
      don_vi_id ? `/api/ho-so-files?don_vi_id=${encodeURIComponent(don_vi_id)}` : '/api/ho-so-files',
      'GET',
      undefined,
      'get_ho_so_files',
      { don_vi_id }
    ),

  addHoSoDiaBanFile: (file: HoSoDiaBanFile) =>
    requestApi<HoSoDiaBanFile>(
      '/api/ho-so-files',
      'POST',
      file as unknown as Record<string, unknown>,
      'add_ho_so_file',
      file as unknown as Record<string, unknown>
    ),

  deleteHoSoDiaBanFile: (id: string) =>
    requestApi<{ success: boolean }>(
      `/api/ho-so-files/${id}`,
      'DELETE',
      undefined,
      'delete_ho_so_file',
      { id }
    ),
};

