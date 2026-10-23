import React, { useState } from 'react';
import {
  FolderTree,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Eye,
  Edit2,
  ArrowRightLeft,
  Power,
  Building2,
  Trash2,
} from 'lucide-react';
import type { DonViTreeItem } from '../../types';

interface OrgTreePanelProps {
  treeData: DonViTreeItem[];
  selectedUnitId: string | null;
  canEdit: boolean;
  onSelectUnit: (unit: DonViTreeItem) => void;
  onViewUnit: (unit: DonViTreeItem) => void;
  onEditUnit: (unit: DonViTreeItem) => void;
  onAddChild: (parentUnit: DonViTreeItem) => void;
  onChangeParent: (unit: DonViTreeItem) => void;
  onToggleStatus: (unit: DonViTreeItem) => void;
  onDeleteUnit?: (unit: DonViTreeItem) => void;
}

export const OrgTreePanel: React.FC<OrgTreePanelProps> = ({
  treeData,
  selectedUnitId,
  canEdit,
  onSelectUnit,
  onViewUnit,
  onEditUnit,
  onAddChild,
  onChangeParent,
  onToggleStatus,
  onDeleteUnit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    // Mở rộng tất cả các node gốc ban đầu
    const initial: Record<string, boolean> = {};
    treeData.forEach((u) => {
      initial[u.id] = true;
    });
    return initial;
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    const recurse = (items: DonViTreeItem[]) => {
      items.forEach((it) => {
        all[it.id] = true;
        if (it.children && it.children.length > 0) recurse(it.children);
      });
    };
    recurse(treeData);
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Lọc cây theo từ khóa tìm kiếm
  const matchesSearch = (node: DonViTreeItem): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    if (node.ten.toLowerCase().includes(term)) return true;
    if (node.ghi_chu && node.ghi_chu.toLowerCase().includes(term)) return true;
    return node.children.some((child) => matchesSearch(child));
  };

  const renderNode = (node: DonViTreeItem, depth = 0) => {
    if (!matchesSearch(node)) return null;

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? false;
    const isSelected = selectedUnitId === node.id;
    const isPaused = node.trang_thai === 'TAM_NGUNG';
    const isTerminated = node.trang_thai === 'CHAM_DUT';

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectUnit(node)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white font-semibold shadow-xs'
              : isPaused
              ? 'bg-amber-50/50 hover:bg-amber-100/60 text-amber-900'
              : isTerminated
              ? 'bg-rose-50/40 hover:bg-rose-100/50 text-rose-800 line-through'
              : 'hover:bg-slate-100 text-slate-800'
          }`}
          style={{ paddingLeft: `${Math.max(6, depth * 16 + 6)}px` }}
        >
          {/* Cụm biểu tượng mở/đóng và tên tổ chức */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className={`p-0.5 rounded hover:bg-black/10 transition shrink-0 ${
                  isSelected ? 'text-white' : 'text-slate-500'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0 inline-block text-center text-slate-300">•</span>
            )}

            {/* Dấu chấm trạng thái hoạt động */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isTerminated
                  ? 'bg-rose-500'
                  : isPaused
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              title={
                isTerminated
                  ? 'Đã chấm dứt hoạt động'
                  : isPaused
                  ? 'Tạm ngừng hoạt động'
                  : 'Đang hoạt động'
              }
            />

            {/* Tên tổ chức */}
            <span className="truncate text-xs" title={node.ten}>
              {node.ten}
            </span>

            {/* Số lượng trực thuộc */}
            {hasChildren && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
                title={`${node.children.length} đơn vị trực thuộc`}
              >
                {node.children.length}
              </span>
            )}
          </div>

          {/* Menu thao tác nhanh */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 ${
              isSelected ? 'opacity-100' : ''
            }`}
          >
            {/* Xem chi tiết */}
            <button
              onClick={() => onViewUnit(node)}
              title="Xem chi tiết"
              className={`p-1 rounded transition ${
                isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <Eye className="w-3 h-3" />
            </button>

            {canEdit && (
              <>
                {/* Thêm cấp dưới */}
                <button
                  onClick={() => onAddChild(node)}
                  title="Thêm tổ chức trực thuộc"
                  className={`p-1 rounded transition ${
                    isSelected ? 'hover:bg-white/20 text-amber-300' : 'hover:bg-slate-200 text-blue-600'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                </button>

                {/* Sửa thông tin */}
                <button
                  onClick={() => onEditUnit(node)}
                  title="Chỉnh sửa thông tin"
                  className={`p-1 rounded transition ${
                    isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>

                {/* Đổi cấp trên */}
                <button
                  onClick={() => onChangeParent(node)}
                  title="Chuyển cấp trên trực tiếp"
                  className={`p-1 rounded transition ${
                    isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                </button>

                {/* Đổi trạng thái (Tạm dừng / Chấm dứt / Kích hoạt) */}
                <button
                  onClick={() => onToggleStatus(node)}
                  title="Đổi trạng thái: Đang hoạt động / Tạm ngừng / Chấm dứt"
                  className={`p-1 rounded transition ${
                    isSelected
                      ? 'hover:bg-white/20 text-white'
                      : isPaused
                      ? 'hover:bg-amber-100 text-amber-600'
                      : isTerminated
                      ? 'hover:bg-rose-100 text-rose-600'
                      : 'hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <Power className="w-3 h-3" />
                </button>

                {/* Xóa tổ chức */}
                {onDeleteUnit && (
                  <button
                    onClick={() => onDeleteUnit(node)}
                    title="Xóa tổ chức"
                    className={`p-1 rounded transition ${
                      isSelected
                        ? 'hover:bg-white/20 text-rose-200'
                        : 'hover:bg-rose-100 text-rose-500'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Nhánh con */}
        {hasChildren && isExpanded && (
          <div className="border-l border-slate-200/80 ml-3.5 my-0.5 space-y-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full max-h-[720px] overflow-hidden">
      {/* Header cây tổ chức */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <FolderTree className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Cây cơ cấu tổ chức
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={expandAll}
              className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition cursor-pointer"
              title="Mở rộng tất cả các nhánh"
            >
              Mở tất cả
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={collapseAll}
              className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition cursor-pointer"
              title="Thu gọn tất cả các nhánh"
            >
              Thu gọn
            </button>
          </div>
        </div>

        {/* Tìm kiếm trên cây */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm tổ chức trong cây..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </div>
      </div>

      {/* Danh sách node cây */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {treeData.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <span>Chưa có tổ chức nào được khai báo</span>
          </div>
        ) : (
          treeData.map((root) => renderNode(root, 0))
        )}
      </div>

      {/* Chú thích trạng thái dưới chân cây */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Hoạt động</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Tạm ngừng</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Chấm dứt</span>
          </span>
        </div>
      </div>
    </div>
  );
};
