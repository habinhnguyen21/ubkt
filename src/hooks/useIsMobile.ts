import { useState, useEffect } from 'react';

/**
 * Kiểm tra xem màn hình hiện tại có thỏa mãn media query hay không (mặc định max-width: 767px).
 * An toàn trong môi trường SSR/Node/không có window.
 */
export function getIsMobile(query = '(max-width: 767px)'): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return Boolean(window.matchMedia(query).matches);
  } catch {
    return false;
  }
}

/**
 * Hook kiểm tra thiết bị di động dựa trên media query (mặc định max-width: 767px).
 * Tự động cập nhật khi kích thước màn hình thay đổi và hủy đăng ký khi unmount.
 */
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => getIsMobile(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(query);
    } catch {
      return;
    }

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(Boolean(e.matches));
    };

    // Đồng bộ trạng thái hiện tại
    setIsMobile(Boolean(mql.matches));

    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => {
        mql.removeEventListener('change', handler);
      };
    } else if ((mql as any).addListener) {
      (mql as any).addListener(handler);
      return () => {
        (mql as any).removeListener(handler);
      };
    }
  }, [query]);

  return isMobile;
}

export default useIsMobile;
