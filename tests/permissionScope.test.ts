import { describe, it, expect } from 'vitest';
import {
  isUserAdmin,
  getAssignedUnitIds,
  isCommonTask,
  isDirectlyAssignedToUser,
  filterVisibleItemsForUser,
  canEditProgramItem,
} from '../src/utils/permissionScope';
import type { User, ChuongTrinhKtGs } from '../src/types';

describe('Permission Scope & canEditProgramItem', () => {
  const adminUser: User = {
    id: 'admin_1',
    ho_ten: 'Quản trị viên',
    ten_dang_nhap: 'admin',
    vai_tro: 'ADMIN',
    trang_thai: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const editorUser: User = {
    id: 'editor_1',
    ho_ten: 'Hà Hoàng Bình Nguyên',
    ten_dang_nhap: 'hahoangbinhnguyen',
    vai_tro: 'BIEN_TAP',
    trang_thai: 1,
    don_vi_id: 'dv_chi_bo_1',
    pham_vi_quan_ly: ['dv_chi_bo_1', 'dv_chi_bo_2'],
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const itemCommonTask: ChuongTrinhKtGs = {
    id: 'ct_common_1',
    nam: 2026,
    chu_the: 'Ủy ban Kiểm tra Đảng ủy',
    chu_the_loai: 'UBKT',
    don_vi_id: 'dv_ubkt_root',
    ten_don_vi: 'UBKT Đảng ủy phường',
    doi_tuong: 'Chi bộ 10',
    doi_tuong_don_vi_id: 'dv_chi_bo_10',
    noi_dung: 'Kiểm tra việc chấp hành Điều lệ Đảng',
    ngay_bat_dau: '2026-03-01',
    ngay_ket_thuc: '2026-03-31',
    so_van_ban: '10-KH/UBKT',
    trang_thai: 'CHUA_THUC_HIEN',
    file_pdf_ten: null,
    file_pdf_url: null,
    ghi_chu_pdf: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const itemAssignedToEditor: ChuongTrinhKtGs = {
    id: 'ct_assigned_1',
    nam: 2026,
    chu_the: 'Chi bộ 1',
    chu_the_loai: 'KHAC',
    don_vi_id: 'dv_chi_bo_1',
    ten_don_vi: 'Chi bộ 1',
    doi_tuong: 'Đảng viên A',
    noi_dung: 'Giám sát đảng viên',
    ngay_bat_dau: '2026-04-01',
    ngay_ket_thuc: '2026-04-30',
    so_van_ban: '01-KH/CB',
    trang_thai: 'DANG_THUC_HIEN',
    file_pdf_ten: null,
    file_pdf_url: null,
    ghi_chu_pdf: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const itemOtherUnit: ChuongTrinhKtGs = {
    id: 'ct_other_1',
    nam: 2026,
    chu_the: 'Chi bộ 99',
    chu_the_loai: 'KHAC',
    don_vi_id: 'dv_chi_bo_99',
    ten_don_vi: 'Chi bộ 99',
    doi_tuong: 'Đảng viên B',
    noi_dung: 'Giám sát nội bộ',
    ngay_bat_dau: '2026-05-01',
    ngay_ket_thuc: '2026-05-31',
    so_van_ban: '05-KH/CB99',
    trang_thai: 'CHUA_THUC_HIEN',
    file_pdf_ten: null,
    file_pdf_url: null,
    ghi_chu_pdf: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  it('1. isUserAdmin nhận diện chính xác vai trò ADMIN', () => {
    expect(isUserAdmin(adminUser)).toBe(true);
    expect(isUserAdmin(editorUser)).toBe(false);
  });

  it('2. getAssignedUnitIds lấy đúng danh sách đơn vị của user', () => {
    const assigned = getAssignedUnitIds(editorUser);
    expect(assigned.has('dv_chi_bo_1')).toBe(true);
    expect(assigned.has('dv_chi_bo_2')).toBe(true);
    expect(assigned.has('dv_chi_bo_99')).toBe(false);
  });

  it('3. canEditProgramItem cho phép Admin sửa toàn bộ', () => {
    expect(canEditProgramItem(itemCommonTask, adminUser)).toBe(true);
    expect(canEditProgramItem(itemAssignedToEditor, adminUser)).toBe(true);
    expect(canEditProgramItem(itemOtherUnit, adminUser)).toBe(true);
  });

  it('4. canEditProgramItem chỉ cho phép Biên tập viên sửa bản ghi thuộc địa bàn/đơn vị quản lý', () => {
    const assignedIds = getAssignedUnitIds(editorUser);

    // Bản ghi thuộc dv_chi_bo_1 -> ĐƯỢC PHÉP SỬA
    expect(canEditProgramItem(itemAssignedToEditor, editorUser, assignedIds)).toBe(true);

    // Bản ghi nhiệm vụ chung của UBKT nhưng đơn vị không thuộc phân công -> CHỈ XEM, KHÔNG ĐƯỢC SỬA
    expect(canEditProgramItem(itemCommonTask, editorUser, assignedIds)).toBe(false);

    // Bản ghi của đơn vị khác -> KHÔNG ĐƯỢC SỬA
    expect(canEditProgramItem(itemOtherUnit, editorUser, assignedIds)).toBe(false);
  });

  it('5. canEditProgramItem cho phép Biên tập viên sửa nếu được chỉ định cán bộ phụ trách', () => {
    const itemWithOfficer: any = {
      ...itemOtherUnit,
      can_bo_phu_trach_id: editorUser.id,
    };
    expect(canEditProgramItem(itemWithOfficer, editorUser)).toBe(true);
  });

  it('6. filterVisibleItemsForUser cho phép Biên tập viên xem nhiệm vụ chung và địa bàn phụ trách', () => {
    const allItems = [itemCommonTask, itemAssignedToEditor, itemOtherUnit];

    // Admin thấy 100%
    const adminVisible = filterVisibleItemsForUser(allItems, adminUser);
    expect(adminVisible.length).toBe(3);

    // Biên tập viên thấy nhiệm vụ chung + địa bàn phụ trách (2/3 items)
    const editorVisible = filterVisibleItemsForUser(allItems, editorUser);
    expect(editorVisible.length).toBe(2);
    expect(editorVisible.map((i) => i.id)).toEqual(['ct_common_1', 'ct_assigned_1']);
  });
});
