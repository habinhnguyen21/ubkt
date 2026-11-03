import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  X,
  History,
  ShieldAlert,
  UserPlus,
  RotateCw,
  Building2,
  CheckSquare,
  Square,
  Briefcase,
  ChevronRight,
  Eye,
  Trash2,
  ArrowRightLeft,
  Eraser,
  Sparkles,
} from 'lucide-react';
import type { DonVi, PhanCongDiaBan, User, DiaBanRecord, LichSuPhuTrachDiaBan } from '../../types';
import {
  getWaitingUnits,
  getAssigneesForUnit,
  computePhanCongStats,
  canModifyAssignments,
  assignUnitsToOfficer,
  unassignUnitFromOfficer,
  getUnitDecisionNumber,
  matchesSearch,
  MAX_UNITS_PER_OFFICER_DEFAULT,
  findBestMatchingUser,
  transferAssignmentToUser,
  deleteAssignment,
  removeInvalidUnitsFromAssignment,
  cleanAllOrphanWarnings,
  type OrphanWarning,
} from '../../utils/phanCongView';

export interface PhanCongManagerProps {
  currentUser: User;
  allDonVi: DonVi[];
  usersList: User[];
  assignments: PhanCongDiaBan[];
  diaBanRecords: DiaBanRecord[];
  onSaveAssignments: (
    updated: PhanCongDiaBan[],
    auditInfo?: { hanh_dong: string; du_lieu_cu?: any; du_lieu_moi?: any }
  ) => void;
  onReloadUsers?: () => void;
  onOpenCreateUserModal?: () => void;
  onOpenHistoryModal?: (unit: { id: string; ten: string; record?: DiaBanRecord }) => void;
  onOpenEditCanCuModal?: (entry?: LichSuPhuTrachDiaBan | null) => void;
}

const OFFICER_COLOR_CLASSES = [
  'bg-blue-50 text-blue-800 border-blue-200',
  'bg-emerald-50 text-emerald-800 border-emerald-200',
  'bg-purple-50 text-purple-800 border-purple-200',
  'bg-amber-50 text-amber-900 border-amber-200',
  'bg-indigo-50 text-indigo-800 border-indigo-200',
  'bg-rose-50 text-rose-800 border-rose-200',
  'bg-cyan-50 text-cyan-800 border-cyan-200',
  'bg-teal-50 text-teal-800 border-teal-200',
];

export const PhanCongManager: React.FC<PhanCongManagerProps> = ({
  currentUser,
  allDonVi,
  usersList,
  assignments,
  diaBanRecords,
  onSaveAssignments,
  onReloadUsers,
  onOpenCreateUserModal,
  onOpenHistoryModal,
}) => {
  const isAdmin = canModifyAssignments(currentUser);

  // 1. Chế độ xem: 'GIAO_VIEC' (Mặc định) | 'BANG_PHAN_CONG' | 'THEO_DONG_CHI'
  const [viewMode, setViewMode] = useState<'GIAO_VIEC' | 'BANG_PHAN_CONG' | 'THEO_DONG_CHI'>('GIAO_VIEC');

  // 2. Cán bộ đang được chọn ở cột trái
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return usersList[0]?.id || '';
  });

  // Tự động chọn cán bộ đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedUserId && usersList.length > 0) {
      setSelectedUserId(usersList[0].id);
    }
  }, [selectedUserId, usersList]);

  // 3. Multi-select các đơn vị trong danh sách chờ giao
  const [selectedWaitingUnitIds, setSelectedWaitingUnitIds] = useState<Set<string>>(new Set());

  // 4. Hiệu ứng mờ dần (0.3s) trước khi đơn vị biến mất khỏi danh sách chờ giao
  const [fadingUnitIds, setFadingUnitIds] = useState<Set<string>>(new Set());

  // 5. Công tắc "Hiện cả đơn vị đã có người" (mặc định tắt)
  const [showAllAssigned, setShowAllAssigned] = useState<boolean>(false);

  // 6. Tìm kiếm
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [waitingSearch, setWaitingSearch] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableOfficerFilter, setTableOfficerFilter] = useState<string>('ALL');

  // 7. Lọc theo thẻ số liệu ở đầu trang ('ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'MULTI')
  const [statFilter, setStatFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'MULTI'>('ALL');

  // 8. Toast thông báo có nút "Hoàn tác" (đếm ngược 10 giây)
  const [undoToast, setUndoToast] = useState<{
    message: string;
    previousAssignments: PhanCongDiaBan[];
    secondsLeft: number;
  } | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showUndoNotification = (
    message: string,
    previousAssignments: PhanCongDiaBan[],
    durationSeconds = 10
  ) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setUndoToast({
      message,
      previousAssignments,
      secondsLeft: durationSeconds,
    });

    countdownTimerRef.current = setInterval(() => {
      setUndoToast((prev) => {
        if (!prev || prev.secondsLeft <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const handleExecuteUndo = () => {
    if (!undoToast) return;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const toRestore = undoToast.previousAssignments;
    setUndoToast(null);
    onSaveAssignments(toRestore, {
      hanh_dong: 'Hoàn tác thay đổi phân công quản lý địa bàn',
      du_lieu_cu: assignments,
      du_lieu_moi: toRestore,
    });
  };

  // 9. Trạng thái các modal dọn dẹp cảnh báo dữ liệu phân công (chỉ ADMIN)
  const [transferModalTarget, setTransferModalTarget] = useState<OrphanWarning | null>(null);
  const [selectedTransferUserId, setSelectedTransferUserId] = useState<string>('');

  const [deleteModalTarget, setDeleteModalTarget] = useState<OrphanWarning | null>(null);

  const [removeUnitsModalTarget, setRemoveUnitsModalTarget] = useState<OrphanWarning | null>(null);

  const [isCleanAllModalOpen, setIsCleanAllModalOpen] = useState<boolean>(false);
  const [cleanAllStep, setCleanAllStep] = useState<1 | 2>(1);

  const handleOpenTransferModal = (warn: OrphanWarning) => {
    setTransferModalTarget(warn);
    const suggested = findBestMatchingUser(warn.userName, usersList);
    const defaultUser = suggested || usersList.find((u) => u.trang_thai !== 0);
    setSelectedTransferUserId(defaultUser ? defaultUser.id : '');
  };

  const handleConfirmTransfer = () => {
    if (!transferModalTarget || !isAdmin) return;
    const targetUser = usersList.find((u) => u.id === selectedTransferUserId);
    if (!targetUser) {
      alert('Vui lòng chọn tài khoản cán bộ tiếp nhận.');
      return;
    }
    const prev = assignments;
    const updated = transferAssignmentToUser(assignments, transferModalTarget.userId, targetUser);
    onSaveAssignments(updated, {
      hanh_dong: `Chuyển phân công từ "${transferModalTarget.userName}" (ID: ${transferModalTarget.userId}) sang Đ/c ${targetUser.ho_ten}`,
      du_lieu_cu: prev,
      du_lieu_moi: updated,
    });
    showUndoNotification(
      `Đã chuyển phân công của "${transferModalTarget.userName}" sang Đ/c ${targetUser.ho_ten}`,
      prev,
      10
    );
    setTransferModalTarget(null);
  };

  const handleConfirmDeleteAssignment = () => {
    if (!deleteModalTarget || !isAdmin) return;
    const prev = assignments;
    const updated = deleteAssignment(assignments, deleteModalTarget.userId);
    onSaveAssignments(updated, {
      hanh_dong: `Xóa bản phân công của cán bộ không còn tồn tại: "${deleteModalTarget.userName}" (ID: ${deleteModalTarget.userId})`,
      du_lieu_cu: prev,
      du_lieu_moi: updated,
    });
    showUndoNotification(
      `Đã xóa bản phân công của "${deleteModalTarget.userName}". Các đơn vị đã chuyển về Chưa có người phụ trách`,
      prev,
      10
    );
    setDeleteModalTarget(null);
  };

  const handleConfirmRemoveInvalidUnits = () => {
    if (!removeUnitsModalTarget || !isAdmin) return;
    const prev = assignments;
    const updated = removeInvalidUnitsFromAssignment(
      assignments,
      removeUnitsModalTarget.userId,
      removeUnitsModalTarget.invalidUnitIds || []
    );
    onSaveAssignments(updated, {
      hanh_dong: `Gỡ ${(removeUnitsModalTarget.invalidUnitIds || []).length} đơn vị không tồn tại khỏi phân công của ${removeUnitsModalTarget.userName}`,
      du_lieu_cu: prev,
      du_lieu_moi: updated,
    });
    showUndoNotification(
      `Đã gỡ các đơn vị không tồn tại khỏi phân công của Đ/c ${removeUnitsModalTarget.userName}`,
      prev,
      10
    );
    setRemoveUnitsModalTarget(null);
  };

  const handleConfirmCleanAll = () => {
    if (!isAdmin) return;
    const prev = assignments;
    const res = cleanAllOrphanWarnings(assignments, allDonVi, usersList);
    onSaveAssignments(res.cleanedAssignments, {
      hanh_dong: `Dọn tất cả cảnh báo phân công: Xóa ${res.removedAssignmentsCount} cán bộ không tồn tại, gỡ ${res.removedUnitsCount} đơn vị rác`,
      du_lieu_cu: prev,
      du_lieu_moi: res.cleanedAssignments,
    });
    showUndoNotification(
      `Đã dọn sạch toàn bộ cảnh báo (${res.removedAssignmentsCount} bản phân công, ${res.removedUnitsCount} đơn vị rác)`,
      prev,
      10
    );
    setIsCleanAllModalOpen(false);
    setCleanAllStep(1);
  };

  // 9. Thống kê & cảnh báo
  const stats = useMemo(() => {
    return computePhanCongStats(allDonVi, assignments, usersList, MAX_UNITS_PER_OFFICER_DEFAULT);
  }, [allDonVi, assignments, usersList]);

  // Đơn vị hoạt động (chưa xóa)
  const activeUnits = useMemo(() => {
    return allDonVi.filter((u) => !u.deleted_at);
  }, [allDonVi]);

  // Map màu cán bộ
  const userColorMap = useMemo(() => {
    const map = new Map<string, string>();
    usersList.forEach((u, idx) => {
      map.set(u.id, OFFICER_COLOR_CLASSES[idx % OFFICER_COLOR_CLASSES.length]);
    });
    return map;
  }, [usersList]);

  // Cán bộ đang được chọn
  const selectedUserObj = useMemo(() => {
    return usersList.find((u) => u.id === selectedUserId) || null;
  }, [usersList, selectedUserId]);

  // Danh sách đơn vị ĐÃ GIAO cho cán bộ đang chọn
  const assignedUnitsForSelectedUser = useMemo(() => {
    if (!selectedUserId) return [];
    const userAssign = assignments.find((a) => a.user_id === selectedUserId && a.trang_thai !== 'DA_CHUYEN_GIAO');
    if (!userAssign || !userAssign.don_vi_ids) return [];
    const heldSet = new Set(userAssign.don_vi_ids);
    return activeUnits.filter((u) => heldSet.has(u.id));
  }, [selectedUserId, assignments, activeUnits]);

  // Danh sách đơn vị CHỜ GIAO (cột phải)
  const waitingUnits = useMemo(() => {
    return getWaitingUnits(allDonVi, assignments, {
      showAllAssigned,
      searchQuery: waitingSearch,
      excludeUnitIds: fadingUnitIds,
      selectedUserId,
    });
  }, [allDonVi, assignments, showAllAssigned, waitingSearch, fadingUnitIds, selectedUserId]);

  // Xử lý toggle chọn đơn vị chờ giao
  const handleToggleSelectWaiting = (unitId: string) => {
    if (!isAdmin) return;
    setSelectedWaitingUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const handleSelectAllWaiting = () => {
    if (!isAdmin) return;
    if (selectedWaitingUnitIds.size === waitingUnits.length) {
      setSelectedWaitingUnitIds(new Set());
    } else {
      setSelectedWaitingUnitIds(new Set(waitingUnits.map((u) => u.id)));
    }
  };

  // Nút "Giao cho đồng chí này"
  const handleAssignSelectedUnits = () => {
    if (!isAdmin || !selectedUserId || !selectedUserObj) return;
    const unitIdsToAssign = Array.from(selectedWaitingUnitIds);
    if (unitIdsToAssign.length === 0) return;

    const previous = assignments;
    const count = unitIdsToAssign.length;
    const sampleNames = unitIdsToAssign
      .map((id) => allDonVi.find((u) => u.id === id)?.ten)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    const label = count > 2 ? `${sampleNames} và ${count - 2} đơn vị khác` : sampleNames;

    // 1. Kích hoạt hiệu ứng mờ dần trong 0.3s
    setFadingUnitIds(new Set(unitIdsToAssign));

    setTimeout(() => {
      // 2. Lưu phân công mới
      const updated = assignUnitsToOfficer(assignments, selectedUserId, selectedUserObj.ho_ten, unitIdsToAssign);
      onSaveAssignments(updated, {
        hanh_dong: `Giao ${count} đơn vị cho Đ/c ${selectedUserObj.ho_ten}`,
        du_lieu_cu: previous,
        du_lieu_moi: updated,
      });

      // 3. Xóa trạng thái fade & clear selection
      setFadingUnitIds(new Set());
      setSelectedWaitingUnitIds(new Set());

      // 4. Bật Toast Hoàn tác trong 10 giây
      showUndoNotification(`Đã giao ${label} cho Đ/c ${selectedUserObj.ho_ten}`, previous, 10);
    }, 300);
  };

  // Nút bỏ phân công (✕ trên từng chip)
  const handleUnassignSingleUnit = (unit: DonVi) => {
    if (!isAdmin || !selectedUserId || !selectedUserObj) return;

    // Kiểm tra số quyết định
    const decisionNo = getUnitDecisionNumber(unit.id, diaBanRecords);
    if (decisionNo) {
      const confirmRemove = window.confirm(
        `Đơn vị "${unit.ten}" đã được ban hành quyết định phân công ("${decisionNo}").\nBạn có chắc chắn muốn bỏ phân công đơn vị này khỏi Đ/c ${selectedUserObj.ho_ten} không?`
      );
      if (!confirmRemove) return;
    }

    const previous = assignments;
    const updated = unassignUnitFromOfficer(assignments, selectedUserId, unit.id);
    onSaveAssignments(updated, {
      hanh_dong: `Bỏ phân công đơn vị "${unit.ten}" khỏi Đ/c ${selectedUserObj.ho_ten}`,
      du_lieu_cu: previous,
      du_lieu_moi: updated,
    });
    showUndoNotification(`Đã bỏ phân công đơn vị "${unit.ten}" khỏi Đ/c ${selectedUserObj.ho_ten}`, previous, 10);
  };

  // Xuất Excel cho Bảng phân công
  const handleExportExcel = () => {
    const dataForExport = activeUnits.map((u, idx) => {
      const assignees = getAssigneesForUnit(u.id, assignments, usersList);
      const decisionNo = getUnitDecisionNumber(u.id, diaBanRecords) || 'Chưa ban hành';
      const matchRec = diaBanRecords.find((r) => r.id === u.id);
      const tuNgay = matchRec?.thoi_gian_phan_cong || '---';

      return {
        STT: idx + 1,
        'Mã đơn vị': u.ma || '---',
        'Tên tổ chức / Đơn vị': u.ten,
        'Cán bộ phụ trách': assignees.length > 0 ? assignees.map((a) => a.userName).join(', ') : 'Chưa phân công',
        'Số quyết định': decisionNo,
        'Thời gian phân công': tuNgay,
        'Trạng thái': assignees.length > 0 ? 'Đã phân công' : 'Chưa có người',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangPhanCong');
    XLSX.writeFile(wb, `Bang_Phan_Cong_Quan_Ly_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Dữ liệu cho Bảng phân công (nhóm Chưa phân công nằm ở ĐẦU BẢNG)
  const sortedUnitsForTable = useMemo(() => {
    let list = [...activeUnits];

    // Lọc theo stat card
    if (statFilter === 'ASSIGNED') {
      list = list.filter((u) => getAssigneesForUnit(u.id, assignments, usersList).length > 0);
    } else if (statFilter === 'UNASSIGNED') {
      list = list.filter((u) => getAssigneesForUnit(u.id, assignments, usersList).length === 0);
    } else if (statFilter === 'MULTI') {
      list = list.filter((u) => getAssigneesForUnit(u.id, assignments, usersList).length >= 2);
    }

    // Lọc theo cán bộ
    if (tableOfficerFilter !== 'ALL') {
      list = list.filter((u) => {
        const assignees = getAssigneesForUnit(u.id, assignments, usersList);
        return assignees.some((a) => a.userId === tableOfficerFilter);
      });
    }

    // Lọc theo tìm kiếm trong bảng
    if (tableSearch && tableSearch.trim()) {
      list = list.filter((u) => {
        const matchUnit = matchesSearch(u.ten, tableSearch) || matchesSearch(u.ma, tableSearch);
        const assignees = getAssigneesForUnit(u.id, assignments, usersList);
        const matchOfficer = assignees.some((a) => matchesSearch(a.userName, tableSearch));
        return matchUnit || matchOfficer;
      });
    }

    // Sắp xếp: Đơn vị Chưa phân công luôn hiển thị ở ĐẦU BẢNG
    list.sort((a, b) => {
      const aAssign = getAssigneesForUnit(a.id, assignments, usersList).length;
      const bAssign = getAssigneesForUnit(b.id, assignments, usersList).length;
      if (aAssign === 0 && bAssign > 0) return -1;
      if (aAssign > 0 && bAssign === 0) return 1;
      return a.thu_tu - b.thu_tu || a.ten.localeCompare(b.ten);
    });

    return list;
  }, [activeUnits, statFilter, tableOfficerFilter, tableSearch, assignments, usersList]);

  // Kết quả ô tìm kiếm chung toàn diện trên đỉnh trang
  const globalSearchResults = useMemo(() => {
    if (!globalSearch || !globalSearch.trim()) return [];
    return activeUnits
      .map((u) => {
        const assignees = getAssigneesForUnit(u.id, assignments, usersList);
        const matchUnit = matchesSearch(u.ten, globalSearch) || matchesSearch(u.ma, globalSearch);
        const matchOfficer = assignees.some((a) => matchesSearch(a.userName, globalSearch));
        if (matchUnit || matchOfficer) {
          return { unit: u, assignees };
        }
        return null;
      })
      .filter(Boolean) as { unit: DonVi; assignees: { userId: string; userName: string }[] }[];
  }, [globalSearch, activeUnits, assignments, usersList]);

  return (
    <div className="w-full space-y-4 font-sans pb-10">
      {/* ── TOAST HOÀN TÁC NỔI GÓC DƯỚI / TRÊN MÀN HÌNH ── */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounceIn shadow-xl rounded-xl bg-slate-900 text-white p-4 border border-slate-700 flex items-center justify-between gap-4 max-w-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium leading-snug">{undoToast.message}</p>
          </div>
          <button
            type="button"
            onClick={handleExecuteUndo}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn tác ({undoToast.secondsLeft}s)</span>
          </button>
        </div>
      )}

      {/* ── 1. THANH TIÊU ĐỀ & CHUYỂN CHẾ ĐỘ XEM ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Phân công quản lý</h2>
              {!isAdmin && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-slate-500" />
                  <span>Chế độ chỉ xem</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Phân công cán bộ UBKT Đảng ủy phụ trách, theo dõi các tổ chức đảng trực thuộc
            </p>
          </div>
        </div>

        {/* Nút chuyển đổi 3 chế độ xem */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setViewMode('GIAO_VIEC')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'GIAO_VIEC' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Giao việc (Trực quan)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('BANG_PHAN_CONG')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'BANG_PHAN_CONG' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Bảng phân công</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('THEO_DONG_CHI')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'THEO_DONG_CHI' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Theo đồng chí</span>
          </button>
        </div>
      </div>

      {/* ── 2. CÁC THẺ SỐ LIỆU ĐẦU TRANG (BẤM VÀO ĐỂ LỌC) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tổng số đơn vị */}
        <div
          onClick={() => setStatFilter('ALL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
            statFilter === 'ALL'
              ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500">Tổng số đơn vị</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-800">{stats.totalUnits}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Tất cả chi, đảng bộ</p>
        </div>

        {/* Card 2: Đã phân công */}
        <div
          onClick={() => setStatFilter('ASSIGNED')}
          className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
            statFilter === 'ASSIGNED'
              ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500">Đã phân công</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600">{stats.assignedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {stats.totalUnits > 0 ? `${Math.round((stats.assignedCount / stats.totalUnits) * 100)}% độ bao phủ` : '0%'}
          </p>
        </div>

        {/* Card 3: Chưa có người phụ trách (Màu vàng/cam cảnh báo) */}
        <div
          onClick={() => setStatFilter('UNASSIGNED')}
          className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
            stats.unassignedCount > 0 ? 'border-amber-200 bg-amber-50/30' : 'bg-white border-slate-200/80'
          } ${statFilter === 'UNASSIGNED' ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/70' : 'hover:border-amber-300'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-800">Chưa có người</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700">{stats.unassignedCount}</div>
          <p className="text-[10px] text-amber-600 mt-0.5">
            {stats.unassignedCount > 0 ? 'Cần giao việc ngay' : 'Đã giao hết'}
          </p>
        </div>

        {/* Card 4: Có từ 2 người phụ trách trở lên */}
        <div
          onClick={() => setStatFilter('MULTI')}
          className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
            statFilter === 'MULTI'
              ? 'bg-purple-50/70 border-purple-400 ring-1 ring-purple-300'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500">Từ 2 người trở lên</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-700">{stats.multiAssignedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Phối hợp quản lý</p>
        </div>
      </div>

      {/* ── 3. BANNER CẢNH BÁO NẾU CÓ BẤT THƯỜNG ── */}
      {(stats.warnings.orphanUnitsCount > 0 || stats.warnings.overloadedOfficers.length > 0) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-200/80">
            <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Phát hiện cảnh báo dữ liệu phân công ({stats.warnings.orphanUnitsCount} mục cần xử lý):</span>
            </div>
            {isAdmin && stats.warnings.orphanUnitsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsCleanAllModalOpen(true);
                  setCleanAllStep(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
                title="Dọn nhanh tất cả đơn vị không tồn tại và xóa bản phân công của cán bộ không còn trong hệ thống"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Dọn tất cả cảnh báo</span>
              </button>
            )}
          </div>

          {/* Danh sách các cảnh báo cụ thể */}
          <div className="space-y-2">
            {stats.warnings.orphanAssignments.map((warn) => (
              <div
                key={warn.id}
                className="p-3 bg-white/90 border border-rose-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5 font-medium text-rose-900">
                    {warn.type === 'INVALID_UNIT' ? (
                      <Building2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{warn.reason}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 pl-5.5">
                    Bản ghi phân công: <strong className="text-slate-700">{warn.userName || warn.userId}</strong>
                    {warn.affectedUnitIds && warn.affectedUnitIds.length > 0 && (
                      <span> • Đang chứa {warn.affectedUnitIds.length} đơn vị</span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-5.5 md:pl-0">
                    {(warn.type === 'MISSING_USER' || warn.type === 'LOCKED_USER') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(warn)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Chuyển sang tài khoản khác</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalTarget(warn)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa bản phân công này</span>
                        </button>
                      </>
                    )}

                    {warn.type === 'INVALID_UNIT' && (
                      <button
                        type="button"
                        onClick={() => setRemoveUnitsModalTarget(warn)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        <span>Gỡ đơn vị không tồn tại khỏi phân công</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {stats.warnings.overloadedOfficers.map((ov, i) => (
              <div key={i} className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900">
                • Cán bộ <strong>{ov.user.ho_ten}</strong> đang phụ trách {ov.count} đơn vị (vượt ngưỡng {MAX_UNITS_PER_OFFICER_DEFAULT} đơn vị).
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Ô TÌM KIẾM CHUNG TOÀN DIỆN TRÊN ĐẦU TRANG ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Tra cứu nhanh: gõ tên đơn vị (ví dụ TDP 1) hoặc tên cán bộ phụ trách..."
            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Kết quả tìm kiếm chung xổ xuống khi có nội dung */}
        {globalSearch && (
          <div className="mt-2 pt-2 border-t border-slate-100 max-h-60 overflow-y-auto divide-y divide-slate-100">
            {globalSearchResults.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Không tìm thấy đơn vị hoặc cán bộ nào phù hợp</p>
            ) : (
              globalSearchResults.map(({ unit, assignees }) => (
                <div key={unit.id} className="py-2 px-1 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{unit.ten}</span>
                    {unit.ma && <span className="ml-2 font-mono text-[11px] text-slate-400">({unit.ma})</span>}
                  </div>
                  <div>
                    {assignees.length > 0 ? (
                      <span className="text-blue-700 font-semibold flex items-center gap-1">
                        <span>→ Đ/c {assignees.map((a) => a.userName).join(', ')}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 italic">Chưa phân công</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── 5. NỘI DUNG CHÍNH THEO CHẾ ĐỘ XEM ── */}

      {/* CHẾ ĐỘ 1: GIAO VIỆC (MỤC TIÊU CHÍNH) */}
      {viewMode === 'GIAO_VIEC' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[520px]">
            {/* ── CỘT TRÁI: DANH SÁCH CÁN BỘ (4 cols) ── */}
            <div className="md:col-span-4 p-4 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Cán bộ ({usersList.length})
                </span>
                <div className="flex items-center gap-1">
                  {onReloadUsers && (
                    <button
                      type="button"
                      onClick={onReloadUsers}
                      className="p-1 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                      title="Tải lại danh sách"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin && onOpenCreateUserModal && (
                    <button
                      type="button"
                      onClick={onOpenCreateUserModal}
                      className="px-2 py-0.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Thêm cán bộ mới"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Thêm</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách thẻ cán bộ */}
              <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                {usersList.map((usr) => {
                  const assign = assignments.find((a) => a.user_id === usr.id && a.trang_thai !== 'DA_CHUYEN_GIAO');
                  const count = assign?.don_vi_ids?.length || 0;
                  const isSelected = selectedUserId === usr.id;
                  const isOverloaded = count > MAX_UNITS_PER_OFFICER_DEFAULT;

                  return (
                    <div
                      key={usr.id}
                      onClick={() => setSelectedUserId(usr.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {usr.ho_ten}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-mono">@{usr.ten_dang_nhap}</span>
                          {usr.chuc_danh && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {usr.chuc_danh}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Số đơn vị đang giữ (Cân bằng khối lượng công việc) */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isOverloaded
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : count > 0
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                          title={isOverloaded ? `Quá tải: giữ > ${MAX_UNITS_PER_OFFICER_DEFAULT} đơn vị` : 'Số đơn vị đang giữ'}
                        >
                          {count} đơn vị
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── CỘT PHẢI: GIAO VIỆC & DANH SÁCH CHỜ GIAO (8 cols) ── */}
            <div className="md:col-span-8 p-4 flex flex-col justify-between space-y-4">
              <div>
                {/* 1. Header Cán bộ được chọn */}
                <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Đang chọn cán bộ:</span>
                      <span className="text-blue-700 text-base">{selectedUserObj?.ho_ten || 'Chưa chọn'}</span>
                      {selectedUserObj?.chuc_danh && (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-blue-100 text-blue-800 font-medium">
                          {selectedUserObj.chuc_danh}
                        </span>
                      )}
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-700 px-3 py-1 bg-slate-100 rounded-lg">
                    Đang phụ trách {assignedUnitsForSelectedUser.length} đơn vị
                  </span>
                </div>

                {/* 2. Phần "ĐÃ GIAO CHO ĐỒNG CHÍ NÀY" (Dạng chip nhỏ gọn có dấu ✕) */}
                <div className="mt-3 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã giao cho đồng chí này ({assignedUnitsForSelectedUser.length} đơn vị)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 italic">Bấm ✕ để bỏ phân công</span>
                  </div>

                  {assignedUnitsForSelectedUser.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">Đồng chí này hiện chưa được giao đơn vị nào.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {assignedUnitsForSelectedUser.map((u) => {
                        const decisionNo = getUnitDecisionNumber(u.id, diaBanRecords);
                        return (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs hover:border-slate-300 transition"
                          >
                            <span>{u.ten}</span>
                            {decisionNo && (
                              <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1 rounded" title={`Số QĐ: ${decisionNo}`}>
                                QĐ
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleUnassignSingleUnit(u)}
                                className="w-4 h-4 rounded-full hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition cursor-pointer text-slate-400"
                                title="Bỏ phân công đơn vị này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Thanh công cụ của Danh sách chờ giao */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Danh sách chờ giao ({waitingUnits.length} đơn vị)
                    </h4>
                  </div>

                  {/* Công tắc "Hiện cả đơn vị đã có người" */}
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAllAssigned}
                      onChange={(e) => setShowAllAssigned(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Hiện cả đơn vị đã có người</span>
                  </label>
                </div>

                {/* Ô tìm kiếm trong danh sách chờ giao */}
                <div className="relative mt-2.5 mb-2.5">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={waitingSearch}
                    onChange={(e) => setWaitingSearch(e.target.value)}
                    placeholder="Lọc danh sách chờ giao (hiểu TDP = tổ dân phố)..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* 4. Danh sách các đơn vị chờ giao (với checkbox) */}
                <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                  {waitingUnits.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500/80" />
                      <p className="text-xs font-bold text-slate-700">Tất cả đơn vị đã được phân công!</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {showAllAssigned
                          ? 'Không có đơn vị nào phù hợp bộ lọc.'
                          : 'Bật "Hiện cả đơn vị đã có người" nếu muốn giao thêm đồng chí phối hợp.'}
                      </p>
                    </div>
                  ) : (
                    waitingUnits.map((u) => {
                      const isChecked = selectedWaitingUnitIds.has(u.id);
                      const isFading = fadingUnitIds.has(u.id);
                      const currentAssignees = getAssigneesForUnit(u.id, assignments, usersList);
                      const matchRec = diaBanRecords.find((r) => r.id === u.id);
                      const historyCount = matchRec?.lich_su_phu_trach?.length || 0;

                      return (
                        <div
                          key={u.id}
                          style={{
                            transition: 'opacity 300ms ease, transform 300ms ease',
                            opacity: isFading ? 0 : 1,
                            transform: isFading ? 'scale(0.95)' : 'scale(1)',
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-400 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <label className="flex items-center space-x-3 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectWaiting(u.id)}
                              disabled={!isAdmin}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800">{u.ten}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {u.ma && (
                                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">
                                    {u.ma}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">#{u.thu_tu}</span>
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Lịch sử cán bộ */}
                            {onOpenHistoryModal && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onOpenHistoryModal({ id: u.id, ten: u.ten, record: matchRec });
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                                title="Xem lịch sử các thời kỳ cán bộ phụ trách"
                              >
                                <History className="w-3 h-3 text-indigo-600" />
                                <span>{historyCount > 1 ? `${historyCount} đời` : 'Lịch sử'}</span>
                              </button>
                            )}

                            {/* Nhãn người đang phụ trách nếu bật công tắc */}
                            {currentAssignees.length > 0 ? (
                              <span className="text-[11px] font-medium text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-300">
                                Đang giao: <strong>{currentAssignees.map((a) => a.userName).join(', ')}</strong>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chưa có người</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 5. Nút Thao tác Giao việc ở đáy cột phải */}
              {isAdmin && waitingUnits.length > 0 && (
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <button
                    type="button"
                    onClick={handleSelectAllWaiting}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {selectedWaitingUnitIds.size === waitingUnits.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {selectedWaitingUnitIds.size === waitingUnits.length
                        ? 'Bỏ chọn tất cả'
                        : `Chọn tất cả (${waitingUnits.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedWaitingUnitIds.size === 0}
                    onClick={handleAssignSelectedUnits}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedWaitingUnitIds.size > 0
                        ? `Giao ${selectedWaitingUnitIds.size} đơn vị đã chọn cho Đ/c ${selectedUserObj?.ho_ten}`
                        : 'Chọn đơn vị để giao'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 2: BẢNG PHÂN CÔNG (CHẾ ĐỘ XEM CHỈ ĐỌC, ĐƠN VỊ CHƯA PHÂN CÔNG Ở ĐẦU BẢNG) */}
      {viewMode === 'BANG_PHAN_CONG' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-4">
          {/* Thanh công cụ bảng */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              {/* Lọc theo cán bộ */}
              <select
                value={tableOfficerFilter}
                onChange={(e) => setTableOfficerFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả cán bộ</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ho_ten}
                  </option>
                ))}
              </select>

              {/* Tìm kiếm */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Tìm đơn vị hoặc cán bộ..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>
          </div>

          {/* Bảng dữ liệu có cuộn ngang trên điện thoại (overflow-x-auto) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Mã</th>
                  <th className="py-2.5 px-3">Đơn vị / Tổ chức đảng</th>
                  <th className="py-2.5 px-3">Đồng chí phụ trách</th>
                  <th className="py-2.5 px-3">Số quyết định</th>
                  <th className="py-2.5 px-3">Từ ngày</th>
                  <th className="py-2.5 px-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedUnitsForTable.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Không có đơn vị nào phù hợp điều kiện lọc
                    </td>
                  </tr>
                ) : (
                  sortedUnitsForTable.map((u, idx) => {
                    const assignees = getAssigneesForUnit(u.id, assignments, usersList);
                    const isUnassigned = assignees.length === 0;
                    const decisionNo = getUnitDecisionNumber(u.id, diaBanRecords);
                    const matchRec = diaBanRecords.find((r) => r.id === u.id);

                    return (
                      <tr
                        key={u.id}
                        className={`transition ${
                          isUnassigned ? 'bg-amber-50/50 hover:bg-amber-100/60' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{u.ma || '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{u.ten}</span>
                            {isUnassigned && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-200 text-amber-900 font-bold">
                                Chưa phân công
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {isUnassigned ? (
                            <span className="text-amber-700 italic">Chưa có người phụ trách</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {assignees.map((a) => (
                                <span
                                  key={a.userId}
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    userColorMap.get(a.userId) || 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {a.userName}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{decisionNo || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{matchRec?.thoi_gian_phan_cong || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {onOpenHistoryModal && (
                            <button
                              type="button"
                              onClick={() => onOpenHistoryModal({ id: u.id, ten: u.ten, record: matchRec })}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                            >
                              Lịch sử
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 3: THEO ĐỒNG CHÍ (MỖI ĐỒNG CHÍ MỘT THẺ) */}
      {viewMode === 'THEO_DONG_CHI' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usersList.map((usr) => {
            const assign = assignments.find((a) => a.user_id === usr.id && a.trang_thai !== 'DA_CHUYEN_GIAO');
            const heldUnitIds = new Set(assign?.don_vi_ids || []);
            const heldUnits = activeUnits.filter((u) => heldUnitIds.has(u.id));
            const isOverloaded = heldUnits.length > MAX_UNITS_PER_OFFICER_DEFAULT;

            return (
              <div
                key={usr.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{usr.ho_ten}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        @{usr.ten_dang_nhap} {usr.chuc_danh ? `• ${usr.chuc_danh}` : ''}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isOverloaded
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : heldUnits.length > 0
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {heldUnits.length} đơn vị
                    </span>
                  </div>

                  {/* Danh sách các đơn vị của đồng chí này */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {heldUnits.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">Chưa phụ trách đơn vị nào</p>
                    ) : (
                      heldUnits.map((u, i) => (
                        <div
                          key={u.id}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {i + 1}. {u.ten}
                          </span>
                          {u.ma && <span className="text-[10px] font-mono text-slate-400">{u.ma}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(usr.id);
                        setViewMode('GIAO_VIEC');
                      }}
                      className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Giao thêm / Điều chỉnh đơn vị</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: CHUYỂN PHÂN CÔNG SANG TÀI KHOẢN KHÁC ── */}
      {transferModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-base">
                <ArrowRightLeft className="w-5 h-5" />
                <span>Chuyển phân công sang tài khoản khác</span>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <p>
                  Bản phân công của <strong>{transferModalTarget.userName}</strong> (ID:{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">{transferModalTarget.userId}</code>) không còn tài khoản hợp lệ trong hệ thống.
                </p>
                <p className="mt-1">
                  Đang phụ trách <strong>{transferModalTarget.affectedUnitIds?.length || 0}</strong> đơn vị.
                </p>
              </div>

              {transferModalTarget.affectedUnitIds && transferModalTarget.affectedUnitIds.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1.5">Danh sách đơn vị sẽ được chuyển giao:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    {transferModalTarget.affectedUnitIds.map((uid) => {
                      const u = allDonVi.find((x) => x.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-700 font-medium"
                        >
                          {u?.ten || `ID: ${uid}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Chọn tài khoản cán bộ tiếp nhận:
                </label>
                <select
                  value={selectedTransferUserId}
                  onChange={(e) => setSelectedTransferUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {usersList
                    .filter((u) => u.trang_thai !== 0)
                    .map((u) => {
                      const isSuggested =
                        u.id === findBestMatchingUser(transferModalTarget.userName, usersList)?.id;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.ho_ten} (@{u.ten_dang_nhap} - {u.chuc_danh || u.vai_tro})
                          {isSuggested ? ' ★ [Gợi ý trùng khớp tên]' : ''}
                        </option>
                      );
                    })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Hệ thống tự động so khớp tên không phân biệt dấu và gợi ý tài khoản phù hợp nhất.
                </p>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                💡 <strong>Nguyên tắc:</strong> Toàn bộ đơn vị, số quyết định và ngày phân công sẽ được giữ nguyên. Nếu tài khoản đích đã có phân công thì các đơn vị sẽ được gộp lại (không trùng lặp).
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTransferModalTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: XÓA BẢN PHÂN CÔNG CỦA CÁN BỘ KHÔNG TỒN TẠI ── */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <span>Xác nhận xóa bản phân công</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Bạn có chắc chắn muốn xóa bản phân công của cán bộ <strong>{deleteModalTarget.userName}</strong> (ID:{' '}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{deleteModalTarget.userId}</code>)?
              </p>

              {deleteModalTarget.affectedUnitIds && deleteModalTarget.affectedUnitIds.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1.5">
                  <p className="font-semibold">
                    Các đơn vị sau sẽ trở về trạng thái "Chưa có người phụ trách" ({deleteModalTarget.affectedUnitIds.length} đơn vị):
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {deleteModalTarget.affectedUnitIds.map((uid) => {
                      const u = allDonVi.find((x) => x.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-block px-2 py-0.5 bg-white border border-rose-200 rounded text-[11px] text-rose-800 font-medium"
                        >
                          {u?.ten || `ID: ${uid}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAssignment}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GỠ ĐƠN VỊ KHÔNG TỒN TẠI KHỎI PHÂN CÔNG ── */}
      {removeUnitsModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
                <Eraser className="w-5 h-5" />
                <span>Gỡ đơn vị không tồn tại khỏi phân công</span>
              </div>
              <button
                type="button"
                onClick={() => setRemoveUnitsModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Bản phân công của Đ/c <strong>{removeUnitsModalTarget.userName}</strong> đang chứa các đơn vị đã bị xóa hoặc không còn trong danh mục.
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
                <p className="font-semibold">
                  Danh sách đơn vị sẽ được gỡ bỏ ({removeUnitsModalTarget.invalidUnitIds?.length || 0} đơn vị):
                </p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {(removeUnitsModalTarget.invalidUnitNames || removeUnitsModalTarget.invalidUnitIds || []).map((name, i) => (
                    <span
                      key={i}
                      className="inline-block px-2 py-0.5 bg-white border border-amber-200 rounded text-[11px] text-amber-800 font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRemoveUnitsModalTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveInvalidUnits}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Gỡ khỏi phân công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DỌN TẤT CẢ CẢNH BÁO (2 BƯỚC) ── */}
      {isCleanAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <Sparkles className="w-5 h-5" />
                <span>
                  {cleanAllStep === 1
                    ? 'Dọn tất cả cảnh báo phân công (Bước 1/2)'
                    : 'Xác nhận dọn sạch toàn bộ cảnh báo (Bước 2/2)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCleanAllModalOpen(false);
                  setCleanAllStep(1);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cleanAllStep === 1 ? (
              <div className="text-xs text-slate-600 space-y-3">
                <p>Hệ thống đã quét toàn bộ dữ liệu phân công và tính toán các mục sẽ được dọn dẹp:</p>

                {(() => {
                  const summary = cleanAllOrphanWarnings(assignments, allDonVi, usersList);
                  return (
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>Bản phân công của cán bộ không còn tồn tại:</span>
                          <span className="text-rose-600 font-bold text-sm">
                            {summary.removedAssignmentsCount} bản ghi
                          </span>
                        </div>
                        {summary.removedOfficers.length > 0 && (
                          <p className="text-[11px] text-slate-500">
                            Cán bộ liên quan: {summary.removedOfficers.join(', ')}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-600">
                          → <strong>{summary.affectedUnitIds.length}</strong> đơn vị sẽ được chuyển về Chưa có người phụ trách.
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>Đơn vị rác / đã xóa trong các phân công khác:</span>
                          <span className="text-amber-600 font-bold text-sm">
                            {summary.removedUnitsCount} đơn vị
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          → Tự động gỡ các ID đơn vị này khỏi danh sách phụ trách.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <p className="text-[11px] text-slate-500 italic">
                  * Thao tác có thể Hoàn tác trong vòng 10 giây sau khi xác nhận.
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-3">
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Cảnh báo hành động hàng loạt:</span>
                  </div>
                  <p>
                    Bạn đang chuẩn bị áp dụng làm sạch toàn bộ dữ liệu phân công rác. Tất cả bản ghi không hợp lệ sẽ được xóa, các đơn vị liên quan sẽ về danh sách chờ giao để bạn phân công lại.
                  </p>
                  <p className="text-[11px] text-rose-700">
                    Hệ thống sẽ ghi Audit log và hiển thị nút "Hoàn tác (10s)" ngay sau khi thực hiện.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {cleanAllStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCleanAllModalOpen(false);
                      setCleanAllStep(1);
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanAllStep(2)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>Tiếp tục sang bước 2</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCleanAllStep(1)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Quay lại bước 1
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCleanAll}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận dọn sạch ngay</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhanCongManager;
