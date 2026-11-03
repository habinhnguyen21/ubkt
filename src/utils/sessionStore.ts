import type { User } from '../types';

/**
 * Hằng số cấu hình thời gian tự động khóa phiên làm việc khi không có thao tác (15 phút).
 */
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Hằng số cấu hình thời gian hết hạn tuyệt đối của phiên ghi nhớ trên thiết bị (12 giờ).
 */
export const SESSION_MAX_LIFETIME_MS = 12 * 60 * 60 * 1000;

/**
 * Thời gian giãn cách tối thiểu giữa các lần cập nhật thời điểm thao tác gần nhất (30 giây).
 */
export const ACTIVITY_THROTTLE_MS = 30 * 1000;

export const SESSION_KEYS = {
  USER: 'ubkt_current_user',
  TOKEN: 'ubkt_session_token',
  LOGIN_TIME: 'ubkt_login_timestamp',
  REMEMBER: 'ubkt_remember_me',
  LAST_ACTIVITY: 'ubkt_last_activity',
  LOCKED: 'ubkt_session_locked',
} as const;

let lastRecordedActivityTime = 0;

/**
 * Kiểm tra xem phiên làm việc trong storage có bị quá hạn tuyệt đối (12 giờ) hay không.
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawTime =
      sessionStorage.getItem(SESSION_KEYS.LOGIN_TIME) ||
      localStorage.getItem(SESSION_KEYS.LOGIN_TIME);
    if (!rawTime) return false;
    const loginTime = parseInt(rawTime, 10);
    if (isNaN(loginTime)) return false;
    return Date.now() - loginTime > SESSION_MAX_LIFETIME_MS;
  } catch {
    return false;
  }
}

/**
 * Lấy thông tin người dùng hiện tại từ sessionStorage hoặc localStorage.
 * Nếu phiên trong localStorage đã hết hạn (12 giờ) thì tự động xóa phiên và trả về null.
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Kiểm tra sessionStorage trước (phiên không ghi nhớ)
    const sessionRaw = sessionStorage.getItem(SESSION_KEYS.USER);
    if (sessionRaw) {
      return JSON.parse(sessionRaw);
    }

    // 2. Kiểm tra localStorage (phiên ghi nhớ trên thiết bị)
    const localRaw = localStorage.getItem(SESSION_KEYS.USER);
    if (localRaw) {
      if (isSessionExpired()) {
        clearSession();
        return null;
      }
      return JSON.parse(localRaw);
    }
    return null;
  } catch (err) {
    console.warn('[sessionStore] Lỗi đọc thông tin người dùng:', err);
    return null;
  }
}

/**
 * Cập nhật thông tin người dùng hiện tại vào đúng nơi lưu trữ (sessionStorage hoặc localStorage).
 */
export function setCurrentUser(user: User): void {
  if (typeof window === 'undefined') return;
  const str = JSON.stringify(user);
  try {
    if (sessionStorage.getItem(SESSION_KEYS.USER)) {
      sessionStorage.setItem(SESSION_KEYS.USER, str);
    }
    if (localStorage.getItem(SESSION_KEYS.USER)) {
      localStorage.setItem(SESSION_KEYS.USER, str);
    }
  } catch (err) {
    console.warn('[sessionStore] Lỗi cập nhật người dùng:', err);
  }
}

/**
 * Lấy token xác thực phiên hiện tại.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sessionToken = sessionStorage.getItem(SESSION_KEYS.TOKEN);
    if (sessionToken) return sessionToken;
    if (isSessionExpired()) {
      clearSession();
      return null;
    }
    return localStorage.getItem(SESSION_KEYS.TOKEN);
  } catch {
    return null;
  }
}

/**
 * Cập nhật token phiên làm việc vào đúng nơi lưu trữ.
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(SESSION_KEYS.USER)) {
      sessionStorage.setItem(SESSION_KEYS.TOKEN, token);
    }
    if (localStorage.getItem(SESSION_KEYS.USER)) {
      localStorage.setItem(SESSION_KEYS.TOKEN, token);
    }
  } catch (err) {
    console.warn('[sessionStore] Lỗi cập nhật token:', err);
  }
}

/**
 * Lưu phiên đăng nhập mới.
 * - rememberMe = false: lưu vào sessionStorage, dọn sạch localStorage. Đóng tab/trình duyệt là mất.
 * - rememberMe = true: lưu vào localStorage kèm thời điểm đăng nhập (hết hạn tuyệt đối sau 12 giờ).
 */
export function saveSession(user: User, token: string, rememberMe: boolean): void {
  if (typeof window === 'undefined') return;
  const now = Date.now().toString();
  const userStr = JSON.stringify(user);
  lastRecordedActivityTime = Date.now();

  if (rememberMe) {
    // Dọn sạch ở sessionStorage
    try {
      sessionStorage.removeItem(SESSION_KEYS.USER);
      sessionStorage.removeItem(SESSION_KEYS.TOKEN);
      sessionStorage.removeItem(SESSION_KEYS.LOGIN_TIME);
      sessionStorage.removeItem(SESSION_KEYS.REMEMBER);
      sessionStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
      sessionStorage.removeItem(SESSION_KEYS.LOCKED);
    } catch {}

    // Lưu vào localStorage
    try {
      localStorage.setItem(SESSION_KEYS.USER, userStr);
      localStorage.setItem(SESSION_KEYS.TOKEN, token);
      localStorage.setItem(SESSION_KEYS.LOGIN_TIME, now);
      localStorage.setItem(SESSION_KEYS.REMEMBER, 'true');
      localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, now);
      localStorage.removeItem(SESSION_KEYS.LOCKED);
    } catch (err) {
      console.warn('[sessionStore] Lỗi lưu vào localStorage:', err);
    }
  } else {
    // Dọn sạch ở localStorage
    try {
      localStorage.removeItem(SESSION_KEYS.USER);
      localStorage.removeItem(SESSION_KEYS.TOKEN);
      localStorage.removeItem(SESSION_KEYS.LOGIN_TIME);
      localStorage.removeItem(SESSION_KEYS.REMEMBER);
      localStorage.removeItem(SESSION_KEYS.LAST_ACTIVITY);
      localStorage.removeItem(SESSION_KEYS.LOCKED);
    } catch {}

    // Lưu vào sessionStorage
    try {
      sessionStorage.setItem(SESSION_KEYS.USER, userStr);
      sessionStorage.setItem(SESSION_KEYS.TOKEN, token);
      sessionStorage.setItem(SESSION_KEYS.LOGIN_TIME, now);
      sessionStorage.setItem(SESSION_KEYS.REMEMBER, 'false');
      sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, now);
      sessionStorage.removeItem(SESSION_KEYS.LOCKED);
    } catch (err) {
      console.warn('[sessionStore] Lỗi lưu vào sessionStorage:', err);
    }
  }
}

/**
 * Xóa toàn bộ thông tin phiên làm việc khỏi cả sessionStorage và localStorage.
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  lastRecordedActivityTime = 0;
  const keys = [
    SESSION_KEYS.USER,
    SESSION_KEYS.TOKEN,
    SESSION_KEYS.LOGIN_TIME,
    SESSION_KEYS.REMEMBER,
    SESSION_KEYS.LAST_ACTIVITY,
    SESSION_KEYS.LOCKED,
  ];

  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
    try {
      sessionStorage.removeItem(key);
    } catch {}
  });
}

/**
 * Ghi lại thời điểm thao tác gần nhất (chuột, phím, chạm, cuộn).
 * Tối đa 30 giây một lần để tránh nghẽn I/O lưu trữ, trừ khi force = true.
 */
export function recordActivity(force = false): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!force && now - lastRecordedActivityTime < ACTIVITY_THROTTLE_MS) {
    return;
  }
  lastRecordedActivityTime = now;
  const nowStr = now.toString();

  try {
    if (sessionStorage.getItem(SESSION_KEYS.USER)) {
      sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, nowStr);
    }
    if (localStorage.getItem(SESSION_KEYS.USER)) {
      localStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, nowStr);
    }
  } catch {}
}

/**
 * Lấy mốc thời gian thao tác gần nhất (epoch ms).
 */
export function getLastActivity(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = sessionStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
    if (fromSession) {
      const val = parseInt(fromSession, 10);
      if (!isNaN(val)) return val;
    }
    const fromLocal = localStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
    if (fromLocal) {
      const val = parseInt(fromLocal, 10);
      if (!isNaN(val)) return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra xem phiên làm việc đã quá 15 phút kể từ thao tác cuối hay chưa.
 */
export function isIdleTimedOut(): boolean {
  const last = getLastActivity();
  if (!last) return false;
  return Date.now() - last > SESSION_IDLE_TIMEOUT_MS;
}

/**
 * Kiểm tra trạng thái khóa màn hình.
 */
export function isSessionLocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      sessionStorage.getItem(SESSION_KEYS.LOCKED) === 'true' ||
      localStorage.getItem(SESSION_KEYS.LOCKED) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Đặt hoặc gỡ trạng thái khóa màn hình.
 */
export function setSessionLocked(locked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (locked) {
      if (sessionStorage.getItem(SESSION_KEYS.USER)) {
        sessionStorage.setItem(SESSION_KEYS.LOCKED, 'true');
      }
      if (localStorage.getItem(SESSION_KEYS.USER)) {
        localStorage.setItem(SESSION_KEYS.LOCKED, 'true');
      }
    } else {
      sessionStorage.removeItem(SESSION_KEYS.LOCKED);
      localStorage.removeItem(SESSION_KEYS.LOCKED);
    }
  } catch {}
}

/**
 * Kiểm tra xem phiên làm việc hiện tại có được ghi nhớ trên thiết bị không.
 */
export function isRememberMe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SESSION_KEYS.REMEMBER) === 'true';
  } catch {
    return false;
  }
}

export const sessionStore = {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_MAX_LIFETIME_MS,
  ACTIVITY_THROTTLE_MS,
  SESSION_KEYS,
  isSessionExpired,
  getCurrentUser,
  setCurrentUser,
  getToken,
  setToken,
  saveSession,
  clearSession,
  recordActivity,
  getLastActivity,
  isIdleTimedOut,
  isSessionLocked,
  setSessionLocked,
  isRememberMe,
};

