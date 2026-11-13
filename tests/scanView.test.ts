import { describe, it, expect } from 'vitest';
import { filterScanPrograms, computeScanStats } from '../src/utils/scanView';
import type { ChuongTrinhKtGs, DonVi } from '../src/types';

describe('scanView - filterScanPrograms & computeScanStats', () => {
  const mockPrograms: Partial<ChuongTrinhKtGs>[] = [
    {
      id: 'ct-1',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Ủy ban Kiểm tra Đảng ủy',
      don_vi_id: 'dv-1',
      loai_hinh: 'KIEM_TRA',
      ngay_bat_dau: '2026-03-01',
      trang_thai: 'CHUA_THUC_HIEN',
      noi_dung: 'Kiểm tra công tác tài chính',
    },
    {
      id: 'ct-2',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Ban Thường vụ Đảng ủy',
      don_vi_id: 'dv-1',
      loai_hinh: 'GIAM_SAT',
      ngay_bat_dau: '2026-02-01',
      trang_thai: 'DANG_THUC_HIEN',
      noi_dung: 'Giám sát chuyên đề tổ chức đảng',
    },
    {
      id: 'ct-3',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Chi bộ 1',
      don_vi_id: 'dv-2',
      loai_hinh: 'KIEM_TRA',
      ngay_bat_dau: '2026-05-15',
      trang_thai: 'DA_HOAN_THANH',
      noi_dung: 'Kiểm tra việc thực hiện Nghị quyết Trung ương',
    },
    {
      id: 'ct-4-qua-han',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Chi bộ 2',
      don_vi_id: 'dv-3',
      loai_hinh: 'KIEM_TRA',
      ngay_bat_dau: '2026-01-10',
      trang_thai: 'QUA_HAN',
      noi_dung: 'Kiểm tra đảng viên khi có dấu hiệu vi phạm',
    },
    // Khác năm
    {
      id: 'ct-other-year',
      nam: 2025,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'UBKT Đảng ủy',
      don_vi_id: 'dv-1',
      loai_hinh: 'KIEM_TRA',
      ngay_bat_dau: '2025-04-01',
      trang_thai: 'DA_HOAN_THANH',
    },
    // Thuộc nhiệm kỳ (không phải HANG_NAM)
    {
      id: 'ct-nhiem-ky',
      nam: 2026,
      loai_chuong_trinh: 'NHIEM_KY',
      chu_the: 'Đảng ủy phường',
      don_vi_id: 'dv-1',
      loai_hinh: 'KIEM_TRA',
      ngay_bat_dau: '2026-06-01',
      trang_thai: 'CHUA_THUC_HIEN',
    },
    // Đã xóa bằng is_deleted
    {
      id: 'ct-deleted-1',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'UBKT',
      is_deleted: true,
    } as any,
    // Đã xóa bằng deleted_at
    {
      id: 'ct-deleted-2',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'UBKT',
      deleted_at: '2026-01-01T00:00:00Z',
    } as any,
    // Đã xóa bằng cờ deleted
    {
      id: 'ct-deleted-3',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'UBKT',
      deleted: true,
    } as any,
  ];

  it('1. Chỉ lấy chương trình HANG_NAM của đúng năm và bỏ qua bản ghi đã xóa', () => {
    const res = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], {}, 2026, true, '');
    expect(res.stats.tongCuoc).toBe(4);
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain('ct-1');
    expect(ids).toContain('ct-2');
    expect(ids).toContain('ct-3');
    expect(ids).toContain('ct-4-qua-han');
    expect(ids).not.toContain('ct-other-year');
    expect(ids).not.toContain('ct-nhiem-ky');
    expect(ids).not.toContain('ct-deleted-1');
    expect(ids).not.toContain('ct-deleted-2');
    expect(ids).not.toContain('ct-deleted-3');
  });

  it('2. Hiển thị đủ mọi cuộc bất kể trạng thái thực hiện (chưa thực hiện, đang thực hiện, hoàn thành, quá hạn)', () => {
    const res = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], {}, 2026, true, '');
    const statuses = res.items.map((i) => i.trang_thai);
    expect(statuses).toContain('CHUA_THUC_HIEN');
    expect(statuses).toContain('DANG_THUC_HIEN');
    expect(statuses).toContain('DA_HOAN_THANH');
    expect(statuses).toContain('QUA_HAN');
  });

  it('3. Mặc định ẩn cuộc đã tích, hiện lại khi bật công tắc (showScanned)', () => {
    const scannedMap = {
      'ct-2': { ngay: '2026-02-15T08:00:00Z', nguoi: 'Admin' },
    };
    // Khi showScanned = false: ct-2 bị ẩn khỏi danh sách
    const resHidden = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], scannedMap, 2026, false, '');
    expect(resHidden.items.map((i) => i.id)).toEqual(['ct-4-qua-han', 'ct-1', 'ct-3']);

    // Khi showScanned = true: ct-2 hiện lại kèm cờ isScanned
    const resShown = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], scannedMap, 2026, true, '');
    expect(resShown.items.map((i) => i.id)).toContain('ct-2');
    const item2 = resShown.items.find((i) => i.id === 'ct-2');
    expect(item2?.isScanned).toBe(true);
    expect(item2?.scanInfo?.nguoi).toBe('Admin');
  });

  it('4. Tìm kiếm không phân biệt dấu tiếng Việt', () => {
    // Tìm "tai chinh" khớp "tài chính"
    const res1 = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], {}, 2026, true, 'tai chinh');
    expect(res1.items.length).toBe(1);
    expect(res1.items[0].id).toBe('ct-1');

    // Tìm theo loại hình không dấu "giam sat" khớp "Giám sát"
    const res2 = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], {}, 2026, true, 'giam sat');
    expect(res2.items.length).toBe(1);
    expect(res2.items[0].id).toBe('ct-2');

    // Tìm trạng thái "qua han" khớp "QUA_HAN"
    const res3 = filterScanPrograms(mockPrograms as ChuongTrinhKtGs[], {}, 2026, true, 'qua han');
    expect(res3.items.length).toBe(1);
    expect(res3.items[0].id).toBe('ct-4-qua-han');
  });

  it('5. Chi bộ có 3 cuộc: tích 2 thì CHƯA tính đủ, tích nốt cuộc thứ 3 mới tính đủ', () => {
    const chiBoPrograms: Partial<ChuongTrinhKtGs>[] = [
      { id: 'c1', nam: 2026, loai_chuong_trinh: 'HANG_NAM', don_vi_id: 'cb-A', chu_the: 'Chi bộ A' },
      { id: 'c2', nam: 2026, loai_chuong_trinh: 'HANG_NAM', don_vi_id: 'cb-A', chu_the: 'Chi bộ A' },
      { id: 'c3', nam: 2026, loai_chuong_trinh: 'HANG_NAM', don_vi_id: 'cb-A', chu_the: 'Chi bộ A' },
    ];

    // Chỉ tích 2 cuộc
    const scan2 = { c1: true, c2: true };
    const stats2 = computeScanStats(chiBoPrograms as ChuongTrinhKtGs[], scan2, 2026);
    expect(stats2.tongChiBo).toBe(1);
    expect(stats2.chiBoDaScanDu).toBe(0); // Chưa tính đủ
    expect(stats2.tyLeChiBo).toBe(0);
    expect(stats2.daScanCuoc).toBe(2);
    expect(stats2.tongCuoc).toBe(3);

    // Tích nốt cuộc thứ 3
    const scan3 = { c1: true, c2: true, c3: true };
    const stats3 = computeScanStats(chiBoPrograms as ChuongTrinhKtGs[], scan3, 2026);
    expect(stats3.chiBoDaScanDu).toBe(1); // Đã tính đủ
    expect(stats3.tyLeChiBo).toBe(100);
    expect(stats3.daScanCuoc).toBe(3);
  });

  it('6. Tỷ lệ chi bộ và tỷ lệ cuộc tính đúng theo ví dụ mô tả (30 chi bộ, 12 đủ = 40%; 74 cuộc, 33 đã tích = 44,6%)', () => {
    // 30 chi bộ, 12 đủ = 40%
    const tongChiBo = 30;
    const chiBoDaScanDu = 12;
    const tyLeChiBo = Math.round((chiBoDaScanDu / tongChiBo) * 1000) / 10;
    expect(tyLeChiBo).toBe(40);

    // 74 cuộc, 33 đã tích = 44,6%
    const tongCuoc = 74;
    const daScanCuoc = 33;
    const tyLeCuoc = Math.round((daScanCuoc / tongCuoc) * 1000) / 10;
    expect(tyLeCuoc).toBe(44.6);

    // Kiểm tra trực tiếp qua hàm computeScanStats với mock data tạo 30 chi bộ
    const syntheticPrograms: Partial<ChuongTrinhKtGs>[] = [];
    const syntheticScanned: Record<string, boolean> = {};

    for (let i = 1; i <= 30; i++) {
      const pId = `syn-ct-${i}`;
      syntheticPrograms.push({
        id: pId,
        nam: 2026,
        loai_chuong_trinh: 'HANG_NAM',
        don_vi_id: `unit-${i}`,
        chu_the: `Chi bộ ${i}`,
      });
      if (i <= 12) {
        syntheticScanned[pId] = true;
      }
    }

    const stats = computeScanStats(syntheticPrograms as ChuongTrinhKtGs[], syntheticScanned, 2026);
    expect(stats.tongChiBo).toBe(30);
    expect(stats.chiBoDaScanDu).toBe(12);
    expect(stats.tyLeChiBo).toBe(40);
  });

  it('7. Hai cách viết tên cùng một chi bộ ("Chi bộ TDP Hoàng Xá 1" và "Chi bộ Tổ dân phố Hoàng Xá 1") chỉ tính một chi bộ', () => {
    const p1: Partial<ChuongTrinhKtGs> = {
      id: 'hx-1',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Chi bộ TDP Hoàng Xá 1',
    };
    const p2: Partial<ChuongTrinhKtGs> = {
      id: 'hx-2',
      nam: 2026,
      loai_chuong_trinh: 'HANG_NAM',
      chu_the: 'Chi bộ Tổ dân phố Hoàng Xá 1',
    };

    const stats = computeScanStats([p1, p2] as ChuongTrinhKtGs[], {}, 2026);
    expect(stats.tongChiBo).toBe(1);
    expect(stats.tongCuoc).toBe(2);

    // Nếu cung cấp danh mục DonVi có đơn vị "Tổ dân phố Hoàng Xá 1"
    const donViList: Partial<DonVi>[] = [
      { id: 'dv-hx1', ten: 'Tổ dân phố Hoàng Xá 1', deleted_at: null },
    ];
    const statsWithUnits = computeScanStats([p1, p2] as ChuongTrinhKtGs[], {}, 2026, donViList as DonVi[]);
    expect(statsWithUnits.tongChiBo).toBe(1);
    expect(statsWithUnits.soCuocChuaGanDonVi).toBe(0);
    expect(statsWithUnits.theoChiBo.has('dv-hx1')).toBe(true);
  });

  it('8. Mẫu số bằng 0 không gây chia cho 0', () => {
    const statsEmpty = computeScanStats([], {}, 2026);
    expect(statsEmpty.tongCuoc).toBe(0);
    expect(statsEmpty.daScanCuoc).toBe(0);
    expect(statsEmpty.tyLeCuoc).toBe(0);
    expect(statsEmpty.tongChiBo).toBe(0);
    expect(statsEmpty.chiBoDaScanDu).toBe(0);
    expect(statsEmpty.tyLeChiBo).toBe(0);
    expect(Number.isFinite(statsEmpty.tyLeCuoc)).toBe(true);
    expect(Number.isFinite(statsEmpty.tyLeChiBo)).toBe(true);
  });

  it('9. Thống kê KHÔNG bị ảnh hưởng bởi từ khóa tìm kiếm hay công tắc hiện đã scan', () => {
    const scannedMap = { 'ct-1': true };
    // Lọc với từ khóa hẹp và ẩn đã scan
    const resFiltered = filterScanPrograms(
      mockPrograms as ChuongTrinhKtGs[],
      scannedMap,
      2026,
      false,
      'tai chinh'
    );
    // Danh sách items chỉ còn 0 vì ct-1 đã scan và bị ẩn
    expect(resFiltered.items.length).toBe(0);
    // Nhưng stats vẫn giữ nguyên thống kê của cả năm 2026
    expect(resFiltered.stats.tongCuoc).toBe(4);
    expect(resFiltered.stats.daScanCuoc).toBe(1);
    expect(resFiltered.stats.tongChiBo).toBe(3);
  });
});
