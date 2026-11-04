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

  it('3. Cán bộ đã bị xóa khỏi hệ thống: tự động đặt về Chưa phân công khi usersComplete = true', () => {
    const recordWithDeletedUser: DiaBanRecord = {
      ...baseRecord,
      can_bo_phu_trach_id: 'mock-deleted-user',
      can_bo_phu_trach_ten: 'Đ/c Cán Bộ Đã Xóa',
      can_bo_chuc_vu: 'Chuyên viên',
      can_bo_phu_trach_ids: ['mock-deleted-user'],
    };

    const assignments: PhanCongDiaBan[] = [];
    const result = deriveOfficerFields(
      recordWithDeletedUser,
      assignments,
      mockUsers,
      new Date('2026-11-03'),
      { usersComplete: true }
    );
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

  it('11. (a) usersComplete=false, users chỉ có 1 người: hồ sơ của cán bộ khác KHÔNG đổi, lịch sử không bị đóng', () => {
    const otherOfficerRecord: DiaBanRecord = {
      ...baseRecord,
      id: 'dv-other',
      can_bo_phu_trach_id: 'u-other-officer',
      can_bo_phu_trach_ten: 'Đ/c Trần Thị B',
      can_bo_chuc_vu: 'Phó Chủ nhiệm UBKT',
      can_bo_phu_trach_ids: ['u-other-officer'],
      lich_su_phu_trach: [
        {
          id: 'ls-1',
          can_bo_id: 'u-other-officer',
          can_bo_ten: 'Đ/c Trần Thị B',
          can_bo_chuc_vu: 'Phó Chủ nhiệm UBKT',
          tu_ngay: '01/01/2026',
          den_ngay: null,
          van_ban_phan_cong: 'QĐ 01',
          created_at: '2026-01-01',
        },
      ],
    };

    // Phân công có u-other-officer phụ trách dv-other
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'pc-other',
        user_id: 'u-other-officer',
        user_name: 'Trần Thị B',
        don_vi_ids: ['dv-other'],
        trang_thai: 'DANG_PHU_TRACH',
        updated_at: '2026-01-01',
      },
    ];

    // Người dùng hiện tại chỉ là u-bientap, users chỉ có 1 người duy nhất!
    const singleUserList: User[] = [
      {
        id: 'u-bientap',
        ten_dang_nhap: 'bientap',
        ho_ten: 'Nguyễn Văn Biên Tập',
        vai_tro: 'BIEN_TAP',
        trang_thai: 1,
        must_change_password: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    const result = deriveOfficerFields(
      otherOfficerRecord,
      assignments,
      singleUserList,
      new Date('2026-11-04'),
      { usersComplete: false }
    );

    // Cán bộ u-other-officer KHÔNG bị xóa, thông tin giữ nguyên
    expect(result.can_bo_phu_trach_id).toBe('u-other-officer');
    expect(result.can_bo_phu_trach_ten).toBe('Đ/c Trần Thị B');
    expect(result.can_bo_chuc_vu).toBe('Phó Chủ nhiệm UBKT');
    expect(result.can_bo_phu_trach_ids).toEqual(['u-other-officer']);
    // Lịch sử phụ trách KHÔNG bị đóng den_ngay
    expect(result.lich_su_phu_trach?.length).toBe(1);
    expect(result.lich_su_phu_trach?.[0].den_ngay).toBeNull();
  });

  it('12. (b) usersComplete=false nhưng user đó có trong users và bị khóa (trang_thai = 0): hồ sơ về Chưa phân công', () => {
    const lockedOfficerRecord: DiaBanRecord = {
      ...baseRecord,
      id: 'dv-locked',
      can_bo_phu_trach_id: 'u-locked-user',
      can_bo_phu_trach_ten: 'Đ/c Người Bị Khóa',
      can_bo_chuc_vu: 'Chuyên viên',
      can_bo_phu_trach_ids: ['u-locked-user'],
      lich_su_phu_trach: [
        {
          id: 'ls-locked',
          can_bo_id: 'u-locked-user',
          can_bo_ten: 'Đ/c Người Bị Khóa',
          can_bo_chuc_vu: 'Chuyên viên',
          tu_ngay: '01/01/2026',
          den_ngay: null,
          van_ban_phan_cong: 'QĐ 02',
          created_at: '2026-01-01',
        },
      ],
    };

    const assignments: PhanCongDiaBan[] = [
      {
        id: 'pc-locked',
        user_id: 'u-locked-user',
        user_name: 'Người Bị Khóa',
        don_vi_ids: ['dv-locked'],
        updated_at: '2026-01-01',
      },
    ];

    const users: User[] = [
      {
        id: 'u-locked-user',
        ten_dang_nhap: 'locked',
        ho_ten: 'Người Bị Khóa',
        vai_tro: 'BIEN_TAP',
        trang_thai: 0, // ĐÃ BỊ KHÓA
        must_change_password: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    const result = deriveOfficerFields(
      lockedOfficerRecord,
      assignments,
      users,
      new Date('2026-11-04'),
      { usersComplete: false }
    );

    expect(result.can_bo_phu_trach_id).toBeUndefined();
    expect(result.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(result.can_bo_chuc_vu).toBe('');
    expect(result.lich_su_phu_trach?.[0].den_ngay).toBe('04/11/2026');
  });

  it('13. (c) usersComplete=true, cán bộ đã xóa khỏi hệ thống: về Chưa phân công và đóng lịch sử', () => {
    const deletedOfficerRecord: DiaBanRecord = {
      ...baseRecord,
      id: 'dv-del',
      can_bo_phu_trach_id: 'u-ghost',
      can_bo_phu_trach_ten: 'Đ/c Người Đã Xóa',
      can_bo_chuc_vu: 'Chuyên viên',
      can_bo_phu_trach_ids: ['u-ghost'],
      lich_su_phu_trach: [
        {
          id: 'ls-ghost',
          can_bo_id: 'u-ghost',
          can_bo_ten: 'Đ/c Người Đã Xóa',
          can_bo_chuc_vu: 'Chuyên viên',
          tu_ngay: '01/01/2026',
          den_ngay: null,
          van_ban_phan_cong: 'QĐ 03',
          created_at: '2026-01-01',
        },
      ],
    };

    // assignments có chứa u-ghost nhưng users không có u-ghost
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'pc-ghost',
        user_id: 'u-ghost',
        user_name: 'Người Đã Xóa',
        don_vi_ids: ['dv-del'],
        updated_at: '2026-01-01',
      },
    ];

    // ADMIN có usersComplete = true, trong danh sách users không có u-ghost
    const adminUsersList: User[] = [
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
    ];

    const result = deriveOfficerFields(
      deletedOfficerRecord,
      assignments,
      adminUsersList,
      new Date('2026-11-04'),
      { usersComplete: true }
    );

    expect(result.can_bo_phu_trach_id).toBeUndefined();
    expect(result.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(result.can_bo_chuc_vu).toBe('');
    expect(result.lich_su_phu_trach?.[0].den_ngay).toBe('04/11/2026');
  });

  it('14. (d) danh sách phân công có dữ liệu nhưng đơn vị không nằm trong đó thì về Chưa phân công ở cả hai chế độ', () => {
    const unassignedUnitRecord: DiaBanRecord = {
      ...baseRecord,
      id: 'dv-unassigned',
      can_bo_phu_trach_id: 'u-previous',
      can_bo_phu_trach_ten: 'Đ/c Cán Bộ Trước Đó',
      can_bo_chuc_vu: 'Chuyên viên',
      can_bo_phu_trach_ids: ['u-previous'],
      lich_su_phu_trach: [
        {
          id: 'ls-prev',
          can_bo_id: 'u-previous',
          can_bo_ten: 'Đ/c Cán Bộ Trước Đó',
          can_bo_chuc_vu: 'Chuyên viên',
          tu_ngay: '01/01/2026',
          den_ngay: null,
          van_ban_phan_cong: 'QĐ 04',
          created_at: '2026-01-01',
        },
      ],
    };

    // assignments có dữ liệu nhưng KHÔNG chứa 'dv-unassigned'
    const assignments: PhanCongDiaBan[] = [
      {
        id: 'pc-1',
        user_id: 'u-active',
        user_name: 'Cán Bộ Đang Làm',
        don_vi_ids: ['dv-other-1', 'dv-other-2'],
        updated_at: '2026-01-01',
      },
    ];

    const users: User[] = [
      {
        id: 'u-active',
        ten_dang_nhap: 'active',
        ho_ten: 'Cán Bộ Đang Làm',
        vai_tro: 'BIEN_TAP',
        trang_thai: 1,
        must_change_password: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    // Chế độ 1: usersComplete = false
    const resFalse = deriveOfficerFields(
      unassignedUnitRecord,
      assignments,
      users,
      new Date('2026-11-04'),
      { usersComplete: false }
    );
    expect(resFalse.can_bo_phu_trach_id).toBeUndefined();
    expect(resFalse.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(resFalse.can_bo_chuc_vu).toBe('');
    expect(resFalse.lich_su_phu_trach?.[0].den_ngay).toBe('04/11/2026');

    // Chế độ 2: usersComplete = true
    const resTrue = deriveOfficerFields(
      unassignedUnitRecord,
      assignments,
      users,
      new Date('2026-11-04'),
      { usersComplete: true }
    );
    expect(resTrue.can_bo_phu_trach_id).toBeUndefined();
    expect(resTrue.can_bo_phu_trach_ten).toBe('Chưa phân công');
    expect(resTrue.can_bo_chuc_vu).toBe('');
    expect(resTrue.lich_su_phu_trach?.[0].den_ngay).toBe('04/11/2026');
  });
});

