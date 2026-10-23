import React from 'react';
import { Calendar, Filter, RotateCcw, RefreshCw } from 'lucide-react';
import type { DashboardFilterState } from '../../services/dashboardStats';

interface DashboardFiltersProps {
  filters: DashboardFilterState;
  availableYears: number[];
  availableUnits: { id: string; ten: string; loai: string }[];
  availableLinhVuc: string[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onChange: (newFilters: DashboardFilterState) => void;
  onReset: () => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  availableYears,
  availableUnits,
  availableLinhVuc,
  isRefreshing = false,
  onRefresh,
  onChange,
  onReset,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
      {/* Tiêu đề ngắn gọn */}
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
        Tổng quan chỉ tiêu & tiến độ kiểm tra, giám sát
      </div>

      {/* Dropdown controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Bộ chọn năm */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filters.year}
            onChange={(e) =>
              onChange({
                ...filters,
                year: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
              })
            }
            className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Năm {yr}
              </option>
            ))}
            <option value="ALL">Toàn bộ các năm / Toàn khóa</option>
          </select>
        </div>

        {/* Lọc theo tổ chức cơ sở cụ thể nếu cần */}
        {availableUnits.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.donViId}
              onChange={(e) =>
                onChange({
                  ...filters,
                  donViId: e.target.value,
                })
              }
              className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer max-w-48 truncate"
            >
              <option value="ALL">-- Tất cả tổ chức cơ sở --</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ten}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Lọc theo lĩnh vực (nếu có dữ liệu) */}
        {availableLinhVuc.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <select
              value={filters.linhVuc}
              onChange={(e) =>
                onChange({
                  ...filters,
                  linhVuc: e.target.value,
                })
              }
              className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer max-w-36 truncate"
            >
              <option value="ALL">Tất cả lĩnh vực</option>
              {availableLinhVuc.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nút đặt lại bộ lọc */}
        {(filters.donViId !== 'ALL' || filters.linhVuc !== 'ALL') && (
          <button
            onClick={onReset}
            title="Đặt lại bộ lọc mặc định"
            className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Nút làm mới dữ liệu */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Làm mới dữ liệu từ CSDL"
            className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        )}
      </div>
    </div>
  );
};
