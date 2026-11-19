import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionStore, SESSION_KEYS, SESSION_MAX_LIFETIME_MS } from '../src/utils/sessionStore';
import { sanitizeUserForCloud, stripSecretsFromUser } from '../src/utils/passwordCrypto';
import type { User } from '../src/types';

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

describe('Cơ chế một-tài-khoản-một-thiết-bị & Quản lý phiên làm việc', () => {
  const mockUser: User & { activeSessionId?: string; lastLoginDevice?: string; lastActiveAt?: any } = {
    id: 'uid-test-guard',
    ten_dang_nhap: 'hahoangbinhnguyen',
    ho_ten: 'Hà Hoàng Bình Nguyên',
    vai_tro: 'ADMIN',
    trang_thai: 1,
    must_change_password: false,
    activeSessionId: 'sess_cloud_123',
    lastLoginDevice: 'Mozilla/5.0 Test Browser',
    lastActiveAt: 1700000000000,
  };

  beforeEach(() => {
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

  describe('1. Kiểm tra tính hợp lệ của phiên làm việc', () => {
    it('1.1. Máy không có sessionId cục bộ thì không được coi là phiên hợp lệ', () => {
      // Giả lập storage có thông tin user nhưng không có sessionId
      localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(mockUser));
      localStorage.setItem(SESSION_KEYS.TOKEN, 'test-token');
      localStorage.setItem(SESSION_KEYS.REMEMBER, 'true');

      const localSessionId = sessionStore.getSessionId();
      expect(localSessionId).toBeNull();

      // Kiểm tra logic xác thực phiên: bắt buộc phải có đồng thời user, token và sessionId
      const isValidLocalSession = Boolean(
        sessionStore.getCurrentUser() &&
        sessionStore.getToken() &&
        sessionStore.getSessionId()
      );
      expect(isValidLocalSession).toBe(false);
    });

    it('1.2. Cloud chưa có activeSessionId (tài khoản cũ) thì không coi là phiên hợp lệ', () => {
      const currentLocalSessionId = 'sess_local_456';
      sessionStore.saveSession(mockUser, 'test-token', true, currentLocalSessionId);
      expect(sessionStore.getSessionId()).toBe(currentLocalSessionId);

      const cloudDataWithoutSession: any = { ...mockUser };
      delete cloudDataWithoutSession.activeSessionId;

      // Hàm kiểm tra tính hợp lệ giữa Cloud và Local
      const isCloudSessionValid = (cloudActiveSessionId: any, localSessionId: string | null): boolean => {
        if (!cloudActiveSessionId || typeof cloudActiveSessionId !== 'string') return false;
        if (!localSessionId) return false;
        return cloudActiveSessionId === localSessionId;
      };

      // Khi Cloud không có activeSessionId -> không hợp lệ, buộc đăng nhập lại
      expect(isCloudSessionValid(cloudDataWithoutSession.activeSessionId, sessionStore.getSessionId())).toBe(false);
    });

    it('1.3. activeSessionId trên Cloud khác sessionId cục bộ thì không coi là hợp lệ', () => {
      const localSessionId = 'sess_device_laptop';
      sessionStore.saveSession(mockUser, 'test-token', true, localSessionId);

      const cloudActiveSessionId = 'sess_device_phone'; // thiết bị khác vừa đăng nhập
      const isMatch = cloudActiveSessionId === sessionStore.getSessionId();
      expect(isMatch).toBe(false);
    });

    it('1.4. activeSessionId trên Cloud khớp sessionId cục bộ thì được coi là hợp lệ', () => {
      const matchingSessionId = 'sess_device_same';
      sessionStore.saveSession(mockUser, 'test-token', true, matchingSessionId);

      const cloudActiveSessionId = 'sess_device_same';
      expect(cloudActiveSessionId === sessionStore.getSessionId()).toBe(true);
    });
  });

  describe('2. Ghi hồ sơ người dùng không bao giờ chứa activeSessionId', () => {
    it('2.1. sanitizeUserForCloud loại bỏ hoàn toàn activeSessionId, lastLoginDevice, lastActiveAt', () => {
      const sanitized = sanitizeUserForCloud(mockUser) as any;
      expect(sanitized.activeSessionId).toBeUndefined();
      expect(sanitized.lastLoginDevice).toBeUndefined();
      expect(sanitized.lastActiveAt).toBeUndefined();
      expect(sanitized.id).toBe(mockUser.id);
      expect(sanitized.ten_dang_nhap).toBe(mockUser.ten_dang_nhap);
    });

    it('2.2. stripSecretsFromUser loại bỏ hoàn toàn activeSessionId, lastLoginDevice, lastActiveAt', () => {
      const stripped = stripSecretsFromUser(mockUser) as any;
      expect(stripped.activeSessionId).toBeUndefined();
      expect(stripped.lastLoginDevice).toBeUndefined();
      expect(stripped.lastActiveAt).toBeUndefined();
      expect(stripped.id).toBe(mockUser.id);
    });

    it('2.3. sessionStore.saveSession và setCurrentUser không bao giờ lưu activeSessionId vào ubkt_current_user', () => {
      sessionStore.saveSession(mockUser, 'test-token', true, 'sess_keep_separate');

      const savedUserStr = localStorage.getItem(SESSION_KEYS.USER);
      expect(savedUserStr).not.toBeNull();
      const parsedUser = JSON.parse(savedUserStr!);
      expect(parsedUser.activeSessionId).toBeUndefined();
      expect(parsedUser.lastLoginDevice).toBeUndefined();
      expect(parsedUser.lastActiveAt).toBeUndefined();

      // Khi gọi setCurrentUser cập nhật thông tin
      sessionStore.setCurrentUser({
        ...mockUser,
        activeSessionId: 'sess_leak_attempt',
        ho_ten: 'Tên đã cập nhật',
      } as any);

      const updatedUserStr = localStorage.getItem(SESSION_KEYS.USER);
      const parsedUpdated = JSON.parse(updatedUserStr!);
      expect(parsedUpdated.ho_ten).toBe('Tên đã cập nhật');
      expect(parsedUpdated.activeSessionId).toBeUndefined();
      expect(parsedUpdated.lastLoginDevice).toBeUndefined();
      expect(parsedUpdated.lastActiveAt).toBeUndefined();
    });
  });

  describe('3. Khôi phục phiên không làm mới thời điểm đăng nhập', () => {
    it('3.1. setCurrentUser khi khôi phục không thay đổi LOGIN_TIME hay LAST_ACTIVITY', () => {
      const loginTime = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(loginTime);

      sessionStore.saveSession(mockUser, 'token-123', true, 'sess_device_1');
      expect(localStorage.getItem(SESSION_KEYS.LOGIN_TIME)).toBe(loginTime.toString());
      expect(localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY)).toBe(loginTime.toString());

      // 2 giờ sau người dùng mở lại trang web (1700007200000)
      const reopenTime = loginTime + 2 * 60 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(reopenTime);

      // Khi khôi phục phiên: chỉ gọi sessionStore.setCurrentUser, KHÔNG gọi saveSession
      sessionStore.setCurrentUser({
        ...mockUser,
        ho_ten: 'Hà Hoàng Bình Nguyên (Khôi phục)',
      });

      // Thời điểm đăng nhập ban đầu vẫn giữ nguyên mốc 1700000000000
      expect(localStorage.getItem(SESSION_KEYS.LOGIN_TIME)).toBe(loginTime.toString());
      expect(localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY)).toBe(loginTime.toString());

      // Phiên vẫn chưa hết hạn 12 giờ
      expect(sessionStore.isSessionExpired()).toBe(false);

      // Quá 12 giờ kể từ mốc đăng nhập ban đầu: hết hạn tuyệt đối
      vi.spyOn(Date, 'now').mockReturnValue(loginTime + SESSION_MAX_LIFETIME_MS + 1000);
      expect(sessionStore.isSessionExpired()).toBe(true);
    });
  });

  describe('4. Không nhớ đăng nhập thì sau khi mất sessionStorage phải đăng nhập lại', () => {
    it('4.1. rememberMe = false lưu vào sessionStorage, khi mất sessionStorage không còn phiên', () => {
      sessionStore.saveSession(mockUser, 'session-token', false, 'sess_temp_123');

      // Có phiên trong sessionStorage
      expect(sessionStore.getCurrentUser()).toEqual(stripSecretsFromUser(mockUser));
      expect(sessionStore.getSessionId()).toBe('sess_temp_123');
      expect(sessionStore.isRememberMe()).toBe(false);

      // Không lưu gì trong localStorage
      expect(localStorage.getItem(SESSION_KEYS.USER)).toBeNull();
      expect(localStorage.getItem(SESSION_KEYS.SESSION_ID)).toBeNull();

      // Giả lập đóng tab / trình duyệt làm mất sessionStorage
      sessionStorage.clear();

      // Sau khi mất sessionStorage, không còn phiên và buộc đăng nhập lại
      expect(sessionStore.getCurrentUser()).toBeNull();
      expect(sessionStore.getSessionId()).toBeNull();
      expect(sessionStore.getToken()).toBeNull();
    });
  });
});
