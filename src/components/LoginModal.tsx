import React, { useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import logoUbkt from '../assets/logo-ubkt.jpg';

// Font chuyên nghiệp từ Google Fonts
if (typeof document !== 'undefined' && !document.getElementById('gfont-bevietnam')) {
  const l = document.createElement('link');
  l.id = 'gfont-bevietnam';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(l);
}

interface LoginModalProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        ten_dang_nhap: username.trim(),
        mat_khau: password,
      });
      onLoginSuccess(res.user, res.token);
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
        background: '#f5eded',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* ── NỀN HOA VĂN MỜ ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Ccircle cx='130' cy='130' r='120' fill='none' stroke='%23c8282c' stroke-width='0.7' opacity='0.13'/%3E%3Ccircle cx='130' cy='130' r='95' fill='none' stroke='%23c8282c' stroke-width='0.6' opacity='0.10'/%3E%3Ccircle cx='130' cy='130' r='70' fill='none' stroke='%23c8282c' stroke-width='0.5' opacity='0.08'/%3E%3Ccircle cx='130' cy='130' r='45' fill='none' stroke='%23c8282c' stroke-width='0.5' opacity='0.07'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '260px 260px',
          pointerEvents: 'none',
        }}
      />

      {/* ── SÓng trang trí trên cùng ──────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #c8282c 0%, #e03a3e 50%, #c8282c 100%)',
        }}
      />

      {/* ── LOGO ỦY BAN KIỂM TRA ĐẢNG ──────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          marginBottom: 18,
        }}
      >
        <img
          src={logoUbkt}
          alt="Logo Ủy ban Kiểm tra Đảng"
          style={{
            width: 110,
            height: 110,
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
          padding: '36px 40px 30px',
          textAlign: 'center',
        }}
      >
        {/* Tiêu đề */}
        <h1
          style={{
            fontSize: 22,
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
            fontSize: 12.5,
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tên tài khoản"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                style={{
                  width: '100%',
                  padding: '11px 44px 11px 14px',
                  border: '1.5px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
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
              {/* Icon mắt SVG */}
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#9ca3af',
                }}
              >
                {showPw ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Nút đăng nhập */}
          <button
            id="btn-login"
            type="submit"
            disabled={loading}
            className="login-btn"
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? '#e87c7f' : '#c8282c',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 15,
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
        </form>
      </div>

      {/* ── SÓng trang trí phía dưới ────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 110,
          overflow: 'hidden',
          pointerEvents: 'none',
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
          position: 'absolute',
          bottom: 10,
          right: 20,
          fontSize: 10,
          color: 'rgba(255,255,255,0.75)',
          zIndex: 3,
        }}
      >
        v1.0.0 · UBKT Đảng ủy phường Ái Quốc
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
