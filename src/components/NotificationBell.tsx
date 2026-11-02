import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { api } from '../services/api';
import { isSameData } from '../utils/syncUtils';
import { computeReminders, describeDays, REMINDER_SOON_DAYS } from '../utils/reminders';
import type { ReminderItem } from '../utils/reminders';
import { requestOpenItem } from '../utils/openRequest';

interface NotificationBellProps {
  currentUser: User;
  /** Chuyển tab của ứng dụng tới màn hình chứa mục được nhắc */
  onNavigate: (tab: 'chuong_trinh' | 'don_thu') => void;
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // làm mới mỗi giờ (tính trên dữ liệu có sẵn, không đọc thêm Firestore)

function dismissedStorageKey(userId: string): string {
  return `ubkt_dismissed_reminders_${userId}`;
}

function loadDismissed(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(userId: string, set: Set<string>): void {
  try {
    localStorage.setItem(dismissedStorageKey(userId), JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // bộ nhớ đầy hoặc bị chặn: bỏ qua, nhắc việc vẫn hoạt động
  }
}

export function NotificationBell({ currentUser, onNavigate }: NotificationBellProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed(currentUser.id));
  const [open, setOpen] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [chuongTrinh, donThu, donVi, phanCong] = await Promise.all([
        api.getAllChuongTrinh().catch(() => []),
        api.getAllDonThu().catch(() => []),
        api.getAllDonVi().catch(() => []),
        api.getPhanCongDiaBan().catch(() => []),
      ]);
      if (!aliveRef.current) return;
      const next = computeReminders({
        user: currentUser,
        chuongTrinh: Array.isArray(chuongTrinh) ? chuongTrinh : [],
        donThu: Array.isArray(donThu) ? donThu : [],
        donVi: Array.isArray(donVi) ? donVi : [],
        phanCong: Array.isArray(phanCong) ? phanCong : [],
      });
      // Chỉ cập nhật state khi danh sách thật sự đổi để không vẽ lại thừa
      setReminders((prev) => (isSameData(prev, next) ? prev : next));
    } catch (err) {
      // Giữ nguyên danh sách cũ khi lỗi
      console.warn('[NotificationBell] Không tính được nhắc việc:', err);
    }
  }, [currentUser]);

  // Làm mới có gom nhóm (debounce) để nhiều sự kiện đồng bộ liên tiếp chỉ tính một lần
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void refresh();
    }, 500);
  }, [refresh]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();

    const events = [
      'ubkt_data_synced',
      'ubkt_chuong_trinh_updated',
      'ubkt_assignments_updated',
      'ubkt_diaban_records_updated',
    ];
    events.forEach((e) => window.addEventListener(e, scheduleRefresh));

    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) void refresh();
    }, REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden) scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      aliveRef.current = false;
      events.forEach((e) => window.removeEventListener(e, scheduleRefresh));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refresh, scheduleRefresh]);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = useMemo(() => reminders.filter((r) => !dismissed.has(r.key)), [reminders, dismissed]);
  const hiddenItems = useMemo(() => reminders.filter((r) => dismissed.has(r.key)), [reminders, dismissed]);
  const overdue = visible.filter((r) => r.severity === 'OVERDUE');
  const soon = visible.filter((r) => r.severity === 'SOON');

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(currentUser.id, next);
      return next;
    });
  };

  const restoreAll = () => {
    const next = new Set<string>();
    setDismissed(next);
    saveDismissed(currentUser.id, next);
    setShowDismissed(false);
  };

  const openItem = (item: ReminderItem) => {
    setOpen(false);
    onNavigate(item.type === 'CHUONG_TRINH' ? 'chuong_trinh' : 'don_thu');
    requestOpenItem({ type: item.type, id: item.id });
  };

  const badgeColor = overdue.length > 0 ? '#e53e3e' : '#dd6b20';
  const badgeText = visible.length > 99 ? '99+' : String(visible.length);

  const renderItem = (item: ReminderItem, muted = false) => (
    <div
      key={item.key}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        borderBottom: '1px solid #edf2f7',
        opacity: muted ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => openItem(item)}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'inherit',
        }}
        title="Bấm để mở"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden>{item.type === 'CHUONG_TRINH' ? '📋' : '📬'}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1a202c',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.title}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#718096', marginTop: 2, paddingLeft: 22 }}>{item.subtitle}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 4,
            marginLeft: 22,
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 8px',
            borderRadius: 999,
            color: item.severity === 'OVERDUE' ? '#9b2c2c' : '#975a16',
            background: item.severity === 'OVERDUE' ? '#fed7d7' : '#feebc8',
          }}
        >
          {describeDays(item.daysLeft)}
        </div>
      </button>
      {!muted && (
        <button
          type="button"
          onClick={() => dismiss(item.key)}
          title="Ẩn nhắc việc này"
          aria-label="Ẩn nhắc việc này"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#a0aec0',
            fontSize: 14,
            padding: 2,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );

  const sectionTitle = (text: string, color: string, count: number) => (
    <div
      style={{
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        color,
        background: '#f7fafc',
        borderBottom: '1px solid #edf2f7',
      }}
    >
      {text} ({count})
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={visible.length > 0 ? `Nhắc việc: ${visible.length} mục cần chú ý` : 'Nhắc việc: không có mục nào'}
        aria-expanded={open}
        title="Nhắc việc"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: 6,
          fontSize: 18,
          color: '#718096',
        }}
      >
        🔔
        {visible.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -1,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              boxSizing: 'border-box',
              background: badgeColor,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
              borderRadius: 999,
              border: '1.5px solid #fff',
            }}
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Danh sách nhắc việc"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 'min(380px, calc(100vw - 24px))',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            zIndex: 300,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a202c' }}>Nhắc việc</div>
            <div style={{ fontSize: 11, color: '#718096' }}>
              Việc quá hạn và sắp đến hạn trong {REMINDER_SOON_DAYS} ngày
              {currentUser.vai_tro === 'BIEN_TAP' ? ' thuộc đơn vị bạn phụ trách' : ''}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {visible.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: '#718096' }}>
                Không có việc nào cần nhắc 🎉
              </div>
            )}
            {overdue.length > 0 && (
              <>
                {sectionTitle('QUÁ HẠN', '#c53030', overdue.length)}
                {overdue.map((r) => renderItem(r))}
              </>
            )}
            {soon.length > 0 && (
              <>
                {sectionTitle('SẮP ĐẾN HẠN', '#b7791f', soon.length)}
                {soon.map((r) => renderItem(r))}
              </>
            )}
            {showDismissed && hiddenItems.length > 0 && (
              <>
                {sectionTitle('ĐÃ ẨN', '#718096', hiddenItems.length)}
                {hiddenItems.map((r) => renderItem(r, true))}
              </>
            )}
          </div>

          {hiddenItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderTop: '1px solid #e2e8f0',
                background: '#f7fafc',
                fontSize: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setShowDismissed((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2b6cb0', padding: 0 }}
              >
                {showDismissed ? 'Thu gọn mục đã ẩn' : `Xem ${hiddenItems.length} mục đã ẩn`}
              </button>
              <button
                type="button"
                onClick={restoreAll}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2b6cb0', padding: 0 }}
              >
                Hiện lại tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
