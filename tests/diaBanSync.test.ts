import { describe, it, expect } from 'vitest';
import { deriveOfficerFields, deriveAllOfficerFields, getUserAssignmentImpact } from '../src/utils/diaBanSync';
import type { DiaBanRecord, PhanCongDiaBan, User, DonVi } from '../src/types';

describe('diaBanSync - Đồng bộ cán bộ phụ trách trên hồ sơ địa bàn', () => {
  const mockUsers: User[] = [
    {
      id: 'u-1',
      ten_dang_nhap: 'canbo1',
      ho_ten: 'Nguyễn Văn Một',
      vai_tro: 'BIEN_TAP',
      chuc_danh: 'Ủy viên UBKT',
      trang_thai: 1, // Hoạt động
    },
    {
      id: 'u-2',
      ten_dang_nhap: 'canbo2',
      ho_ten: 'Trần Thị Hai',
      vai_tro: 'BIEN_TAP',
      chuc_danh: 'Phó Chủ nhiệm UBKT',
      trang_thai: 1, // Hoạt động
    },
    {
      id: 'u-locked',
      ten_dang_nhap: 'canbokhoa',
      ho_ten: 'Lê Văn Khóa',
      vai_tro: 'BIEN_TAP',
      chuc_danh: 'Chuyên viên',
      trang_thai: 0, // Đã bị khóa
    },
  ];

  const baseRecord: DiaBanRecord = {
    id: 'dv-1',
    ten_dia_ban: 'Chi bộ 1',
    loai_to_chuc: 'CHI_BO',
    tinh_trang_bao_cao_thang: 'CHUA_NOP',
    thang_hien_tai: 'T11/2026',
    so_van_de_theo_doi: 0,
    so_chi_dao_chua_hoan_thanh: 0,
    thoi_diem_cap_nhat_gan_nhat: '03/11/2026',
  };

  it('1. Có phân công hợp lệ: cập nhật cán bộ, chức danh và thêm lịch sử có ID cố định', () => {
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-1'],
      },
    ];

    const result = deriveOfficerFields(baseRecord, assignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBe('u-1');
    expect(result.can_bo_phu_trach_ten).toBe('Đ/c Nguyễn Văn Một');
    expect(result.can_bo_chuc_vu).toBe('Ủy viên UBKT');
    expect(result.can_bo_phu_trach_ids).toEqual(['u-1']);
    expect(result.lich_su_phu_trach?.length).toBe(1);
    expect(result.lich_su_phu_trach?.[0].id).toBe('ls-auto-dv-1-u-1-2026-11-03');
    expect(result.lich_su_phu_trach?.[0].den_ngay).toBeNull();
  });

  it('2. Không có phân công: đưa về Chưa phân công và đóng lịch sử cũ, KHÔNG xóa lịch sử', () => {
    const existingWithOfficer: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'u-1',
      can_bo_phu_trach_ten: 'Đ/c Nguyễn Văn Một',
      can_bo_chuc_vu: 'Ủy viên UBKT',
      can_bo_phu_trach_ids: ['u-1'],
      lich_su_phu_trach: [
        {
          id: 'ls-old-1',
          can_bo_id: 'u-1',
          can_bo_ten: 'Đ/c Nguyễn Văn Một',
          tu_ngay: '01/01/2026',
          den_ngay: undefined,
          created_at: '2026-01-01',
        },
      ],
    };

    // assignments có dữ liệu nhưng không chứa dv-1
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-other'],
      },
    ];

    const result = deriveOfficerFields(existingWithOfficer, assignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBeUndefined();
    expect(result.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(result.can_bo_chuc_vu).toBe('');
    expect(result.can_bo_phu_trach_ids).toEqual([]);
    // Lịch sử không bị mất, và mục cuối cùng được đóng den_ngay
    expect(result.lich_su_phu_trach?.length).toBe(1);
    expect(result.lich_su_phu_trach?.[0].den_ngay).toBe('03/11/2026');
  });

  it('3. Cán bộ đã bị xóa khỏi hệ thống: tự động đặt về Chưa phân công', () => {
    const recordWithDeletedUser: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'mock-deleted-user',
      can_bo_phu_trach_ten: 'Đ/c Cán Bộ Đã Xóa',
      can_bo_chuc_vu: 'Chuyên viên',
      can_bo_phu_trach_ids: ['mock-deleted-user'],
    };

    const assignments: PhanCongDiaBan[] = [];
    const result = deriveOfficerFields(recordWithDeletedUser, assignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBeUndefined();
    expect(result.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(result.can_bo_chuc_vu).toBe('');
  });

  it('4. Cán bộ bị khóa tài khoản (trang_thai = 0): coi như không hợp lệ và đưa về Chưa phân công', () => {
    const recordWithLockedUser: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'u-locked',
      can_bo_phu_trach_ten: 'Đ/c Lê Văn Khóa',
      can_bo_chuc_vu: 'Chuyên viên',
    };

    // Dù assignments có chứa u-locked nhưng u-locked có trang_thai === 0
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-locked',
        user_id: 'u-locked',
        user_name: 'Lê Văn Khóa',
        don_vi_ids: ['dv-1'],
      },
    ];

    const result = deriveOfficerFields(recordWithLockedUser, assignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBeUndefined();
    expect(result.can_bo_phu_trach_ten).toBe('Chưa phân công');
  });

  it('5. Nhiều cán bộ cùng được phân công: gộp danh sách tên và chức danh', () => {
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-1'],
      },
      {
        id: 'u-2',
        user_id: 'u-2',
        user_name: 'Trần Thị Hai',
        don_vi_ids: ['dv-1'],
      },
    ];

    const result = deriveOfficerFields(baseRecord, assignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBe('u-1');
    expect(result.can_bo_phu_trach_ids).toEqual(['u-1', 'u-2']);
    expect(result.can_bo_phu_trach_ten).toBe('Đ/c Nguyễn Văn Một, Đ/c Trần Thị Hai');
    expect(result.can_bo_chuc_vu).toContain('Ủy viên UBKT');
    expect(result.can_bo_chuc_vu).toContain('Phó Chủ nhiệm UBKT');
  });

  it('6. Danh sách phân công rỗng nhưng cán bộ trên hồ sơ vẫn tồn tại trong users: giữ nguyên dữ liệu cũ', () => {
    const recordWithExistingUser: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'u-1',
      can_bo_phu_trach_ten: 'Đ/c Nguyễn Văn Một',
      can_bo_chuc_vu: 'Ủy viên UBKT',
    };

    const emptyAssignments: PhanCongDiaBan[] = [];
    const result = deriveOfficerFields(recordWithExistingUser, emptyAssignments, mockUsers, new Date('2026-11-03'));
    expect(result.can_bo_phu_trach_id).toBe('u-1');
    expect(result.can_bo_phu_trach_ten).toBe('Đ/c Nguyễn Văn Một');
  });

  it('7. Danh sách người dùng rỗng: không xóa gì, giữ nguyên 100%', () => {
    const record: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'u-1',
      can_bo_phu_trach_ten: 'Đ/c Nguyễn Văn Một',
    };

    const result = deriveOfficerFields(record, [], []);
    expect(result).toBe(record);
  });

  it('8. Chạy hai lần cho kết quả giống nhau, không sinh thêm lịch sử', () => {
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-1'],
      },
    ];

    const firstRun = deriveOfficerFields(baseRecord, assignments, mockUsers, new Date('2026-11-03'));
    expect(firstRun.lich_su_phu_trach?.length).toBe(1);

    const secondRun = deriveOfficerFields(firstRun, assignments, mockUsers, new Date('2026-11-03'));
    expect(secondRun.lich_su_phu_trach?.length).toBe(1);
    expect(secondRun).toBe(firstRun); // Giữ nguyên tham chiếu vì không thay đổi
  });

  it('9. deriveAllOfficerFields trả về đúng mảng cũ nếu không có bản ghi nào đổi', () => {
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-1'],
      },
    ];

    const records = [deriveOfficerFields(baseRecord, assignments, mockUsers, new Date('2026-11-03'))];
    const afterAll = deriveAllOfficerFields(records, assignments, mockUsers, new Date('2026-11-03'));
    expect(afterAll).toBe(records);
  });

  it('10. getUserAssignmentImpact trả về đúng danh sách các đơn vị cán bộ đang phụ trách', () => {
    const mockDonViList: DonVi[] = [
      {
        id: 'dv-1',
        ma: 'CB-1',
        ten: 'Chi bộ Khối 1',
        loai: 'CHI_BO',
        cap: 'CO_SO',
        thu_tu: 1,
        trang_thai: 'DANG_HOAT_DONG',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'dv-2',
        ma: 'CB-2',
        ten: 'Chi bộ Khối 2',
        loai: 'CHI_BO',
        cap: 'CO_SO',
        thu_tu: 2,
        trang_thai: 'DANG_HOAT_DONG',
        created_at: '',
        updated_at: '',
      },
    ];

    const assignments: PhanCongDiaBan[] = [
      {
        id: 'u-1',
        user_id: 'u-1',
        user_name: 'Nguyễn Văn Một',
        don_vi_ids: ['dv-1', 'dv-2'],
      },
      {
        id: 'u-2',
        user_id: 'u-2',
        user_name: 'Trần Thị Hai',
        don_vi_ids: ['dv-1'],
        trang_thai: 'DA_CHUYEN_GIAO',
      },
    ];

    // Cán bộ u-1 đang phụ trách dv-1 và dv-2
    const impact1 = getUserAssignmentImpact('u-1', assignments, mockDonViList);
    expect(impact1.length).toBe(2);
    expect(impact1.map((u) => u.id)).toEqual(['dv-1', 'dv-2']);
    expect(impact1.map((u) => u.ten)).toEqual(['Chi bộ Khối 1', 'Chi bộ Khối 2']);

    // Cán bộ u-2 đã chuyển giao (DA_CHUYEN_GIAO) => không tính
    const impact2 = getUserAssignmentImpact('u-2', assignments, mockDonViList);
    expect(impact2).toEqual([]);

    // Cán bộ chưa có phân công nào
    const impact3 = getUserAssignmentImpact('u-none', assignments, mockDonViList);
    expect(impact3).toEqual([]);
  });
});

