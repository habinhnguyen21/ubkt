import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getIsMobile } from '../src/hooks/useIsMobile';

describe('useIsMobile & getIsMobile', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('an toàn khi chạy không có window (môi trường server / SSR)', () => {
    // @ts-expect-error - Giả lập không có window
    delete globalThis.window;
    expect(getIsMobile()).toBe(false);
  });

  it('an toàn khi window không hỗ trợ matchMedia', () => {
    // @ts-expect-error - Giả lập window không có matchMedia
    globalThis.window = {};
    expect(getIsMobile()).toBe(false);
  });

  it('trả về true khi matchMedia khớp điện thoại (<= 767px)', () => {
    globalThis.window = {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('767px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    } as any;

    expect(getIsMobile('(max-width: 767px)')).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('trả về false khi matchMedia là máy tính (> 767px)', () => {
    globalThis.window = {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    } as any;

    expect(getIsMobile('(max-width: 767px)')).toBe(false);
  });

  it('bắt đúng lỗi nếu window.matchMedia ném exception', () => {
    globalThis.window = {
      matchMedia: vi.fn().mockImplementation(() => {
        throw new Error('Not supported');
      }),
    } as any;

    expect(getIsMobile()).toBe(false);
  });
});
