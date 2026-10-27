import { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import type { AppInfo, User } from './types';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DonViManager } from './components/DonViManager';
import { ChuongTrinhManager } from './components/ChuongTrinhManager';
import { LichThangManager } from './components/LichThangManager';
import { KhoPdfManager } from './components/KhoPdfManager';
import { AuditLogModal } from './components/AuditLogModal';
import UserManager from './components/UserManager';
import { HoSoDiaBanManager } from './components/HoSoDiaBanManager';
import { DonThuManager } from './components/DonThuManager';
import { CloudSyncModal } from './components/CloudSyncModal';
import { cloudSyncService } from './services/cloudSyncService';
import { centralDataService } from './services/centralDataService';

type TabKey = 'tong_quan' | 'don_vi' | 'chuong_trinh' | 'ho_so_dia_ban' | 'don_thu' | 'lich_thang' | 'kho_pdf' | 'thong_ke' | 'bao_cao';

// Khởi tạo trạng thái môi trường chính thức
if (typeof window !== 'undefined') {
  try {
    const isCleaned = localStorage.getItem('ubkt_prod_clean_done');
    if (!isCleaned) {
      localStorage.setItem('ubkt_prod_clean_done', 'true');
    }
  } catch {
    // ignore
  }
}

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ubkt_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [donViInitialTab, setDonViInitialTab] = useState<'to_chuc' | 'phan_cong'>('to_chuc');
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

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
    if (tab !== 'don_vi') {
      setDonViInitialTab('to_chuc');
    }
    const hashMap: Record<TabKey, string> = {
      tong_quan: '#tong-quan',
      don_vi: '#don-vi',
      chuong_trinh: '#chuong-trinh',
      ho_so_dia_ban: '#ho-so-dia-ban',
      don_thu: '#don-thu',
      lich_thang: '#lich-thang',
      kho_pdf: '#kho-pdf',
      thong_ke: '#thong-ke',
      bao_cao: '#bao-cao',
    };
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + (hashMap[tab] || ''));
    }
  }, []);

  // Kiểm tra điều hướng trực tiếp bằng URL (Hash, Query Param, Path)
  const checkUrlRouting = useCallback((user: User | null) => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    const isRequestingPhanCong =
      hash.includes('phan-cong') ||
      hash.includes('phan_cong') ||
      search.includes('tab=phan_cong') ||
      search.includes('tab=phan-cong') ||
      search.includes('sub=phan_cong') ||
      search.includes('sub=phan-cong') ||
      pathname.endsWith('/phan-cong') ||
      pathname.endsWith('/phan_cong');

    if (isRequestingPhanCong) {
      if (!user) return;

      if (user.vai_tro === 'ADMIN') {
        setActiveTab('don_vi');
        setDonViInitialTab('phan_cong');
      } else {
        // BIÊN TẬP VIÊN: TỪ CHỐI TRUY CẬP TRỰC TIẾP
        setActiveTab('don_vi');
        setDonViInitialTab('to_chuc');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + '#don-vi');
        } else {
          window.location.hash = '#don-vi';
        }
        setAccessDeniedMessage('Từ chối truy cập: Tài khoản Biên tập viên không có quyền truy cập trực tiếp phân hệ Phân công quản lý.');
        setTimeout(() => setAccessDeniedMessage(null), 5000);
      }
      return;
    }

    if (hash === '#tong-quan') setActiveTab('tong_quan');
    else if (hash === '#don-vi') { setActiveTab('don_vi'); setDonViInitialTab('to_chuc'); }
    else if (hash === '#chuong-trinh') setActiveTab('chuong_trinh');
    else if (hash === '#ho-so-dia-ban') setActiveTab('ho_so_dia_ban');
    else if (hash === '#don-thu') setActiveTab('don_thu');
    else if (hash === '#lich-thang') setActiveTab('lich_thang');
    else if (hash === '#kho-pdf') setActiveTab('kho_pdf');
  }, []);

  useEffect(() => {
    checkUrlRouting(currentUser);
    const handleHash = () => checkUrlRouting(currentUser);
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, [currentUser, checkUrlRouting]);

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
    const handleDataSynced = () => {
      fetchAppInfo();
    };
    window.addEventListener('ubkt_data_synced', handleDataSynced);

    // Khởi tạo bộ lắng nghe thời gian thực Firestore tập trung (Real-Time Snapshot Sync)
    const cleanupRealtime = centralDataService.initRealtimeSync();
    centralDataService.ensureProductionSeed().catch((err) => {
      console.warn('[App] Lỗi kiểm tra seed dữ liệu gốc:', err);
    });

    // Khởi chạy vòng lặp tự động đồng bộ 2 chiều ẩn định kỳ mỗi 30s
    cloudSyncService.startAutoSync();

    // Đồng bộ ban đầu ngay khi vào app
    cloudSyncService.smartSync().catch((err) => {
      console.warn('[App] Lỗi đồng bộ đám mây ban đầu:', err);
    });

    return () => {
      window.removeEventListener('ubkt_data_synced', handleDataSynced);
      cloudSyncService.stopAutoSync();
      cleanupRealtime();
    };
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

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    localStorage.setItem('ubkt_current_user', JSON.stringify(user));
    localStorage.setItem('ubkt_session_token', token);
    fetchAppInfo();
    checkUrlRouting(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ubkt_current_user');
    localStorage.removeItem('ubkt_session_token');
    if (typeof window !== 'undefined' && window.location.hash) {
      window.location.hash = '';
    }
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
        return (
          <DonViManager
            user={currentUser}
            onDataChanged={fetchAppInfo}
            initialTab={donViInitialTab}
          />
        );
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
      {/* Thông báo từ chối truy cập nếu Biên tập viên mở trực tiếp URL cấm */}
      {accessDeniedMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#fee2e2', border: '1.5px solid #ef4444',
          color: '#991b1b', padding: '12px 18px', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 13,
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>⛔</span>
          <span>{accessDeniedMessage}</span>
          <button
            onClick={() => setAccessDeniedMessage(null)}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 16, marginLeft: 8 }}
          >
            ✕
          </button>
        </div>
      )}
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
          onChangePassword={() => setShowChangePasswordModal(true)}
          onOpenAuditLogs={() => setShowAuditLogs(true)}
          onOpenUserManager={() => setShowUserManager(true)}
          onOpenCloudSync={() => setShowCloudSyncModal(true)}
          isSyncing={isSyncing}
          onRefresh={handleManualSync}
        >
          {renderContent()}
        </AppLayout>
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

      {/* Modal Đồng bộ Đám mây Cloud */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        onSynced={fetchAppInfo}
      />
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
