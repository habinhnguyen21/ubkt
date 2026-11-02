import type { DonThu } from '../../types';
import { centralDataService } from '../centralDataService';
import { registerMockCommands, requestApi, saveMockDb } from './core';

registerMockCommands({
  get_all_don_thu: async (db) => {
    return db.donThuList || [];
  },

  create_don_thu: async (db, args) => {
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
    await centralDataService.saveDoc('don_thu', newDonThu.id, newDonThu);
    return newDonThu;
  },

  update_don_thu: async (db, args) => {
    const { id, input, actor_name } = args as {
      id: string;
      input: Partial<DonThu>;
      actor_name?: string;
    };
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
    await centralDataService.saveDoc('don_thu', updated.id, updated);
    return updated;
  },

  delete_don_thu: async (db, args) => {
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
    await centralDataService.deleteDoc('don_thu', id);
    return undefined;
  },
});

export const donthuApi = {
  getAllDonThu: () => requestApi<DonThu[]>('/api/don-thu', 'GET', undefined, 'get_all_don_thu'),

  createDonThu: (input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>('/api/don-thu', 'POST', { input, actor_name }, 'create_don_thu', {
      input,
      actor_name,
    }),

  updateDonThu: (id: string, input: Partial<DonThu>, actor_name?: string) =>
    requestApi<DonThu>(`/api/don-thu/${id}`, 'PUT', { input, actor_name }, 'update_don_thu', {
      id,
      input,
      actor_name,
    }),

  deleteDonThu: (id: string, actor_name?: string) =>
    requestApi<void>(`/api/don-thu/${id}`, 'DELETE', { actor_name }, 'delete_don_thu', {
      id,
      actor_name,
    }),
};

