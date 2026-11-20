import React, { useState } from 'react';
import { FileCheck } from 'lucide-react';
import type { User } from '../types';
import { ScanHoSoTab } from './baocao/ScanHoSoTab';

export interface BaoCaoTabConfig {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<{ user: User }>;
}

// Khai báo danh sách thẻ bằng một mảng cấu hình (id, nhãn, component)
// để sau này thêm thẻ chỉ cần thêm một phần tử, không sửa khung.
const BAO_CAO_TABS: BaoCaoTabConfig[] = [
  {
    id: 'scan_ho_so',
    label: 'Scan hồ sơ',
    icon: FileCheck,
    component: ScanHoSoTab,
  },
];

interface BaoCaoManagerProps {
  user: User;
}

export const BaoCaoManager: React.FC<BaoCaoManagerProps> = ({ user }) => {
  const [activeTabId, setActiveTabId] = useState<string>(BAO_CAO_TABS[0]?.id || 'scan_ho_so');

  if (user.vai_tro !== 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-xl border border-slate-200 text-center shadow-xs">
        <h3 className="text-base font-bold text-slate-800 mb-2">Giới hạn quyền truy cập</h3>
        <p className="text-sm text-slate-600">
          Chức năng Báo cáo chỉ dành cho quản trị viên (Admin). Vui lòng quay lại Tổng quan.
        </p>
      </div>
    );
  }

  const currentTab = BAO_CAO_TABS.find((t) => t.id === activeTabId) || BAO_CAO_TABS[0];
  const ActiveComponent = currentTab?.component;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* ── THANH THẺ CON Ở ĐẦU TRANG ── */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {BAO_CAO_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-blue-100' : 'text-slate-500'}`} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── NỘI DUNG THẺ ĐANG CHỌN ── */}
      {ActiveComponent && <ActiveComponent user={user} />}
    </div>
  );
};

export default BaoCaoManager;

