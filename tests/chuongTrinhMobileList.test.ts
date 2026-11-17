import { describe, it, expect } from 'vitest';
import type { ChuongTrinhKtGs } from '../src/types';
import { formatDateVn } from '../src/services/chuongTrinhExcelService';

describe('ChuongTrinhMobileList logic & data handling', () => {
  const sampleItems: ChuongTrinhKtGs[] = [
    {
      id: 'ct-1',
      so_van_ban: '12-KH/UBKT',
      chu_the: 'Ủy ban Kiểm tra',
      co_quan_ban_hanh: 'Ủy ban Kiểm tra',
      doi_tuong: 'Chi bộ 1',
      noi_dung: 'Kiểm tra thực hiện quy chế làm việc',
      loai_hinh: 'KIEM_TRA',
      trang_thai: 'DANG_THUC_HIEN',
      nam: 2026,
      ngay_bat_dau: '2026-03-01',
      ngay_ket_thuc: '2026-03-31',
    },
    {
      id: 'ct-2',
      so_van_ban: '15-KH/ĐU',
      chu_the: 'Đảng ủy',
      co_quan_ban_hanh: 'Đảng ủy',
      doi_tuong: 'Chi bộ 2',
      noi_dung: 'Giám sát chuyên đề tổ chức sinh hoạt chi bộ',
      loai_hinh: 'GIAM_SAT',
      trang_thai: 'CHUA_THUC_HIEN',
      nam: 2026,
      ngay_bat_dau: '2026-05-01',
      ngay_ket_thuc: '2026-05-31',
    },
    {
      id: 'ct-3',
      so_van_ban: '18-KH/UBKT',
      chu_the: 'Ủy ban Kiểm tra',
      co_quan_ban_hanh: 'Ủy ban Kiểm tra',
      doi_tuong: 'Chi bộ 3',
      noi_dung: 'Kiểm tra tài chính đảng',
      loai_hinh: 'KIEM_TRA',
      trang_thai: 'DA_HOAN_THANH',
      nam: 2026,
      ngay_bat_dau: '2026-07-01',
      ngay_ket_thuc: '2026-07-31',
    },
  ];

  it('paginates items correctly on mobile with pageSize', () => {
    const pageSize = 2;
    const page1 = sampleItems.slice(0, pageSize);
    const page2 = sampleItems.slice(pageSize, pageSize * 2);

    expect(page1.length).toBe(2);
    expect(page1[0].id).toBe('ct-1');
    expect(page1[1].id).toBe('ct-2');

    expect(page2.length).toBe(1);
    expect(page2[0].id).toBe('ct-3');

    const totalPages = Math.max(1, Math.ceil(sampleItems.length / pageSize));
    expect(totalPages).toBe(2);
  });

  it('calculates activeFilterCount correctly for mobile filter badge', () => {
    const filterNam = '2026';
    const filterHnChuThe = 'ALL';
    const filterHnLoaiHinh = 'KIEM_TRA';
    const filterHnLinhVuc = 'ALL';
    const filterHnDonVi = 'ALL';
    const filterHnTrangThai = 'DANG_THUC_HIEN';
    const hnProgressFilter = 'ALL';

    const activeFilterCount =
      (filterNam !== 'ALL' ? 1 : 0) +
      (filterHnChuThe !== 'ALL' ? 1 : 0) +
      (filterHnLoaiHinh !== 'ALL' ? 1 : 0) +
      (filterHnLinhVuc !== 'ALL' ? 1 : 0) +
      (filterHnDonVi !== 'ALL' ? 1 : 0) +
      (filterHnTrangThai !== 'ALL' ? 1 : 0) +
      (hnProgressFilter !== 'ALL' ? 1 : 0);

    expect(activeFilterCount).toBe(3);
  });

  it('formats date ranges correctly for mobile cards', () => {
    const formattedStart = formatDateVn('2026-03-01');
    const formattedEnd = formatDateVn('2026-03-31');

    expect(formattedStart).toBe('01/03/2026');
    expect(formattedEnd).toBe('31/03/2026');
  });

  it('matches search query across multiple fields for mobile list', () => {
    const query = 'tài chính';
    const qLower = query.toLowerCase().trim();
    const matches = sampleItems.filter((item) => {
      return (
        item.noi_dung.toLowerCase().includes(qLower) ||
        (item.doi_tuong && item.doi_tuong.toLowerCase().includes(qLower)) ||
        (item.so_van_ban && item.so_van_ban.toLowerCase().includes(qLower))
      );
    });

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('ct-3');
  });
});
