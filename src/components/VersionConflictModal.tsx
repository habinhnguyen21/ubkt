import React, { useEffect, useState } from 'react';
import type { VersionConflictPayload } from '../services/centralDataService';

interface ConflictEventDetail {
  conflict: VersionConflictPayload;
  resolve: (action: 'reload' | 'overwrite') => void;
}

const COLLECTION_LABEL: Record<string, string> = {
  chuong_trinh: 'Chương trình KT-GS',
  ho_so_dia_ban_records: 'Hồ sơ địa bàn',
  don_vi: 'Cơ cấu tổ chức (Đơn vị)',
  bao_cao_thang: 'Báo cáo tháng',
};

const IGNORED_DIFF_KEYS = new Set([
  'updated_at',
  'created_at',
  'sync_status',
  'is_deleted',
  'thoi_diem_cap_nhat_gan_nhat',
]);

function formatValue(val: any): string {
  if (val === null || val === undefined || val === '') return '(Trống)';
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export const VersionConflictModal: React.FC = () => {
  const [activeConflict, setActiveConflict] = useState<ConflictEventDetail | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ConflictEventDetail>;
      if (ce.detail?.conflict && typeof ce.detail.resolve === 'function') {
        setActiveConflict(ce.detail);
        setShowDiff(false);
      }
    };
    window.addEventListener('ubkt_version_conflict', handler);
    return () => window.removeEventListener('ubkt_version_conflict', handler);
  }, []);

  if (!activeConflict) return null;

  const { conflict, resolve } = activeConflict;
  const timeFormatted = (() => {
    if (!conflict.updatedAt) return 'vừa xong';
    try {
      const d = new Date(conflict.updatedAt);
      return isNaN(d.getTime()) ? conflict.updatedAt : d.toLocaleString('vi-VN');
    } catch {
      return conflict.updatedAt;
    }
  })();

  const diffRows: { key: string; cloudVal: string; localVal: string }[] = [];
  const allKeys = new Set([
    ...Object.keys(conflict.cloudData || {}),
    ...Object.keys(conflict.localData || {}),
  ]);
  allKeys.forEach((k) => {
    if (IGNORED_DIFF_KEYS.has(k)) return;
    const cStr = formatValue(conflict.cloudData?.[k]);
    const lStr = formatValue(conflict.localData?.[k]);
    if (cStr !== lStr) {
      diffRows.push({ key: k, cloudVal: cStr, localVal: lStr });
    }
  });

  const handleAction = (action: 'reload' | 'overwrite') => {
    const fn = resolve;
    setActiveConflict(null);
    setShowDiff(false);
    fn(action);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          maxWidth: showDiff ? 760 : 520,
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
          border: '1.5px solid #f59e0b',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            padding: '16px 20px',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 26 }}>⚠️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#92400e' }}>
              Phát hiện xung đột phiên bản khi lưu
            </h3>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
              Phân hệ: <strong>{COLLECTION_LABEL[conflict.collectionName] || conflict.collectionName}</strong> · Mã: <code>{conflict.id}</code>
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 20px', fontSize: 14, color: '#1e293b', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600 }}>
            Bản ghi vừa được <span style={{ color: '#b45309', fontWeight: 800 }}>{conflict.updatedBy}</span> sửa lúc{' '}
            <span style={{ color: '#0f172a', fontWeight: 800 }}>{timeFormatted}</span> (Phiên bản Cloud: <code>v{conflict.cloudVersion}</code>, phiên bản bạn đang sửa: <code>v{conflict.localVersion}</code>).
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
            Vui lòng chọn tải lại dữ liệu mới nhất từ Cloud, ghi đè bằng nội dung của bạn, hoặc xem chi tiết các trường khác biệt.
          </p>

          {showDiff && (
            <div
              style={{
                marginTop: 14,
                maxHeight: 300,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                background: '#f8fafc',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', color: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', borderBottom: '1px solid #cbd5e1', width: '24%' }}>Trường dữ liệu</th>
                    <th style={{ padding: '8px 10px', borderBottom: '1px solid #cbd5e1', width: '38%' }}>
                      Trên Cloud (v{conflict.cloudVersion} - {conflict.updatedBy})
                    </th>
                    <th style={{ padding: '8px 10px', borderBottom: '1px solid #cbd5e1', width: '38%' }}>
                      Đang sửa trên máy bạn (v{conflict.localVersion})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                        Không có khác biệt về nội dung trường nghiệp vụ (chỉ khác số phiên bản).
                      </td>
                    </tr>
                  ) : (
                    diffRows.map((row) => (
                      <tr key={row.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace', color: '#334155' }}>
                          {row.key}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {row.cloudVal}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            background: '#f0fdf4',
                            color: '#166534',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {row.localVal}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginRight: 'auto',
            }}
          >
            {showDiff ? 'Ẩn khác biệt' : `🔍 Xem khác biệt (${diffRows.length})`}
          </button>

          <button
            type="button"
            onClick={() => handleAction('reload')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↻ Tải lại từ Cloud
          </button>

          <button
            type="button"
            onClick={() => handleAction('overwrite')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#d97706',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Ghi đè
          </button>
        </div>
      </div>
    </div>
  );
};
