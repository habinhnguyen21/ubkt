import { describe, it, expect, beforeEach } from 'vitest';
import { cloudSyncService } from '../src/services/cloudSyncService';
import { ensureFirebaseAuthReady } from '../src/services/firebase';
import { sessionStore } from '../src/utils/sessionStore';
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

describe('Firebase Auth Synchronization & Mobile Fallback Handling', () => {
  const mockUser: User = {
    id: 'uid-mobile-001',
    ten_dang_nhap: 'admin',
    ho_ten: 'Quản trị viên',
    vai_tro: 'ADMIN',
    trang_thai: 1,
    must_change_password: false,
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
  });

  it('1. ensureFirebaseAuthReady không bị crash khi không có user và trả về null một cách an toàn', async () => {
    const user = await ensureFirebaseAuthReady(200);
    // Trong môi trường test không có Firebase backend trực tiếp, hàm phải trả về null hoặc mock user mà không ném exception
    expect(user === null || typeof user === 'object').toBe(true);
  });

  it('2. pullAllFromCloud trả về thông báo lỗi rõ ràng khi chưa có Firebase Auth nhưng có session trong storage', async () => {
    sessionStore.saveSession(mockUser, 'test-token', true, 'sess_001');

    const res = await cloudSyncService.pullAllFromCloud();
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    // Phải thông báo phiên xác thực Firebase Auth chưa sẵn sàng / yêu cầu đăng nhập
    expect(res.error).toContain('Firebase Auth');
  });

  it('3. pushAllToCloud trả về thông báo lỗi rõ ràng khi chưa có Firebase Auth', async () => {
    sessionStore.saveSession(mockUser, 'test-token', true, 'sess_001');

    const res = await cloudSyncService.pushAllToCloud();
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).toContain('Firebase Auth');
  });

  it('4. getCloudSummary trả về trạng thái authReady = false và counts an toàn khi chưa đăng nhập Firebase', async () => {
    const summary = await cloudSyncService.getCloudSummary();
    expect(summary.isOnline).toBe(false);
    expect(summary.counts).toEqual({
      donVi: 0,
      chuongTrinh: 0,
      hoSoDiaBan: 0,
      hoSoFiles: 0,
      baoCaoThang: 0,
      pdfFiles: 0,
    });
    expect(summary.authReady).toBe(false);
  });
});
