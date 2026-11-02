import type {
  ChuongTrinhKtGs,
  DiaBanRecord,
  DonVi,
  PhanCongDiaBan,
  User,
} from '../types';

/**
 * Chuẩn hóa tên đơn vị / cơ quan để so khớp chính xác:
 * - Chuyển chữ thường, bỏ dấu tiếng Việt (NFD + bỏ dấu kết hợp, đ -> d) để "Ủy" và "Uỷ" khớp nhau
 * - Thay "tổ dân phố" bằng "tdp"
 * - Gộp khoảng trắng
 * - Bỏ các tiền tố "chi bộ", "đảng bộ", "chi ủy", "ban", "uỷ ban kiểm tra"... khi cần
 */
export function normalizeUnitName(s?: string | null, stripPrefix = true): string {
  if (!s) return '';
  let norm = String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[-–—,._/():;"'`]/g, ' ')
    .replace(/\bto\s+dan\s+pho\b/g, 'tdp')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripPrefix && norm) {
    const prefixRegex =
      /^(?:uy ban kiem tra dang uy|uy ban kiem tra|ubkt dang uy|ubkt|ban thuong vu dang uy|ban thuong vu|btv dang uy|btv|ban chap hanh dang bo|ban chap hanh|bch dang bo|bch|dang bo co so|dang bo bo phan|dang bo|dang uy|chi bo co so|chi bo|chi uy|ban)\s+/i;
    let prev = '';
    while (norm && norm !== prev) {
      prev = norm;
      const stripped = norm.replace(prefixRegex, '').trim();
      if (stripped) {
        norm = stripped;
      } else {
        break;
      }
    }
  }

  return norm;
}

/**
 * Tìm đơn vị khớp tốt nhất trong danh mục DonVi (bỏ qua đơn vị đã xóa deleted_at):
 * 1. Ưu tiên khớp chính xác sau chuẩn hóa (cả tên đầy đủ và tên đã bỏ tiền tố).
 * 2. Chỉ khi không có khớp chính xác mới dùng so khớp "chứa" (includes),
 *    nhưng BẮT BUỘC độ dài chuỗi ngắn hơn >= 70% chuỗi dài hơn,
 *    và KHÔNG dùng khi tên đơn vị chuẩn hóa ngắn hơn 4 ký tự (tránh "Chi bộ 1" khớp nhầm).
 * 3. Nếu nhiều đơn vị cùng khớp thì chọn đơn vị có độ tương đồng cao nhất.
 */
export function findBestMatchingDonVi(
  rawName?: string | null,
  donViList?: DonVi[] | null
): DonVi | null {
  if (!rawName || !Array.isArray(donViList) || donViList.length === 0) return null;

  const fullQuery = normalizeUnitName(rawName, false);
  const strippedQuery = normalizeUnitName(rawName, true);
  if (!fullQuery || fullQuery === 'toan dang bo' || strippedQuery === 'toan dang bo') {
    return null;
  }

  const activeUnits = donViList.filter((d) => d && !d.deleted_at);
  if (activeUnits.length === 0) return null;

  let bestExactUnit: DonVi | null = null;
  let bestExactScore = 0;

  for (const unit of activeUnits) {
    const unitFull = normalizeUnitName(unit.ten, false);
    const unitStripped = normalizeUnitName(unit.ten, true);
    const unitMa = unit.ma ? normalizeUnitName(unit.ma, false) : '';

    if (!unitFull) continue;

    if (unitFull === fullQuery || (unitMa && unitMa === fullQuery)) {
      const score = 1.01;
      if (score > bestExactScore) {
        bestExactScore = score;
        bestExactUnit = unit;
      }
      continue;
    }

    if (strippedQuery && unitStripped && unitStripped === strippedQuery) {
      const score = 1.0;
      if (score > bestExactScore) {
        bestExactScore = score;
        bestExactUnit = unit;
      }
    }
  }

  if (bestExactUnit) {
    return bestExactUnit;
  }

  // Bước 2: So khớp "chứa" (includes) chặt chẽ với ngưỡng >= 70% và độ dài tên đơn vị chuẩn hóa >= 4 ký tự
  let bestContainsUnit: DonVi | null = null;
  let bestContainsRatio = 0;

  for (const unit of activeUnits) {
    const unitStripped = normalizeUnitName(unit.ten, true);
    const unitFull = normalizeUnitName(unit.ten, false);

    if (unitStripped.length < 4 || strippedQuery.length < 4) {
      continue;
    }

    const candidates: Array<[string, string]> = [
      [strippedQuery, unitStripped],
      [fullQuery, unitFull],
    ];

    for (const [a, b] of candidates) {
      if (a.length < 4 || b.length < 4) continue;
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length <= b.length ? b : a;

      if (longer.includes(shorter)) {
        const ratio = shorter.length / longer.length;
        if (ratio >= 0.7 && ratio > bestContainsRatio) {
          bestContainsRatio = ratio;
          bestContainsUnit = unit;
        }
      }
    }
  }

  return bestContainsUnit;
}

export function isStrictUnitNameMatch(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const fullA = normalizeUnitName(nameA, false);
  const fullB = normalizeUnitName(nameB, false);
  if (!fullA || !fullB) return false;
  if (fullA === fullB) return true;

  const stripA = normalizeUnitName(nameA, true);
  const stripB = normalizeUnitName(nameB, true);
  if (stripA && stripB && stripA === stripB) return true;

  if (stripA.length < 4 || stripB.length < 4) return false;
  const shorter = stripA.length <= stripB.length ? stripA : stripB;
  const longer = stripA.length <= stripB.length ? stripB : stripA;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.7) {
    return true;
  }
  return false;
}

export interface ProgramAssignmentContext {
  activeDonViList: DonVi[];
  assignments: PhanCongDiaBan[];
  usersList: User[];
  diaBanRecords: DiaBanRecord[];
  isAdmin?: boolean;
}

export interface ProgramAssignmentResolution {
  officers: string[];
  matchedUnits: DonVi[];
  lookupAgencyName: string;
  status: 'ASSIGNED' | 'NO_UNIT' | 'NO_OFFICER';
}

export function resolveProgramAssignmentInfo(
  item: ChuongTrinhKtGs,
  ctx: ProgramAssignmentContext
): ProgramAssignmentResolution {
  const { activeDonViList, assignments, usersList, diaBanRecords, isAdmin = true } = ctx;
  const lookupAgencyName =
    (
      item.chu_the ||
      item.co_quan_ban_hanh ||
      item.ten_don_vi ||
      item.ten_chi_dang_bo ||
      item.doi_tuong ||
      item.chu_the_ap_dung ||
      ''
    ).trim() || 'Chưa rõ cơ quan';

  if (!isAdmin) {
    return { officers: [], matchedUnits: [], lookupAgencyName, status: 'NO_UNIT' };
  }

  const activeUnits = activeDonViList.filter((d) => d && !d.deleted_at);
  const matchedUnits: DonVi[] = [];

  // 1. Đối chiếu theo ID đơn vị đã lưu (bỏ qua đơn vị có deleted_at)
  const candidateIds = [
    item.don_vi_id,
    item.chu_the_don_vi_id,
    item.chi_dang_bo_id,
    item.doi_tuong_don_vi_id,
  ].filter(Boolean) as string[];

  for (const id of candidateIds) {
    const found = activeUnits.find((d) => d.id === id);
    if (found) {
      if (!found.don_vi_cha_id && item.don_vi_id !== found.id) {
        const byChuThe = findBestMatchingDonVi(item.chu_the || item.co_quan_ban_hanh, activeUnits);
        if (!byChuThe || byChuThe.id !== found.id) {
          continue;
        }
      }
      if (!matchedUnits.some((m) => m.id === found.id)) {
        matchedUnits.push(found);
      }
    }
  }

  // 2. Đối chiếu theo tên cơ quan / đơn vị (ưu tiên chu_the và co_quan_ban_hanh trước)
  const candidateNames = [
    item.chu_the,
    item.co_quan_ban_hanh,
    item.ten_don_vi,
    item.ten_chi_dang_bo,
    item.doi_tuong,
    item.chu_the_ap_dung,
  ].filter(Boolean) as string[];

  for (const rawName of candidateNames) {
    const found = findBestMatchingDonVi(rawName, activeUnits);
    if (found && !matchedUnits.some((m) => m.id === found.id)) {
      matchedUnits.push(found);
    }
  }

  const targetUnitIds = matchedUnits.map((u) => u.id);
  const officerNames: string[] = [];

  // 3. Tìm trong danh sách phân công địa bàn (assignments)
  if (Array.isArray(assignments) && targetUnitIds.length > 0) {
    for (const uid of targetUnitIds) {
      for (const a of assignments) {
        if (!Array.isArray(a?.don_vi_ids)) continue;
        if (a.don_vi_ids.includes(uid)) {
          const usr = usersList.find((u) => u.id === a.user_id);
          const rawName = usr?.ho_ten || a.user_name || '';
          const cleanName = rawName.replace(/^(Đ\/c|Đồng chí)\s+/i, '').trim();
          if (cleanName && !officerNames.includes(cleanName)) {
            officerNames.push(cleanName);
          }
        }
      }
    }
  }

  // 4. Dự phòng tìm trong danh sách hồ sơ địa bàn nếu assignments chưa có
  if (officerNames.length === 0 && Array.isArray(diaBanRecords)) {
    for (const rec of diaBanRecords) {
      const isMatchById = targetUnitIds.includes(rec.id);
      const isMatchByName =
        !isMatchById &&
        candidateNames.some((cn) => isStrictUnitNameMatch(cn, rec.ten_dia_ban));

      if (isMatchById || isMatchByName) {
        if (Array.isArray(rec.can_bo_phu_trach_ids) && rec.can_bo_phu_trach_ids.length > 0) {
          for (const uid of rec.can_bo_phu_trach_ids) {
            const usr = usersList.find((u) => u.id === uid);
            if (usr?.ho_ten) {
              const clean = usr.ho_ten.replace(/^(Đ\/c|Đồng chí)\s+/i, '').trim();
              if (clean && !officerNames.includes(clean)) officerNames.push(clean);
            }
          }
        }
        if (officerNames.length === 0 && rec.can_bo_phu_trach_id) {
          const usr = usersList.find((u) => u.id === rec.can_bo_phu_trach_id);
          if (usr?.ho_ten) {
            const clean = usr.ho_ten.replace(/^(Đ\/c|Đồng chí)\s+/i, '').trim();
            if (clean && !officerNames.includes(clean)) officerNames.push(clean);
          }
        }
        if (
          officerNames.length === 0 &&
          rec.can_bo_phu_trach_ten &&
          rec.can_bo_phu_trach_ten !== 'Chưa phân công'
        ) {
          const parts = rec.can_bo_phu_trach_ten
            .split(/[,;\n]+/)
            .map((s) => s.replace(/^(Đ\/c|Đồng chí)\s+/i, '').trim())
            .filter(Boolean);
          for (const p of parts) {
            if (!officerNames.includes(p)) officerNames.push(p);
          }
        }
      }
    }
  }

  const status: 'ASSIGNED' | 'NO_UNIT' | 'NO_OFFICER' =
    officerNames.length > 0
      ? 'ASSIGNED'
      : matchedUnits.length === 0
      ? 'NO_UNIT'
      : 'NO_OFFICER';

  return {
    officers: officerNames,
    matchedUnits,
    lookupAgencyName,
    status,
  };
}

export function getAssignedOfficers(
  item: ChuongTrinhKtGs,
  ctx: ProgramAssignmentContext
): string[] {
  return resolveProgramAssignmentInfo(item, ctx).officers;
}

