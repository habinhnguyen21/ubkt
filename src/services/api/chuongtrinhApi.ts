import type {
  ChuongTrinhKtGs,
  CreateChuongTrinhInput,
  ThayDoiBoSungKtGs,
  UpdateChuongTrinhInput,
} from '../../types';
import { centralDataService } from '../centralDataService';
import {
  getDeletedChuongTrinhIds,
  MOCK_STORAGE_KEY,
  registerMockCommands,
  requestApi,
  saveDeletedChuongTrinhId,
  saveDeletedPdfId,
  saveMockDb,
} from './core';

registerMockCommands({
  get_all_chuong_trinh: async (db) => {
    if (!db.chuongTrinhList || db.chuongTrinhList.length === 0) {
      db.chuongTrinhList = [];
    }
    let needsSave = false;
    const deletedCtIds = getDeletedChuongTrinhIds();
    db.chuongTrinhList = db.chuongTrinhList.filter((c) => !deletedCtIds.has(c.id));

    db.chuongTrinhList.forEach((c) => {
      if (!c.term_start_year && c.nhiem_ky) {
        const parts = c.nhiem_ky
          .split('-')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        if (parts.length >= 2) {
          c.term_start_year = parts[0];
          c.term_end_year = parts[1];
          needsSave = true;
        }
      }
      if (!c.co_quan_ban_hanh) {
        c.co_quan_ban_hanh = c.chu_the;
        needsSave = true;
      }
      if (!c.chu_the_ap_dung) {
        c.chu_the_ap_dung = c.ten_chi_dang_bo || (c.ten_don_vi ? c.ten_don_vi : 'Toàn Đảng bộ');
        needsSave = true;
      }
      if (!c.thoi_gian_loai) {
        c.thoi_gian_loai = c.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY';
        needsSave = true;
      }

      if (c.id === 'ct-nk-btv') {
        c.co_quan_ban_hanh = 'Ban Thường vụ Đảng ủy phường';
        c.chu_the_ap_dung = 'Toàn Đảng bộ';
        c.so_van_ban = null;
        c.file_pdf_ten = 'CT-KTGS của BCH, BTV.pdf';
        c.thoi_gian_loai = 'CA_NHIEM_KY';
        c.trang_thai = 'DANG_THUC_HIEN';
        c.ten_chuong_trinh =
          c.ten_chuong_trinh || 'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...';
      } else if (c.id === 'ct-nk-001') {
        c.co_quan_ban_hanh = 'Ban Chấp hành Đảng bộ';
        c.chu_the_ap_dung = 'Toàn Đảng bộ';
        c.so_van_ban = '01-CTr/ĐU';
        c.trang_thai = 'DANG_THUC_HIEN';
        c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030';
      } else if (c.id === 'ct-nk-002') {
        c.co_quan_ban_hanh = 'Chi bộ Quân sự';
        c.chu_the_ap_dung = 'Chi bộ Quân sự';
        c.so_van_ban = '02-CTr/CBQS';
        c.trang_thai = 'DANG_THUC_HIEN';
        c.ten_chuong_trinh =
          'Chương trình kiểm tra, giám sát của Chi bộ Quân sự nhiệm kỳ 2025 - 2027';
      } else if (c.id === 'ct-nk-003') {
        c.co_quan_ban_hanh = 'Chi bộ Công an';
        c.chu_the_ap_dung = 'Chi bộ Công an';
        c.so_van_ban = '03-CTr/CBCA';
        c.trang_thai = 'DANG_THUC_HIEN';
        c.ten_chuong_trinh = 'Chương trình kiểm tra, giám sát nhiệm kỳ 2025 - 2027';
      } else if (c.id === 'ct-nk-004') {
        c.co_quan_ban_hanh = 'UBKT Đảng ủy phường';
        c.chu_the_ap_dung = 'Toàn Đảng bộ';
        c.so_van_ban = '04-CTr/UBMTTQ';
        c.trang_thai = 'DA_HOAN_THANH';
        c.ngay_bat_dau = '2025-09-01';
        c.ngay_ket_thuc = '2030-08-30';
        c.ten_chuong_trinh =
          'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030 của Ủy ban Kiểm tra Đảng ủy phường';
      }
    });

    const priorityOrder = ['ct-nk-btv', 'ct-nk-001', 'ct-nk-002', 'ct-nk-003', 'ct-nk-004'];
    db.chuongTrinhList.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.id);
      const idxB = priorityOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    if (needsSave) {
      saveMockDb(db);
    }
    return db.chuongTrinhList || [];
  },

  create_chuong_trinh: async (db, args) => {
    const { input } = args as { input: CreateChuongTrinhInput };
    const isNhiemKy =
      (input.loai_chuong_trinh || (input.nhiem_ky || input.has_nhiem_ky ? 'NHIEM_KY' : 'HANG_NAM')) ===
      'NHIEM_KY';
    const termStart =
      input.term_start_year ||
      (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[0]?.trim() || '', 10) || null : null);
    const termEnd =
      input.term_end_year ||
      (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[1]?.trim() || '', 10) || null : null);
    const nhiemKyFinal =
      input.nhiem_ky || (termStart && termEnd ? `${termStart} - ${termEnd}` : null);

    const newItem: ChuongTrinhKtGs = {
      id: 'ct-' + Date.now(),
      nam: input.nam,
      loai_chuong_trinh: isNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
      nhiem_ky: nhiemKyFinal,
      khoa_nhiem_ky: nhiemKyFinal,
      has_nhiem_ky: input.has_nhiem_ky !== undefined ? input.has_nhiem_ky : Boolean(nhiemKyFinal),
      term_start_year: termStart,
      term_end_year: termEnd,
      ten_chuong_trinh: input.ten_chuong_trinh?.trim() || input.noi_dung.slice(0, 80),
      co_quan_ban_hanh: input.co_quan_ban_hanh?.trim() || input.chu_the,
      chu_the_ap_dung: input.chu_the_ap_dung?.trim() || input.ten_chi_dang_bo || 'Toàn Đảng bộ',
      thoi_gian_loai:
        input.thoi_gian_loai || (input.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY'),
      chu_the: input.chu_the,
      chu_the_loai: input.chu_the_loai,
      cap_chu_the: input.cap_chu_the,
      chu_the_don_vi_id: input.chu_the_don_vi_id || null,
      don_vi_id: input.don_vi_id || null,
      ten_don_vi: input.ten_don_vi || null,
      chi_dang_bo_id: input.chi_dang_bo_id || null,
      ten_chi_dang_bo: input.ten_chi_dang_bo || null,
      loai_hinh: isNhiemKy ? input.loai_hinh || null : input.loai_hinh || 'KIEM_TRA',
      doi_tuong: isNhiemKy
        ? input.doi_tuong?.trim() || input.chu_the_ap_dung || input.ten_chi_dang_bo || 'Toàn Đảng bộ'
        : input.doi_tuong?.trim() || '',
      doi_tuong_don_vi_id: input.doi_tuong_don_vi_id || null,
      doi_tuong_loai: input.doi_tuong_loai || 'TO_CHUC',
      linh_vuc: input.linh_vuc || null,
      noi_dung: input.noi_dung.trim(),
      noi_dung_van_ban: input.noi_dung_van_ban?.trim() || null,
      ngay_bat_dau: input.ngay_bat_dau || null,
      ngay_ket_thuc: input.ngay_ket_thuc || null,
      so_van_ban: input.so_van_ban?.trim() || null,
      ngay_ban_hanh: input.ngay_ban_hanh || null,
      nguoi_ky: input.nguoi_ky?.trim() || null,
      trang_thai: input.trang_thai,
      file_pdf_ten: input.file_pdf_ten || null,
      file_pdf_url: input.file_pdf_url || null,
      file_pdf_dung_luong: input.file_pdf_dung_luong || (input.file_pdf_ten ? 350000 : null),
      ghi_chu_pdf: input.ghi_chu_pdf?.trim() || null,
      danh_sach_thay_doi_bo_sung: input.danh_sach_thay_doi_bo_sung || [],
      version: 1,
      updated_by: input.updated_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const saved = await centralDataService.saveDoc('chuong_trinh', newItem.id, newItem);
    db.chuongTrinhList.unshift(saved);
    saveMockDb(db);
    return saved;
  },

  update_chuong_trinh: async (db, args) => {
    const { input } = args as { input: UpdateChuongTrinhInput };
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const item = db.chuongTrinhList.find((c) => c.id === input.id);
    if (!item) throw new Error('Không tìm thấy chương trình');
    const expectedVersion = input.version !== undefined ? input.version : item.version;
    item.nam = input.nam;
    if (input.loai_chuong_trinh !== undefined) item.loai_chuong_trinh = input.loai_chuong_trinh;
    if (input.nhiem_ky !== undefined) {
      item.nhiem_ky = input.nhiem_ky;
      item.khoa_nhiem_ky = input.nhiem_ky;
    }
    if (input.has_nhiem_ky !== undefined) item.has_nhiem_ky = input.has_nhiem_ky;
    if (input.term_start_year !== undefined) item.term_start_year = input.term_start_year;
    if (input.term_end_year !== undefined) item.term_end_year = input.term_end_year;
    if (input.ten_chuong_trinh !== undefined) item.ten_chuong_trinh = input.ten_chuong_trinh;
    if (input.co_quan_ban_hanh !== undefined) item.co_quan_ban_hanh = input.co_quan_ban_hanh;
    if (input.chu_the_ap_dung !== undefined) item.chu_the_ap_dung = input.chu_the_ap_dung;
    if (input.thoi_gian_loai !== undefined) item.thoi_gian_loai = input.thoi_gian_loai;
    item.chu_the = input.chu_the;
    if (input.chu_the_loai !== undefined) item.chu_the_loai = input.chu_the_loai;
    if (input.cap_chu_the !== undefined) item.cap_chu_the = input.cap_chu_the;
    if (input.chu_the_don_vi_id !== undefined) item.chu_the_don_vi_id = input.chu_the_don_vi_id;
    item.don_vi_id = input.don_vi_id || null;
    item.ten_don_vi = input.ten_don_vi || null;
    if (input.chi_dang_bo_id !== undefined) item.chi_dang_bo_id = input.chi_dang_bo_id;
    if (input.ten_chi_dang_bo !== undefined) item.ten_chi_dang_bo = input.ten_chi_dang_bo;
    if (input.loai_hinh !== undefined) item.loai_hinh = input.loai_hinh;
    if (input.doi_tuong !== undefined) item.doi_tuong = input.doi_tuong?.trim() || null;
    if (input.doi_tuong_don_vi_id !== undefined)
      item.doi_tuong_don_vi_id = input.doi_tuong_don_vi_id;
    if (input.doi_tuong_loai !== undefined) item.doi_tuong_loai = input.doi_tuong_loai;
    if (input.linh_vuc !== undefined) item.linh_vuc = input.linh_vuc;
    item.noi_dung = input.noi_dung.trim();
    if (input.noi_dung_van_ban !== undefined) item.noi_dung_van_ban = input.noi_dung_van_ban;
    item.ngay_bat_dau = input.ngay_bat_dau || null;
    item.ngay_ket_thuc = input.ngay_ket_thuc || null;
    item.so_van_ban = input.so_van_ban?.trim() || null;
    if (input.ngay_ban_hanh !== undefined) item.ngay_ban_hanh = input.ngay_ban_hanh;
    if (input.nguoi_ky !== undefined) item.nguoi_ky = input.nguoi_ky;
    item.trang_thai = input.trang_thai;
    if (input.file_pdf_ten !== undefined) item.file_pdf_ten = input.file_pdf_ten;
    if (input.file_pdf_url !== undefined) item.file_pdf_url = input.file_pdf_url;
    if (input.file_pdf_dung_luong !== undefined)
      item.file_pdf_dung_luong = input.file_pdf_dung_luong;
    if (input.danh_sach_thay_doi_bo_sung !== undefined)
      item.danh_sach_thay_doi_bo_sung = input.danh_sach_thay_doi_bo_sung;
    if (input.updated_by !== undefined) item.updated_by = input.updated_by;
    item.ghi_chu_pdf = input.ghi_chu_pdf?.trim() || null;
    item.updated_at = new Date().toISOString();
    const saved = await centralDataService.saveDoc('chuong_trinh', item.id, item, {
      expectedVersion,
    });
    item.version = saved.version;
    item.updated_by = saved.updated_by;
    saveMockDb(db);
    return item;
  },

  delete_chuong_trinh: async (db, args) => {
    const { id } = args as { id: string };
    saveDeletedChuongTrinhId(id);
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    db.chuongTrinhList = db.chuongTrinhList.filter((c) => c.id !== id);
    if (!db.pdfFiles) db.pdfFiles = [];
    db.pdfFiles = db.pdfFiles.filter((p) => p.chuong_trinh_id !== id && p.id !== 'ct-pdf-' + id);
    saveMockDb(db);

    await centralDataService.deleteDoc('chuong_trinh', id);
    await centralDataService.deleteDoc('pdf_files', 'ct-pdf-' + id);

    window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

    return undefined;
  },

  batch_import_chuong_trinh: async (db, args) => {
    const { items, duplicateAction = 'OVERWRITE', actor_name, user_id } = args as {
      items: CreateChuongTrinhInput[];
      duplicateAction?: 'OVERWRITE' | 'SKIP' | 'CREATE_NEW';
      actor_name?: string;
      user_id?: string;
    };

    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const errors: string[] = [];
    const createdItems: ChuongTrinhKtGs[] = [];
    const updatedItems: ChuongTrinhKtGs[] = [];
    let skippedCount = 0;

    for (let idx = 0; idx < (items || []).length; idx++) {
      const input = items[idx];
      const isNhiemKy =
        (input.loai_chuong_trinh ||
          (input.nhiem_ky || input.has_nhiem_ky ? 'NHIEM_KY' : 'HANG_NAM')) === 'NHIEM_KY';
      const termStart =
        input.term_start_year ||
        (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[0]?.trim() || '', 10) || null : null);
      const termEnd =
        input.term_end_year ||
        (input.nhiem_ky ? parseInt(input.nhiem_ky.split('-')[1]?.trim() || '', 10) || null : null);
      const nhiemKyFinal =
        input.nhiem_ky || (termStart && termEnd ? `${termStart} - ${termEnd}` : null);

      const existingIdx = db.chuongTrinhList.findIndex((c) => {
        if (c.nam !== input.nam) return false;
        if (
          input.so_van_ban &&
          c.so_van_ban &&
          c.so_van_ban.trim().toLowerCase() === input.so_van_ban.trim().toLowerCase()
        ) {
          return true;
        }
        if (
          input.doi_tuong &&
          c.doi_tuong &&
          c.doi_tuong.trim().toLowerCase() === input.doi_tuong.trim().toLowerCase() &&
          c.noi_dung.trim().toLowerCase() === input.noi_dung.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (existingIdx >= 0) {
        if (duplicateAction === 'SKIP') {
          skippedCount++;
          continue;
        }

        if (duplicateAction === 'OVERWRITE') {
          const existing = db.chuongTrinhList[existingIdx];
          existing.nam = input.nam;
          existing.chu_the = input.chu_the;
          existing.co_quan_ban_hanh = input.co_quan_ban_hanh || input.chu_the;
          existing.chu_the_ap_dung = input.chu_the_ap_dung || input.doi_tuong || 'Toàn Đảng bộ';
          existing.loai_hinh = input.loai_hinh || 'KIEM_TRA';
          existing.linh_vuc = input.linh_vuc || 'Công tác xây dựng Đảng';
          existing.doi_tuong = input.doi_tuong?.trim() || '';
          existing.noi_dung = input.noi_dung.trim();
          existing.ten_chuong_trinh = input.ten_chuong_trinh || existing.ten_chuong_trinh;
          existing.ngay_bat_dau = input.ngay_bat_dau || existing.ngay_bat_dau;
          existing.ngay_ket_thuc = input.ngay_ket_thuc || existing.ngay_ket_thuc;
          existing.so_van_ban = input.so_van_ban?.trim() || existing.so_van_ban;
          existing.ngay_ban_hanh = input.ngay_ban_hanh || existing.ngay_ban_hanh;
          existing.nguoi_ky = input.nguoi_ky?.trim() || existing.nguoi_ky;
          existing.trang_thai = input.trang_thai;
          if (input.don_vi_id) existing.don_vi_id = input.don_vi_id;
          if (input.ten_don_vi) existing.ten_don_vi = input.ten_don_vi;
          if (input.file_pdf_ten) existing.file_pdf_ten = input.file_pdf_ten;
          if (input.ghi_chu_pdf) existing.ghi_chu_pdf = input.ghi_chu_pdf.trim();
          existing.updated_at = new Date().toISOString();

          updatedItems.push(existing);
          await centralDataService.saveDoc('chuong_trinh', existing.id, existing);
          continue;
        }
      }

      const newItem: ChuongTrinhKtGs = {
        id: 'ct-' + Date.now() + '-' + idx,
        nam: input.nam,
        loai_chuong_trinh: isNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
        nhiem_ky: nhiemKyFinal,
        khoa_nhiem_ky: nhiemKyFinal,
        has_nhiem_ky:
          input.has_nhiem_ky !== undefined ? input.has_nhiem_ky : Boolean(nhiemKyFinal),
        term_start_year: termStart,
        term_end_year: termEnd,
        ten_chuong_trinh: input.ten_chuong_trinh?.trim() || input.noi_dung.slice(0, 80),
        co_quan_ban_hanh: input.co_quan_ban_hanh?.trim() || input.chu_the,
        chu_the_ap_dung: input.chu_the_ap_dung?.trim() || input.doi_tuong || 'Toàn Đảng bộ',
        thoi_gian_loai:
          input.thoi_gian_loai || (input.ngay_bat_dau ? 'KHOANG_THOI_GIAN' : 'CA_NHIEM_KY'),
        chu_the: input.chu_the,
        don_vi_id: input.don_vi_id || null,
        ten_don_vi: input.ten_don_vi || null,
        chi_dang_bo_id: input.chi_dang_bo_id || null,
        ten_chi_dang_bo: input.ten_chi_dang_bo || null,
        loai_hinh: isNhiemKy ? input.loai_hinh || null : input.loai_hinh || 'KIEM_TRA',
        doi_tuong: input.doi_tuong?.trim() || '',
        noi_dung: input.noi_dung.trim(),
        noi_dung_van_ban: input.noi_dung_van_ban?.trim() || null,
        ngay_bat_dau: input.ngay_bat_dau || null,
        ngay_ket_thuc: input.ngay_ket_thuc || null,
        so_van_ban: input.so_van_ban?.trim() || null,
        ngay_ban_hanh: input.ngay_ban_hanh || null,
        nguoi_ky: input.nguoi_ky?.trim() || null,
        trang_thai: input.trang_thai,
        file_pdf_ten: input.file_pdf_ten || null,
        file_pdf_url: input.file_pdf_url || null,
        file_pdf_dung_luong: input.file_pdf_dung_luong || (input.file_pdf_ten ? 350000 : null),
        ghi_chu_pdf: input.ghi_chu_pdf?.trim() || null,
        danh_sach_thay_doi_bo_sung: input.danh_sach_thay_doi_bo_sung || [],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.chuongTrinhList.unshift(newItem);
      createdItems.push(newItem);
      await centralDataService.saveDoc('chuong_trinh', newItem.id, newItem);
    }

    if (db.auditLogs && (createdItems.length > 0 || updatedItems.length > 0)) {
      db.auditLogs.unshift({
        id: 'log-' + Date.now(),
        nguoi_dung_id: user_id || null,
        ten_nguoi_dung: actor_name || 'Cán bộ UBKT',
        hanh_dong: `Nhập Excel chương trình KT-GS: thêm mới ${createdItems.length}, cập nhật ${updatedItems.length}, bỏ qua ${skippedCount}`,
        bang_anh_huong: 'chuong_trinh',
        ban_ghi_id: null,
        du_lieu_cu: null,
        du_lieu_moi: JSON.stringify({
          createdCount: createdItems.length,
          updatedCount: updatedItems.length,
        }),
        thoi_gian: new Date().toISOString(),
      });
    }

    saveMockDb(db);
    window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

    return {
      success: true,
      createdCount: createdItems.length,
      updatedCount: updatedItems.length,
      skippedCount,
      totalProcessed: (items || []).length,
      errors,
    };
  },

  add_thay_doi_bo_sung: async (db, args) => {
    const { input } = args as { input: ThayDoiBoSungKtGs };
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
    if (!ct) throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
    if (!ct.danh_sach_thay_doi_bo_sung) ct.danh_sach_thay_doi_bo_sung = [];
    const newThayDoi: ThayDoiBoSungKtGs = {
      ...input,
      id: input.id || 'td-' + Date.now(),
      lan_dieu_chinh: input.lan_dieu_chinh || ct.danh_sach_thay_doi_bo_sung.length + 1,
      created_at: input.created_at || new Date().toISOString(),
    };
    ct.danh_sach_thay_doi_bo_sung.unshift(newThayDoi);
    ct.updated_at = new Date().toISOString();
    saveMockDb(db);
    return newThayDoi;
  },

  delete_thay_doi_bo_sung: async (db, args) => {
    const { chuong_trinh_id, thay_doi_id } = args as {
      chuong_trinh_id: string;
      thay_doi_id: string;
    };
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const ct = db.chuongTrinhList.find((c) => c.id === chuong_trinh_id);
    if (ct && ct.danh_sach_thay_doi_bo_sung) {
      ct.danh_sach_thay_doi_bo_sung = ct.danh_sach_thay_doi_bo_sung.filter(
        (td) => td.id !== thay_doi_id
      );
      ct.updated_at = new Date().toISOString();
      if (!db.pdfFiles) db.pdfFiles = [];
      db.pdfFiles = db.pdfFiles.filter((p) => !p.id.includes(thay_doi_id));
      saveMockDb(db);
    }
    window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
    return undefined;
  },

  update_thay_doi_bo_sung: async (db, args) => {
    const { input } = args as { input: ThayDoiBoSungKtGs };
    if (!db.chuongTrinhList) db.chuongTrinhList = [];
    const ct = db.chuongTrinhList.find((c) => c.id === input.chuong_trinh_id);
    if (!ct || !ct.danh_sach_thay_doi_bo_sung)
      throw new Error('Không tìm thấy chương trình KT-GS tương ứng');
    const idx = ct.danh_sach_thay_doi_bo_sung.findIndex((td) => td.id === input.id);
    if (idx !== -1) {
      ct.danh_sach_thay_doi_bo_sung[idx] = {
        ...ct.danh_sach_thay_doi_bo_sung[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };
      ct.updated_at = new Date().toISOString();
      saveMockDb(db);
      return ct.danh_sach_thay_doi_bo_sung[idx];
    }
    throw new Error('Không tìm thấy bản ghi thay đổi bổ sung');
  },
});

export const chuongtrinhApi = {
  getAllChuongTrinh: () =>
    requestApi<ChuongTrinhKtGs[]>('/api/chuong-trinh', 'GET', undefined, 'get_all_chuong_trinh'),

  createChuongTrinh: (input: CreateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>('/api/chuong-trinh', 'POST', { input }, 'create_chuong_trinh', {
      input,
    }),

  updateChuongTrinh: (input: UpdateChuongTrinhInput) =>
    requestApi<ChuongTrinhKtGs>(
      `/api/chuong-trinh/${input.id}`,
      'PUT',
      { input },
      'update_chuong_trinh',
      { input }
    ),

  deleteChuongTrinh: async (id: string) => {
    saveDeletedChuongTrinhId(id);
    await centralDataService.deleteDoc('chuong_trinh', id);
    await centralDataService.deleteDoc('pdf_files', 'ct-pdf-' + id);
    try {
      const rawMock = localStorage.getItem(MOCK_STORAGE_KEY);
      if (rawMock) {
        const mDb = JSON.parse(rawMock);
        if (mDb.pdfFiles && Array.isArray(mDb.pdfFiles)) {
          const toDelete = mDb.pdfFiles.filter((p: any) => p.chuong_trinh_id === id);
          for (const p of toDelete) {
            saveDeletedPdfId(p.id);
            await centralDataService.deleteDoc('pdf_files', p.id);
          }
          mDb.pdfFiles = mDb.pdfFiles.filter((p: any) => p.chuong_trinh_id !== id);
          localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mDb));
        }
      }
    } catch {}
    return requestApi<void>(
      `/api/chuong-trinh/${id}`,
      'DELETE',
      undefined,
      'delete_chuong_trinh',
      { id }
    );
  },

  batchImportChuongTrinh: (
    items: CreateChuongTrinhInput[],
    duplicateAction: 'OVERWRITE' | 'SKIP' | 'CREATE_NEW' = 'OVERWRITE',
    actor_name?: string,
    user_id?: string
  ) =>
    requestApi<{
      success: boolean;
      createdCount: number;
      updatedCount: number;
      skippedCount: number;
      totalProcessed: number;
      errors: string[];
    }>(
      '/api/chuong-trinh/batch-import',
      'POST',
      { items, duplicateAction, actor_name, user_id },
      'batch_import_chuong_trinh',
      { items, duplicateAction, actor_name, user_id }
    ),

  addThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>('/api/thay-doi-bo-sung', 'POST', { input }, 'add_thay_doi_bo_sung', {
      input,
    }),

  deleteThayDoiBoSung: (chuong_trinh_id: string, thay_doi_id: string) =>
    requestApi<void>(
      `/api/thay-doi-bo-sung/${chuong_trinh_id}/${thay_doi_id}`,
      'DELETE',
      undefined,
      'delete_thay_doi_bo_sung',
      { chuong_trinh_id, thay_doi_id }
    ),

  updateThayDoiBoSung: (input: ThayDoiBoSungKtGs) =>
    requestApi<ThayDoiBoSungKtGs>(
      `/api/thay-doi-bo-sung/${input.id}`,
      'PUT',
      { input },
      'update_thay_doi_bo_sung',
      { input }
    ),
};

