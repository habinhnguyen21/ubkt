import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  value: number | string;
  subtitle?: string;
  badge?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  iconBgColor = 'bg-blue-100/70',
  iconColor = 'text-[#2563eb]',
  title,
  value,
  subtitle,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-full ${iconBgColor} ${iconColor} flex items-center justify-center shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-slate-500 font-medium truncate" title={title}>
            {title}
          </p>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="text-2xl font-black text-slate-900 tracking-tight my-0.5">
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-400 font-normal truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
