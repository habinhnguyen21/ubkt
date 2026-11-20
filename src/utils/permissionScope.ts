import type { User, PhanCongDiaBan } from '../types';

export const COMMON_SUBJECT_KEYWORDS = [
  'btv',
  'ban thường vụ',
  'bch',
  'ban chấp hành',
  'ubkt',
  'ủy ban kiểm tra',
  'đảng ủy',
  'đảng ủy phường',
];

/**
 * Kiểm tra xem người dùng có phải là Admin hay không
 */
export function isUserAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.vai_tro || (user as any).role || '').toUpperCase();
  return role === 'ADMIN';
}

/**
 * Lấy tập ID các đơn vị mà user được phân công phụ trách
 */
export function getAssignedUnitIds(
  currentUser: User | null | undefined,
  phanCongList?: PhanCongDiaBan[]
): Set<string> {
  const ids = new Set<string>();
  if (!currentUser) return ids;

  if (currentUser.don_vi_id) ids.add(currentUser.don_vi_id);
  if (Array.isArray(currentUser.pham_vi_quan_ly)) {
    currentUser.pham_vi_quan_ly.forEach((id) => id && ids.add(id));
  }

  let pcList = phanCongList;
  if (!pcList && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('ubkt_phan_cong_dia_ban');
      if (raw) pcList = JSON.parse(raw);
    } catch {}
  }

  if (Array.isArray(pcList)) {
    for (const a of pcList) {
      if (!a) continue;
      const isOwner =
        a.user_id === currentUser.id ||
        (currentUser.ho_ten &&
          a.user_name &&
          a.user_name.trim().toLowerCase() === currentUser.ho_ten.trim().toLowerCase());
      if (isOwner && a.trang_thai !== 'DA_CHUYEN_GIAO') {
        for (const uid of a.don_vi_ids || []) {
          if (uid) ids.add(uid);
        }
      }
    }
  }

  return ids;
}

/**
 * Kiểm tra xem một bản ghi có thuộc nhiệm vụ chung của BTV, BCH, UBKT Đảng ủy phường hay không
 */
export function isCommonTask(item: any): boolean {
  if (!item) return false;

  // 1. Kiểm tra loại chủ thể / cơ cấu
  const loai = String(item.chu_the_loai || item.loai || item.loai_to_chuc || '').toUpperCase();
  if (['BTV', 'BCH', 'UBKT', 'DANG_BO'].includes(loai)) return true;

  // 2. Kiểm tra cấp chủ thể
  const capChuThe = String(item.cap_chu_the || item.cap_to_chuc || '').toUpperCase();
  if (capChuThe === 'PHUONG' || capChuThe === 'CAP_TREN') return true;

  // 3. Chuỗi văn bản đối chiếu (chu_the, co_quan_ban_hanh, ten_don_vi, ten_dia_ban, v.v.)
  const textFields = [
    item.chu_the,
    item.co_quan_ban_hanh,
    item.ten_chuong_trinh,
    item.ten_don_vi,
    item.ten_chi_dang_bo,
    item.ten_dia_ban,
    item.ten,
    item.doi_tuong_lien_quan,
    item.doi_tuong_khac,
    item.linh_vuc,
    item.noi_dung,
  ];

  for (const field of textFields) {
    if (!field || typeof field !== 'string') continue;
    const lower = field.toLowerCase();
    for (const kw of COMMON_SUBJECT_KEYWORDS) {
      if (lower.includes(kw)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Kiểm tra xem bản ghi có được giao trực tiếp cho cá nhân user hoặc địa bàn phụ trách hay không
 */
export function isDirectlyAssignedToUser(
  item: any,
  currentUser: User,
  assignedUnitIds: Set<string>
): boolean {
  if (!item || !currentUser) return false;

  // 1. Khớp ID người dùng
  if (item.user_id && item.user_id === currentUser.id) return true;
  if (item.can_bo_phu_trach_id && item.can_bo_phu_trach_id === currentUser.id) return true;
  if (item.nguoi_tao_id && item.nguoi_tao_id === currentUser.id) return true;
  if (item.nguoi_thuc_hien && item.nguoi_thuc_hien === currentUser.id) return true;
  if (Array.isArray(item.can_bo_phu_trach_ids) && item.can_bo_phu_trach_ids.includes(currentUser.id)) return true;

  // 2. Khớp theo họ tên / tên đăng nhập
  const myName = (currentUser.ho_ten || '').trim().toLowerCase();
  const myUser = (currentUser.ten_dang_nhap || '').trim().toLowerCase();

  const nameFields = [
    item.user_name,
    item.can_bo_phu_trach,
    item.can_bo_phu_trach_ten,
    item.nguoi_ky,
    item.nguoi_tao_ten,
  ];

  for (const nf of nameFields) {
    if (!nf || typeof nf !== 'string') continue;
    const cleanNf = nf.toLowerCase().replace(/^đ\/c\s*/i, '').replace(/^đồng chí\s*/i, '').trim();
    if (myName && (cleanNf === myName || cleanNf.includes(myName) || myName.includes(cleanNf))) {
      return true;
    }
    if (myUser && (cleanNf.includes(myUser) || myUser.includes(cleanNf))) {
      return true;
    }
  }

  // 3. Khớp theo địa bàn / đơn vị phụ trách
  const unitIds = [
    item.id, // Với DonVi, DiaBanRecord
    item.don_vi_id,
    item.doi_tuong_don_vi_id,
    item.chi_dang_bo_id,
    item.chu_the_don_vi_id,
  ];

  for (const uid of unitIds) {
    if (uid && assignedUnitIds.has(uid)) return true;
  }

  return false;
}

/**
 * Hàm lọc dùng chung theo đúng đặc tả phân quyền:
 * - Admin: Thấy 100% toàn bộ dữ liệu
 * - Biên tập viên: Thấy tất cả bản ghi thuộc nhiệm vụ chung của BTV, BCH, UBKT Đảng ủy phường
 *   CỘNG VỚI các bản ghi được giao trực tiếp cho cá nhân hoặc địa bàn phụ trách.
 */
export function filterVisibleItemsForUser<T>(
  items: T[],
  currentUser: User | null | undefined,
  assignedUnitIds?: Set<string> | string[],
  phanCongList?: PhanCongDiaBan[]
): T[] {
  if (!Array.isArray(items)) return [];
  if (!currentUser || isUserAdmin(currentUser)) {
    return items;
  }

  const unitIdsSet: Set<string> =
    assignedUnitIds instanceof Set
      ? assignedUnitIds
      : Array.isArray(assignedUnitIds)
      ? new Set(assignedUnitIds)
      : getAssignedUnitIds(currentUser, phanCongList);

  return items.filter((item) => {
    // 1. Thuộc nhiệm vụ chung BTV, BCH, UBKT Đảng ủy phường
    if (isCommonTask(item)) return true;

    // 2. Giao trực tiếp cho cá nhân hoặc địa bàn phụ trách
    if (isDirectlyAssignedToUser(item, currentUser, unitIdsSet)) return true;

    return false;
  });
}

/**
 * Kiểm tra xem người dùng có quyền sửa/cập nhật tiến độ/đổi trạng thái đối với một bản ghi KT-GS / Lịch:
 * - Admin: Toàn quyền (Thêm mới, Sửa, Xóa, Đổi trạng thái)
 * - Biên tập viên: Chỉ được phép sửa / cập nhật tiến độ / đổi trạng thái đối với các bản ghi
 *   thuộc đơn vị/địa bàn mà người đó quản lý hoặc được phân công phụ trách.
 */
export function canEditProgramItem(
  item: any,
  currentUser: User | null | undefined,
  assignedUnitIds?: Set<string> | string[],
  phanCongList?: PhanCongDiaBan[]
): boolean {
  if (!currentUser) return false;
  if (isUserAdmin(currentUser)) return true;

  const unitIdsSet: Set<string> =
    assignedUnitIds instanceof Set
      ? assignedUnitIds
      : Array.isArray(assignedUnitIds)
      ? new Set(assignedUnitIds)
      : getAssignedUnitIds(currentUser, phanCongList);

  return isDirectlyAssignedToUser(item, currentUser, unitIdsSet);
}

