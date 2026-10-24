import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Eye,
  Edit2,
  Plus,
  ArrowRightLeft,
  Power,
  Building2,
  Trash2,
} from 'lucide-react';
import type { DonVi, DonViTreeItem } from '../../types';

interface OrgTablePanelProps {
  units: DonVi[];
  selectedUnit: DonViTreeItem | null;
  canEdit: boolean;
  onSelectUnit: (unit: DonVi) => void;
  onViewUnit: (unit: DonVi) => void;
  onEditUnit: (unit: DonVi) => void;
  onAddChild: (parentUnit: DonVi) => void;
  onChangeParent: (unit: DonVi) => void;
  onToggleStatus: (unit: DonVi) => void;
  onDeleteUnit?: (unit: DonVi) => void;
  onBatchToggleStatus?: (units: DonVi[], newStatus: string) => void;
  filterPreset?: string;
}

type SortField = 'thu_tu' | 'ten' | 'trang_thai';
type SortOrder = 'asc' | 'desc';

export const OrgTablePanel: React.FC<OrgTablePanelProps> = ({
  units,
  selectedUnit,
  canEdit,
  onSelectUnit,
  onViewUnit,
  onEditUnit,
  onAddChild,
  onChangeParent,
  onToggleStatus,
  onDeleteUnit,
  onBatchToggleStatus,
  filterPreset,
}) => {
  // Mode: 'ALL' (toàn bộ) | 'CHILDREN' (chỉ con của selectedUnit)
  const [viewMode, setViewMode] = useState<'ALL' | 'CHILDREN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('thu_tu');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Unit parent map for quick parent name lookup
  const unitMap = useMemo(() => {
    return new Map(units.map((u) => [u.id, u.ten]));
  }, [units]);

  // Synchronize filterPreset from stats cards if provided
  React.useEffect(() => {
    if (filterPreset) {
      if (filterPreset === 'ALL') {
        setStatusFilter('ALL');
      } else if (filterPreset === 'ACTIVE') {
        setStatusFilter('DANG_HOAT_DONG');
      } else if (filterPreset === 'PAUSED') {
        setStatusFilter('TAM_NGUNG');
      } else if (filterPreset === 'TERMINATED') {
        setStatusFilter('CHAM_DUT');
      }
      setCurrentPage(1);
    }
  }, [filterPreset]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    let result = units.filter((u) => !u.deleted_at);

    // Filter by viewMode
    if (viewMode === 'CHILDREN' && selectedUnit) {
      result = result.filter((u) => u.don_vi_cha_id === selectedUnit.id);
    }

    // Filter by search query (ten, ghi_chu)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.ten.toLowerCase().includes(q) ||
          (u.ghi_chu && u.ghi_chu.toLowerCase().includes(q)),
      );
    }

    // Filter by status
    if (statusFilter !== 'ALL') {
      result = result.filter((u) => {
        const s = u.trang_thai || 'DANG_HOAT_DONG';
        return s === statusFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'thu_tu') {
        cmp = (a.thu_tu ?? 0) - (b.thu_tu ?? 0);
      } else if (sortField === 'ten') {
        cmp = a.ten.localeCompare(b.ten, 'vi');
      } else if (sortField === 'trang_thai') {
        const sa = a.trang_thai || 'DANG_HOAT_DONG';
        const sb = b.trang_thai || 'DANG_HOAT_DONG';
        cmp = sa.localeCompare(sb);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [units, viewMode, selectedUnit, searchQuery, statusFilter, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-600 ml-1 inline" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-600 ml-1 inline" />
    );
  };

  // Multi-select handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedData.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col h-full overflow-hidden">
      {/* ── HEADER BẢNG: CHẾ ĐỘ XEM & TÌM KIẾM ── */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Toggle Chế độ xem */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded-lg shrink-0">
          <button
            onClick={() => {
              setViewMode('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
              viewMode === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Toàn bộ danh mục ({units.filter((u) => !u.deleted_at).length})
          </button>
          <button
            onClick={() => {
              setViewMode('CHILDREN');
              setCurrentPage(1);
            }}
            disabled={!selectedUnit}
            title={selectedUnit ? `Chỉ hiển thị cấp dưới của: ${selectedUnit.ten}` : 'Hãy chọn một tổ chức trên cây trước'}
            className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              viewMode === 'CHILDREN'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Trực thuộc đang chọn</span>
            {selectedUnit && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-mono">
                {selectedUnit.so_luong_truc_thuoc || 0}
              </span>
            )}
          </button>
        </div>

        {/* Thanh công cụ lọc & tìm kiếm */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo tên tổ chức..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 w-48 sm:w-60"
            />
          </div>

          {/* Lọc Trạng thái */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DANG_HOAT_DONG">Đang hoạt động</option>
              <option value="TAM_NGUNG">Tạm ngừng</option>
              <option value="CHAM_DUT">Đã chấm dứt</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── THAO TÁC HÀNG LOẠT NẾU CHỌN NHIỀU ── */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">
              Đã chọn {selectedIds.size} tổ chức:
            </span>
          </div>

          {canEdit && onBatchToggleStatus && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const selectedList = units.filter((u) => selectedIds.has(u.id));
                  onBatchToggleStatus(selectedList, 'TAM_NGUNG');
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Tạm ngừng hoạt động
              </button>
              <button
                onClick={() => {
                  const selectedList = units.filter((u) => selectedIds.has(u.id));
                  onBatchToggleStatus(selectedList, 'DANG_HOAT_DONG');
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Kích hoạt lại
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── BẢNG DỮ LIỆU ĐÃ LƯỢC BỎ MÃ, LOẠI HÌNH, CẤP, NGÀY HIỆU LỰC ── */}
      <div className="flex-1 overflow-x-auto min-h-[320px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold select-none">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    paginatedData.length > 0 &&
                    paginatedData.every((u) => selectedIds.has(u.id))
                  }
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 cursor-pointer"
                />
              </th>
              <th
                onClick={() => handleSort('thu_tu')}
                className="p-3 text-center w-14 cursor-pointer hover:text-slate-800"
              >
                STT {renderSortIcon('thu_tu')}
              </th>
              <th
                onClick={() => handleSort('ten')}
                className="p-3 text-left cursor-pointer hover:text-slate-800 min-w-56"
              >
                Tên tổ chức {renderSortIcon('ten')}
              </th>
              <th className="p-3 text-left min-w-44">Tổ chức cấp trên trực tiếp</th>
              <th
                onClick={() => handleSort('trang_thai')}
                className="p-3 text-center cursor-pointer hover:text-slate-800 w-36"
              >
                Trạng thái {renderSortIcon('trang_thai')}
              </th>
              <th className="p-3 text-center w-36">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-medium">Không tìm thấy tổ chức nào phù hợp.</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((unit, idx) => {
                const parentName = unit.don_vi_cha_id
                  ? unitMap.get(unit.don_vi_cha_id) || 'Đang cập nhật'
                  : '— (Tổ chức cấp cao nhất)';
                const isChecked = selectedIds.has(unit.id);
                const isSelected = selectedUnit?.id === unit.id;

                const statusTag =
                  unit.trang_thai === 'TAM_NGUNG' ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>Tạm ngừng</span>
                    </span>
                  ) : unit.trang_thai === 'CHAM_DUT' ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span>Đã chấm dứt</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Đang hoạt động</span>
                    </span>
                  );

                return (
                  <tr
                    key={unit.id}
                    onClick={() => onSelectUnit(unit)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 text-center"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelectOne(unit.id)}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span title={unit.ten}>{unit.ten}</span>
                          <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200" title={`Mã tổ chức: ${unit.ma || 'DU-01'}`}>
                            {unit.ma || 'DU-01'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 text-xs truncate max-w-48" title={parentName}>
                      {parentName}
                    </td>
                    <td className="p-3 text-center">{statusTag}</td>
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {/* Xem */}
                        <button
                          onClick={() => onViewUnit(unit)}
                          title="Xem thông tin chi tiết (Thoát bằng nút Đóng)"
                          className="px-2 py-1 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem</span>
                        </button>

                        {canEdit && (
                          <>
                            {/* Thêm cấp dưới */}
                            <button
                              onClick={() => onAddChild(unit)}
                              title="Thêm tổ chức trực thuộc"
                              className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>

                            {/* Sửa */}
                            <button
                              onClick={() => onEditUnit(unit)}
                              title="Sửa thông tin"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Chuyển cấp trên */}
                            <button
                              onClick={() => onChangeParent(unit)}
                              title="Chuyển cấp trên"
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>

                            {/* Đổi trạng thái (Tạm dừng, Chấm dứt, Khôi phục) */}
                            <button
                              onClick={() => onToggleStatus(unit)}
                              title="Đổi trạng thái: Đang hoạt động / Tạm ngừng / Chấm dứt"
                              className={`p-1 rounded transition cursor-pointer ${
                                unit.trang_thai === 'TAM_NGUNG'
                                  ? 'text-amber-600 hover:bg-amber-100'
                                  : unit.trang_thai === 'CHAM_DUT'
                                  ? 'text-rose-600 hover:bg-rose-100'
                                  : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            {/* Xóa tổ chức */}
                            {onDeleteUnit && (
                              <button
                                onClick={() => onDeleteUnit(unit)}
                                title="Xóa tổ chức"
                                className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── FOOTER: PHÂN TRANG ── */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-slate-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>bản ghi / trang • Tổng: <strong>{totalItems}</strong> tổ chức</span>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Trước
          </button>
          <span className="px-3 py-1 font-bold text-slate-700">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
};
