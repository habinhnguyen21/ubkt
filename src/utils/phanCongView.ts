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
  role: 'CHINH' | 'PHOI_HOP';
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
    const role = a.don_vi_roles?.[unitId] || 'CHINH';
    result.push({
      userId: a.user_id,
      userName: matchedUser?.ho_ten || a.user_name || 'Cán bộ',
      chucDanh: matchedUser?.chuc_danh,
      isLocked: matchedUser ? matchedUser.trang_thai === 0 : false,
      role,
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

export type OrphanWarningType = 'MISSING_USER' | 'LOCKED_USER' | 'INVALID_UNIT';

export interface OrphanWarning {
  id: string;
  type: OrphanWarningType;
  assignment: PhanCongDiaBan;
  reason: string;
  userId: string;
  userName?: string;
  affectedUnitIds?: string[];
  invalidUnitIds?: string[];
  invalidUnitNames?: string[];
}

export interface AssignmentWarnings {
  unassignedCount: number;
  unassignedUnits: DonVi[];
  orphanUnitsCount: number;
  orphanAssignments: OrphanWarning[];
  overloadedOfficers: { user: User; count: number }[];
  multiMainUnits: { unit: DonVi; count: number; officerNames: string[] }[];
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
  const orphanAssignments: OrphanWarning[] = [];
  const userMap = new Map((usersList || []).map((u) => [u.id, u]));

  for (const a of assignments || []) {
    if (a.trang_thai === 'DA_CHUYEN_GIAO') continue;
    const usr = userMap.get(a.user_id);
    if (!usr) {
      orphanAssignments.push({
        id: `missing-user-${a.user_id}`,
        type: 'MISSING_USER',
        assignment: a,
        userId: a.user_id,
        userName: a.user_name || 'Chưa rõ họ tên',
        affectedUnitIds: a.don_vi_ids || [],
        reason: `Cán bộ ID ${a.user_id} (${a.user_name || 'Chưa rõ họ tên'}) không còn tồn tại trong hệ thống`,
      });
    } else if (usr.trang_thai === 0) {
      orphanAssignments.push({
        id: `locked-user-${a.user_id}`,
        type: 'LOCKED_USER',
        assignment: a,
        userId: a.user_id,
        userName: usr.ho_ten,
        affectedUnitIds: a.don_vi_ids || [],
        reason: `Cán bộ "${usr.ho_ten}" (@${usr.ten_dang_nhap}) đã bị khóa tài khoản`,
      });
    }

    // Kiểm tra đơn vị bị xóa hoặc không còn trong danh mục
    const invalidUnitsInThisAssign: { id: string; name: string }[] = [];
    for (const uid of a.don_vi_ids || []) {
      if (!activeUnitMap.has(uid)) {
        const deletedUnit = (allUnits || []).find((u) => u.id === uid);
        const unitName = deletedUnit ? `${deletedUnit.ten} (đã xóa)` : `ID: ${uid}`;
        invalidUnitsInThisAssign.push({ id: uid, name: unitName });
      } else {
        const cur = unitAssigneeCount.get(uid) || 0;
        unitAssigneeCount.set(uid, cur + 1);
      }
    }

    if (invalidUnitsInThisAssign.length > 0) {
      orphanAssignments.push({
        id: `invalid-units-${a.user_id}`,
        type: 'INVALID_UNIT',
        assignment: a,
        userId: a.user_id,
        userName: a.user_name || 'Chưa rõ họ tên',
        invalidUnitIds: invalidUnitsInThisAssign.map((u) => u.id),
        invalidUnitNames: invalidUnitsInThisAssign.map((u) => u.name),
        reason: `Đơn vị ID ${invalidUnitsInThisAssign.map((u) => u.name).join(', ')} đã bị xóa hoặc không còn trong danh mục`,
      });
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

  // Đơn vị có nhiều hơn 1 cán bộ phụ trách CHÍNH
  const multiMainUnits: { unit: DonVi; count: number; officerNames: string[] }[] = [];
  for (const u of activeUnits) {
    const assignees = getAssigneesForUnit(u.id, assignments, usersList);
    const mainAssignees = assignees.filter((a) => a.role === 'CHINH');
    if (mainAssignees.length >= 2) {
      multiMainUnits.push({
        unit: u,
        count: mainAssignees.length,
        officerNames: mainAssignees.map((a) => a.userName),
      });
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
      multiMainUnits,
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
 * Giao thêm một danh sách đơn vị cho cán bộ:
 * - Khi giao thêm người cho đơn vị đã có người phụ trách: mặc định vai trò là 'PHOI_HOP'.
 * - Khi giao cho đơn vị chưa có ai: mặc định vai trò là 'CHINH'.
 * - Dữ liệu cũ không có trường don_vi_roles mặc định là 'CHINH'.
 */
export function assignUnitsToOfficer(
  assignments: PhanCongDiaBan[],
  userId: string,
  userName: string,
  unitIds: string[],
  customRoles?: Record<string, 'CHINH' | 'PHOI_HOP'>
): PhanCongDiaBan[] {
  if (!unitIds || unitIds.length === 0) return assignments;
  const now = new Date().toISOString();
  let found = false;

  // Xác định các đơn vị đã có cán bộ khác đang phụ trách (active)
  const unitsWithOtherAssignees = new Set<string>();
  (assignments || []).forEach((a) => {
    if (a.user_id !== userId && a.trang_thai !== 'DA_CHUYEN_GIAO') {
      (a.don_vi_ids || []).forEach((id) => unitsWithOtherAssignees.add(id));
    }
  });

  const result = (assignments || []).map((a) => {
    if (a.user_id === userId) {
      found = true;
      const existing = new Set(a.don_vi_ids || []);
      const roles: Record<string, 'CHINH' | 'PHOI_HOP'> = { ...(a.don_vi_roles || {}) };

      unitIds.forEach((id) => {
        existing.add(id);
        if (!roles[id]) {
          if (customRoles && customRoles[id]) {
            roles[id] = customRoles[id];
          } else {
            roles[id] = unitsWithOtherAssignees.has(id) ? 'PHOI_HOP' : 'CHINH';
          }
        }
      });

      return {
        ...a,
        user_name: userName || a.user_name,
        don_vi_ids: Array.from(existing),
        don_vi_roles: roles,
        updated_at: now,
      };
    }
    return a;
  });

  if (!found) {
    const roles: Record<string, 'CHINH' | 'PHOI_HOP'> = {};
    unitIds.forEach((id) => {
      if (customRoles && customRoles[id]) {
        roles[id] = customRoles[id];
      } else {
        roles[id] = unitsWithOtherAssignees.has(id) ? 'PHOI_HOP' : 'CHINH';
      }
    });

    result.push({
      user_id: userId,
      user_name: userName,
      don_vi_ids: Array.from(new Set(unitIds)),
      don_vi_roles: roles,
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
      const updatedRoles = { ...(a.don_vi_roles || {}) };
      delete updatedRoles[unitId];
      return {
        ...a,
        don_vi_ids: (a.don_vi_ids || []).filter((id) => id !== unitId),
        don_vi_roles: Object.keys(updatedRoles).length > 0 ? updatedRoles : undefined,
        updated_at: now,
      };
    }
    return a;
  });
}

/**
 * Đổi vai trò phụ trách của cán bộ trên một đơn vị ('CHINH' <-> 'PHOI_HOP')
 */
export function toggleOfficerUnitRole(
  assignments: PhanCongDiaBan[],
  userId: string,
  unitId: string,
  targetRole?: 'CHINH' | 'PHOI_HOP'
): PhanCongDiaBan[] {
  const now = new Date().toISOString();
  return (assignments || []).map((a) => {
    if (a.user_id === userId) {
      const currentRole = a.don_vi_roles?.[unitId] || 'CHINH';
      const nextRole = targetRole || (currentRole === 'CHINH' ? 'PHOI_HOP' : 'CHINH');
      return {
        ...a,
        don_vi_roles: {
          ...(a.don_vi_roles || {}),
          [unitId]: nextRole,
        },
        updated_at: now,
      };
    }
    return a;
  });
}

export interface TransferAllOfficersOptions {
  ngayHieuLuc?: string;
  soQuyetDinh?: string;
  ghiChu?: string;
}

/**
 * Chuyển giao toàn bộ đơn vị của cán bộ A sang cán bộ B:
 * - Bản phân công của A: chuyển trang_thai = 'DA_CHUYEN_GIAO', đặt den_ngay, xóa danh sách đơn vị hiện tại (nhưng giữ lịch sử bản ghi).
 * - Bản phân công của B: gộp thêm các đơn vị từ A (không trùng lặp), bảo lưu vai trò.
 */
export function transferAllUnitsBetweenOfficers(
  assignments: PhanCongDiaBan[],
  fromUserId: string,
  targetUser: User,
  options?: TransferAllOfficersOptions
): PhanCongDiaBan[] {
  const source = (assignments || []).find((a) => a.user_id === fromUserId && a.trang_thai !== 'DA_CHUYEN_GIAO');
  if (!source || !Array.isArray(source.don_vi_ids) || source.don_vi_ids.length === 0) {
    return assignments || [];
  }

  const sourceUnits = source.don_vi_ids;
  const sourceRoles = source.don_vi_roles || {};
  const now = new Date().toISOString();
  const effectiveDate = options?.ngayHieuLuc || now.slice(0, 10);
  const decisionNo = options?.soQuyetDinh || source.so_quyet_dinh || null;

  let targetFound = false;

  const result: PhanCongDiaBan[] = (assignments || []).map((a) => {
    // 1. Cán bộ nguồn (A): chuyển sang DA_CHUYEN_GIAO, gắn den_ngay, giải phóng don_vi_ids
    if (a.user_id === fromUserId && a.trang_thai !== 'DA_CHUYEN_GIAO') {
      const existingHistory = Array.isArray(a.lich_su_chuyen_giao) ? a.lich_su_chuyen_giao : [];
      const historyEntry = {
        id: `cg-${Date.now()}`,
        ngay_chuyen_giao: effectiveDate,
        to_user_id: targetUser.id,
        to_user_name: targetUser.ho_ten,
        so_quyet_dinh: decisionNo,
        don_vi_ids: [...sourceUnits],
        ghi_chu: options?.ghiChu || `Đã chuyển giao toàn bộ đơn vị cho Đ/c ${targetUser.ho_ten}`,
      };

      return {
        ...a,
        don_vi_ids: [],
        trang_thai: 'DA_CHUYEN_GIAO',
        den_ngay: effectiveDate,
        so_quyet_dinh: decisionNo || a.so_quyet_dinh,
        lich_su_chuyen_giao: [...existingHistory, historyEntry],
        ghi_chu: options?.ghiChu || `Đã chuyển giao toàn bộ đơn vị cho Đ/c ${targetUser.ho_ten}`,
        updated_at: now,
      };
    }

    // 2. Cán bộ đích (B): gộp các đơn vị không trùng lặp và bảo lưu vai trò
    if (a.user_id === targetUser.id) {
      targetFound = true;
      const mergedIds = Array.from(new Set([...(a.don_vi_ids || []), ...sourceUnits]));
      const mergedRoles: Record<string, 'CHINH' | 'PHOI_HOP'> = { ...(a.don_vi_roles || {}) };

      sourceUnits.forEach((uid) => {
        if (!mergedRoles[uid]) {
          mergedRoles[uid] = sourceRoles[uid] || 'CHINH';
        }
      });

      return {
        ...a,
        user_name: targetUser.ho_ten,
        don_vi_ids: mergedIds,
        don_vi_roles: mergedRoles,
        trang_thai: 'DANG_PHU_TRACH',
        so_quyet_dinh: decisionNo || a.so_quyet_dinh,
        tu_ngay: a.tu_ngay || effectiveDate,
        updated_at: now,
      };
    }

    return a;
  });

  // Nếu cán bộ đích chưa có bản ghi phân công nào trong danh sách
  if (!targetFound) {
    const targetRoles: Record<string, 'CHINH' | 'PHOI_HOP'> = {};
    sourceUnits.forEach((uid) => {
      targetRoles[uid] = sourceRoles[uid] || 'CHINH';
    });

    result.push({
      id: targetUser.id,
      user_id: targetUser.id,
      user_name: targetUser.ho_ten,
      don_vi_ids: [...sourceUnits],
      don_vi_roles: targetRoles,
      trang_thai: 'DANG_PHU_TRACH',
      tu_ngay: effectiveDate,
      so_quyet_dinh: decisionNo,
      updated_at: now,
    });
  }

  return result;
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

/**
 * Tìm người dùng phù hợp nhất để gợi ý khi chuyển phân công (so khớp không dấu, hoa thường, tiền tố)
 */
export function findBestMatchingUser(
  orphanUserName: string | undefined,
  usersList: User[]
): User | undefined {
  if (!orphanUserName || !usersList || usersList.length === 0) return undefined;
  // Bỏ tiền tố "Đ/c", "Đồng chí", "Đc", v.v.
  const cleaned = orphanUserName
    .replace(/^(đ\/c|đồng chí|đc)\s+/i, '')
    .trim();
  const normalizedTarget = normalizeSearch(cleaned);
  if (!normalizedTarget) return undefined;

  // 1. Khớp chính xác hoàn toàn họ tên (bỏ dấu)
  const exactMatch = usersList.find(
    (u) => u.trang_thai !== 0 && normalizeSearch(u.ho_ten) === normalizedTarget
  );
  if (exactMatch) return exactMatch;

  // 2. Khớp một phần hoặc tên đăng nhập
  const partialMatch = usersList.find(
    (u) =>
      u.trang_thai !== 0 &&
      (normalizeSearch(u.ho_ten).includes(normalizedTarget) ||
        normalizedTarget.includes(normalizeSearch(u.ho_ten)) ||
        normalizeSearch(u.ten_dang_nhap) === normalizedTarget)
  );
  return partialMatch;
}

/**
 * Chuyển toàn bộ phân công của cán bộ cũ sang tài khoản cán bộ mới
 * Giữ nguyên don_vi_ids, số quyết định, ngày và lịch sử.
 * Nếu tài khoản đích đã có phân công thì gộp danh sách đơn vị không trùng lặp.
 */
export function transferAssignmentToUser(
  assignments: PhanCongDiaBan[],
  sourceUserId: string,
  targetUser: User
): PhanCongDiaBan[] {
  const source = (assignments || []).find((a) => a.user_id === sourceUserId);
  if (!source) return assignments || [];

  const sourceUnits = source.don_vi_ids || [];
  const targetExists = (assignments || []).some((a) => a.user_id === targetUser.id);
  const now = new Date().toISOString();

  if (targetExists) {
    return (assignments || [])
      .filter((a) => a.user_id !== sourceUserId)
      .map((a) => {
        if (a.user_id === targetUser.id) {
          const merged = Array.from(new Set([...(a.don_vi_ids || []), ...sourceUnits]));
          return {
            ...a,
            user_name: targetUser.ho_ten,
            don_vi_ids: merged,
            updated_at: now,
          };
        }
        return a;
      });
  } else {
    return (assignments || []).map((a) => {
      if (a.user_id === sourceUserId) {
        return {
          ...a,
          id: targetUser.id,
          user_id: targetUser.id,
          user_name: targetUser.ho_ten,
          updated_at: now,
        };
      }
      return a;
    });
  }
}

/**
 * Xóa bản ghi phân công của một cán bộ (các đơn vị trong đó sẽ trở về chưa có người phụ trách)
 */
export function deleteAssignment(
  assignments: PhanCongDiaBan[],
  userId: string
): PhanCongDiaBan[] {
  return (assignments || []).filter((a) => a.user_id !== userId);
}

/**
 * Gỡ các ID đơn vị không tồn tại hoặc đã bị xóa khỏi một bản phân công
 */
export function removeInvalidUnitsFromAssignment(
  assignments: PhanCongDiaBan[],
  userId: string,
  invalidUnitIds: string[]
): PhanCongDiaBan[] {
  const invalidSet = new Set(invalidUnitIds || []);
  const now = new Date().toISOString();
  return (assignments || []).map((a) => {
    if (a.user_id === userId) {
      return {
        ...a,
        don_vi_ids: (a.don_vi_ids || []).filter((uid) => !invalidSet.has(uid)),
        updated_at: now,
      };
    }
    return a;
  });
}

/**
 * Dọn tất cả cảnh báo: gỡ đơn vị không tồn tại và xóa bản phân công của cán bộ không còn trong hệ thống
 */
export function cleanAllOrphanWarnings(
  assignments: PhanCongDiaBan[],
  allUnits: DonVi[],
  usersList: User[]
): {
  cleanedAssignments: PhanCongDiaBan[];
  removedAssignmentsCount: number;
  removedUnitsCount: number;
  affectedUnitIds: string[];
  removedOfficers: string[];
} {
  const activeUnitIds = new Set((allUnits || []).filter((u) => !u.deleted_at).map((u) => u.id));
  const activeUserIds = new Set((usersList || []).map((u) => u.id));
  const now = new Date().toISOString();

  let removedAssignmentsCount = 0;
  let removedUnitsCount = 0;
  const affectedUnitIds: string[] = [];
  const removedOfficers: string[] = [];

  const cleanedAssignments: PhanCongDiaBan[] = [];

  for (const a of assignments || []) {
    // Nếu cán bộ không còn trong hệ thống
    if (!activeUserIds.has(a.user_id)) {
      removedAssignmentsCount++;
      removedOfficers.push(a.user_name || a.user_id);
      (a.don_vi_ids || []).forEach((uid) => {
        if (activeUnitIds.has(uid)) affectedUnitIds.push(uid);
      });
      continue;
    }

    // Nếu cán bộ còn tồn tại, lọc bỏ các đơn vị không tồn tại/đã xóa
    const validUnitIds: string[] = [];
    for (const uid of a.don_vi_ids || []) {
      if (activeUnitIds.has(uid)) {
        validUnitIds.push(uid);
      } else {
        removedUnitsCount++;
      }
    }

    cleanedAssignments.push({
      ...a,
      don_vi_ids: validUnitIds,
      updated_at: now,
    });
  }

  return {
    cleanedAssignments,
    removedAssignmentsCount,
    removedUnitsCount,
    affectedUnitIds: Array.from(new Set(affectedUnitIds)),
    removedOfficers,
  };
}
