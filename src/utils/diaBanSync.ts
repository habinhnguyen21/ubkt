import type { DiaBanRecord, LichSuPhuTrachDiaBan, PhanCongDiaBan, User, DonVi } from '../types';

export function formatDateVi(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatLocalYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface DeriveOfficerFieldsOptions {
  usersComplete?: boolean;
}

/**
 * Suy ra các trường thông tin cán bộ phụ trách cho một bản ghi hồ sơ địa bàn
 * dựa trên nguồn dữ liệu gốc là Phân công quản lý và Danh sách người dùng.
 *
 * @param record Hồ sơ địa bàn hiện tại
 * @param assignments Danh sách phân công quản lý
 * @param users Danh sách người dùng
 * @param nowOrOptions Thời điểm thực hiện hoặc Options cấu hình
 * @param options Cấu hình options: usersComplete (mặc định false = an toàn cho non-ADMIN)
 */
export function deriveOfficerFields(
  record: DiaBanRecord,
  assignments: PhanCongDiaBan[] = [],
  users: User[] = [],
  nowOrOptions?: Date | DeriveOfficerFieldsOptions,
  options?: DeriveOfficerFieldsOptions
): DiaBanRecord {
  // Thận trọng 1: Nếu danh sách người dùng chưa tải (rỗng) => không xóa gì, giữ nguyên
  if (!users || users.length === 0) {
    return record;
  }

  let now = new Date();
  let opts: DeriveOfficerFieldsOptions = { usersComplete: false };

  if (nowOrOptions instanceof Date) {
    now = nowOrOptions;
    if (options && typeof options === 'object') {
      opts = options;
    }
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    opts = nowOrOptions;
  }

  const usersComplete = Boolean(opts.usersComplete);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const todayStr = formatDateVi(now);
  const ymdStr = formatLocalYmd(now);

  // Phân công hợp lệ cho đơn vị này:
  // - Phân công chưa ở trạng thái DA_CHUYEN_GIAO
  // - Đơn vị nằm trong don_vi_ids
  // - Cán bộ:
  //   + Nếu user có trong users: kiểm tra xem có bị khóa không (u.trang_thai !== 0)
  //   + Nếu user KHÔNG có trong users:
  //     * usersComplete = true (ADMIN có đủ users): coi như đã bị xóa -> không hợp lệ
  //     * usersComplete = false (non-ADMIN chỉ tải 1 user): KHÔNG suy ra đã bị xóa -> vẫn hợp lệ
  const validAssignments = (assignments || []).filter((a) => {
    if (a.trang_thai === 'DA_CHUYEN_GIAO') return false;
    if (!Array.isArray(a.don_vi_ids) || !a.don_vi_ids.includes(record.id)) return false;
    const u = userMap.get(a.user_id);
    if (u) {
      return u.trang_thai !== 0;
    }
    return !usersComplete;
  });

  if (validAssignments.length > 0) {
    // Sắp xếp để người có vai trò 'CHINH' đứng trước làm người chịu trách nhiệm chính
    const sortedAssignments = [...validAssignments].sort((a, b) => {
      const roleA = a.don_vi_roles?.[record.id] || 'CHINH';
      const roleB = b.don_vi_roles?.[record.id] || 'CHINH';
      if (roleA === 'CHINH' && roleB !== 'CHINH') return -1;
      if (roleA !== 'CHINH' && roleB === 'CHINH') return 1;
      return 0;
    });

    const canBoIds = sortedAssignments.map((a) => a.user_id);
    const primaryId = canBoIds[0];
    const hasExplicitRole = sortedAssignments.some((a) => a.don_vi_roles?.[record.id]);
    const canBoNames = sortedAssignments.map((a) => {
      const u = userMap.get(a.user_id);
      const role = a.don_vi_roles?.[record.id] || 'CHINH';
      const roleSuffix = hasExplicitRole && sortedAssignments.length > 1 ? (role === 'CHINH' ? ' (chính)' : ' (phối hợp)') : '';
      const rawName = u ? u.ho_ten : a.user_name || 'Cán bộ';
      const prefix = rawName.startsWith('Đ/c ') ? '' : 'Đ/c ';
      return prefix + rawName + roleSuffix;
    });
    const newTen = canBoNames.join(', ');
    const newChucVu = sortedAssignments
      .map((a) => {
        const u = userMap.get(a.user_id);
        if (u) {
          return u.chuc_danh || (u.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT');
        }
        // Khi user không có trong users (usersComplete = false):
        // Giữ lại chức vụ đã có trên record nếu cùng cán bộ phụ trách
        if (record.can_bo_phu_trach_id === a.user_id && record.can_bo_chuc_vu) {
          return record.can_bo_chuc_vu;
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');

    const isPrimaryChanged = record.can_bo_phu_trach_id !== primaryId;

    let updatedHistory = record.lich_su_phu_trach;
    if (isPrimaryChanged) {
      const historyCopy: LichSuPhuTrachDiaBan[] = Array.isArray(record.lich_su_phu_trach)
        ? [...record.lich_su_phu_trach]
        : [];

      // 1. Đóng mục lịch sử cuối cùng nếu chưa có ngày kết thúc
      const closedHistory = historyCopy.map((item, idx) => {
        if (idx === historyCopy.length - 1 && !item.den_ngay) {
          return { ...item, den_ngay: todayStr };
        }
        return item;
      });

      // 2. Thêm mục lịch sử mới với ID cố định theo ngày địa phương để tránh sinh trùng lặp khi chạy nhiều lần
      const historyId = `ls-auto-${record.id}-${primaryId}-${ymdStr}`;
      const alreadyHas = closedHistory.some((h) => h.id === historyId);
      if (!alreadyHas) {
        closedHistory.push({
          id: historyId,
          can_bo_id: primaryId,
          can_bo_ten: newTen,
          can_bo_chuc_vu: newChucVu,
          tu_ngay: todayStr,
          den_ngay: null,
          van_ban_phan_cong: `Phân công theo dõi địa bàn (${todayStr})`,
          created_at: now.toISOString(),
        });
      }
      updatedHistory = closedHistory;
    }

    // Kiểm tra xem có gì thay đổi so với bản ghi hiện tại không
    const sameIds =
      Array.isArray(record.can_bo_phu_trach_ids) &&
      record.can_bo_phu_trach_ids.length === canBoIds.length &&
      record.can_bo_phu_trach_ids.every((id, idx) => id === canBoIds[idx]);

    const isUnchanged =
      record.can_bo_phu_trach_id === primaryId &&
      sameIds &&
      record.can_bo_phu_trach_ten === newTen &&
      record.can_bo_chuc_vu === newChucVu &&
      !isPrimaryChanged &&
      record.lich_su_phu_trach === updatedHistory;

    if (isUnchanged) {
      return record;
    }

    return {
      ...record,
      can_bo_phu_trach_id: primaryId,
      can_bo_phu_trach_ids: canBoIds,
      can_bo_phu_trach_ten: newTen,
      can_bo_chuc_vu: newChucVu,
      thoi_gian_phan_cong: isPrimaryChanged ? todayStr : record.thoi_gian_phan_cong || todayStr,
      lich_su_phu_trach: updatedHistory,
    };
  }

  // Không có phân công hợp lệ:
  const curOfficerId = record.can_bo_phu_trach_id;
  const curUser = curOfficerId ? userMap.get(curOfficerId) : undefined;
  const isCurUserLocked = Boolean(curUser && curUser.trang_thai === 0);
  const isCurUserDeleted = Boolean(usersComplete && curOfficerId && !curUser);
  const isAssignmentsEmpty = !assignments || assignments.length === 0;

  // Thận trọng 2: nếu danh sách phân công trống hoàn toàn
  if (isAssignmentsEmpty) {
    if (isCurUserLocked || isCurUserDeleted) {
      // Cần đưa về Chưa phân công do user bị khóa hoặc bị xóa
    } else {
      // Giữ nguyên dữ liệu cũ (cập nhật tên/chức vụ mới nhất nếu user có trong userMap)
      if (curUser && curUser.trang_thai !== 0) {
        const updatedTen = `Đ/c ${curUser.ho_ten}`;
        const updatedChucVu =
          curUser.chuc_danh || (curUser.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT');
        if (record.can_bo_phu_trach_ten === updatedTen && record.can_bo_chuc_vu === updatedChucVu) {
          return record;
        }
        return {
          ...record,
          can_bo_phu_trach_ten: updatedTen,
          can_bo_chuc_vu: updatedChucVu,
        };
      }
      return record;
    }
  }

  // Cần đặt về "Chưa phân công":
  // - Cán bộ trên hồ sơ bị khóa (ở cả 2 chế độ)
  // - Cán bộ trên hồ sơ bị xóa (chỉ khi usersComplete = true)
  // - Hoặc danh sách phân công có dữ liệu nhưng đơn vị không nằm trong phân công hợp lệ nào
  const shouldClear =
    isCurUserLocked ||
    isCurUserDeleted ||
    (!isAssignmentsEmpty && (record.can_bo_phu_trach_id !== undefined || record.can_bo_phu_trach_ten !== 'Chưa phân công'));

  if (shouldClear) {
    const isAlreadyCleared =
      record.can_bo_phu_trach_id === undefined &&
      (!record.can_bo_phu_trach_ids || record.can_bo_phu_trach_ids.length === 0) &&
      record.can_bo_phu_trach_ten === 'Chưa phân công' &&
      record.can_bo_chuc_vu === '';

    // Đóng mục lịch sử cuối cùng (KHÔNG xóa lịch sử)
    let historyChanged = false;
    const historyCopy = Array.isArray(record.lich_su_phu_trach) ? [...record.lich_su_phu_trach] : [];
    const updatedHistory = historyCopy.map((item, idx) => {
      if (idx === historyCopy.length - 1 && !item.den_ngay) {
        historyChanged = true;
        return { ...item, den_ngay: todayStr };
      }
      return item;
    });

    if (isAlreadyCleared && !historyChanged) {
      return record;
    }

    return {
      ...record,
      can_bo_phu_trach_id: undefined,
      can_bo_phu_trach_ids: [],
      can_bo_phu_trach_ten: 'Chưa phân công',
      can_bo_chuc_vu: '',
      lich_su_phu_trach: historyChanged ? updatedHistory : record.lich_su_phu_trach,
    };
  }

  return record;
}

/**
 * Áp dụng suy ra cán bộ phụ trách cho toàn bộ danh sách hồ sơ địa bàn
 * Trả về đúng tham chiếu mảng cũ nếu không có bất kỳ bản ghi nào thay đổi.
 */
export function deriveAllOfficerFields(
  records: DiaBanRecord[],
  assignments: PhanCongDiaBan[] = [],
  users: User[] = [],
  nowOrOptions?: Date | DeriveOfficerFieldsOptions,
  options?: DeriveOfficerFieldsOptions
): DiaBanRecord[] {
  if (!Array.isArray(records)) return [];
  let now = new Date();
  let opts: DeriveOfficerFieldsOptions = { usersComplete: false };

  if (nowOrOptions instanceof Date) {
    now = nowOrOptions;
    if (options && typeof options === 'object') {
      opts = options;
    }
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    opts = nowOrOptions;
  }

  let hasChanged = false;
  const nextRecords = records.map((r) => {
    const nextR = deriveOfficerFields(r, assignments, users, now, opts);
    if (nextR !== r) {
      hasChanged = true;
    }
    return nextR;
  });

  return hasChanged ? nextRecords : records;
}

/**
 * Lấy danh sách các đơn vị mà cán bộ đang phụ trách
 *
 * @param userId ID của cán bộ cần kiểm tra
 * @param assignments Danh sách phân công địa bàn
 * @param donVi Danh sách đơn vị trong hệ thống
 */
export function getUserAssignmentImpact(
  userId: string,
  assignments: PhanCongDiaBan[] = [],
  donVi: DonVi[] = []
): DonVi[] {
  if (!userId || !Array.isArray(assignments)) return [];
  const assignment = assignments.find(
    (a) => a.user_id === userId && a.trang_thai !== 'DA_CHUYEN_GIAO'
  );
  if (!assignment || !Array.isArray(assignment.don_vi_ids) || assignment.don_vi_ids.length === 0) {
    return [];
  }
  const assignedUnitIdSet = new Set(assignment.don_vi_ids);
  const matchedUnits: DonVi[] = [];

  for (const dv of donVi || []) {
    if (assignedUnitIdSet.has(dv.id)) {
      matchedUnits.push(dv);
      assignedUnitIdSet.delete(dv.id);
    }
  }

  // Nếu có ID đơn vị không tìm thấy trong donVi, tạo object fallback để vẫn hiển thị
  for (const missingId of assignedUnitIdSet) {
    matchedUnits.push({
      id: missingId,
      ma: '',
      ten: `Đơn vị ID ${missingId}`,
      loai: 'CHI_BO',
      don_vi_cha_id: null,
      thu_tu: 9999,
      ghi_chu: null,
      trang_thai: 'DANG_HOAT_DONG',
      version: 1,
      sync_status: 'synced',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
  }

  return matchedUnits;
}
