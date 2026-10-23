import React from 'react';
import { Building2, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import type { DonVi } from '../../types';

interface OrgStatsCardsProps {
  units: DonVi[];
  selectedFilter: string;
  onFilterChange: (filterKey: string) => void;
}

export const OrgStatsCards: React.FC<OrgStatsCardsProps> = ({
  units,
  selectedFilter,
  onFilterChange,
}) => {
  const activeUnits = units.filter((u) => !u.deleted_at);

  // 1. Tổng số
  const totalCount = activeUnits.length;

  // 2. Đang hoạt động
  const activeCount = activeUnits.filter(
    (u) => !u.trang_thai || u.trang_thai === 'DANG_HOAT_DONG',
  ).length;

  // 3. Tạm ngừng
  const pausedCount = activeUnits.filter((u) => u.trang_thai === 'TAM_NGUNG').length;

  // 4. Đã chấm dứt
  const terminatedCount = activeUnits.filter((u) => u.trang_thai === 'CHAM_DUT').length;

  const cards = [
    {
      key: 'ALL',
      title: 'Tổng số tổ chức',
      value: totalCount,
      subtitle: 'Toàn bộ danh mục đơn vị',
      icon: Building2,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      activeRing: 'ring-2 ring-blue-600',
    },
    {
      key: 'ACTIVE',
      title: 'Đang hoạt động',
      value: activeCount,
      subtitle: 'Sinh hoạt & hoạt động bình thường',
      icon: CheckCircle2,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      activeRing: 'ring-2 ring-emerald-600',
    },
    {
      key: 'PAUSED',
      title: 'Tạm ngừng hoạt động',
      value: pausedCount,
      subtitle: 'Tạm dừng theo quyết định',
      icon: PauseCircle,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      activeRing: 'ring-2 ring-amber-600',
    },
    {
      key: 'TERMINATED',
      title: 'Đã chấm dứt hoạt động',
      value: terminatedCount,
      subtitle: 'Đã giải thể / sáp nhập',
      icon: XCircle,
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-700',
      activeRing: 'ring-2 ring-rose-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.key;

        return (
          <div
            key={card.key}
            onClick={() => onFilterChange(card.key)}
            className={`bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition cursor-pointer flex items-center justify-between group ${
              isSelected ? `${card.activeRing} bg-slate-50/50` : ''
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {card.title}
              </p>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {card.value}
                </span>
                <span className="text-xs text-slate-500 font-medium">tổ chức</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
            </div>

            <div
              className={`w-11 h-11 rounded-xl ${card.bgColor} ${card.textColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition`}
            >
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
