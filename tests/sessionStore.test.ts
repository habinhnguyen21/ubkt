import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sessionStore,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_MAX_LIFETIME_MS,
  SESSION_KEYS,
} from '../src/utils/sessionStore';
import type { User } from '../src/types';

// Mock storage helper for environment
class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

describe('sessionStore - Quản lý phiên làm việc, ghi nhớ đăng nhập và tự động khóa', () => {
  const mockUser: User = {
    id: 'u-admin-123',
    ten_dang_nhap: 'admin',
    ho_ten: 'Quản trị viên',
    vai_tro: 'ADMIN',
    chuc_danh: 'Chủ nhiệm UBKT',
    trang_thai: 1,
  };
  const mockToken = 'mock-firebase-id-token-xyz';

  beforeEach(() => {
    // Gắn memory storage vào global/window nếu chưa có hoặc dọn sạch
    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    const memLocal = new MemoryStorage();
    const memSession = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: memLocal,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: memSession,
      writable: true,
      configurable: true,
    });
    sessionStore.clearSession();
    vi.restoreAllMocks();
  });

  it('1. Đăng nhập KHÔNG tích ghi nhớ: lưu vào sessionStorage, không lưu localStorage', () => {
    sessionStore.saveSession(mockUser, mockToken, false);

    // Kiểm tra trong sessionStorage
    expect(sessionStorage.getItem(SESSION_KEYS.USER)).toBe(JSON.stringify(mockUser));
    expect(sessionStorage.getItem(SESSION_KEYS.TOKEN)).toBe(mockToken);
    expect(sessionStorage.getItem(SESSION_KEYS.REMEMBER)).toBe('false');

    // Không tồn tại trong localStorage
    expect(localStorage.getItem(SESSION_KEYS.USER)).toBeNull();
    expect(localStorage.getItem(SESSION_KEYS.TOKEN)).toBeNull();
    expect(sessionStore.isRememberMe()).toBe(false);

    // getCurrentUser và getToken trả về đúng
    expect(sessionStore.getCurrentUser()).toEqual(mockUser);
    expect(sessionStore.getToken()).toBe(mockToken);
  });

  it('2. Đăng nhập CÓ tích ghi nhớ: lưu vào localStorage kèm thời điểm đăng nhập', () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    sessionStore.saveSession(mockUser, mockToken, true);

    // Kiểm tra trong localStorage
    expect(localStorage.getItem(SESSION_KEYS.USER)).toBe(JSON.stringify(mockUser));
    expect(localStorage.getItem(SESSION_KEYS.TOKEN)).toBe(mockToken);
    expect(localStorage.getItem(SESSION_KEYS.REMEMBER)).toBe('true');
    expect(localStorage.getItem(SESSION_KEYS.LOGIN_TIME)).toBe(now.toString());
    expect(sessionStore.isRememberMe()).toBe(true);

    // Dọn sạch sessionStorage
    expect(sessionStorage.getItem(SESSION_KEYS.USER)).toBeNull();

    // getCurrentUser và getToken lấy từ localStorage
    expect(sessionStore.getCurrentUser()).toEqual(mockUser);
    expect(sessionStore.getToken()).toBe(mockToken);
  });

  it('3. Phiên ghi nhớ trong localStorage hết hạn tuyệt đối sau 12 giờ', () => {
    const loginTime = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(loginTime);

    sessionStore.saveSession(mockUser, mockToken, true);
    expect(sessionStore.isSessionExpired()).toBe(false);

    // 11 giờ sau: chưa hết hạn
    vi.spyOn(Date, 'now').mockReturnValue(loginTime + 11 * 60 * 60 * 1000);
    expect(sessionStore.isSessionExpired()).toBe(false);
    expect(sessionStore.getCurrentUser()).toEqual(mockUser);

    // Quá 12 giờ (12 giờ + 1 phút): hết hạn tuyệt đối, tự động dọn phiên
    vi.spyOn(Date, 'now').mockReturnValue(loginTime + SESSION_MAX_LIFETIME_MS + 60000);
    expect(sessionStore.isSessionExpired()).toBe(true);
    expect(sessionStore.getCurrentUser()).toBeNull();
    expect(localStorage.getItem(SESSION_KEYS.USER)).toBeNull();
  });

  it('4. Tự động kiểm tra idle timeout (> 15 phút không thao tác)', () => {
    const startTime = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(startTime);

    sessionStore.saveSession(mockUser, mockToken, true);
    expect(sessionStore.isIdleTimedOut()).toBe(false);

    // 10 phút trôi qua: chưa khóa
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 10 * 60 * 1000);
    expect(sessionStore.isIdleTimedOut()).toBe(false);

    // 16 phút trôi qua (> 15 phút): bị timeout
    vi.spyOn(Date, 'now').mockReturnValue(startTime + SESSION_IDLE_TIMEOUT_MS + 60000);
    expect(sessionStore.isIdleTimedOut()).toBe(true);
  });

  it('5. recordActivity ghi nhận thao tác và throttle 30 giây', () => {
    const t0 = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(t0);

    sessionStore.saveSession(mockUser, mockToken, false);
    sessionStore.recordActivity(true);
    expect(sessionStore.getLastActivity()).toBe(t0);

    // Thao tác lại sau 10 giây: bị throttle (không ghi vào storage)
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 10000);
    sessionStore.recordActivity(false);
    expect(sessionStore.getLastActivity()).toBe(t0);

    // Thao tác lại sau 35 giây: được cập nhật
    const t35 = t0 + 35000;
    vi.spyOn(Date, 'now').mockReturnValue(t35);
    sessionStore.recordActivity(false);
    expect(sessionStore.getLastActivity()).toBe(t35);
  });

  it('6. setSessionLocked và isSessionLocked quản lý cờ khóa màn hình', () => {
    sessionStore.saveSession(mockUser, mockToken, false);
    expect(sessionStore.isSessionLocked()).toBe(false);

    sessionStore.setSessionLocked(true);
    expect(sessionStore.isSessionLocked()).toBe(true);

    sessionStore.setSessionLocked(false);
    expect(sessionStore.isSessionLocked()).toBe(false);
  });

  it('7. clearSession xóa sạch tất cả khóa phiên ở cả 2 storage', () => {
    sessionStore.saveSession(mockUser, mockToken, true);
    sessionStore.setSessionLocked(true);

    // Thêm rác vào cả sessionStorage
    sessionStorage.setItem(SESSION_KEYS.USER, 'temp');

    sessionStore.clearSession();

    expect(sessionStore.getCurrentUser()).toBeNull();
    expect(sessionStore.getToken()).toBeNull();
    expect(sessionStore.isSessionLocked()).toBe(false);
    expect(sessionStore.getLastActivity()).toBeNull();
    expect(localStorage.getItem(SESSION_KEYS.USER)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEYS.USER)).toBeNull();
  });
});

