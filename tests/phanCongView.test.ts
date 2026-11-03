import { describe, it, expect } from 'vitest';
import {
  matchesSearch,
  getWaitingUnits,
  computePhanCongStats,
  canModifyAssignments,
  assignUnitsToOfficer,
  unassignUnitFromOfficer,
  findBestMatchingUser,
  transferAssignmentToUser,
  deleteAssignment,
  removeInvalidUnitsFromAssignment,
  cleanAllOrphanWarnings,
} from '../src/utils/phanCongView';
import type { DonVi, PhanCongDiaBan, User } from '../src/types';

describe('phanCongView - Kiểm tra các hàm thuần phân công quản lý', () => {
  const mockUnits: DonVi[] = [
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
      ten: 'Chi bộ Tổ dân phố 2',
      loai: 'CHI_BO',
      cap: 'CO_SO',
      thu_tu: 2,
      trang_thai: 'HOAT_DONG',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'dv-3',
      ma: 'CB-03',
      ten: 'Chi bộ TDP 3',
      loai: 'CHI_BO',
      cap: 'CO_SO',
      thu_tu: 3,
      trang_thai: 'HOAT_DONG',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'dv-deleted',
      ma: 'CB-DEL',
      ten: 'Chi bộ Đã Giải Thể',
      loai: 'CHI_BO',
      cap: 'CO_SO',
      thu_tu: 99,
      trang_thai: 'NGUNG_HOAT_DONG',
      deleted_at: '2026-02-01',
      created_at: '2026-01-01',
      updated_at: '2026-02-01',
    },
  ];

  const mockUsers: User[] = [
    {
      id: 'u-admin',
      ten_dang_nhap: 'admin',
      ho_ten: 'Quản trị viên',
      vai_tro: 'ADMIN',
      trang_thai: 1,
      must_change_password: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'u-bientap',
      ten_dang_nhap: 'bientap',
      ho_ten: 'Nguyễn Văn A',
      vai_tro: 'BIEN_TAP',
      trang_thai: 1,
      must_change_password: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  const mockAssignments: PhanCongDiaBan[] = [
    {
      id: 'pc-1',
      user_id: 'u-bientap',
      user_name: 'Nguyễn Văn A',
      don_vi_ids: ['dv-1'], // dv-1 đã được giao
      updated_at: '2026-01-01',
    },
  ];

  it('1. Đơn vị đã giao không xuất hiện trong danh sách chờ giao (mặc định)', () => {
    const waiting = getWaitingUnits(mockUnits, mockAssignments, { showAllAssigned: false });
    const waitingIds = waiting.map((u) => u.id);

    // dv-1 đã giao => KHÔNG được có trong danh sách chờ giao
    expect(waitingIds).not.toContain('dv-1');

    // dv-2 và dv-3 chưa giao => CÓ trong danh sách chờ giao
    expect(waitingIds).toContain('dv-2');
    expect(waitingIds).toContain('dv-3');
  });

  it('2. Đơn vị đã xóa (deleted_at) không xuất hiện trong danh sách chờ giao', () => {
    const waiting = getWaitingUnits(mockUnits, mockAssignments, { showAllAssigned: true });
    const waitingIds = waiting.map((u) => u.id);

    expect(waitingIds).not.toContain('dv-deleted');
  });

  it('3. Tìm kiếm không dấu và hiểu TDP tương đương "tổ dân phố"', () => {
    // Tìm "tdp 2" khớp với "Chi bộ Tổ dân phố 2"
    expect(matchesSearch('Chi bộ Tổ dân phố 2', 'tdp 2')).toBe(true);
    expect(matchesSearch('Chi bộ Tổ dân phố 2', 'TDP 2')).toBe(true);

    // Tìm "to dan pho 3" khớp với "Chi bộ TDP 3"
    expect(matchesSearch('Chi bộ TDP 3', 'to dan pho 3')).toBe(true);
    expect(matchesSearch('Chi bộ TDP 3', 'Tổ dân phố 3')).toBe(true);

    // Không phân biệt hoa thường và dấu tiếng Việt
    expect(matchesSearch('Nguyễn Văn Biên Tập', 'nguyen van')).toBe(true);
    expect(matchesSearch('Nguyễn Văn Biên Tập', 'BIEN TAP')).toBe(true);
  });

  it('4. Giao việc và Hoàn tác khôi phục đúng danh sách phân công', () => {
    // Ban đầu: u-bientap đang giữ ['dv-1']
    let current = [...mockAssignments];

    // Giao thêm dv-2 cho u-bientap
    current = assignUnitsToOfficer(current, 'u-bientap', 'Nguyễn Văn A', ['dv-2']);
    const afterAssign = current.find((a) => a.user_id === 'u-bientap');
    expect(afterAssign?.don_vi_ids).toContain('dv-1');
    expect(afterAssign?.don_vi_ids).toContain('dv-2');

    // Hoàn tác: gỡ dv-2 khỏi u-bientap
    current = unassignUnitFromOfficer(current, 'u-bientap', 'dv-2');
    const afterUndo = current.find((a) => a.user_id === 'u-bientap');
    expect(afterUndo?.don_vi_ids).toContain('dv-1');
    expect(afterUndo?.don_vi_ids).not.toContain('dv-2');
  });

  it('5. Vai trò không phải ADMIN không được phép thay đổi phân công', () => {
    expect(canModifyAssignments(mockUsers[0])).toBe(true); // ADMIN => true
    expect(canModifyAssignments(mockUsers[1])).toBe(false); // BIEN_TAP => false
    expect(canModifyAssignments(null)).toBe(false); // Chưa đăng nhập => false
  });

  it('6. Tính toán thống kê và cảnh báo chính xác', () => {
    const stats = computePhanCongStats(mockUnits, mockAssignments, mockUsers);
    // Tổng số đơn vị hoạt động: 3 (dv-1, dv-2, dv-3; dv-deleted bị loại)
    expect(stats.totalUnits).toBe(3);
    // Đã phân công: 1 (dv-1)
    expect(stats.assignedCount).toBe(1);
    // Chưa phân công: 2 (dv-2, dv-3)
    expect(stats.unassignedCount).toBe(2);
    expect(stats.warnings.unassignedCount).toBe(2);
  });

  it('7. Gợi ý tài khoản trùng họ tên (bỏ dấu, hoa thường, tiền tố)', () => {
    // mockUsers có: 'Nguyễn Văn A'
    const suggested1 = findBestMatchingUser('Đ/c Nguyễn Văn A', mockUsers);
    expect(suggested1?.id).toBe('u-bientap');

    const suggested2 = findBestMatchingUser('nguyen van a', mockUsers);
    expect(suggested2?.id).toBe('u-bientap');

    const suggested3 = findBestMatchingUser('Đồng chí Quản trị', mockUsers);
    expect(suggested3?.id).toBe('u-admin');

    const notFound = findBestMatchingUser('Đ/c Trần Không Tồn Tại', mockUsers);
    expect(notFound).toBeUndefined();
  });

  it('8. Chuyển phân công của cán bộ không còn tồn tại sang tài khoản khác', () => {
    const orphanAssigns: PhanCongDiaBan[] = [
      {
        id: 'mock-user-1',
        user_id: 'mock-user-1',
        user_name: 'Đ/c Nguyễn Văn Cũ',
        don_vi_ids: ['dv-2', 'dv-3'],
        updated_at: '2026-01-01',
      },
      {
        id: 'u-bientap',
        user_id: 'u-bientap',
        user_name: 'Nguyễn Văn A',
        don_vi_ids: ['dv-1'],
        updated_at: '2026-01-01',
      },
    ];

    // Chuyển sang u-bientap (người đã có phân công dv-1)
    const targetUser = mockUsers.find((u) => u.id === 'u-bientap')!;
    const transferred = transferAssignmentToUser(orphanAssigns, 'mock-user-1', targetUser);

    // Bản ghi cũ mock-user-1 bị xóa
    expect(transferred.find((a) => a.user_id === 'mock-user-1')).toBeUndefined();

    // Bản ghi u-bientap được gộp các đơn vị không trùng lặp
    const merged = transferred.find((a) => a.user_id === 'u-bientap');
    expect(merged?.don_vi_ids).toEqual(['dv-1', 'dv-2', 'dv-3']);
  });

  it('9. Xóa bản phân công của cán bộ không còn tồn tại', () => {
    const list: PhanCongDiaBan[] = [
      {
        id: 'mock-user-1',
        user_id: 'mock-user-1',
        user_name: 'Cán bộ rác',
        don_vi_ids: ['dv-2'],
        updated_at: '2026-01-01',
      },
      {
        id: 'u-bientap',
        user_id: 'u-bientap',
        user_name: 'Nguyễn Văn A',
        don_vi_ids: ['dv-1'],
        updated_at: '2026-01-01',
      },
    ];

    const afterDelete = deleteAssignment(list, 'mock-user-1');
    expect(afterDelete.length).toBe(1);
    expect(afterDelete.find((a) => a.user_id === 'mock-user-1')).toBeUndefined();
    expect(afterDelete[0].user_id).toBe('u-bientap');
  });

  it('10. Gỡ đơn vị không tồn tại khỏi phân công', () => {
    const list: PhanCongDiaBan[] = [
      {
        id: 'u-bientap',
        user_id: 'u-bientap',
        user_name: 'Nguyễn Văn A',
        don_vi_ids: ['dv-1', 'dv-deleted-id', 'dv-fake-id'],
        updated_at: '2026-01-01',
      },
    ];

    const cleaned = removeInvalidUnitsFromAssignment(list, 'u-bientap', ['dv-deleted-id', 'dv-fake-id']);
    expect(cleaned[0].don_vi_ids).toEqual(['dv-1']);
  });

  it('11. Dọn tất cả cảnh báo phân công hàng loạt', () => {
    const dirtyAssignments: PhanCongDiaBan[] = [
      {
        id: 'mock-ghost-user',
        user_id: 'mock-ghost-user',
        user_name: 'Người ma',
        don_vi_ids: ['dv-2', 'dv-deleted'],
        updated_at: '2026-01-01',
      },
      {
        id: 'u-bientap',
        user_id: 'u-bientap',
        user_name: 'Nguyễn Văn A',
        don_vi_ids: ['dv-1', 'dv-deleted'],
        updated_at: '2026-01-01',
      },
    ];

    const result = cleanAllOrphanWarnings(dirtyAssignments, mockUnits, mockUsers);

    // Bản ghi mock-ghost-user bị xóa
    expect(result.removedAssignmentsCount).toBe(1);
    expect(result.removedOfficers).toContain('Người ma');

    // Đơn vị dv-2 thuộc mock-ghost-user trở về chưa có người phụ trách
    expect(result.affectedUnitIds).toContain('dv-2');

    // dv-deleted bị gỡ khỏi u-bientap
    expect(result.removedUnitsCount).toBe(1);

    // Danh sách sau khi dọn chỉ còn u-bientap với dv-1 hợp lệ
    expect(result.cleanedAssignments.length).toBe(1);
    expect(result.cleanedAssignments[0].user_id).toBe('u-bientap');
    expect(result.cleanedAssignments[0].don_vi_ids).toEqual(['dv-1']);
  });
});
