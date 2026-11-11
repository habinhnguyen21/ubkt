import type {
  AppInfo,
  CreateDonViInput,
  DonVi,
  DonViTreeItem,
  NhatKy,
  TrangThaiDonVi,
  UpdateDonViInput,
} from '../../types';
import { centralDataService } from '../centralDataService';
import {
  getMockDb,
  MOCK_STORAGE_KEY,
  registerMockCommands,
  requestApi,
  saveDeletedDiaBanId,
  saveDeletedDonViId,
  saveMockDb,
} from './core';

registerMockCommands({
  get_all_don_vi: async (db) => {
    return db.donViList.filter((d) => !d.deleted_at);
  },

  get_don_vi_tree: async (db) => {
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
    return buildTree(null);
  },

  create_don_vi: async (db, args) => {
    const { input } = args as { input: CreateDonViInput };
    const newDonVi: DonVi = {
      id: 'dv-' + Date.now(),
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
      nguoi_tao_ten: input.nguoi_tao_ten || null,
      nguoi_tao_id: input.nguoi_tao_id || null,
      updated_by: input.updated_by || input.nguoi_tao_ten || null,
      version: 1,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    const saved = await centralDataService.saveDoc('don_vi', newDonVi.id, newDonVi);
    db.donViList.push(saved);
    saveMockDb(db);
    return saved;
  },

  update_don_vi: async (db, args) => {
    const { input } = args as { input: UpdateDonViInput };
    const item = db.donViList.find((d) => d.id === input.id);
    if (!item) throw new Error('Không tìm thấy đơn vị');
    const expectedVersion = input.version !== undefined ? input.version : item.version;
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
    if (input.nguoi_cap_nhat_ten !== undefined) item.nguoi_cap_nhat_ten = input.nguoi_cap_nhat_ten;
    if (input.nguoi_cap_nhat_id !== undefined) item.nguoi_cap_nhat_id = input.nguoi_cap_nhat_id;
    if (input.updated_by !== undefined) item.updated_by = input.updated_by;
    item.updated_at = new Date().toISOString();
    item.sync_status = 'synced';
    const saved = await centralDataService.saveDoc('don_vi', item.id, item, { expectedVersion });
    item.version = saved.version;
    item.updated_by = saved.updated_by;
    saveMockDb(db);

    try {
      const rawRecs = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      if (rawRecs) {
        const recs: any[] = JSON.parse(rawRecs);
        const rIdx = recs.findIndex((r) => r.id === item.id);
        if (rIdx !== -1) {
          recs[rIdx].ten_dia_ban = item.ten;
          if (input.trang_thai) recs[rIdx].trang_thai_to_chuc = input.trang_thai;
          recs[rIdx].thoi_diem_cap_nhat_gan_nhat = new Date().toLocaleDateString('vi-VN');
          localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(recs));
          await centralDataService.saveBackgroundDiaBanRecord(item.id, recs[rIdx], [
            'ten_dia_ban',
            'trang_thai_to_chuc',
            'thoi_diem_cap_nhat_gan_nhat',
          ]);
        }
      }
    } catch {}

    return item;
  },

  delete_don_vi: async (db, args) => {
    const { id } = args as { id: string };
    const hasChildren = db.donViList.some((d) => d.don_vi_cha_id === id && !d.deleted_at);
    if (hasChildren) {
      throw new Error('Không thể xóa đơn vị đang có đơn vị cấp dưới trực thuộc.');
    }
    saveDeletedDonViId(id);
    saveDeletedDiaBanId(id);
    const item = db.donViList.find((d) => d.id === id);
    if (item) {
      item.deleted_at = new Date().toISOString();
    }
    db.donViList = db.donViList.filter((d) => d.id !== id);
    saveMockDb(db);

    await centralDataService.deleteDoc('don_vi', id);
    await centralDataService.deleteDoc('ho_so_dia_ban_records', id);

    return undefined;
  },

  toggle_don_vi_status: async (db, args) => {
    const { id, trang_thai, ly_do, actor_name } = args as {
      id: string;
      trang_thai: TrangThaiDonVi;
      ly_do?: string;
      actor_name?: string;
    };
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
    return item;
  },

  batch_import_don_vi: async (db, args) => {
    const { items, actor_name } = args as { items: any[]; actor_name?: string };
    const imported: DonVi[] = [];
    const errors: string[] = [];

    const normalize = (t?: string | null) =>
      (t || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[–—]/g, '-');
    const isRootVal = (val?: string | null) => {
      if (!val) return true;
      const clean = normalize(val);
      return [
        '', '-', '--', '---', '0', 'none', 'null', 'n/a', 'na',
        'goc', 'gốc', '-- gốc --', 'khong', 'không', 'khong co', 'không có',
        'root', 'tổ chức gốc', 'cấp cao nhất', 'trực tiếp',
      ].includes(clean);
    };

    const resolveParent = (
      parentVal?: string | null,
      currentUnits: DonVi[] = [],
      currentImported: DonVi[] = []
    ) => {
      if (isRootVal(parentVal)) return null;
      const raw = (parentVal || '').trim();
      const lower = normalize(raw);
      const all = [...currentUnits.filter((d) => !d.deleted_at), ...currentImported];

      const byId = all.find((d) => d.id === raw);
      if (byId) return byId.id;

      const byCode = all.find((d) => d.ma && normalize(d.ma) === lower);
      if (byCode) return byCode.id;

      const byName = all.find((d) => d.ten && normalize(d.ten) === lower);
      if (byName) return byName.id;

      const bracketMatch = raw.match(/^([a-zA-Z0-9_\-.]+)\s*[(\-–—:]\s*(.*?)\)?$/);
      if (bracketMatch) {
        const extCode = normalize(bracketMatch[1]);
        const extName = normalize(bracketMatch[2]);
        const byExtCode = all.find((d) => d.ma && normalize(d.ma) === extCode);
        if (byExtCode) return byExtCode.id;
        if (extName) {
          const byExtName = all.find((d) => d.ten && normalize(d.ten) === extName);
          if (byExtName) return byExtName.id;
        }
      }

      const codePrefix = all.find((d) => {
        if (!d.ma) return false;
        const cleanMa = normalize(d.ma);
        return (
          lower === cleanMa ||
          lower.startsWith(cleanMa + ' ') ||
          lower.startsWith(cleanMa + '(') ||
          lower.startsWith(cleanMa + '-')
        );
      });
      if (codePrefix) return codePrefix.id;

      const swapped = lower.includes('đảng ủy')
        ? lower.replace(/đảng ủy/g, 'đảng bộ')
        : lower.includes('đảng bộ')
        ? lower.replace(/đảng bộ/g, 'đảng ủy')
        : null;
      if (swapped) {
        const bySwapped = all.find((d) => d.ten && normalize(d.ten) === swapped);
        if (bySwapped) return bySwapped.id;
      }

      const roots = all.filter((d) => !d.don_vi_cha_id);
      if (roots.length === 1) {
        const root = roots[0];
        const genericTerms = [
          'đảng ủy', 'đảng bộ', 'đảng ủy cơ sở', 'đảng bộ cơ sở',
          'đảng ủy phường', 'đảng bộ phường', 'cấp trên',
        ];
        if (
          genericTerms.some((t) => lower === t || lower.includes(t)) ||
          (root.ten &&
            (lower.includes(normalize(root.ten)) || normalize(root.ten).includes(lower)))
        ) {
          return root.id;
        }
      }

      return null;
    };

    const existingCodes = new Set(
      db.donViList.filter((d) => !d.deleted_at && d.ma).map((d) => normalize(d.ma))
    );

    (items || []).forEach((item, idx) => {
      const row = idx + 1;
      const ten = (item.ten || '').trim();
      if (!ten) {
        errors.push(`Dòng ${row}: Thiếu tên tổ chức`);
        return;
      }

      let ma = item.ma ? item.ma.trim() : '';
      if (!ma) {
        const isRoot = !item.don_vi_cha_id && !item.ma_cap_tren;
        const prefix = isRoot || (item.loai || '').toUpperCase() === 'DANG_BO' ? 'DU' : 'CB';
        let maxN = 0;
        const reg = new RegExp(`^${prefix}[-_\\s]?(\\d+)$`, 'i');
        [...db.donViList, ...imported].forEach((d) => {
          if (!d.deleted_at && d.ma) {
            const m = d.ma.match(reg);
            if (m) {
              const n = parseInt(m[1], 10);
              if (!isNaN(n) && n > maxN) maxN = n;
            }
          }
        });
        let nextN = maxN + 1;
        while (existingCodes.has(`${prefix}-${String(nextN).padStart(2, '0')}`.toLowerCase())) {
          nextN++;
        }
        ma = `${prefix}-${String(nextN).padStart(2, '0')}`;
      }

      if (existingCodes.has(normalize(ma))) {
        errors.push(`Dòng ${row}: Mã "${ma}" đã tồn tại`);
        return;
      }
      let parentId = item.don_vi_cha_id || null;
      if (!parentId && item.ma_cap_tren) {
        parentId = resolveParent(item.ma_cap_tren, db.donViList, imported);
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
        _temp_ma_cap_tren: item.ma_cap_tren || null,
      } as any;
      existingCodes.add(normalize(ma));
      imported.push(newUnit);
    });

    imported.forEach((unit: any) => {
      if (!unit.don_vi_cha_id && unit._temp_ma_cap_tren) {
        unit.don_vi_cha_id = resolveParent(unit._temp_ma_cap_tren, db.donViList, imported);
      }
      delete unit._temp_ma_cap_tren;
    });

    if (imported.length > 0) {
      db.donViList.push(...imported);
      saveMockDb(db);
      for (const unit of imported) {
        await centralDataService.saveDoc('don_vi', unit.id, unit);
      }
    }
    return {
      success: true,
      importedCount: imported.length,
      errorCount: errors.length,
      errors,
      imported,
    };
  },

  batch_delete_don_vi: async (db, args) => {
    const { ids } = args as { ids: string[]; user_id?: string; actor_name?: string };
    const idSet = new Set(ids || []);
    const now = new Date().toISOString();
    const deleted: DonVi[] = [];
    const errors: string[] = [];

    (ids || []).forEach((id) => {
      const item = db.donViList.find((d) => d.id === id && !d.deleted_at);
      if (!item) return;

      const unselectedChildren = db.donViList.filter(
        (d) => d.don_vi_cha_id === id && !d.deleted_at && !idSet.has(d.id)
      );
      if (unselectedChildren.length > 0) {
        errors.push(
          `Không thể xóa "${item.ten}" vì có ${unselectedChildren.length} tổ chức trực thuộc không nằm trong danh sách xóa`
        );
        return;
      }

      item.deleted_at = now;
      item.updated_at = now;
      deleted.push(item);
    });

    if (deleted.length > 0) {
      saveMockDb(db);
      const deletedIds = deleted.map((d) => d.id);
      deletedIds.forEach((id) => {
        saveDeletedDonViId(id);
        saveDeletedDiaBanId(id);
      });
      await centralDataService.batchDelete('don_vi', deletedIds);
      await centralDataService.batchDelete('ho_so_dia_ban_records', deletedIds);
    }
    return { success: true, deletedCount: deleted.length, errorCount: errors.length, errors };
  },

  get_don_vi_relations: async (db, args) => {
    const { id } = args as { id: string };
    const chuongTrinhCount = (db.chuongTrinhList || []).filter((c) => c.don_vi_id === id).length;
    const donThuCount = (db.donThuList || []).filter((d) => d.doi_tuong_lien_quan === id).length;
    const childrenCount = (db.donViList || []).filter(
      (d) => d.don_vi_cha_id === id && !d.deleted_at
    ).length;
    const history = (db.auditLogs || [])
      .filter((l) => l.ban_ghi_id === id || l.hanh_dong?.includes(id))
      .slice(0, 10);
    return { chuongTrinhCount, donThuCount, childrenCount, history };
  },

  get_app_info: async (db) => {
    const active = db.donViList.filter((d) => !d.deleted_at);
    const rootUnit = active.find((d) => !d.don_vi_cha_id) || active[0];
    return {
      app_name: 'Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng',
      version: '2.0.0-Online',
      total_don_vi: active.length,
      root_unit_name: rootUnit ? rootUnit.ten : 'Đảng ủy cơ sở',
      root_unit_id: rootUnit ? rootUnit.id : null,
      pending_sync_count: db.donViList.filter((d) => d.sync_status === 'pending').length,
    };
  },

  get_audit_logs: async (db) => {
    return db.auditLogs;
  },
});

export const donviApi = {
  getAllDonVi: () => requestApi<DonVi[]>('/api/don-vi', 'GET', undefined, 'get_all_don_vi'),

  getDonViTree: () =>
    requestApi<DonViTreeItem[]>('/api/don-vi/tree', 'GET', undefined, 'get_don_vi_tree'),

  createDonVi: (input: CreateDonViInput, user_id?: string) =>
    requestApi<DonVi>('/api/don-vi', 'POST', { input, user_id }, 'create_don_vi', {
      input,
      user_id,
    }),

  updateDonVi: (input: UpdateDonViInput, user_id?: string) =>
    requestApi<DonVi>(`/api/don-vi/${input.id}`, 'PUT', { input, user_id }, 'update_don_vi', {
      input,
      user_id,
    }),

  deleteDonVi: async (id: string, user_id?: string, actor_name?: string) => {
    saveDeletedDonViId(id);
    saveDeletedDiaBanId(id);
    await centralDataService.deleteDoc('don_vi', id);
    await centralDataService.deleteDoc('ho_so_dia_ban_records', id);
    return requestApi<void>(
      `/api/don-vi/${id}`,
      'DELETE',
      { user_id, actor_name },
      'delete_don_vi',
      { id, user_id, actor_name }
    );
  },

  toggleDonViStatus: (
    id: string,
    trang_thai: TrangThaiDonVi,
    ly_do?: string,
    actor_name?: string,
    user_id?: string
  ) =>
    requestApi<DonVi>(
      `/api/don-vi/${id}/toggle-status`,
      'POST',
      { trang_thai, ly_do, actor_name, user_id },
      'toggle_don_vi_status',
      { id, trang_thai, ly_do, actor_name, user_id }
    ),

  batchImportDonVi: (items: any[], actor_name?: string, user_id?: string) =>
    requestApi<{
      success: boolean;
      importedCount: number;
      errorCount: number;
      errors: string[];
      imported: DonVi[];
    }>(
      '/api/don-vi/batch-import',
      'POST',
      { items, actor_name, user_id },
      'batch_import_don_vi',
      { items, actor_name, user_id }
    ),

  batchDeleteDonVi: async (ids: string[], user_id?: string, actor_name?: string) => {
    for (const id of ids || []) {
      saveDeletedDonViId(id);
      saveDeletedDiaBanId(id);
    }
    await centralDataService.batchDelete('don_vi', ids || []);
    await centralDataService.batchDelete('ho_so_dia_ban_records', ids || []);
    return requestApi<{
      success: boolean;
      deletedCount: number;
      errorCount: number;
      errors: string[];
    }>('/api/don-vi/batch-delete', 'POST', { ids, user_id, actor_name }, 'batch_delete_don_vi', {
      ids,
      user_id,
      actor_name,
    });
  },

  getDonViRelations: (id: string) =>
    requestApi<{
      chuongTrinhCount: number;
      donThuCount: number;
      childrenCount: number;
      history: NhatKy[];
    }>(`/api/don-vi/${id}/relations`, 'GET', undefined, 'get_don_vi_relations', { id }),

  getAppInfo: () => requestApi<AppInfo>('/api/app-info', 'GET', undefined, 'get_app_info'),

  getAuditLogs: (limit = 50) =>
    requestApi<NhatKy[]>(`/api/audit-logs?limit=${limit}`, 'GET', undefined, 'get_audit_logs', {
      limit,
    }),

  resetAiQuocUnits: async () => {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    getMockDb();
    try {
      await fetch('/api/reset-data', { method: 'POST' });
    } catch {
      // ignore
    }
  },
};

