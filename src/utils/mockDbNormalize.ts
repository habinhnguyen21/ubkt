/**
 * Chuẩn hóa dữ liệu cục bộ (ubkt_mock_db) đọc từ localStorage.
 *
 * Bối cảnh: bản di trú IndexedDB từng thay nội dung các khóa dữ liệu lớn trong localStorage bằng một
 * bản đánh dấu nhỏ {"_migrated_to_idb": true}. Mã đọc dữ liệu vẫn đọc trực tiếp localStorage nên thấy
 * một đối tượng thiếu donViList, chuongTrinhList... và bị lỗi "undefined is not an object
 * (evaluating 'e.donViList.filter')". Hàm ở đây giúp nhận ra bản đánh dấu và luôn trả về dữ liệu
 * có đủ các mảng bắt buộc.
 */

export const MIGRATION_PLACEHOLDER_FLAG = '_migrated_to_idb';

/** Bản đánh dấu = đối tượng có cờ di trú và KHÔNG chứa dữ liệu thật (không có mảng nào) */
export function isMigrationPlaceholder(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj[MIGRATION_PLACEHOLDER_FLAG] !== true) return false;
  return !Object.keys(obj).some((k) => k !== MIGRATION_PLACEHOLDER_FLAG && Array.isArray(obj[k]));
}

const REQUIRED_ARRAYS = ['users', 'donViList', 'chuongTrinhList', 'auditLogs'] as const;
const OPTIONAL_ARRAYS = [
  'pdfFiles',
  'donThuList',
  'diaBanRecords',
  'hoSoDiaBanFiles',
  'phanCongDiaBan',
] as const;

/**
 * Trả về đối tượng luôn có đủ các mảng bắt buộc:
 * - mảng bắt buộc thiếu hoặc sai kiểu thì đặt thành [] (riêng users: dùng danh sách mặc định)
 * - mảng tùy chọn nếu có mà sai kiểu thì bỏ đi (không tự tạo mới để giữ nguyên ý nghĩa "chưa có")
 * - bỏ cờ di trú nếu còn sót
 */
export function normalizeMockDb<T extends object>(
  parsed: unknown,
  makeDefaultUsers: () => unknown[]
): T {
  const src: Record<string, unknown> =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};

  delete src[MIGRATION_PLACEHOLDER_FLAG];

  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(src[key])) src[key] = [];
  }
  if ((src.users as unknown[]).length === 0) src.users = makeDefaultUsers();

  for (const key of OPTIONAL_ARRAYS) {
    if (key in src && !Array.isArray(src[key])) delete src[key];
  }
  return src as T;
}
