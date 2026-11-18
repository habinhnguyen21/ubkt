import type {
  ChuongTrinhKtGs,
  DonThu,
  DonVi,
  PhanCongDiaBan,
  User,
} from '../types';
import { findBestMatchingDonVi } from './donViMatcher';

/**
 * Nhắc việc: tính danh sách chương trình KT-GS và đơn thư quá hạn / sắp đến hạn.
 * - Chỉ là hàm thuần (không đọc Firestore, không đọc localStorage) nên dễ kiểm thử.
 * - ADMIN và XEM thấy tất cả; BIEN_TAP chỉ thấy việc thuộc đơn vị mình được phân công
 *   (hoặc đơn thư do chính mình phụ trách).
 */

export const REMINDER_SOON_DAYS = 7;

export type ReminderType = 'CHUONG_TRINH' | 'DON_THU';
export type ReminderSeverity = 'OVERDUE' | 'SOON';

export interface ReminderItem {
  /** Khóa ổn định để ẩn / hiện lại: type:id:severity (đổi mức độ thì nhắc lại) */
  key: string;
  type: ReminderType;
  id: string;
  severity: ReminderSeverity;
  title: string;
  subtitle: string;
  /** Số ngày còn lại (âm nếu đã quá hạn) */
  daysLeft: number;
  /** Ngày hết hạn dạng YYYY-MM-DD (nếu xác định được) */
  dueDate: string | null;
}

export interface ReminderInput {
  user: Pick<User, 'id' | 'ho_ten' | 'vai_tro' | 'don_vi_id' | 'pham_vi_quan_ly'>;
  chuongTrinh: ChuongTrinhKtGs[];
  donThu: DonThu[];
  donVi: DonVi[];
  phanCong: PhanCongDiaBan[];
  /** Mặc định là thời điểm hiện tại; truyền vào để kiểm thử */
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Trích xuất ngày theo múi giờ Việt Nam (UTC+7).
 * Đảm bảo mọi máy tính (kể cả máy cài múi giờ UTC, US, v.v.) đều tính toán ngày hiện tại đồng nhất.
 */
export function getVietnamDateParts(d: Date): CalendarDateParts {
  // Bù chênh lệch timezone của máy để về UTC, rồi +7 giờ để ra giờ Việt Nam
  const vnTime = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 7 * 3600000);
  return {
    year: vnTime.getFullYear(),
    month: vnTime.getMonth() + 1,
    day: vnTime.getDate(),
  };
}

/** Hỗ trợ YYYY-MM-DD (kể cả có giờ phía sau), DD/MM/YYYY hoặc DD-MM-YYYY, hoặc chuỗi ISO */
export function parseCalendarDate(raw?: string | null): CalendarDateParts | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // 1. Dạng YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, day] = s.slice(0, 10).split('-').map((n) => parseInt(n, 10));
    if (y >= 1900 && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      return { year: y, month: m, day };
    }
  }
  // 2. Dạng DD/MM/YYYY hoặc DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) {
    const [day, m, y] = s.split(/[-/]/).map((n) => parseInt(n, 10));
    if (y >= 1900 && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      return { year: y, month: m, day };
    }
  }
  // 3. Chuỗi thời gian ISO đầy đủ
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return getVietnamDateParts(parsed);
  }
  return null;
}

/** Hỗ trợ YYYY-MM-DD (kể cả có giờ phía sau) và DD/MM/YYYY hoặc DD-MM-YYYY (trả về Date an toàn) */
export function parseDateLoose(raw?: string | null): Date | null {
  const p = parseCalendarDate(raw);
  if (!p) return null;
  return new Date(p.year, p.month - 1, p.day);
}

export function partsToYmd(p: CalendarDateParts): string {
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

export function formatDateViParts(p: CalendarDateParts): string {
  const dd = String(p.day).padStart(2, '0');
  const mm = String(p.month).padStart(2, '0');
  return `${dd}/${mm}/${p.year}`;
}

export function formatDateVi(ymd: string | null): string {
  if (!ymd) return '';
  const p = parseCalendarDate(ymd);
  if (!p) return ymd;
  return formatDateViParts(p);
}

/**
 * Tính số ngày cách biệt chính xác dựa trên ngày lịch thuần túy (dùng UTC timestamps)
 * Không bị ảnh hưởng bởi múi giờ máy khách hay giờ mùa hè (DST).
 */
export function daysBetweenCalendar(target: CalendarDateParts, today: CalendarDateParts): number {
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((targetUtc - todayUtc) / DAY_MS);
}

/** Bỏ dấu, chữ thường, bỏ "Đ/c", "Đồng chí" để so tên cán bộ */
export function normalizePersonName(s?: string | null): string {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(d\/c|dong chi)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPersonMatch(assigned?: string | null, userName?: string | null): boolean {
  const a = normalizePersonName(assigned);
  const u = normalizePersonName(userName);
  if (!a || !u) return false;
  return a === u || a.includes(u) || u.includes(a);
}

/** Các đơn vị mà người dùng (biên tập viên) được phân công phụ trách (bao gồm cả vai trò CHINH và PHOI_HOP) */
export function getUserUnitIds(
  user: ReminderInput['user'],
  phanCong: PhanCongDiaBan[]
): Set<string> {
  const ids = new Set<string>();
  for (const a of phanCong || []) {
    if (!a || a.user_id !== user.id) continue;
    if (a.trang_thai === 'DA_CHUYEN_GIAO') continue;
    for (const id of a.don_vi_ids || []) if (id) ids.add(id);
  }
  if (user.don_vi_id) ids.add(user.don_vi_id);
  for (const id of user.pham_vi_quan_ly || []) if (id) ids.add(id);
  return ids;
}

/** Lấy tên cán bộ phụ trách CHÍNH của một đơn vị (vai trò CHINH, mặc định cho dữ liệu cũ) */
export function getPrimaryOfficerForUnit(
  unitId: string,
  phanCong: PhanCongDiaBan[],
  users?: { id: string; ho_ten: string }[]
): string | null {
  const active = (phanCong || []).filter(
    (a) => a.trang_thai !== 'DA_CHUYEN_GIAO' && Array.isArray(a.don_vi_ids) && a.don_vi_ids.includes(unitId)
  );
  if (active.length === 0) return null;
  const mainAssign = active.find((a) => (a.don_vi_roles?.[unitId] || 'CHINH') === 'CHINH') || active[0];
  const u = users?.find((usr) => usr.id === mainAssign.user_id);
  return u?.ho_ten || mainAssign.user_name || null;
}

/** Chương trình có thuộc một trong các đơn vị đã cho không (theo ID trước, theo tên sau) */
function programBelongsToUnits(
  item: ChuongTrinhKtGs,
  unitIds: Set<string>,
  donVi: DonVi[]
): boolean {
  if (unitIds.size === 0) return false;
  const idCandidates = [
    item.don_vi_id,
    item.chu_the_don_vi_id,
    item.chi_dang_bo_id,
    item.doi_tuong_don_vi_id,
  ].filter(Boolean) as string[];
  if (idCandidates.some((id) => unitIds.has(id))) return true;

  const nameCandidates = [item.chu_the, item.co_quan_ban_hanh, item.ten_don_vi, item.ten_chi_dang_bo].filter(
    Boolean
  ) as string[];
  for (const name of nameCandidates) {
    const found = findBestMatchingDonVi(name, donVi);
    if (found && unitIds.has(found.id)) return true;
  }
  return false;
}

function severityOf(daysLeft: number): ReminderSeverity | null {
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= REMINDER_SOON_DAYS) return 'SOON';
  return null;
}

export function describeDays(daysLeft: number): string {
  if (daysLeft < 0) return `Quá hạn ${Math.abs(daysLeft)} ngày`;
  if (daysLeft === 0) return 'Hết hạn hôm nay';
  return `Còn ${daysLeft} ngày`;
}

export function computeReminders(input: ReminderInput): ReminderItem[] {
  const now = input.now || new Date();
  const todayVn = getVietnamDateParts(now);
  const user = input.user;
  const seeAll = user.vai_tro === 'ADMIN' || user.vai_tro === 'XEM';
  const myUnitIds = seeAll ? new Set<string>() : getUserUnitIds(user, input.phanCong);
  const items: ReminderItem[] = [];

  // 1. Chương trình KT-GS hằng năm
  for (const ct of input.chuongTrinh || []) {
    if (!ct || (ct as { deleted_at?: string | null }).deleted_at) continue;
    if ((ct.loai_chuong_trinh || 'HANG_NAM') !== 'HANG_NAM') continue;
    if (ct.trang_thai === 'DA_HOAN_THANH') continue;

    if (!seeAll && !programBelongsToUnits(ct, myUnitIds, input.donVi)) continue;

    const endParts = parseCalendarDate(ct.ngay_ket_thuc);
    let daysLeft: number;
    let severity: ReminderSeverity | null;
    if (endParts) {
      daysLeft = daysBetweenCalendar(endParts, todayVn);
      severity = severityOf(daysLeft);
      // Trạng thái đã đánh dấu QUA_HAN nhưng chưa có hạn rõ ràng vẫn phải nhắc
      if (!severity && ct.trang_thai === 'QUA_HAN') severity = 'OVERDUE';
    } else if (ct.trang_thai === 'QUA_HAN') {
      daysLeft = -1;
      severity = 'OVERDUE';
    } else {
      continue;
    }
    if (!severity) continue;

    const agency = (ct.chu_the || ct.co_quan_ban_hanh || ct.ten_don_vi || ct.doi_tuong || '').trim();
    const title = (ct.ten_chuong_trinh || ct.noi_dung || 'Chương trình KT-GS').toString().trim();
    const dueDateStr = endParts ? partsToYmd(endParts) : null;
    items.push({
      key: `CHUONG_TRINH:${ct.id}:${severity}`,
      type: 'CHUONG_TRINH',
      id: ct.id,
      severity,
      title: title.length > 90 ? title.slice(0, 87) + '…' : title,
      subtitle: [agency, endParts ? `Hạn ${formatDateViParts(endParts)}` : ''].filter(Boolean).join(' • '),
      daysLeft,
      dueDate: dueDateStr,
    });
  }

  // 2. Đơn thư
  for (const dt of input.donThu || []) {
    if (!dt || dt.trang_thai === 'Đã hoàn thành') continue;
    if (!seeAll && !isPersonMatch(dt.can_bo_phu_trach, user.ho_ten)) continue;

    const receivedParts = parseCalendarDate(dt.ngay_tiep_nhan);
    if (!receivedParts) continue;
    const receivedUtc = Date.UTC(receivedParts.year, receivedParts.month - 1, receivedParts.day);
    const dueUtc = new Date(receivedUtc + (dt.thoi_han_quy_dinh || 30) * DAY_MS);
    const dueParts: CalendarDateParts = {
      year: dueUtc.getUTCFullYear(),
      month: dueUtc.getUTCMonth() + 1,
      day: dueUtc.getUTCDate(),
    };

    const daysLeft = daysBetweenCalendar(dueParts, todayVn);
    let severity = severityOf(daysLeft);
    if (!severity && dt.trang_thai === 'Quá hạn') severity = 'OVERDUE';
    if (!severity) continue;

    const dueDateStr = partsToYmd(dueParts);
    items.push({
      key: `DON_THU:${dt.id}:${severity}`,
      type: 'DON_THU',
      id: dt.id,
      severity,
      title: `Đơn thư ${dt.ma_don || ''}`.trim(),
      subtitle: [
        dt.can_bo_phu_trach ? `Phụ trách: ${dt.can_bo_phu_trach}` : '',
        `Hạn ${formatDateViParts(dueParts)}`,
      ]
        .filter(Boolean)
        .join(' • '),
      daysLeft,
      dueDate: dueDateStr,
    });
  }

  // Quá hạn lâu nhất lên trước, sau đó tới việc sắp hết hạn gần nhất
  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'OVERDUE' ? -1 : 1;
    return a.daysLeft - b.daysLeft;
  });
  return items;
}
