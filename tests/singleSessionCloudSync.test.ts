import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cloudSyncService } from '../src/services/cloudSyncService';
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

describe('Single-Session Write Guard & Permission Denied Handling', () => {
  const mockUser: User = {
    id: 'uid-test-01',
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
    if (!window.dispatchEvent) {
      (window as any).dispatchEvent = vi.fn();
    }
    if (!window.addEventListener) {
      (window as any).addEventListener = vi.fn();
      (window as any).removeEventListener = vi.fn();
    }

    sessionStore.clearSession();
    sessionStore.setSessionLocked(false);
    sessionStore.saveSession(mockUser, 'test-token', false, 'sess_device_1');
  });

  it('1. isPermissionDeniedError nhận diện chính xác các mã và thông báo lỗi permission-denied', () => {
    expect(cloudSyncService.isPermissionDeniedError({ code: 'permission-denied' })).toBe(true);
    expect(cloudSyncService.isPermissionDeniedError({ code: 'firestore/permission-denied' })).toBe(true);
    expect(cloudSyncService.isPermissionDeniedError({ message: 'Missing or insufficient permissions.' })).toBe(true);
    expect(cloudSyncService.isPermissionDeniedError({ message: 'PERMISSION_DENIED: Phiên làm việc đã hết hạn' })).toBe(true);
    expect(cloudSyncService.isPermissionDeniedError({ message: 'Error: permission-denied at doc' })).toBe(true);
    expect(cloudSyncService.isPermissionDeniedError({ code: 'unavailable' })).toBe(false);
    expect(cloudSyncService.isPermissionDeniedError(null)).toBe(false);
  });

  it('2. handleSessionPermissionDenied kích hoạt khóa màn hình LockScreen và phát sự kiện', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    cloudSyncService.handleSessionPermissionDenied(new Error('permission-denied'));

    expect(sessionStore.isSessionLocked()).toBe(true);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('3. Phiên mới lưu sessionId chính xác và thay thế phiên cũ', () => {
    expect(sessionStore.getSessionId()).toBe('sess_device_1');

    // Thiết bị mới đăng nhập
    sessionStore.saveSession(mockUser, 'test-token-2', false, 'sess_device_2');
    expect(sessionStore.getSessionId()).toBe('sess_device_2');
  });
});
