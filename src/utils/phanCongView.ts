import type { DonVi, PhanCongDiaBan, User, DiaBanRecord } from '../types';

export const MAX_UNITS_PER_OFFICER_DEFAULT = 10;

/**
 * Chuẩn hóa chuỗi tìm kiếm không dấu, chữ thường,
 * hỗ trợ từ viết tắt "TDP" tương đương "tổ dân phố".
 */
export function normalizeSearch(text?: string | null): string {
  if (!text) return '';
  let s = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  // Chuyển "to dan pho" thành "tdp" để tìm kiếm 2 chiều
  s = s.replace(/\bto\s+dan\s+pho\b/g, 'tdp');
  // Xóa ký tự đặc biệt dư thừa
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Kiểm tra xem chuỗi nguồn có khớp từ khóa tìm kiếm không
 */
export function matchesSearch(target?: string | null, query?: string | null): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;
  const nTarget = normalizeSearch(target);
  const nQuery = normalizeSearch(query);
  return nTarget.includes(nQuery);
}

export interface UnitAssigneeInfo {
  userId: string;
  userName: string;
  chucDanh?: string;
  isLocked?: boolean;
}

/**
 * Lấy danh sách các cán bộ đang phụ trách đơn vị cho trước
 */
export function getAssigneesForUnit(
  unitId: string,
  assignments: PhanCongDiaBan[],
  usersList: User[]
): UnitAssigneeInfo[] {
  const result: UnitAssigneeInfo[] = [];
  const activeAssignments = (assignments || []).filter(
    (a) => a.trang_thai !== 'DA_CHUYEN_GIAO' && Array.isArray(a.don_vi_ids) && a.don_vi_ids.includes(unitId)
  );

  for (const a of activeAssignments) {
    const matchedUser = (usersList || []).find((u) => u.id === a.user_id);
    result.push({
      userId: a.user_id,
      userName: matchedUser?.ho_ten || a.user_name || 'Cán bộ',
      chucDanh: matchedUser?.chuc_danh,
      isLocked: matchedUser ? matchedUser.trang_thai === 0 : false,
    });
  }
  return result;
}

/**
 * Lọc danh sách đơn vị chờ giao:
 * - Bỏ qua đơn vị đã xóa (có deleted_at).
 * - Mặc định chỉ hiện các đơn vị CHƯA có người phụ trách nào.
 * - Nếu showAllAssigned = true: hiện cả đơn vị đã có người phụ trách (trừ khi chính đồng chí đó đang giữ).
 * - Lọc theo từ khóa tìm kiếm.
 */
export function getWaitingUnits(
  allUnits: DonVi[],
  assignments: PhanCongDiaBan[],
  options: {
    showAllAssigned?: boolean;
    searchQuery?: string;
    excludeUnitIds?: Set<string>; // ví dụ các đơn vị vừa giao đang trong hiệu ứng fade
    selectedUserId?: string;
  } = {}
): DonVi[] {
  const { showAllAssigned = false, searchQuery = '', excludeUnitIds, selectedUserId } = options;

  // Lấy tập hợp tất cả unitId đã có người phụ trách
  const assignedUnitIds = new Set<string>();
  const userHeldUnitIds = new Set<string>();

  for (const a of assignments || []) {
    if (a.trang_thai === 'DA_CHUYEN_GIAO') continue;
    for (const uid of a.don_vi_ids || []) {
      if (uid) {
        assignedUnitIds.add(uid);
        if (selectedUserId && a.user_id === selectedUserId) {
          userHeldUnitIds.add(uid);
        }
      }
    }
  }

  return (allUnits || []).filter((u) => {
    // 1. Bỏ qua đơn vị đã xóa
    if (!u || u.deleted_at) return false;

    // 2. Bỏ qua đơn vị đang trong hiệu ứng ẩn
    if (excludeUnitIds && excludeUnitIds.has(u.id)) return false;

    // 3. Nếu đồng chí đang chọn ĐÃ phụ trách đơn vị này thì không hiện ở danh sách chờ giao
    if (userHeldUnitIds.has(u.id)) return false;

    // 4. Nếu không bật "Hiện cả đơn vị đã có người", chỉ hiện đơn vị hoàn toàn chưa có người
    if (!showAllAssigned && assignedUnitIds.has(u.id)) return false;

    // 5. Tìm kiếm
    if (searchQuery && searchQuery.trim()) {
      const matchTen = matchesSearch(u.ten, searchQuery);
      const matchMa = matchesSearch(u.ma, searchQuery);
      if (!matchTen && !matchMa) return false;
    }

    return true;
  });
}

export interface AssignmentWarnings {
  unassignedCount: number;
  unassignedUnits: DonVi[];
  orphanUnitsCount: number;
  orphanAssignments: { assignment: PhanCongDiaBan; reason: string }[];
  overloadedOfficers: { user: User; count: number }[];
}

export interface PhanCongStats {
  totalUnits: number;
  assignedCount: number;
  unassignedCount: number;
  multiAssignedCount: number;
  warnings: AssignmentWarnings;
}

/**
 * Tính toán thống kê và cảnh báo phân công quản lý
 */
export function computePhanCongStats(
  allUnits: DonVi[],
  assignments: PhanCongDiaBan[],
  usersList: User[],
  maxThreshold: number = MAX_UNITS_PER_OFFICER_DEFAULT
): PhanCongStats {
  const activeUnits = (allUnits || []).filter((u) => !u.deleted_at);
  const activeUnitMap = new Map(activeUnits.map((u) => [u.id, u]));

  // Đếm số người phụ trách cho từng đơn vị
  const unitAssigneeCount = new Map<string, number>();
  activeUnits.forEach((u) => unitAssigneeCount.set(u.id, 0));

  // Kiểm tra phân công trỏ tới đơn vị đã bị xóa hoặc cán bộ bị khóa/không tồn tại
  const orphanAssignments: { assignment: PhanCongDiaBan; reason: string }[] = [];
  const userMap = new Map((usersList || []).map((u) => [u.id, u]));

  for (const a of assignments || []) {
    if (a.trang_thai === 'DA_CHUYEN_GIAO') continue;
    const usr = userMap.get(a.user_id);
    if (!usr) {
      orphanAssignments.push({
        assignment: a,
        reason: `Cán bộ ID ${a.user_id} (${a.user_name}) không còn tồn tại trong hệ thống`,
      });
    } else if (usr.trang_thai === 0) {
      orphanAssignments.push({
        assignment: a,
        reason: `Cán bộ "${usr.ho_ten}" (@${usr.ten_dang_nhap}) đã bị khóa tài khoản`,
      });
    }

    for (const uid of a.don_vi_ids || []) {
      if (!activeUnitMap.has(uid)) {
        orphanAssignments.push({
          assignment: a,
          reason: `Đơn vị ID ${uid} đã bị xóa hoặc không còn trong danh mục`,
        });
      } else {
        const cur = unitAssigneeCount.get(uid) || 0;
        unitAssigneeCount.set(uid, cur + 1);
      }
    }
  }

  let assignedCount = 0;
  let unassignedCount = 0;
  let multiAssignedCount = 0;
  const unassignedUnits: DonVi[] = [];

  for (const u of activeUnits) {
    const c = unitAssigneeCount.get(u.id) || 0;
    if (c === 0) {
      unassignedCount++;
      unassignedUnits.push(u);
    } else {
      assignedCount++;
      if (c >= 2) multiAssignedCount++;
    }
  }

  // Cán bộ giữ quá nhiều đơn vị
  const overloadedOfficers: { user: User; count: number }[] = [];
  for (const u of usersList || []) {
    const a = (assignments || []).find((x) => x.user_id === u.id && x.trang_thai !== 'DA_CHUYEN_GIAO');
    const count = a?.don_vi_ids?.length || 0;
    if (count > maxThreshold) {
      overloadedOfficers.push({ user: u, count });
    }
  }

  return {
    totalUnits: activeUnits.length,
    assignedCount,
    unassignedCount,
    multiAssignedCount,
    warnings: {
      unassignedCount,
      unassignedUnits,
      orphanUnitsCount: orphanAssignments.length,
      orphanAssignments,
      overloadedOfficers,
    },
  };
}

/**
 * Kiểm tra quyền sửa đổi: chỉ ADMIN mới được phép
 */
export function canModifyAssignments(currentUser: User | null): boolean {
  return Boolean(currentUser && currentUser.vai_tro === 'ADMIN');
}

/**
 * Giao thêm một danh sách đơn vị cho cán bộ
 */
export function assignUnitsToOfficer(
  assignments: PhanCongDiaBan[],
  userId: string,
  userName: string,
  unitIds: string[]
): PhanCongDiaBan[] {
  if (!unitIds || unitIds.length === 0) return assignments;
  const now = new Date().toISOString();
  let found = false;

  const result = (assignments || []).map((a) => {
    if (a.user_id === userId) {
      found = true;
      const existing = new Set(a.don_vi_ids || []);
      unitIds.forEach((id) => existing.add(id));
      return {
        ...a,
        user_name: userName || a.user_name,
        don_vi_ids: Array.from(existing),
        updated_at: now,
      };
    }
    return a;
  });

  if (!found) {
    result.push({
      user_id: userId,
      user_name: userName,
      don_vi_ids: Array.from(new Set(unitIds)),
      updated_at: now,
    });
  }

  return result;
}

/**
 * Gỡ bỏ một đơn vị khỏi danh sách phụ trách của cán bộ
 */
export function unassignUnitFromOfficer(
  assignments: PhanCongDiaBan[],
  userId: string,
  unitId: string
): PhanCongDiaBan[] {
  const now = new Date().toISOString();
  return (assignments || []).map((a) => {
    if (a.user_id === userId) {
      return {
        ...a,
        don_vi_ids: (a.don_vi_ids || []).filter((id) => id !== unitId),
        updated_at: now,
      };
    }
    return a;
  });
}

/**
 * Kiểm tra xem đơn vị đã có số quyết định phân công hay chưa
 */
export function getUnitDecisionNumber(
  unitId: string,
  diaBanRecords: DiaBanRecord[]
): string | null {
  const matchRec = (diaBanRecords || []).find((r) => r.id === unitId);
  if (!matchRec) return null;

  if (matchRec.van_ban_phan_cong && matchRec.van_ban_phan_cong.trim()) {
    return matchRec.van_ban_phan_cong.trim();
  }

  if (Array.isArray(matchRec.lich_su_phu_trach)) {
    for (const h of matchRec.lich_su_phu_trach) {
      if (h.so_quyet_dinh && h.so_quyet_dinh.trim()) return h.so_quyet_dinh.trim();
      if (h.van_ban_phan_cong && h.van_ban_phan_cong.trim()) return h.van_ban_phan_cong.trim();
    }
  }

  return null;
}
