import React, { useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import logoUbkt from '../assets/logo-ubkt.jpg';
import loginBg from '../assets/login-bg.webp';
import { useIsMobile } from '../hooks/useIsMobile';
import { Eye, EyeOff } from 'lucide-react';

// Font chuyên nghiệp từ Google Fonts
if (typeof document !== 'undefined' && !document.getElementById('gfont-bevietnam')) {
  const l = document.createElement('link');
  l.id = 'gfont-bevietnam';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(l);
}

interface LoginModalProps {
  onLoginSuccess: (user: User, token: string, rememberMe?: boolean, sessionId?: string) => void;
  kickReason?: string | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, kickReason }) => {
  const isMobile = useIsMobile();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(kickReason || null);
  const [showPw, setShowPw] = useState(false);

  React.useEffect(() => {
    if (kickReason) {
      setError(kickReason);
    }
  }, [kickReason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        ten_dang_nhap: username.trim(),
        mat_khau: password,
        ghi_nho: rememberMe,
      });
      onLoginSuccess(res.user, res.token, rememberMe, (res as any)?.sessionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Inter', sans-serif",
        background: '#FEF1DE', // trùng màu nền ảnh trống đồng để không lộ viền
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: '100dvh',
        padding: isMobile ? '16px 16px 40px' : '20px 16px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── NỀN TRỐNG ĐỒNG ĐÔNG SƠN (ảnh đặt giữa, nằm sau khung đăng nhập) ───── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `url(${loginBg})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: isMobile ? 'min(95vw, 440px)' : 'auto min(max(92vmin, 560px), 920px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── SÓng trang trí trên cùng ──────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          zIndex: 10,
          background: 'linear-gradient(90deg, #c8282c 0%, #e03a3e 50%, #c8282c 100%)',
        }}
      />

      {/* ── LOGO ỦY BAN KIỂM TRA ĐẢNG ──────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          marginTop: isMobile ? 'auto' : 0,
          marginBottom: isMobile ? 12 : 18,
        }}
      >
        <img
          src={logoUbkt}
          alt="Logo Ủy ban Kiểm tra Đảng"
          style={{
            width: isMobile ? 76 : 110,
            height: isMobile ? 76 : 110,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            boxShadow: '0 6px 24px rgba(180,30,30,0.30), 0 2px 8px rgba(0,0,0,0.10)',
            border: '3px solid #ffffff',
            outline: '2px solid rgba(200,40,44,0.20)',
          }}
        />
      </div>

      {/* ── CARD ĐĂNG NHẬP ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 430,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 4px 30px rgba(180,30,30,0.10), 0 1px 8px rgba(0,0,0,0.06)',
          padding: isMobile ? '24px 20px 20px' : '36px 40px 30px',
          marginBottom: isMobile ? 'auto' : 0,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Tiêu đề */}
        <h1
          style={{
            fontSize: isMobile ? 20 : 22,
            fontWeight: 800,
            color: '#111111',
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
            fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
          }}
        >
          Đăng nhập
        </h1>
        <p
          style={{
            fontSize: isMobile ? 11.5 : 12.5,
            fontWeight: 600,
            color: '#b91c1c',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            margin: '0 0 24px',
            lineHeight: 1.5,
            fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
          }}
        >
          Phần mềm Nghiệp vụ kiểm tra, giám sát
        </p>

        {/* Thông báo lỗi */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fff5f5',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              color: '#c53030',
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {/* Tên tài khoản */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#333',
                marginBottom: 6,
              }}
            >
              Tên tài khoản
            </label>
            <input
              id="login-username"
              type="text"
              required
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tên tài khoản"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '11px 14px',
                border: '1.5px solid #d1d5db',
                borderRadius: 8,
                fontSize: isMobile ? 16 : 14,
                color: '#111827',
                background: '#fff',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#c8282c';
                e.target.style.boxShadow = '0 0 0 3px rgba(200,40,44,0.10)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Mật khẩu */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#333',
                marginBottom: 6,
              }}
            >
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '11px 44px 11px 14px',
                  border: '1.5px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: isMobile ? 16 : 14,
                  color: '#111827',
                  background: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#c8282c';
                  e.target.style.boxShadow = '0 0 0 3px rgba(200,40,44,0.10)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {/* Nút hiện / ẩn mật khẩu */}
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 44,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#4b5563';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                }}
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Ghi nhớ đăng nhập trên thiết bị này */}
          <div style={{ marginBottom: 20, minHeight: 44, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="login-remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                accentColor: '#c8282c',
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="login-remember-me"
              style={{
                fontSize: 13,
                color: '#4b5563',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Ghi nhớ đăng nhập trên thiết bị này
            </label>
          </div>

          {/* Nút đăng nhập */}
          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            className="login-btn"
            style={{
              width: '100%',
              minHeight: 46,
              padding: '13px',
              background: loading ? '#e87c7f' : '#c8282c',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: isMobile ? 16 : 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, transform 0.1s',
              letterSpacing: '0.03em',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 15,
                    height: 15,
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                Đang xác thực...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>

          <div
            style={{
              marginTop: 18,
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: 6,
              border: '1px dashed #cbd5e1',
              fontSize: 12,
              color: '#64748b',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            🔒 Nếu chưa có tài khoản hoặc quên mật khẩu, vui lòng liên hệ Quản trị viên hệ thống để được cấp tài khoản hoặc đặt lại mật khẩu.
          </div>
        </form>
      </div>

      {/* ── SÓng trang trí phía dưới ────────────────────────────────── */}
      <div
        style={{
          position: isMobile ? 'fixed' : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isMobile ? 55 : 110,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: isMobile ? 0.35 : 1,
          zIndex: 1,
        }}
      >
        <svg
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          <path
            d="M0,55 C360,110 1080,0 1440,55 L1440,110 L0,110 Z"
            fill="#c8282c"
            opacity="0.80"
          />
          <path
            d="M0,75 C400,25 1000,100 1440,65 L1440,110 L0,110 Z"
            fill="#a81f23"
            opacity="0.55"
          />
        </svg>
      </div>

      {/* Version */}
      <div
        style={{
          position: isMobile ? 'relative' : 'absolute',
          bottom: isMobile ? 0 : 10,
          right: isMobile ? 0 : 20,
          marginTop: isMobile ? 12 : 0,
          textAlign: isMobile ? 'center' : 'right',
          fontSize: 10,
          color: isMobile ? '#9a3412' : 'rgba(255,255,255,0.75)',
          zIndex: 3,
        }}
      >
        v1.0.0 · Phần mềm Quản lý kiểm tra, giám sát Đảng
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .login-btn:hover:not(:disabled) {
          background: #a81f23 !important;
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
};
