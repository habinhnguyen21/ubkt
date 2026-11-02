import { describe, it, expect } from 'vitest';
import {
  generateComprehensiveReport,
  filterChuongTrinh,
} from '../src/services/reportService';
import type {
  ChuongTrinhKtGs,
  DonThu,
  DonVi,
  PhanCongDiaBan,
  User,
} from '../src/types';

describe('reportService - Kiểm tra tính đúng đắn của logic báo cáo thống kê', () => {
  const mockDonViList: DonVi[] = [
    {
      id: 'dv-1',
      ma: 'CB-01',
      ten: 'Chi bộ 1',
      loai: 'CHI_BO',
      cap: 'CO_SO',
      thu_tu: 1,
      trang_thai: 'HOAT_DONG',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'dv-2',
      ma: 'CB-02',
      ten: 'Chi bộ 2',
      loai: 'CHI_BO',
      cap: 'CO_SO',
      thu_tu: 2,
      trang_thai: 'HOAT_DONG',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const mockUsers: User[] = [
    {
      id: 'admin-1',
      ten_dang_nhap: 'admin',
      ho_ten: 'Quản trị viên',
      vai_tro: 'ADMIN',
      trang_thai: 1,
      must_change_password: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'bientap-1',
      ten_dang_nhap: 'bientap1',
      ho_ten: 'Nguyễn Văn Biên Tập',
      vai_tro: 'BIEN_TAP',
      trang_thai: 1,
      must_change_password: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const mockPhanCong: PhanCongDiaBan[] = [
    {
      id: 'pc-1',
      user_id: 'bientap-1',
      user_name: 'Nguyễn Văn Biên Tập',
      don_vi_ids: ['dv-1'],
      updated_at: '2026-01-01',
    },
  ];

  const mockChuongTrinh: ChuongTrinhKtGs[] = [
    {
      id: 'ct-1',
      nam: 2026,
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: 'dv-1',
      ten_don_vi: 'Chi bộ 1',
      loai_hinh: 'KIEM_TRA',
      noi_dung: 'Kiểm tra tài chính đảng',
      ngay_bat_dau: '2026-03-01',
      ngay_ket_thuc: '2026-03-25',
      trang_thai: 'DA_HOAN_THANH',
      linh_vuc: 'Tài chính đảng',
      file_pdf_ten: null,
      file_pdf_url: null,
      ghi_chu_pdf: null,
      so_van_ban: '01-KH/UBKT',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
    },
    {
      id: 'ct-2',
      nam: 2026,
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: 'dv-2',
      ten_don_vi: 'Chi bộ 2',
      loai_hinh: 'GIAM_SAT',
      noi_dung: 'Giám sát chuyên đề sinh hoạt',
      ngay_bat_dau: '2026-03-15',
      ngay_ket_thuc: '2026-04-10',
      trang_thai: 'DANG_THUC_HIEN',
      linh_vuc: 'Xây dựng Đảng',
      file_pdf_ten: null,
      file_pdf_url: null,
      ghi_chu_pdf: null,
      so_van_ban: '02-KH/UBKT',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
    },
    {
      id: 'ct-3',
      nam: 2026,
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: null, // Chưa gắn đơn vị
      ten_don_vi: null,
      loai_hinh: 'KIEM_TRA',
      noi_dung: 'Kiểm tra dấu hiệu vi phạm',
      ngay_bat_dau: '2026-03-31',
      ngay_ket_thuc: '2026-04-30',
      trang_thai: 'CHUA_THUC_HIEN',
      linh_vuc: 'Phòng chống tham nhũng',
      file_pdf_ten: null,
      file_pdf_url: null,
      ghi_chu_pdf: null,
      so_van_ban: '03-KH/UBKT',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
    },
    {
      id: 'ct-4-other-date',
      nam: 2026,
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: 'dv-1',
      ten_don_vi: 'Chi bộ 1',
      loai_hinh: 'KIEM_TRA',
      noi_dung: 'Kiểm tra quý 4',
      ngay_bat_dau: '2026-10-01',
      ngay_ket_thuc: '2026-10-20',
      trang_thai: 'CHUA_THUC_HIEN',
      linh_vuc: 'Tài chính đảng',
      file_pdf_ten: null,
      file_pdf_url: null,
      ghi_chu_pdf: null,
      so_van_ban: '04-KH/UBKT',
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-10T00:00:00Z',
    },
  ];

  const mockDonThu: DonThu[] = [
    {
      id: 'dt-1',
      ma_don: 'DT-2026-001',
      ngay_tiep_nhan: '2026-03-05',
      loai_don: 'TO_CAO',
      linh_vuc: 'Đất đai',
      doi_tuong_lien_quan: 'Đảng viên A',
      phan_loai_xu_ly: 'THUOC_THAM_QUYEN',
      huong_xu_ly: 'THU_LY_GIAI_QUYET',
      thoi_han_quy_dinh: 30,
      can_bo_phu_trach: 'Đ/c Nguyễn Văn Biên Tập',
      trang_thai: 'Đang xử lý',
    },
    {
      id: 'dt-2',
      ma_don: 'DT-2026-002',
      ngay_tiep_nhan: '2026-01-01',
      loai_don: 'KHIEU_NAI',
      linh_vuc: 'Chính sách',
      doi_tuong_lien_quan: 'Đảng viên B',
      phan_loai_xu_ly: 'THUOC_THAM_QUYEN',
      huong_xu_ly: 'DA_GIAI_QUYET',
      thoi_han_quy_dinh: 30,
      can_bo_phu_trach: 'Đ/c Khác',
      trang_thai: 'Đã hoàn thành',
      ngay_hoan_thanh: '2026-01-20',
    },
  ];

  // 1. Kiểm tra tổng các nhóm phải bằng tổng chương trình
  it('1. Tổng các nhóm (theo đơn vị, trạng thái, loại hình, lĩnh vực) phải bằng tổng chương trình', () => {
    const report = generateComprehensiveReport({
      chuongTrinhList: mockChuongTrinh,
      donThuList: mockDonThu,
      donViList: mockDonViList,
      phanCongList: mockPhanCong,
      userList: mockUsers,
      currentUser: mockUsers[0], // ADMIN
      filters: { nam: 2026 },
    });

    const total = report.kpi.tongChuongTrinh;
    expect(total).toBe(4);

    // Tổng theo loại hình = tổng chương trình
    const sumLoaiHinh = report.theoLoaiHinh.reduce((s, x) => s + x.count, 0);
    expect(sumLoaiHinh).toBe(total);

    // Tổng theo trạng thái = tổng chương trình
    const sumTrangThai = report.theoTrangThai.reduce((s, x) => s + x.count, 0);
    expect(sumTrangThai).toBe(total);

    // Tổng theo lĩnh vực = tổng chương trình
    const sumLinhVuc = report.theoLinhVuc.reduce((s, x) => s + x.count, 0);
    expect(sumLinhVuc).toBe(total);

    // Tổng theo đơn vị (bao gồm dòng Chưa gắn đơn vị) = tổng chương trình
    const sumDonVi = report.theoDonVi.reduce((s, x) => s + x.tong, 0);
    expect(sumDonVi).toBe(total);
  });

  // 2. Kiểm tra dòng "Chưa gắn đơn vị"
  it('2. Chương trình không có don_vi_id phải được gom vào dòng "Chưa gắn đơn vị" để tổng vẫn khớp', () => {
    const report = generateComprehensiveReport({
      chuongTrinhList: mockChuongTrinh,
      donThuList: mockDonThu,
      donViList: mockDonViList,
      phanCongList: mockPhanCong,
      userList: mockUsers,
      currentUser: mockUsers[0],
      filters: { nam: 2026 },
    });

    const unassigned = report.theoDonVi.find((d) => d.donViId === 'UNASSIGNED');
    expect(unassigned).toBeDefined();
    expect(unassigned?.tenDonVi).toBe('Chưa gắn đơn vị');
    expect(unassigned?.tong).toBe(1); // ct-3 không có don_vi_id

    // Đảm bảo tổng cả danh sách đơn vị vẫn khớp đúng 4
    const totalUnitsSum = report.theoDonVi.reduce((s, x) => s + x.tong, 0);
    expect(totalUnitsSum).toBe(report.kpi.tongChuongTrinh);
  });

  // 3. Đúng ranh giới ngày
  it('3. Lọc theo khoảng thời gian phải chính xác ranh giới (>= tuNgay và <= denNgay) và ngày chốt', () => {
    // Khoảng [2026-03-01, 2026-03-31]: bao gồm ct-1 (03-01), ct-2 (03-15), ct-3 (03-31)
    // Loại bỏ ct-4 (10-01)
    const filtered = filterChuongTrinh(mockChuongTrinh, {
      tuNgay: '2026-03-01',
      denNgay: '2026-03-31',
    });

    expect(filtered.length).toBe(3);
    const ids = filtered.map((c) => c.id);
    expect(ids).toContain('ct-1'); // Đúng mốc bắt đầu
    expect(ids).toContain('ct-2');
    expect(ids).toContain('ct-3'); // Đúng mốc kết thúc
    expect(ids).not.toContain('ct-4-other-date');

    // Kiểm tra ngày chốt số liệu: chốt ngày 2026-03-20
    // ct-3 (ngay_bat_dau: 2026-03-31) sẽ bị loại
    const chotFiltered = filterChuongTrinh(mockChuongTrinh, {
      tuNgay: '2026-03-01',
      ngayChot: '2026-03-20',
    });
    expect(chotFiltered.map((c) => c.id)).toEqual(['ct-1', 'ct-2']);
  });

  // 4. Phân quyền BIEN_TAP
  it('4. Phân quyền: ADMIN/XEM thấy tất cả, BIEN_TAP chỉ thấy dữ liệu đơn vị được phân công', () => {
    // ADMIN thấy đủ 4 chương trình và 2 đơn thư
    const adminReport = generateComprehensiveReport({
      chuongTrinhList: mockChuongTrinh,
      donThuList: mockDonThu,
      donViList: mockDonViList,
      phanCongList: mockPhanCong,
      userList: mockUsers,
      currentUser: mockUsers[0], // ADMIN
      filters: { nam: 2026 },
    });
    expect(adminReport.kpi.tongChuongTrinh).toBe(4);
    expect(adminReport.kpi.tongDonThu).toBe(2);

    // BIEN_TAP (chỉ được phân công dv-1)
    const bienTapUser = mockUsers[1];
    const bienTapReport = generateComprehensiveReport({
      chuongTrinhList: mockChuongTrinh,
      donThuList: mockDonThu,
      donViList: mockDonViList,
      phanCongList: mockPhanCong,
      userList: mockUsers,
      currentUser: bienTapUser, // BIEN_TAP
      filters: { nam: 2026 },
    });

    // Chỉ thấy các chương trình thuộc dv-1: ct-1 và ct-4
    expect(bienTapReport.kpi.tongChuongTrinh).toBe(2);
    expect(bienTapReport.filteredChuongTrinh.map((c) => c.id)).toEqual(['ct-1', 'ct-4-other-date']);

    // Chỉ thấy đơn thư giao cho chính mình: dt-1
    expect(bienTapReport.kpi.tongDonThu).toBe(1);
    expect(bienTapReport.filteredDonThu[0].id).toBe('dt-1');
  });
});
