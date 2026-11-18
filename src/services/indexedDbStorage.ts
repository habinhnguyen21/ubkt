import { openDB, type IDBPDatabase } from 'idb';
import { isMigrationPlaceholder } from '../utils/mockDbNormalize';

const DB_NAME = 'ubkt_indexeddb_storage';
const DB_VERSION = 1;
const STORE_COLLECTIONS = 'collections';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
          db.createObjectStore(STORE_COLLECTIONS);
        }
      },
    });
  }
  return dbPromise;
}

// Bộ nhớ cache in-memory để truy xuất đồng bộ (sync cache) không gián đoạn app
const memoryCache = new Map<string, any>();
let isMigrated = false;

// Danh sách các key dữ liệu lớn cần chuyển từ localStorage sang IndexedDB
export const LARGE_STORAGE_KEYS = [
  'ubkt_mock_db',
  'ubkt_ho_so_dia_ban_records',
  'ubkt_ho_so_dia_ban_files',
  'ubkt_bao_cao_thang',
] as const;

export type LargeStorageKey = (typeof LARGE_STORAGE_KEYS)[number];

export const indexedDbStorage = {
  /**
   * CẢNH BÁO: KHÔNG gọi hàm này cho tới khi MỌI nơi đọc/ghi 4 khóa trong LARGE_STORAGE_KEYS đã chuyển sang
   * indexedDbStorage. Hàm này thay nội dung các khóa trong localStorage bằng bản đánh dấu
   * {"_migrated_to_idb": true}, trong khi hàng chục nơi trong ứng dụng vẫn đọc trực tiếp localStorage
   * nên sẽ thấy dữ liệu rỗng và lỗi (đã từng xảy ra). Muốn khôi phục dữ liệu đã bị di trú, dùng restoreMigratedKeys().
   *
   * Khởi tạo và tự động di trú một lần từ localStorage sang IndexedDB
   */
  async init(): Promise<void> {
    if (isMigrated) return;

    try {
      const db = await getDb();

      for (const key of LARGE_STORAGE_KEYS) {
        const idbVal = await db.get(STORE_COLLECTIONS, key);

        if (idbVal !== undefined) {
          memoryCache.set(key, idbVal);
        } else {
          // Kiểm tra xem có dữ liệu cũ trong localStorage không
          const raw = localStorage.getItem(key);
          if (raw !== null) {
            try {
              const parsed = JSON.parse(raw);
              await db.put(STORE_COLLECTIONS, parsed, key);
              memoryCache.set(key, parsed);
              // Lưu placeholder nhỏ gọn trong localStorage để đánh dấu
              localStorage.setItem(key, JSON.stringify({ _migrated_to_idb: true }));
            } catch {
              await db.put(STORE_COLLECTIONS, raw, key);
              memoryCache.set(key, raw);
            }
          }
        }
      }

      isMigrated = true;
    } catch (err) {
      console.warn('[IndexedDB] Khởi tạo IndexedDB thất bại, sử dụng fallback bộ nhớ:', err);
      // Fallback: đọc trực tiếp localStorage
      for (const key of LARGE_STORAGE_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) memoryCache.set(key, JSON.parse(raw));
        } catch {}
      }
    }
  },

  /**
   * Đọc dữ liệu nhanh từ Memory Cache (đồng bộ)
   */
  getItem<T>(key: LargeStorageKey): T | null {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }
    // Nếu chưa có trong cache, thử đọc tạm từ localStorage (cho các trường hợp vừa load trang)
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed?._migrated_to_idb) {
          memoryCache.set(key, parsed);
          return parsed as T;
        }
      }
    } catch {}
    return null;
  },

  /**
   * Ghi dữ liệu bất đồng bộ vào IndexedDB kèm cập nhật Memory Cache và bắt lỗi QuotaExceededError
   */
  async setItem<T>(key: LargeStorageKey, value: T): Promise<void> {
    memoryCache.set(key, value);

    try {
      const db = await getDb();
      await db.put(STORE_COLLECTIONS, value, key);
    } catch (err: any) {
      if (
        err?.name === 'QuotaExceededError' ||
        err?.code === 22 ||
        err?.message?.includes('quota')
      ) {
        console.error(
          `[IndexedDB] QuotaExceededError khi lưu key "${key}". Bộ nhớ trình duyệt đã đầy:`,
          err
        );
        alert(
          'Cảnh báo: Bộ nhớ trình duyệt của thiết bị đã đầy (QuotaExceededError). Vui lòng dọn dẹp bớt dữ liệu lưu trữ để tiếp tục.'
        );
      } else {
        console.warn(`[IndexedDB] Lỗi ghi dữ liệu cho key "${key}":`, err);
      }
    }
  },

  /**
   * Xóa một key trong IndexedDB
   */
  async removeItem(key: LargeStorageKey): Promise<void> {
    memoryCache.delete(key);
    try {
      const db = await getDb();
      await db.delete(STORE_COLLECTIONS, key);
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[IndexedDB] Lỗi xóa key "${key}":`, err);
    }
  },
};


// ───────────────────────────────────────────────────────────────────────────
// Khôi phục dữ liệu đã bị di trú sang IndexedDB về lại localStorage
// ───────────────────────────────────────────────────────────────────────────

export interface RestoreDeps {
  getStored(key: string): string | null;
  setStored(key: string, value: string): void;
  removeStored(key: string): void;
  readIdb(key: string): Promise<unknown | undefined>;
  deleteIdb(key: string): Promise<void>;
}

export interface RestoreResult {
  restored: string[];
  removed: string[];
}

const defaultRestoreDeps: RestoreDeps = {
  getStored: (key) => localStorage.getItem(key),
  setStored: (key, value) => localStorage.setItem(key, value),
  removeStored: (key) => localStorage.removeItem(key),
  readIdb: async (key) => (await getDb()).get(STORE_COLLECTIONS, key),
  deleteIdb: async (key) => {
    await (await getDb()).delete(STORE_COLLECTIONS, key);
  },
};

/**
 * Với mỗi khóa dữ liệu lớn mà localStorage đang chỉ chứa bản đánh dấu di trú:
 * - nếu IndexedDB còn bản dữ liệu thật thì ghi trả về localStorage (đúng nơi ứng dụng đang đọc);
 * - nếu không khôi phục được (không có bản trong IndexedDB, hoặc đầy bộ nhớ) thì xóa khóa đó để ứng dụng
 *   tự nạp lại từ Cloud khi đồng bộ.
 * Các khóa không phải bản đánh dấu thì giữ nguyên, không đụng tới.
 */
export async function restoreMigratedKeys(
  deps: RestoreDeps = defaultRestoreDeps
): Promise<RestoreResult> {
  const result: RestoreResult = { restored: [], removed: [] };

  for (const key of LARGE_STORAGE_KEYS) {
    let raw: string | null;
    try {
      raw = deps.getStored(key);
    } catch {
      continue;
    }
    if (raw === null) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // không phải JSON: không phải bản đánh dấu, để nguyên
    }
    if (!isMigrationPlaceholder(parsed)) continue;

    let restored = false;
    try {
      const value = await deps.readIdb(key);
      if (value !== undefined && value !== null) {
        deps.setStored(key, typeof value === 'string' ? value : JSON.stringify(value));
        restored = true;
        await deps.deleteIdb(key).catch(() => undefined);
      }
    } catch (err) {
      console.warn(`[IndexedDB] Không khôi phục được khóa "${key}" về localStorage:`, err);
    }

    if (restored) {
      result.restored.push(key);
    } else {
      try {
        deps.removeStored(key);
        result.removed.push(key);
      } catch {
        // bỏ qua
      }
    }
  }
  return result;
}
