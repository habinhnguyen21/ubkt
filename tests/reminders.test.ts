import { describe, it, expect } from 'vitest';
import {
  parseCalendarDate,
  daysBetweenCalendar,
  getVietnamDateParts,
  computeReminders,
  formatDateVi,
  partsToYmd,
} from '../src/utils/reminders';
import type { ChuongTrinhKtGs, DonThu, User } from '../src/types';

describe('Reminders Utility & Timezone Consistency', () => {
  it('1. parseCalendarDate phân tích đúng mọi định dạng ngày (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO)', () => {
    expect(parseCalendarDate('2026-11-25')).toEqual({ year: 2026, month: 11, day: 25 });
    expect(parseCalendarDate('2026-11-25 14:30:00')).toEqual({ year: 2026, month: 11, day: 25 });
    expect(parseCalendarDate('25/11/2026')).toEqual({ year: 2026, month: 11, day: 25 });
    expect(parseCalendarDate('25-11-2026')).toEqual({ year: 2026, month: 11, day: 25 });
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate('invalid-date')).toBeNull();
  });

  it('2. daysBetweenCalendar tính số ngày chính xác tuyệt đối không bị lệch bởi múi giờ', () => {
    const today = { year: 2026, month: 11, day: 18 };

    // Cùng ngày -> 0
    expect(daysBetweenCalendar({ year: 2026, month: 11, day: 18 }, today)).toBe(0);

    // Hạn còn 7 ngày
    expect(daysBetweenCalendar({ year: 2026, month: 11, day: 25 }, today)).toBe(7);

    // Quá hạn 2 ngày -> -2
    expect(daysBetweenCalendar({ year: 2026, month: 11, day: 16 }, today)).toBe(-2);

    // Chuyển giao qua tháng (30/11 -> 05/12 là 5 ngày)
    expect(
      daysBetweenCalendar(
        { year: 2026, month: 12, day: 5 },
        { year: 2026, month: 11, day: 30 }
      )
    ).toBe(5);

    // Chuyển giao qua năm (31/12/2026 -> 02/01/2027 là 2 ngày)
    expect(
      daysBetweenCalendar(
        { year: 2027, month: 1, day: 2 },
        { year: 2026, month: 12, day: 31 }
      )
    ).toBe(2);
  });

  it('3. getVietnamDateParts chuẩn hóa ngày giờ sang múi giờ Việt Nam (UTC+7)', () => {
    // 2026-11-18 18:00:00 UTC = 2026-11-19 01:00:00 UTC+7 (Việt Nam)
    const utcDate = new Date('2026-11-18T18:00:00.000Z');
    const vnParts = getVietnamDateParts(utcDate);
    expect(vnParts.year).toBe(2026);
    expect(vnParts.month).toBe(11);
    expect(vnParts.day).toBe(19);
  });

  it('4. formatDateVi và partsToYmd định dạng chuỗi ngày chuẩn', () => {
    expect(formatDateVi('2026-11-25')).toBe('25/11/2026');
    expect(partsToYmd({ year: 2026, month: 5, day: 9 })).toBe('2026-05-09');
  });

  it('5. computeReminders tính đúng danh sách việc quá hạn và sắp đến hạn', () => {
    const mockUser: User = {
      id: 'uid-admin-01',
      ten_dang_nhap: 'admin',
      ho_ten: 'Quản trị viên',
      vai_tro: 'ADMIN',
      trang_thai: 1,
      must_change_password: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    const mockChuongTrinh: ChuongTrinhKtGs[] = [
      {
        id: 'ct-overdue',
        chu_the: 'Chi bộ 1',
        noi_dung: 'Kiểm tra tài chính đảng',
        nam: 2026,
        trang_thai: 'DANG_THUC_HIEN',
        ngay_ket_thuc: '2026-11-10', // Đã quá hạn so với 2026-11-18
        loai_chuong_trinh: 'HANG_NAM',
      },
      {
        id: 'ct-soon',
        chu_the: 'Chi bộ 2',
        noi_dung: 'Giám sát chuyên đề',
        nam: 2026,
        trang_thai: 'DANG_THUC_HIEN',
        ngay_ket_thuc: '2026-11-22', // Còn 4 ngày (sắp đến hạn <= 7 ngày)
        loai_chuong_trinh: 'HANG_NAM',
      },
      {
        id: 'ct-far',
        chu_the: 'Chi bộ 3',
        noi_dung: 'Kiểm tra công tác cán bộ',
        nam: 2026,
        trang_thai: 'DANG_THUC_HIEN',
        ngay_ket_thuc: '2026-12-30', // Còn hơn 1 tháng -> không nhắc
        loai_chuong_trinh: 'HANG_NAM',
      },
      {
        id: 'ct-done',
        chu_the: 'Chi bộ 4',
        noi_dung: 'Đã hoàn thành',
        nam: 2026,
        trang_thai: 'DA_HOAN_THANH',
        ngay_ket_thuc: '2026-11-01',
        loai_chuong_trinh: 'HANG_NAM',
      },
    ];

    const mockDonThu: DonThu[] = [
      {
        id: 'dt-soon',
        ma_don: 'DT-001',
        loai_don: 'KHIEU_NAI',
        nguoi_gui: 'Nguyễn Văn A',
        noi_dung: 'Đơn thư khiếu nại đất đai',
        trang_thai: 'Đang xử lý',
        ngay_tiep_nhan: '2026-10-25',
        thoi_han_quy_dinh: 30, // Hạn = 2026-11-24 -> còn 6 ngày (sắp đến hạn)
        can_bo_phu_trach: 'Quản trị viên',
      },
    ];

    const fixedNow = new Date('2026-11-18T10:00:00+07:00');
    const reminders = computeReminders({
      user: mockUser,
      chuongTrinh: mockChuongTrinh,
      donThu: mockDonThu,
      donVi: [],
      phanCong: [],
      now: fixedNow,
    });

    // Kỳ vọng có 3 mục: 1 quá hạn, 2 sắp đến hạn
    expect(reminders.length).toBe(3);

    // Mục quá hạn phải được sắp xếp lên đầu
    expect(reminders[0].id).toBe('ct-overdue');
    expect(reminders[0].severity).toBe('OVERDUE');
    expect(reminders[0].daysLeft).toBe(-8);

    // Hai mục sắp đến hạn
    const soonItems = reminders.filter((r) => r.severity === 'SOON');
    expect(soonItems.length).toBe(2);
    expect(soonItems.some((r) => r.id === 'ct-soon')).toBe(true);
    expect(soonItems.some((r) => r.id === 'dt-soon')).toBe(true);
  });
});
