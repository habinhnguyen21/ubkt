import type { BaoCaoThangItem, HoSoDiaBanFile, PdfKhoItem } from '../../types';
import { centralDataService } from '../centralDataService';
import { cloudSyncService } from '../cloudSyncService';
import {
  extractGoogleDriveFileId,
  getGoogleDriveConfig,
  isGoogleDriveConfigured,
  uploadBase64OrUrlToGoogleDrive,
} from '../googleDriveService';
import {
  ensureFirestoreSynced,
  getDeletedChuongTrinhIds,
  getDeletedPdfIds,
  getDeletedPdfNames,
  getMockDb,
  registerMockCommands,
  requestApi,
  saveDeletedPdfId,
  saveDeletedPdfName,
  saveMockDb,
} from './core';

registerMockCommands({
  get_all_pdfs: async (db) => {
    const list: PdfKhoItem[] = [];
    const seenFileKeys = new Set<string>();
    const deletedPdfIds = getDeletedPdfIds();
    const deletedPdfNames = getDeletedPdfNames();
    const deletedCtIds = getDeletedChuongTrinhIds();

    (db.chuongTrinhList || []).forEach((c) => {
      if (
        c.file_pdf_ten &&
        !deletedCtIds.has(c.id) &&
        !deletedPdfNames.has(c.file_pdf_ten) &&
        !deletedPdfIds.has('ct-pdf-' + c.id) &&
        !deletedPdfIds.has(c.id)
      ) {
        const key = `ct_${c.id}_${c.file_pdf_ten}`;
        if (!seenFileKeys.has(key)) {
          seenFileKeys.add(key);
          const cDriveId = (c as any).google_drive_id || extractGoogleDriveFileId(c.file_pdf_url);
          const isCDrive = Boolean(
            (c as any).is_google_drive ||
              cDriveId ||
              (c.file_pdf_url && c.file_pdf_url.includes('drive.google.com'))
          );
          list.push({
            id: 'ct-pdf-' + c.id,
            ten_file: c.file_pdf_ten,
            dung_luong: c.file_pdf_dung_luong || 385000,
            url: c.file_pdf_url,
            file_url: c.file_pdf_url,
            google_drive_id: cDriveId || null,
            google_drive_preview_url:
              (c as any).google_drive_preview_url ||
              (cDriveId ? `https://drive.google.com/file/d/${cDriveId}/preview` : null),
            is_google_drive: isCDrive,
            chuong_trinh_id: c.id,
            don_vi_id: c.don_vi_id || c.chi_dang_bo_id,
            ten_don_vi: c.ten_chi_dang_bo || c.ten_don_vi,
            nguon_goc: 'CHUONG_TRINH',
            chu_the: c.chu_the,
            doi_tuong:
              c.doi_tuong ||
              (c.ten_chi_dang_bo ? `Lưu cho: ${c.ten_chi_dang_bo}` : 'Toàn Đảng bộ'),
            nam: c.nam,
            loai_hinh: c.loai_hinh,
            so_van_ban: c.so_van_ban,
            ngay_ban_hanh:
              c.ngay_ban_hanh || (c.created_at ? c.created_at.slice(0, 10) : '2026-01-15'),
            ghi_chu:
              c.ghi_chu_pdf ||
              (c.nhiem_ky ? `Chương trình nhiệm kỳ ${c.nhiem_ky}` : `Chương trình năm ${c.nam}`),
            created_at: c.updated_at || c.created_at,
          });
        }
      }

      if (c.danh_sach_thay_doi_bo_sung && Array.isArray(c.danh_sach_thay_doi_bo_sung)) {
        c.danh_sach_thay_doi_bo_sung.forEach((td) => {
          if (
            td.file_pdf_ten &&
            !deletedCtIds.has(c.id) &&
            !deletedPdfNames.has(td.file_pdf_ten) &&
            !deletedPdfIds.has('td-pdf-' + td.id) &&
            !deletedPdfIds.has(td.id)
          ) {
            const tdKey = `td_${td.id}_${td.file_pdf_ten}`;
            if (!seenFileKeys.has(tdKey)) {
              seenFileKeys.add(tdKey);
              const tdDriveId =
                (td as any).google_drive_id || extractGoogleDriveFileId(td.file_pdf_url);
              const isTdDrive = Boolean(
                (td as any).is_google_drive ||
                  tdDriveId ||
                  (td.file_pdf_url && td.file_pdf_url.includes('drive.google.com'))
              );
              list.push({
                id: 'td-pdf-' + td.id,
                ten_file: td.file_pdf_ten,
                dung_luong: td.file_pdf_dung_luong || 350000,
                url: td.file_pdf_url,
                file_url: td.file_pdf_url,
                google_drive_id: tdDriveId || null,
                google_drive_preview_url:
                  (td as any).google_drive_preview_url ||
                  (tdDriveId ? `https://drive.google.com/file/d/${tdDriveId}/preview` : null),
                is_google_drive: isTdDrive,
                chuong_trinh_id: c.id,
                thay_doi_id: td.id,
                don_vi_id: td.don_vi_id || null,
                ten_don_vi: td.ten_don_vi || 'Toàn Đảng bộ',
                nguon_goc: 'THAY_DOI_BO_SUNG',
                chu_the: c.chu_the,
                doi_tuong: td.ten_don_vi ? `Địa bàn: ${td.ten_don_vi}` : 'Toàn Đảng bộ',
                nam: c.nam,
                loai_hinh: c.loai_hinh,
                so_van_ban: td.so_van_ban,
                ngay_ban_hanh:
                  td.ngay_ban_hanh || (td.created_at ? td.created_at.slice(0, 10) : '2026-02-01'),
                ghi_chu: `Văn bản điều chỉnh/bổ sung (Lần ${td.lan_dieu_chinh || 1}): ${td.noi_dung_dieu_chinh.slice(0, 70)}...`,
                created_at: td.created_at,
              });
            }
          }
        });
      }
    });

    try {
      const rawDiaBanFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      if (rawDiaBanFiles) {
        const diaBanFiles = JSON.parse(rawDiaBanFiles);
        if (Array.isArray(diaBanFiles)) {
          diaBanFiles.forEach((f: any) => {
            if (
              f.ten_file &&
              !deletedPdfNames.has(f.ten_file) &&
              !deletedPdfIds.has('hsdb-' + f.id) &&
              !deletedPdfIds.has(f.id)
            ) {
              const dbKey = `db_${f.id}_${f.ten_file}`;
              if (!seenFileKeys.has(dbKey)) {
                seenFileKeys.add(dbKey);
                const driveId =
                  f.google_drive_id || extractGoogleDriveFileId(f.url || f.file_url);
                const isDrive = Boolean(
                  f.is_google_drive ||
                    driveId ||
                    (f.url && f.url.includes('drive.google.com')) ||
                    (f.file_url && f.file_url.includes('drive.google.com'))
                );
                list.push({
                  id: 'hsdb-' + f.id,
                  ten_file: f.ten_file,
                  dung_luong: f.dung_luong || 320000,
                  url: f.url || f.file_url || null,
                  file_url: f.file_url || f.url || null,
                  loai_file:
                    f.loai_file ||
                    (f.ten_file?.toLowerCase().endsWith('.pdf')
                      ? 'pdf'
                      : f.ten_file?.toLowerCase().endsWith('.docx')
                      ? 'docx'
                      : f.ten_file?.toLowerCase().endsWith('.xlsx')
                      ? 'xlsx'
                      : 'doc'),
                  the_loai_van_ban: f.the_loai_van_ban || 'Tài liệu hồ sơ',
                  so_van_ban: f.so_van_ban || null,
                  trich_yeu: f.trich_yeu || f.mo_ta || null,
                  nguoi_ky: f.nguoi_ky || f.nguoi_tao || null,
                  chuong_trinh_id: null,
                  don_vi_id: f.don_vi_id || null,
                  ten_don_vi: f.ten_don_vi || null,
                  nguon_goc: 'HO_SO_DIA_BAN',
                  chu_the: f.ten_don_vi
                    ? `Hồ sơ địa bàn ${f.ten_don_vi}`
                    : 'Hồ sơ địa bàn cơ sở',
                  doi_tuong: f.ten_don_vi || 'Cơ sở',
                  nam: new Date().getFullYear(),
                  ngay_ban_hanh:
                    f.ngay_ban_hanh ||
                    (f.ngay_tao ? f.ngay_tao.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                  ghi_chu: f.loai_tai_lieu || f.trich_yeu || 'Tài liệu hồ sơ địa bàn',
                  google_drive_id: driveId || null,
                  google_drive_preview_url:
                    f.google_drive_preview_url ||
                    (driveId ? `https://drive.google.com/file/d/${driveId}/preview` : null),
                  is_google_drive: isDrive,
                  created_at: f.ngay_tao ? new Date().toISOString() : new Date().toISOString(),
                });
              }
            }
          });
        }
      }
    } catch {}

    try {
      const rawBaoCao = localStorage.getItem('ubkt_bao_cao_thang');
      if (rawBaoCao) {
        const baoCaoList = JSON.parse(rawBaoCao);
        if (Array.isArray(baoCaoList)) {
          baoCaoList.forEach((bc: any) => {
            if (
              bc.file_ten &&
              !deletedPdfNames.has(bc.file_ten) &&
              !deletedPdfIds.has('bc-' + bc.id) &&
              !deletedPdfIds.has(bc.id)
            ) {
              const bcKey = `bc_${bc.id}_${bc.file_ten}`;
              if (!seenFileKeys.has(bcKey)) {
                seenFileKeys.add(bcKey);
                const bcDriveId =
                  bc.google_drive_id || extractGoogleDriveFileId(bc.file_url || bc.url);
                const isBcDrive = Boolean(
                  bc.is_google_drive ||
                    bcDriveId ||
                    (bc.file_url && bc.file_url.includes('drive.google.com')) ||
                    (bc.url && bc.url.includes('drive.google.com'))
                );
                list.push({
                  id: 'bc-' + bc.id,
                  ten_file: bc.file_ten,
                  dung_luong: bc.file_dung_luong || 250000,
                  url: bc.file_url || null,
                  file_url: bc.file_url || null,
                  loai_file:
                    bc.file_loai || (bc.file_ten.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'),
                  the_loai_van_ban: 'Báo cáo',
                  so_van_ban: `BC-T${bc.thang}/${bc.nam}`,
                  trich_yeu: bc.tieu_de || `Báo cáo công tác tháng ${bc.thang}/${bc.nam}`,
                  nguoi_ky: bc.can_bo_ten || null,
                  chuong_trinh_id: null,
                  don_vi_id: bc.danh_sach_don_vi_ids?.[0] || null,
                  ten_don_vi: bc.danh_sach_ten_don_vi?.join(', ') || null,
                  nguon_goc: 'BAO_CAO_THANG',
                  chu_the: bc.danh_sach_ten_don_vi?.join(', ') || 'Báo cáo tháng cơ sở',
                  doi_tuong: bc.danh_sach_ten_don_vi?.join(', ') || 'Cơ sở',
                  nam: bc.nam || new Date().getFullYear(),
                  ngay_ban_hanh:
                    bc.ngay_nop ||
                    (bc.created_at
                      ? bc.created_at.slice(0, 10)
                      : new Date().toISOString().slice(0, 10)),
                  ghi_chu: `Báo cáo định kỳ tháng ${bc.thang}/${bc.nam}`,
                  google_drive_id: bcDriveId || null,
                  google_drive_preview_url:
                    bc.google_drive_preview_url ||
                    (bcDriveId ? `https://drive.google.com/file/d/${bcDriveId}/preview` : null),
                  is_google_drive: isBcDrive,
                  created_at: bc.created_at || new Date().toISOString(),
                });
              }
            }
          });
        }
      }
    } catch {}

    if (db.pdfFiles && Array.isArray(db.pdfFiles)) {
      db.pdfFiles.forEach((p) => {
        if (
          !deletedPdfIds.has(p.id) &&
          !deletedPdfNames.has(p.ten_file) &&
          !(p.chuong_trinh_id && deletedCtIds.has(p.chuong_trinh_id))
        ) {
          if (!seenFileKeys.has('pdf_' + p.id)) {
            seenFileKeys.add('pdf_' + p.id);
            list.push({
              ...p,
              nguon_goc: p.nguon_goc || 'KHO_PDF',
              ngay_ban_hanh:
                p.ngay_ban_hanh ||
                (p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            });
          }
        }
      });
    }

    list.sort((a, b) => {
      const dateA = a.ngay_ban_hanh || a.created_at || '';
      const dateB = b.ngay_ban_hanh || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

    return list;
  },

  create_or_attach_pdf: async (db, args) => {
    const { input } = args as {
      input: {
        ten_file: string;
        dung_luong: number;
        url?: string | null;
        file_url?: string | null;
        chuong_trinh_id?: string | null;
        ghi_chu?: string | null;
        nguoi_tai_len?: string | null;
        nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
        don_vi_id?: string | null;
        ten_don_vi?: string | null;
        google_drive_id?: string | null;
        google_drive_preview_url?: string | null;
        is_google_drive?: boolean | null;
      };
    };

    if (input.chuong_trinh_id) {
      const ct = (db.chuongTrinhList || []).find((c) => c.id === input.chuong_trinh_id);
      if (ct) {
        ct.file_pdf_ten = input.ten_file;
        ct.file_pdf_dung_luong = input.dung_luong;
        if (input.url) ct.file_pdf_url = input.url;
        if (input.ghi_chu) ct.ghi_chu_pdf = input.ghi_chu;
        (ct as any).google_drive_id = input.google_drive_id || null;
        (ct as any).google_drive_preview_url = input.google_drive_preview_url || null;
        (ct as any).is_google_drive = Boolean(input.is_google_drive);
        ct.updated_at = new Date().toISOString();
        saveMockDb(db);
        return {
          id: 'ct-pdf-' + ct.id,
          ten_file: input.ten_file,
          dung_luong: input.dung_luong,
          url: input.url || null,
          file_url: input.file_url || input.url || null,
          google_drive_id: input.google_drive_id || null,
          google_drive_preview_url: input.google_drive_preview_url || null,
          is_google_drive: Boolean(input.is_google_drive),
          chuong_trinh_id: ct.id,
          nguon_goc: 'CHUONG_TRINH',
          chu_the: ct.chu_the,
          doi_tuong: ct.doi_tuong,
          nam: ct.nam,
          loai_hinh: ct.loai_hinh,
          so_van_ban: ct.so_van_ban,
          ghi_chu: input.ghi_chu || null,
          created_at: ct.updated_at,
        };
      }
    }

    if (!db.pdfFiles) db.pdfFiles = [];
    const newPdf: PdfKhoItem = {
      id: 'pdf-' + Date.now(),
      ten_file: input.ten_file,
      dung_luong: input.dung_luong,
      url: input.url || null,
      file_url: input.file_url || input.url || null,
      google_drive_id: input.google_drive_id || null,
      google_drive_preview_url: input.google_drive_preview_url || null,
      is_google_drive: input.is_google_drive || false,
      chuong_trinh_id: null,
      nguon_goc: input.nguon_goc || 'KHO_PDF',
      don_vi_id: input.don_vi_id || null,
      ten_don_vi: input.ten_don_vi || null,
      chu_the: input.ten_don_vi || 'Văn bản / Kế hoạch độc lập',
      doi_tuong: input.ten_don_vi ? `Địa bàn ${input.ten_don_vi}` : 'Tài liệu nghiệp vụ KT-GS',
      nam: new Date().getFullYear(),
      ghi_chu: input.ghi_chu || null,
      created_at: new Date().toISOString(),
    };
    db.pdfFiles.unshift(newPdf);
    saveMockDb(db);
    cloudSyncService.saveItemToCloud('pdf_files', newPdf.id, newPdf);
    return newPdf;
  },

  update_pdf: async (db, args) => {
    const { id, input } = args as { id: string; input: Partial<PdfKhoItem> };
    if (id.startsWith('ct-pdf-')) {
      const ctId = id.replace('ct-pdf-', '');
      const ct = (db.chuongTrinhList || []).find((c) => c.id === ctId);
      if (ct) {
        if (input.url || input.file_url)
          ct.file_pdf_url = input.url || input.file_url || ct.file_pdf_url;
        (ct as any).google_drive_id = input.google_drive_id || null;
        (ct as any).google_drive_preview_url = input.google_drive_preview_url || null;
        (ct as any).is_google_drive = Boolean(input.is_google_drive);
        ct.updated_at = new Date().toISOString();
      }
    } else if (id.startsWith('td-pdf-')) {
      const tdId = id.replace('td-pdf-', '');
      (db.chuongTrinhList || []).forEach((c) => {
        if (c.danh_sach_thay_doi_bo_sung) {
          const td = c.danh_sach_thay_doi_bo_sung.find((t) => t.id === tdId);
          if (td) {
            if (input.url || input.file_url)
              td.file_pdf_url = input.url || input.file_url || td.file_pdf_url;
            (td as any).google_drive_id = input.google_drive_id || null;
            (td as any).google_drive_preview_url = input.google_drive_preview_url || null;
            (td as any).is_google_drive = Boolean(input.is_google_drive);
          }
        }
      });
    }

    if (id.startsWith('bc-')) {
      const bcId = id.replace('bc-', '');
      try {
        const rawBc = localStorage.getItem('ubkt_bao_cao_thang');
        if (rawBc) {
          const bcList = JSON.parse(rawBc);
          const updatedBc = bcList.map((b: any) =>
            b.id === bcId
              ? {
                  ...b,
                  file_url: input.url || input.file_url || b.file_url,
                  google_drive_id: input.google_drive_id,
                  google_drive_preview_url: input.google_drive_preview_url,
                  is_google_drive: true,
                }
              : b
          );
          localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(updatedBc));
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (!db.pdfFiles) db.pdfFiles = [];
    const idx = db.pdfFiles.findIndex((p) => p.id === id);
    if (idx !== -1) {
      db.pdfFiles[idx] = { ...db.pdfFiles[idx], ...input };
    } else if (!id.startsWith('ct-pdf-') && !id.startsWith('td-pdf-') && !id.startsWith('bc-')) {
      db.pdfFiles.push({ id, ...input } as PdfKhoItem);
    }
    saveMockDb(db);
    const updatedPdf = idx !== -1 ? db.pdfFiles[idx] : input;
    cloudSyncService.saveItemToCloud('pdf_files', id, updatedPdf);
    return updatedPdf;
  },

  delete_pdf: async (db, args) => {
    const { id, ten_file } = args as { id: string; ten_file?: string };
    if (!db.pdfFiles) db.pdfFiles = [];
    const targetPdf = db.pdfFiles.find((p) => p.id === id);
    const targetFileName = ten_file || targetPdf?.ten_file;
    const targetCtId = targetPdf?.chuong_trinh_id;

    saveDeletedPdfId(id);
    if (targetFileName) saveDeletedPdfName(targetFileName);
    await centralDataService.deleteDoc('pdf_files', id);
    if (targetFileName) {
      await centralDataService.deleteDoc('pdf_files', targetFileName);
    }

    if (id.startsWith('ct-pdf-') || targetCtId || targetFileName) {
      const ctId = id.startsWith('ct-pdf-') ? id.replace('ct-pdf-', '') : targetCtId;
      (db.chuongTrinhList || []).forEach((c) => {
        let updated = false;
        if (c.id === ctId || (targetFileName && c.file_pdf_ten === targetFileName)) {
          c.file_pdf_ten = null;
          c.file_pdf_url = null;
          c.file_pdf_dung_luong = null;
          c.ghi_chu_pdf = null;
          (c as any).google_drive_id = null;
          (c as any).google_drive_preview_url = null;
          (c as any).is_google_drive = false;
          c.updated_at = new Date().toISOString();
          updated = true;
        }
        if (c.danh_sach_thay_doi_bo_sung) {
          c.danh_sach_thay_doi_bo_sung.forEach((td) => {
            if (targetFileName && td.file_pdf_ten === targetFileName) {
              td.file_pdf_ten = null;
              td.file_pdf_url = null;
              (td as any).google_drive_id = null;
              (td as any).google_drive_preview_url = null;
              (td as any).is_google_drive = false;
              updated = true;
            }
          });
        }
        if (updated) {
          cloudSyncService.saveItemToCloud('chuong_trinh', c.id, c).catch(() => {});
        }
      });
    }

    if (id.startsWith('td-pdf-')) {
      const tdId = id.replace('td-pdf-', '');
      (db.chuongTrinhList || []).forEach((c) => {
        let updated = false;
        if (c.danh_sach_thay_doi_bo_sung) {
          c.danh_sach_thay_doi_bo_sung.forEach((td) => {
            if (td.id === tdId || tdId.endsWith(td.id)) {
              td.file_pdf_ten = null;
              td.file_pdf_url = null;
              (td as any).google_drive_id = null;
              (td as any).google_drive_preview_url = null;
              (td as any).is_google_drive = false;
              updated = true;
            }
          });
        }
        if (updated) {
          cloudSyncService.saveItemToCloud('chuong_trinh', c.id, c).catch(() => {});
        }
      });
    }

    if (id.startsWith('hsdb-') || targetFileName) {
      const rawFileId = id.startsWith('hsdb-') ? id.replace('hsdb-', '') : null;
      try {
        const rawFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (rawFiles) {
          const files = JSON.parse(rawFiles);
          const targetFile = files.find(
            (f: any) =>
              (rawFileId && f.id === rawFileId) || (targetFileName && f.ten_file === targetFileName)
          );
          const filtered = files.filter(
            (f: any) =>
              (!rawFileId || f.id !== rawFileId) && (!targetFileName || f.ten_file !== targetFileName)
          );
          localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(filtered));

          if (targetFile?.id) {
            cloudSyncService.deleteItemFromCloud('ho_so_dia_ban_files', targetFile.id).catch(() => {});
          }

          if (targetFile?.don_vi_id) {
            const rawRecs = localStorage.getItem('ubkt_ho_so_dia_ban_records');
            if (rawRecs) {
              const recs = JSON.parse(rawRecs);
              const updatedRecs = recs.map((r: any) =>
                r.id === targetFile.don_vi_id
                  ? { ...r, so_luong_tai_lieu: Math.max(0, (r.so_luong_tai_lieu || 1) - 1) }
                  : r
              );
              localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(updatedRecs));
            }
          }
        }
      } catch (e) {
        console.error('Lỗi xóa tệp liên thông hồ sơ địa bàn trong delete_pdf:', e);
      }
    }

    if (id.startsWith('bc-') || targetFileName) {
      const rawBcId = id.startsWith('bc-') ? id.replace('bc-', '') : null;
      try {
        const rawBc = localStorage.getItem('ubkt_bao_cao_thang');
        if (rawBc) {
          const bcList = JSON.parse(rawBc);
          const targetBc = bcList.find(
            (b: any) =>
              (rawBcId && b.id === rawBcId) || (targetFileName && b.file_ten === targetFileName)
          );
          const filteredBc = bcList.filter(
            (b: any) =>
              (!rawBcId || b.id !== rawBcId) && (!targetFileName || b.file_ten !== targetFileName)
          );
          localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(filteredBc));

          if (targetBc?.id) {
            cloudSyncService.deleteItemFromCloud('bao_cao_thang', targetBc.id).catch(() => {});
          }

          if (targetBc?.file_ten) {
            const rawFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
            if (rawFiles) {
              const files = JSON.parse(rawFiles);
              const filteredFiles = files.filter(
                (f: any) =>
                  f.ten_file !== targetBc.file_ten && (!rawBcId || !f.id.includes(rawBcId))
              );
              localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(filteredFiles));
            }
          }
        }
      } catch (e) {
        console.error('Lỗi xóa báo cáo tháng trong delete_pdf:', e);
      }
    }

    db.pdfFiles = db.pdfFiles.filter(
      (p) => p.id !== id && (!targetFileName || p.ten_file !== targetFileName)
    );
    saveMockDb(db);

    window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

    return undefined;
  },
});

export const pdfApi = {
  getAllPdfs: () => requestApi<PdfKhoItem[]>('/api/pdfs', 'GET', undefined, 'get_all_pdfs'),

  createOrAttachPdf: async (input: {
    ten_file: string;
    dung_luong: number;
    url?: string | null;
    file_url?: string | null;
    google_drive_id?: string | null;
    google_drive_preview_url?: string | null;
    is_google_drive?: boolean | null;
    chuong_trinh_id?: string | null;
    ghi_chu?: string | null;
    nguoi_tai_len?: string | null;
    nguon_goc?: 'CHUONG_TRINH' | 'THAY_DOI_BO_SUNG' | 'HO_SO_DIA_BAN' | 'KHO_PDF';
    don_vi_id?: string | null;
    ten_don_vi?: string | null;
  }) => {
    const finalInput = { ...input };
    const fileSource = finalInput.file_url || finalInput.url;

    if (
      !finalInput.is_google_drive &&
      !finalInput.google_drive_id &&
      fileSource &&
      isGoogleDriveConfigured()
    ) {
      try {
        const gdriveCfg = getGoogleDriveConfig();
        if (gdriveCfg.autoUpload) {
          const driveRes = await uploadBase64OrUrlToGoogleDrive(
            finalInput.ten_file,
            fileSource,
            undefined,
            gdriveCfg.folderId
          );
          if (driveRes.success && driveRes.fileUrl) {
            finalInput.url = driveRes.fileUrl;
            finalInput.file_url = driveRes.fileUrl;
            finalInput.google_drive_id = driveRes.fileId;
            finalInput.google_drive_preview_url = driveRes.previewUrl;
            finalInput.is_google_drive = true;
          }
        }
      } catch (driveErr) {
        console.warn('Lỗi tự động đẩy tệp lên Google Drive trong createOrAttachPdf:', driveErr);
      }
    }

    return requestApi<PdfKhoItem>(
      '/api/pdfs',
      'POST',
      { input: finalInput },
      'create_or_attach_pdf',
      { input: finalInput }
    );
  },

  updatePdf: (id: string, input: Partial<PdfKhoItem>) =>
    requestApi<PdfKhoItem>(`/api/pdfs/${id}`, 'PUT', { input }, 'update_pdf', { id, input }),

  getDeletedPdfIds,
  getDeletedPdfNames,

  deletePdf: async (id: string, ten_file?: string) => {
    saveDeletedPdfId(id);
    if (ten_file) saveDeletedPdfName(ten_file);
    await cloudSyncService.deleteItemFromCloud('pdf_files', id).catch(() => {});
    return requestApi<void>(`/api/pdfs/${id}`, 'DELETE', undefined, 'delete_pdf', {
      id,
      ten_file,
    });
  },

  autoScanAndSyncUnaggregatedFiles: async (
    onProgress?: (info: {
      current: number;
      total: number;
      filename: string;
      source: string;
      status: string;
    }) => void
  ): Promise<{
    scannedCount: number;
    aggregatedCount: number;
    syncedDriveCount: number;
    errors: string[];
  }> => {
    await ensureFirestoreSynced();
    const db = getMockDb();
    const gdriveCfg = getGoogleDriveConfig();
    const isDriveEnabled = isGoogleDriveConfigured();
    const deletedPdfIds = getDeletedPdfIds();
    const deletedPdfNames = getDeletedPdfNames();
    const deletedCtIds = getDeletedChuongTrinhIds();

    interface ScannedItem {
      ten_file: string;
      file_url?: string | null;
      dung_luong?: number | null;
      the_loai_van_ban?: string | null;
      so_van_ban?: string | null;
      trich_yeu?: string | null;
      nguoi_ky?: string | null;
      nguon_goc:
        | 'CHUONG_TRINH'
        | 'THAY_DOI_BO_SUNG'
        | 'HO_SO_DIA_BAN'
        | 'BAO_CAO_THANG'
        | 'KHO_PDF';
      don_vi_id?: string | null;
      ten_don_vi?: string | null;
      chuong_trinh_id?: string | null;
      is_google_drive: boolean;
      google_drive_id?: string | null;
      google_drive_preview_url?: string | null;
      updateRef: (driveInfo: { fileId: string; fileUrl: string; previewUrl?: string }) => void;
    }

    const scannedItems: ScannedItem[] = [];

    (db.chuongTrinhList || []).forEach((c) => {
      if (c.file_pdf_ten) {
        const driveId = (c as any).google_drive_id || extractGoogleDriveFileId(c.file_pdf_url);
        scannedItems.push({
          ten_file: c.file_pdf_ten,
          file_url: c.file_pdf_url,
          dung_luong: c.file_pdf_dung_luong || 350000,
          the_loai_van_ban: (c as any).the_loai_van_ban || 'Kế hoạch',
          so_van_ban: c.so_van_ban || null,
          trich_yeu: c.noi_dung || c.ten_chuong_trinh || null,
          nguoi_ky: c.nguoi_ky || null,
          nguon_goc: 'CHUONG_TRINH',
          chuong_trinh_id: c.id,
          don_vi_id: c.don_vi_id || null,
          ten_don_vi: c.ten_don_vi || c.doi_tuong || null,
          is_google_drive: Boolean((c as any).is_google_drive || driveId),
          google_drive_id: driveId,
          google_drive_preview_url: (c as any).google_drive_preview_url,
          updateRef: (d) => {
            c.file_pdf_url = d.fileUrl;
            (c as any).google_drive_id = d.fileId;
            (c as any).google_drive_preview_url = d.previewUrl;
            (c as any).is_google_drive = true;
          },
        });
      }

      if (c.danh_sach_thay_doi_bo_sung) {
        c.danh_sach_thay_doi_bo_sung.forEach((td) => {
          if (td.file_pdf_ten) {
            const tdDriveId =
              (td as any).google_drive_id || extractGoogleDriveFileId(td.file_pdf_url);
            scannedItems.push({
              ten_file: td.file_pdf_ten,
              file_url: td.file_pdf_url,
              dung_luong: td.file_pdf_dung_luong || 320000,
              the_loai_van_ban: 'Quyết định',
              so_van_ban: td.so_van_ban || null,
              trich_yeu: td.noi_dung_dieu_chinh || (td as any).ly_do_dieu_chinh || null,
              nguoi_ky: td.nguoi_ky || null,
              nguon_goc: 'THAY_DOI_BO_SUNG',
              chuong_trinh_id: c.id,
              don_vi_id: c.don_vi_id || null,
              ten_don_vi: c.ten_don_vi || c.doi_tuong || null,
              is_google_drive: Boolean((td as any).is_google_drive || tdDriveId),
              google_drive_id: tdDriveId,
              google_drive_preview_url: (td as any).google_drive_preview_url,
              updateRef: (d) => {
                td.file_pdf_url = d.fileUrl;
                (td as any).google_drive_id = d.fileId;
                (td as any).google_drive_preview_url = d.previewUrl;
                (td as any).is_google_drive = true;
              },
            });
          }
        });
      }
    });

    let localHsdbFiles: HoSoDiaBanFile[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      if (raw) localHsdbFiles = JSON.parse(raw);
    } catch {}

    localHsdbFiles.forEach((f) => {
      const driveId = f.google_drive_id || extractGoogleDriveFileId(f.file_url || f.url);
      scannedItems.push({
        ten_file: f.ten_file,
        file_url: f.file_url || f.url,
        dung_luong: f.dung_luong || 300000,
        the_loai_van_ban: f.the_loai_van_ban || 'Tài liệu hồ sơ',
        so_van_ban: f.so_van_ban || null,
        trich_yeu: f.trich_yeu || f.mo_ta || null,
        nguoi_ky: f.nguoi_ky || f.nguoi_tao || null,
        nguon_goc: 'HO_SO_DIA_BAN',
        don_vi_id: f.don_vi_id,
        ten_don_vi: f.ten_don_vi,
        is_google_drive: Boolean(f.is_google_drive || driveId),
        google_drive_id: driveId,
        google_drive_preview_url: f.google_drive_preview_url,
        updateRef: (d) => {
          f.url = d.fileUrl;
          f.file_url = d.fileUrl;
          f.google_drive_id = d.fileId;
          f.google_drive_preview_url = d.previewUrl;
          f.is_google_drive = true;
        },
      });
    });

    let localBcList: BaoCaoThangItem[] = [];
    try {
      const raw = localStorage.getItem('ubkt_bao_cao_thang');
      if (raw) localBcList = JSON.parse(raw);
    } catch {}

    localBcList.forEach((bc) => {
      if (bc.file_ten) {
        const driveId = (bc as any).google_drive_id || extractGoogleDriveFileId(bc.file_url);
        scannedItems.push({
          ten_file: bc.file_ten,
          file_url: bc.file_url,
          dung_luong: bc.file_dung_luong || 280000,
          the_loai_van_ban: 'Báo cáo',
          so_van_ban: `BC-T${bc.thang}/${bc.nam}`,
          trich_yeu: bc.tieu_de || `Báo cáo tháng ${bc.thang}/${bc.nam}`,
          nguoi_ky: bc.can_bo_ten || null,
          nguon_goc: 'BAO_CAO_THANG',
          don_vi_id: bc.danh_sach_don_vi_ids?.[0] || null,
          ten_don_vi: bc.danh_sach_ten_don_vi?.join(', ') || null,
          is_google_drive: Boolean((bc as any).is_google_drive || driveId),
          google_drive_id: driveId,
          google_drive_preview_url: (bc as any).google_drive_preview_url,
          updateRef: (d) => {
            bc.file_url = d.fileUrl;
            (bc as any).google_drive_id = d.fileId;
            (bc as any).google_drive_preview_url = d.previewUrl;
            (bc as any).is_google_drive = true;
          },
        });
      }
    });

    let localRecords: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      if (raw) localRecords = JSON.parse(raw);
    } catch {}

    let addedDocsToHsdb = false;
    localRecords.forEach((r) => {
      if (Array.isArray(r.danh_sach_van_de)) {
        r.danh_sach_van_de.forEach((vd: any) => {
          if (vd.file_ten && !localHsdbFiles.some((f) => f.ten_file === vd.file_ten)) {
            const newF: HoSoDiaBanFile = {
              id: 'doc-vd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              don_vi_id: r.id,
              ten_don_vi: r.ten_dia_ban,
              ten_file: vd.file_ten,
              loai_file: vd.file_loai || 'docx',
              dung_luong: vd.file_dung_luong || 300000,
              url: vd.file_url,
              file_url: vd.file_url,
              loai_tai_lieu: vd.nhom_ho_so || '4. Hồ sơ vấn đề nổi cộm & Đơn thư',
              mo_ta: `Tài liệu vấn đề: ${vd.noi_dung}`,
              ngay_tao: vd.ngay_ghi_nhan || new Date().toLocaleDateString('vi-VN'),
              nguoi_tao: vd.nguoi_ghi_nhan || 'Cán bộ UBKT',
            };
            localHsdbFiles.push(newF);
            addedDocsToHsdb = true;
            scannedItems.push({
              ten_file: vd.file_ten,
              file_url: vd.file_url,
              dung_luong: vd.file_dung_luong || 300000,
              the_loai_van_ban: 'Tài liệu vấn đề',
              trich_yeu: vd.noi_dung,
              nguon_goc: 'HO_SO_DIA_BAN',
              don_vi_id: r.id,
              ten_don_vi: r.ten_dia_ban,
              is_google_drive: false,
              updateRef: (d) => {
                vd.file_url = d.fileUrl;
                newF.url = d.fileUrl;
                newF.file_url = d.fileUrl;
                newF.google_drive_id = d.fileId;
                newF.is_google_drive = true;
              },
            });
          }
        });
      }

      if (Array.isArray(r.danh_sach_chi_dao)) {
        r.danh_sach_chi_dao.forEach((cd: any) => {
          if (cd.file_ten && !localHsdbFiles.some((f) => f.ten_file === cd.file_ten)) {
            const newF: HoSoDiaBanFile = {
              id: 'doc-cd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              don_vi_id: r.id,
              ten_don_vi: r.ten_dia_ban,
              ten_file: cd.file_ten,
              loai_file: cd.file_loai || 'docx',
              dung_luong: cd.file_dung_luong || 300000,
              url: cd.file_url,
              file_url: cd.file_url,
              loai_tai_lieu: cd.nhom_ho_so || '5. Kết luận, Thông báo & Chỉ đạo',
              mo_ta: `Tài liệu chỉ đạo: ${cd.noi_dung}`,
              ngay_tao: new Date().toLocaleDateString('vi-VN'),
              nguoi_tao: cd.nguoi_ghi_nhan || 'Cán bộ UBKT',
            };
            localHsdbFiles.push(newF);
            addedDocsToHsdb = true;
            scannedItems.push({
              ten_file: cd.file_ten,
              file_url: cd.file_url,
              dung_luong: cd.file_dung_luong || 300000,
              the_loai_van_ban: 'Chỉ đạo',
              trich_yeu: cd.noi_dung,
              nguon_goc: 'HO_SO_DIA_BAN',
              don_vi_id: r.id,
              ten_don_vi: r.ten_dia_ban,
              is_google_drive: false,
              updateRef: (d) => {
                cd.file_url = d.fileUrl;
                newF.url = d.fileUrl;
                newF.file_url = d.fileUrl;
                newF.google_drive_id = d.fileId;
                newF.is_google_drive = true;
              },
            });
          }
        });
      }
    });

    if (addedDocsToHsdb) {
      localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(localHsdbFiles));
    }

    if (!db.pdfFiles) db.pdfFiles = [];
    const existingPdfMap = new Map<string, PdfKhoItem>();
    db.pdfFiles.forEach((p) => {
      existingPdfMap.set(p.ten_file, p);
    });

    let aggregatedCount = 0;
    let syncedDriveCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < scannedItems.length; i++) {
      const item = scannedItems[i];
      if (
        deletedPdfNames.has(item.ten_file) ||
        (item.chuong_trinh_id && deletedCtIds.has(item.chuong_trinh_id)) ||
        (item.chuong_trinh_id && deletedPdfIds.has('ct-pdf-' + item.chuong_trinh_id))
      ) {
        continue;
      }

      onProgress?.({
        current: i + 1,
        total: scannedItems.length,
        filename: item.ten_file,
        source: item.nguon_goc,
        status: item.is_google_drive ? 'Đã có trên Drive' : 'Đang xử lý...',
      });

      let matchedPdf = existingPdfMap.get(item.ten_file);
      if (!matchedPdf) {
        matchedPdf = {
          id: 'pdf-' + Date.now() + '-' + i,
          ten_file: item.ten_file,
          dung_luong: item.dung_luong || 300000,
          url: item.file_url || null,
          file_url: item.file_url || null,
          the_loai_van_ban: item.the_loai_van_ban || 'Văn bản',
          so_van_ban: item.so_van_ban || null,
          trich_yeu: item.trich_yeu || null,
          nguoi_ky: item.nguoi_ky || null,
          chuong_trinh_id: item.chuong_trinh_id || null,
          don_vi_id: item.don_vi_id || null,
          ten_don_vi: item.ten_don_vi || null,
          nguon_goc: item.nguon_goc,
          chu_the: item.ten_don_vi || 'UBKT Đảng ủy',
          doi_tuong: item.ten_don_vi || 'Cơ sở',
          nam: new Date().getFullYear(),
          ngay_ban_hanh: new Date().toISOString().slice(0, 10),
          is_google_drive: item.is_google_drive,
          google_drive_id: item.google_drive_id || null,
          google_drive_preview_url: item.google_drive_preview_url || null,
          created_at: new Date().toISOString(),
        };
        db.pdfFiles.push(matchedPdf);
        existingPdfMap.set(item.ten_file, matchedPdf);
        aggregatedCount++;
      }

      if (!item.is_google_drive && isDriveEnabled) {
        onProgress?.({
          current: i + 1,
          total: scannedItems.length,
          filename: item.ten_file,
          source: item.nguon_goc,
          status: 'Đang tải lên Google Drive...',
        });

        try {
          let fileSource = item.file_url;
          if (
            !fileSource ||
            (!fileSource.startsWith('data:') &&
              !fileSource.startsWith('http') &&
              !fileSource.startsWith('blob:'))
          ) {
            const textContent = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nỦY BAN KIỂM TRA ĐẢNG ỦY\n\nTỆP LƯU TRỮ VĂN BẢN ĐIỆN TỬ\n---------------------------------------------\nTên văn bản: ${item.ten_file}\nThể loại: ${item.the_loai_van_ban || 'Văn bản'}\nSố ký hiệu: ${item.so_van_ban || '---'}\nĐơn vị / Địa bàn: ${item.ten_don_vi || 'Cơ sở'}\nNội dung trích yếu: ${item.trich_yeu || 'Tài liệu nghiệp vụ công tác kiểm tra, giám sát'}\nThời điểm đồng bộ: ${new Date().toLocaleString('vi-VN')}\n---------------------------------------------\nTrạng thái: Đã tự động tổng hợp & đồng bộ lên Google Drive.`;
            fileSource =
              'data:text/plain;charset=utf-8;base64,' +
              btoa(unescape(encodeURIComponent(textContent)));
          }

          const driveRes = await uploadBase64OrUrlToGoogleDrive(
            item.ten_file,
            fileSource,
            undefined,
            gdriveCfg.folderId
          );

          if (driveRes.success && driveRes.fileUrl) {
            item.updateRef({
              fileId: driveRes.fileId || '',
              fileUrl: driveRes.fileUrl,
              previewUrl: driveRes.previewUrl,
            });

            matchedPdf.url = driveRes.fileUrl;
            matchedPdf.file_url = driveRes.fileUrl;
            matchedPdf.google_drive_id = driveRes.fileId || null;
            matchedPdf.google_drive_preview_url = driveRes.previewUrl || null;
            matchedPdf.is_google_drive = true;

            item.is_google_drive = true;
            item.google_drive_id = driveRes.fileId;
            syncedDriveCount++;
          }
        } catch (err: any) {
          errors.push(`Lỗi tệp ${item.ten_file}: ${err.message || String(err)}`);
        }
      }
    }

    saveMockDb(db);
    localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(localHsdbFiles));
    localStorage.setItem('ubkt_bao_cao_thang', JSON.stringify(localBcList));
    localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(localRecords));

    window.dispatchEvent(new CustomEvent('ubkt_chuong_trinh_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

    return {
      scannedCount: scannedItems.length,
      aggregatedCount,
      syncedDriveCount,
      errors,
    };
  },
};

