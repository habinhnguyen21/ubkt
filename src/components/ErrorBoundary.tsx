import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Đã bắt lỗi runtime:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem('ubkt_current_user');
      localStorage.removeItem('ubkt_session_token');
      localStorage.removeItem('ubkt_active_tab');
    } catch {
      // ignore
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: 24,
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 540,
              width: '100%',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <AlertTriangle style={{ width: 32, height: 32, color: '#dc2626' }} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Đã phát hiện gián đoạn hiển thị
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
              Hệ thống đã tự động bảo vệ dữ liệu để tránh xung đột phiên làm việc hoặc bộ nhớ đệm
              cũ của trình duyệt. Vui lòng bấm làm mới hoặc khôi phục phiên để tiếp tục sử dụng.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                }}
              >
                <RefreshCw style={{ width: 16, height: 16 }} />
                <span>Tải lại trang (F5)</span>
              </button>

              <button
                onClick={this.handleResetState}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw style={{ width: 16, height: 16 }} />
                <span>Khôi phục & Đăng nhập lại</span>
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 11,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {this.state.showDetails ? 'Ẩn chi tiết kỹ thuật' : 'Xem thông tin chi tiết lỗi'}
              </button>

              {this.state.showDetails && this.state.error && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 11,
                    color: '#e11d48',
                    fontFamily: 'monospace',
                    textAlign: 'left',
                    maxHeight: 180,
                    overflowY: 'auto',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
