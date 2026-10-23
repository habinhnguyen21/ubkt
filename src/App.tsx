import { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import type { AppInfo, User } from './types';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LockScreen } from './components/LockScreen';
import { DonViManager } from './components/DonViManager';
import { ChuongTrinhManager } from './components/ChuongTrinhManager';
import { LichThangManager } from './components/LichThangManager';
import { KhoPdfManager } from './components/KhoPdfManager';
import { AuditLogModal } from './components/AuditLogModal';
import UserManager from './components/UserManager';
import { HoSoDiaBanManager } from './components/HoSoDiaBanManager';
import { DonThuManager } from './components/DonThuManager';

type TabKey = 'tong_quan' | 'don_vi' | 'chuong_trinh' | 'ho_so_dia_ban' | 'don_thu' | 'lich_thang' | 'kho_pdf' | 'thong_ke' | 'bao_cao';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ubkt_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isLocked, setIsLocked] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('ubkt_active_tab');
    const validTabs: TabKey[] = ['tong_quan', 'don_vi', 'chuong_trinh', 'ho_so_dia_ban', 'don_thu', 'lich_thang', 'kho_pdf', 'thong_ke', 'bao_cao'];
    if (saved && validTabs.includes(saved as TabKey)) {
      return saved as TabKey;
    }
    return 'tong_quan';
  });

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    localStorage.setItem('ubkt_active_tab', tab);
  }, []);

  const fetchAppInfo = useCallback(async () => {
    try {
      const info = await api.getAppInfo();
      setAppInfo(info);
    } catch (err) {
      console.error('Lỗi lấy thông tin hệ thống:', err);
    }
  }, []);

  useEffect(() => {
    fetchAppInfo();
  }, [fetchAppInfo]);

  // Lắng nghe sự kiện điều hướng tab giữa các phân hệ (vd: link từ Chương trình nhiệm kỳ sang Hồ sơ địa bàn)
  useEffect(() => {
    const handleNav = (e: Event) => {
      const ce = e as CustomEvent<{ tab: TabKey; donViId?: string }>;
      if (ce.detail?.tab) {
        handleTabChange(ce.detail.tab);
      }
    };
    window.addEventListener('ubkt_navigate', handleNav);
    return () => window.removeEventListener('ubkt_navigate', handleNav);
  }, [handleTabChange]);

  // Tự động khóa màn hình sau 15 phút không hoạt động
  useEffect(() => {
    if (!currentUser || isLocked) return;

    let timeoutId: number;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsLocked(true);
      }, 15 * 60 * 1000);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser, isLocked]);

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setIsLocked(false);
    localStorage.setItem('ubkt_current_user', JSON.stringify(user));
    localStorage.setItem('ubkt_session_token', token);
    fetchAppInfo();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLocked(false);
    localStorage.removeItem('ubkt_current_user');
    localStorage.removeItem('ubkt_session_token');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetchAppInfo();
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Render nội dung theo tab ─────────────────────────────────────────────
  function renderContent() {
    if (!currentUser) return null;
    switch (activeTab) {
      case 'tong_quan':
        return <Dashboard currentUser={currentUser} appInfo={appInfo} />;
      case 'don_vi':
        return <DonViManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'chuong_trinh':
        return <ChuongTrinhManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'ho_so_dia_ban':
        return <HoSoDiaBanManager user={currentUser} />;
      case 'don_thu':
        return <DonThuManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'lich_thang':
        return <LichThangManager user={currentUser} />;
      case 'kho_pdf':
        return <KhoPdfManager user={currentUser} onDataChanged={fetchAppInfo} />;
      case 'thong_ke':
        return <PlaceholderPage icon="📊" title="Thống kê" desc="Thống kê theo năm, tháng, đơn vị và loại hình kiểm tra" />;
      case 'bao_cao':
        return <PlaceholderPage icon="📄" title="Báo cáo" desc="Xuất báo cáo tổng hợp, in ấn và xuất PDF" />;
      default:
        return <Dashboard currentUser={currentUser} appInfo={appInfo} />;
    }
  }

  return (
    <>
      {/* Nếu chưa đăng nhập → chỉ hiện màn hình đăng nhập */}
      {!currentUser && (
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Ứng dụng chính sau đăng nhập */}
      {currentUser && (
        <AppLayout
          currentUser={currentUser}
          appInfo={appInfo}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onLockScreen={() => setIsLocked(true)}
          onChangePassword={() => setShowChangePasswordModal(true)}
          onOpenAuditLogs={() => setShowAuditLogs(true)}
          onOpenUserManager={() => setShowUserManager(true)}
          isSyncing={isSyncing}
          onRefresh={handleManualSync}
        >
          {renderContent()}
        </AppLayout>
      )}

      {/* Màn hình khóa */}
      {currentUser && isLocked && (
        <LockScreen
          user={currentUser}
          onUnlock={() => setIsLocked(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Modal đổi mật khẩu */}
      {currentUser && (currentUser.must_change_password || showChangePasswordModal) && (
        <ChangePasswordModal
          user={currentUser}
          isMandatory={currentUser.must_change_password}
          onSuccess={() => {
            const updated = { ...currentUser, must_change_password: false };
            setCurrentUser(updated);
            localStorage.setItem('ubkt_current_user', JSON.stringify(updated));
            setShowChangePasswordModal(false);
            fetchAppInfo();
          }}
          onClose={
            currentUser.must_change_password ? undefined : () => setShowChangePasswordModal(false)
          }
        />
      )}

      {/* Modal Nhật ký */}
      {showAuditLogs && (
        <AuditLogModal onClose={() => setShowAuditLogs(false)} />
      )}

      {/* Modal Quản lý người dùng */}
      {showUserManager && currentUser && (
        <UserManager
          currentUser={currentUser}
          onClose={() => {
            setShowUserManager(false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
            }
          }}
        />
      )}
    </>
  );
}

// Placeholder cho các tab chưa implement
function PlaceholderPage({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 400, textAlign: 'center',
      background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      padding: 40,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2d3748', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#718096', maxWidth: 400 }}>{desc}</p>
      <div style={{
        marginTop: 24, padding: '10px 24px',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 8, color: '#3b82f6', fontSize: 13, fontWeight: 600,
      }}>
        🚧 Đang phát triển — sẽ có trong phiên bản tiếp theo
      </div>
    </div>
  );
}

export default App;
