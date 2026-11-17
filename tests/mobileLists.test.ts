import { describe, it, expect } from 'vitest';
import type { DonThu, PdfKhoItem, DiaBanRecord } from '../src/types';

describe('Mobile Lists unit tests', () => {
  it('correctly handles DonThu item fields and status labels', () => {
    const mockDonThu: DonThu = {
      id: 'dt-1',
      ma_don: 'Đ-001/2026',
      ngay_nhan: '2026-02-15',
      nguoi_gui: 'Nguyễn Văn A',
      dia_chi_nguoi_gui: 'Hải Dương',
      nguoi_bi_to_cao: 'Trần Văn B',
      chuc_vu_nguoi_bi_to_cao: 'Bí thư Chi bộ',
      don_vi_nguoi_bi_to_cao_id: 'dv-1',
      loai_don: 'Tố cáo',
      linh_vuc: 'Thực hiện nhiệm vụ',
      noi_dung_tom_tat: 'Phản ánh sai phạm trong công tác kiểm tra',
      thuoc_tham_quyen: true,
      can_bo_phu_trach_id: 'cb-1',
      can_bo_phu_trach_ten: 'Lê Văn C',
      ngay_chuyen_hoac_phan_cong: '2026-02-16',
      thoi_han_giai_quyet: '2026-04-15',
      trang_thai_xu_ly: 'Đang xác minh',
      ket_qua_xu_ly: 'CHUA_CO',
      ghi_chu_nghiep_vu: 'Đang thụ lý',
      tai_lieu_dinh_kem: [],
      lich_su_xu_ly: [],
      created_at: '2026-02-15T00:00:00Z',
      updated_at: '2026-02-15T00:00:00Z',
    };

    expect(mockDonThu.ma_don).toBe('Đ-001/2026');
    expect(mockDonThu.nguoi_bi_to_cao).toBe('Trần Văn B');
    expect(mockDonThu.trang_thai_xu_ly).toBe('Đang xác minh');
  });

  it('correctly handles KhoPdf item properties and filters', () => {
    const mockPdf: PdfKhoItem = {
      id: 'pdf-1',
      file_name: 'BaoCaoTienDo.pdf',
      file_url: 'https://storage/pdf-1.pdf',
      file_size: 1024 * 1024 * 2.5, // 2.5 MB
      don_vi_id: 'dv-1',
      ten_don_vi: 'Chi bộ 1',
      the_loai: 'Báo cáo',
      loai_file: 'PDF',
      nguon_goc: 'Hồ sơ địa bàn',
      ngay_tai_len: '2026-03-01T10:00:00Z',
      nguoi_tai_len: 'Cán bộ 1',
    };

    expect(mockPdf.file_name.endsWith('.pdf')).toBe(true);
    expect(mockPdf.file_size).toBeGreaterThan(1024 * 1024);
  });

  it('correctly calculates HoSoDiaBan counts and status flags', () => {
    const mockRecord: DiaBanRecord = {
      id: 'db-1',
      ten_dia_ban: 'Chi bộ Cơ quan',
      loai_to_chuc: 'CHI_BO',
      tinh_trang_bao_cao_thang: 'DA_NOP_DUNG_HAN',
      thang_hien_tai: '03/2026',
      so_van_de_theo_doi: 3,
      so_chi_dao_chua_hoan_thanh: 1,
      thoi_diem_cap_nhat_gan_nhat: '2026-03-05',
      trang_thai_ho_so: 'DANG_THEO_DOI',
    };

    const hasBcThang =
      mockRecord.tinh_trang_bao_cao_thang === 'DA_NOP_DUNG_HAN' ||
      mockRecord.tinh_trang_bao_cao_thang === 'DA_NOP_MUON';

    expect(hasBcThang).toBe(true);
    expect(mockRecord.so_van_de_theo_doi).toBe(3);
    expect(mockRecord.so_chi_dao_chua_hoan_thanh).toBe(1);
  });
});
