import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ArrowUpDown, ExternalLink } from 'lucide-react';
import type { UnitProgressRow } from '../../services/dashboardStats';

interface OrgProgressTableProps {
  data: UnitProgressRow[];
  currentYear: number | 'ALL';
  onNavigateToUnit?: (donViId: string) => void;
}

type SortField = 'ten' | 'soKiemTra' | 'soGiamSat' | 'daHoanThanh' | 'chuaThucHien' | 'tyLeHoanThanh';
type SortOrder = 'asc' | 'desc';

export const OrgProgressTable: React.FC<OrgProgressTableProps> = ({
  data,
  currentYear,
  onNavigateToUnit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'INCOMPLETE' | 'OVERDUE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('tyLeHoanThanh');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.ten.toLowerCase().includes(q) ||
          (r.ma && r.ma.toLowerCase().includes(q)) ||
          r.loai.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter === 'DONE') {
      result = result.filter((r) => r.tongNhiemVu > 0 && r.tyLeHoanThanh === 100);
    } else if (statusFilter === 'INCOMPLETE') {
      result = result.filter((r) => r.chuaThucHien > 0 || r.dangThucHien > 0);
    } else if (statusFilter === 'OVERDUE') {
      result = result.filter((r) => r.quaHan > 0);
    }

    // Sort
    result.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return result;
  }, [data, searchTerm, statusFilter, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-600 ml-1 inline" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-600 ml-1 inline" />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              📊 Tổng quan tiến độ theo Chi bộ / Tổ chức cơ sở
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              {currentYear === 'ALL' ? 'Toàn bộ thời gian' : `Năm ${currentYear}`}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Tổng số {data.length} tổ chức thuộc phạm vi quản lý
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tổ chức..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50 w-44"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DONE">Hoàn thành 100%</option>
            <option value="INCOMPLETE">Chưa hoàn thành</option>
            <option value="OVERDUE">Có quá hạn</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold select-none">
              <th className="p-3 text-left w-12 text-center text-slate-400">STT</th>
              <th
                onClick={() => handleSort('ten')}
                className="p-3 text-left cursor-pointer hover:text-slate-800"
              >
                Đơn vị / Tổ chức {getSortIcon('ten')}
              </th>
              <th className="p-3 text-left text-slate-500">Khối</th>
              <th
                onClick={() => handleSort('soKiemTra')}
                className="p-3 text-center text-blue-600 cursor-pointer hover:underline"
                title="Số cuộc kiểm tra"
              >
                Kiểm tra {getSortIcon('soKiemTra')}
              </th>
              <th
                onClick={() => handleSort('soGiamSat')}
                className="p-3 text-center text-purple-600 cursor-pointer hover:underline"
                title="Số cuộc giám sát"
              >
                Giám sát {getSortIcon('soGiamSat')}
              </th>
              <th
                onClick={() => handleSort('daHoanThanh')}
                className="p-3 text-center text-emerald-600 cursor-pointer hover:underline"
                title="Số cuộc đã hoàn thành"
              >
                Hoàn thành {getSortIcon('daHoanThanh')}
              </th>
              <th
                onClick={() => handleSort('chuaThucHien')}
                className="p-3 text-center text-amber-600 cursor-pointer hover:underline"
                title="Chưa thực hiện hoặc đang tiến hành"
              >
                Chưa hoàn {getSortIcon('chuaThucHien')}
              </th>
              <th className="p-3 text-center text-rose-600">Quá hạn</th>
              <th
                onClick={() => handleSort('tyLeHoanThanh')}
                className="p-3 text-center cursor-pointer hover:text-slate-800 min-w-28"
              >
                Tiến độ {getSortIcon('tyLeHoanThanh')}
              </th>
              {onNavigateToUnit && <th className="p-3 text-center w-20">Hồ sơ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={onNavigateToUnit ? 10 : 9} className="p-8 text-center text-slate-400">
                  Không tìm thấy đơn vị nào phù hợp với điều kiện lọc.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const globalIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr key={row.donViId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                      {globalIndex}
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span title={row.ten}>{row.ten}</span>
                        {row.ma && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500">
                            {row.ma}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">{row.loai}</td>
                    <td className="p-3 text-center font-bold text-blue-600">{row.soKiemTra}</td>
                    <td className="p-3 text-center font-bold text-purple-600">{row.soGiamSat}</td>
                    <td className="p-3 text-center font-bold text-emerald-600">
                      {row.daHoanThanh}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-600">
                      {row.dangThucHien + row.chuaThucHien}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">
                      {row.quaHan > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                          {row.quaHan}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              row.tyLeHoanThanh === 100
                                ? 'bg-emerald-500'
                                : row.tyLeHoanThanh >= 50
                                ? 'bg-blue-500'
                                : row.tyLeHoanThanh > 0
                                ? 'bg-amber-500'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${row.tyLeHoanThanh}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700 text-[11px] w-8 text-right">
                          {row.tyLeHoanThanh}%
                        </span>
                      </div>
                    </td>
                    {onNavigateToUnit && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onNavigateToUnit(row.donViId)}
                          title="Xem Hồ sơ địa bàn chi tiết"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>Tổng {filteredAndSortedData.length} đơn vị</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Trang trước
            </button>
            <span className="px-2 font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
