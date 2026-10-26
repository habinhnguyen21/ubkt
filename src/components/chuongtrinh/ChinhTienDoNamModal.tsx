import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Play,
  AlertCircle,
  Save,
  RotateCcw,
  Search,
  Check,
  TrendingUp,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { ChuongTrinhKtGs, TrangThaiKtGs } from '../../types';
import { api } from '../../services/api';

interface ChinhTienDoNamModalProps {
  isOpen: boolean;
  onClose: () => void;
  list: ChuongTrinhKtGs[];
  initialYear: string;
  availableYears: number[];
  onDataChanged: () => void;
}

interface EditableProgramState {
  trang_thai: TrangThaiKtGs;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  so_van_ban: string;
  ngay_ban_hanh: string;
  nguoi_ky: string;
}

export const ChinhTienDoNamModal: React.FC<ChinhTienDoNamModalProps> = ({
  isOpen,
  onClose,
  list,
  initialYear,
  availableYears,
  onDataChanged,
}) => {
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterLoaiHinh, setFilterLoaiHinh] = useState<string>('ALL');

  // Bản lưu trữ trạng thái chỉnh sửa tạm thời theo id
  const [editedItems, setEditedItems] = useState<Record<string, EditableProgramState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Đồng bộ lại khi modal mở hoặc năm ban đầu đổi
  React.useEffect(() => {
    if (isOpen) {
      setSelectedYear(initialYear);
      setEditedItems({});
      setSaveSuccessMsg(null);
    }
  }, [isOpen, initialYear]);

  // Danh sách chương trình lọc theo năm đang chọn
  const programsInYear = useMemo(() => {
    return list.filter((item) => {
      const isHangNam = (item.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM';
      if (!isHangNam) return false;
      if (selectedYear !== 'ALL' && item.nam !== Number(selectedYear)) return false;
      return true;
    });
  }, [list, selectedYear]);

  // Lấy giá trị hiện tại (ưu tiên giá trị đang sửa, nếu chưa sửa thì lấy giá trị gốc)
  const getItemValue = (item: ChuongTrinhKtGs): EditableProgramState => {
    if (editedItems[item.id]) {
      return editedItems[item.id];
    }
    return {
      trang_thai: item.trang_thai,
      ngay_bat_dau: item.ngay_bat_dau || '',
      ngay_ket_thuc: item.ngay_ket_thuc || '',
      so_van_ban: item.so_van_ban || '',
      ngay_ban_hanh: item.ngay_ban_hanh || '',
      nguoi_ky: item.nguoi_ky || '',
    };
  };

  const handleFieldChange = (
    id: string,
    field: keyof EditableProgramState,
    value: string
  ) => {
    const original = list.find((i) => i.id === id);
    if (!original) return;

    setEditedItems((prev) => {
      const current = prev[id] || {
        trang_thai: original.trang_thai,
        ngay_bat_dau: original.ngay_bat_dau || '',
        ngay_ket_thuc: original.ngay_ket_thuc || '',
        so_van_ban: original.so_van_ban || '',
        ngay_ban_hanh: original.ngay_ban_hanh || '',
        nguoi_ky: original.nguoi_ky || '',
      };
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // Số lượng bản ghi đã chỉnh sửa
  const modifiedCount = useMemo(() => {
    let count = 0;
    Object.keys(editedItems).forEach((id) => {
      const original = list.find((i) => i.id === id);
      if (!original) return;
      const edited = editedItems[id];
      const isDifferent =
        edited.trang_thai !== original.trang_thai ||
        (edited.ngay_bat_dau || '') !== (original.ngay_bat_dau || '') ||
        (edited.ngay_ket_thuc || '') !== (original.ngay_ket_thuc || '') ||
        (edited.so_van_ban || '') !== (original.so_van_ban || '') ||
        (edited.ngay_ban_hanh || '') !== (original.ngay_ban_hanh || '') ||
        (edited.nguoi_ky || '') !== (original.nguoi_ky || '');
      if (isDifferent) count++;
    });
    return count;
  }, [editedItems, list]);

  // Thống kê nhanh theo trạng thái hiện tại (bao gồm cả các chỉnh sửa tạm thời)
  const currentStats = useMemo(() => {
    let total = programsInYear.length;
    let daHoanThanh = 0;
    let dangThucHien = 0;
    let chuaThucHien = 0;
    let quaHan = 0;

    programsInYear.forEach((item) => {
      const val = getItemValue(item);
      if (val.trang_thai === 'DA_HOAN_THANH') daHoanThanh++;
      else if (val.trang_thai === 'DANG_THUC_HIEN') dangThucHien++;
      else if (val.trang_thai === 'CHUA_THUC_HIEN') chuaThucHien++;
      else if (val.trang_thai === 'QUA_HAN') quaHan++;
    });

    const tyLeHoanThanh = total > 0 ? Math.round((daHoanThanh / total) * 100) : 0;
    return { total, daHoanThanh, dangThucHien, chuaThucHien, quaHan, tyLeHoanThanh };
  }, [programsInYear, editedItems]);

  // Bộ lọc tìm kiếm trên giao diện modal
  const filteredPrograms = useMemo(() => {
    return programsInYear.filter((item) => {
      const val = getItemValue(item);
      if (filterStatus !== 'ALL' && val.trang_thai !== filterStatus) return false;
      if (filterLoaiHinh !== 'ALL' && (item.loai_hinh || 'KIEM_TRA') !== filterLoaiHinh) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const noiDung = (item.noi_dung || '').toLowerCase();
        const doiTuong = (item.doi_tuong || '').toLowerCase();
        const chuThe = (item.chu_the || '').toLowerCase();
        const soVanBan = (val.so_van_ban || '').toLowerCase();
        if (
          !noiDung.includes(kw) &&
          !doiTuong.includes(kw) &&
          !chuThe.includes(kw) &&
          !soVanBan.includes(kw)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [programsInYear, filterStatus, filterLoaiHinh, searchKeyword, editedItems]);

  // Thao tác nhanh hàng loạt (Batch Actions)
  const handleBatchSetStatus = (targetStatus: TrangThaiKtGs) => {
    const newEdits = { ...editedItems };
    filteredPrograms.forEach((item) => {
      const current = getItemValue(item);
      newEdits[item.id] = {
        ...current,
        trang_thai: targetStatus,
      };
    });
    setEditedItems(newEdits);
  };

  const handleAutoCheckOverdue = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const newEdits = { ...editedItems };
    let changed = 0;

    filteredPrograms.forEach((item) => {
      const current = getItemValue(item);
      if (current.trang_thai === 'DA_HOAN_THANH') return;
      if (!current.ngay_ket_thuc) return;

      try {
        const trimmed = current.ngay_ket_thuc.trim();
        let endD: Date | null = null;
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          const parts = trimmed.split('-');
          endD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(trimmed)) {
          const parts = trimmed.split(/[-/]/);
          endD = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        if (endD && !isNaN(endD.getTime()) && endD < now) {
          newEdits[item.id] = {
            ...current,
            trang_thai: 'QUA_HAN',
          };
          changed++;
        }
      } catch {
        // ignore
      }
    });

    setEditedItems(newEdits);
    if (changed > 0) {
      alert(`Đã tự động phát hiện và chuyển ${changed} nhiệm vụ quá hạn sang trạng thái "Quá hạn".`);
    } else {
      alert('Không phát hiện nhiệm vụ nào quá hạn trong danh sách đang lọc.');
    }
  };

  const handleReset = () => {
    if (modifiedCount > 0 && !confirm('Bạn có chắc chắn muốn hủy bỏ tất cả thay đổi chưa lưu?')) {
      return;
    }
    setEditedItems({});
    setSaveSuccessMsg(null);
  };

  // Lưu tất cả thay đổi
  const handleSaveAll = async () => {
    const idsToUpdate = Object.keys(editedItems).filter((id) => {
      const original = list.find((i) => i.id === id);
      if (!original) return false;
      const edited = editedItems[id];
      return (
        edited.trang_thai !== original.trang_thai ||
        (edited.ngay_bat_dau || '') !== (original.ngay_bat_dau || '') ||
        (edited.ngay_ket_thuc || '') !== (original.ngay_ket_thuc || '') ||
        (edited.so_van_ban || '') !== (original.so_van_ban || '') ||
        (edited.ngay_ban_hanh || '') !== (original.ngay_ban_hanh || '') ||
        (edited.nguoi_ky || '') !== (original.nguoi_ky || '')
      );
    });

    if (idsToUpdate.length === 0) {
      alert('Chưa có thay đổi nào để lưu.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      for (const id of idsToUpdate) {
        const original = list.find((i) => i.id === id);
        if (!original) continue;
        const edited = editedItems[id];

        await api.updateChuongTrinh({
          ...original,
          trang_thai: edited.trang_thai,
          ngay_bat_dau: edited.ngay_bat_dau || null,
          ngay_ket_thuc: edited.ngay_ket_thuc || null,
          so_van_ban: edited.so_van_ban || null,
          ngay_ban_hanh: edited.ngay_ban_hanh || null,
          nguoi_ky: edited.nguoi_ky || null,
        });
      }

      onDataChanged();
      setSaveSuccessMsg(`Đã lưu thành công tiến độ của ${idsToUpdate.length} chương trình KT-GS!`);
      setEditedItems({});

      // Đóng modal sau 1.2s nếu người dùng muốn
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-800">
                  Điều Chỉnh & Cập Nhật Tiến Độ Thực Hiện Theo Năm
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {selectedYear === 'ALL' ? 'Tất cả các năm' : `Năm ${selectedYear}`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cập nhật nhanh trạng thái, thời gian thực hiện và số văn bản kết luận theo kế hoạch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh điều khiển năm & Thống kê tiến độ trực tiếp */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Bộ chọn năm */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Chọn năm điều chỉnh:</span>
              </span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  if (modifiedCount > 0 && !confirm('Chuyển năm sẽ hủy các chỉnh sửa chưa lưu. Tiếp tục?')) {
                    return;
                  }
                  setSelectedYear(e.target.value);
                  setEditedItems({});
                }}
                className="bg-white font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>

              {/* Nút chọn nhanh năm */}
              <div className="hidden md:inline-flex items-center space-x-1 ml-2">
                <button
                  type="button"
                  onClick={() => {
                    if (modifiedCount > 0 && !confirm('Chuyển năm sẽ hủy các chỉnh sửa chưa lưu. Tiếp tục?')) return;
                    setSelectedYear('ALL');
                    setEditedItems({});
                  }}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    selectedYear === 'ALL'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tất cả
                </button>
                {availableYears.slice(0, 5).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      if (modifiedCount > 0 && !confirm('Chuyển năm sẽ hủy các chỉnh sửa chưa lưu. Tiếp tục?')) return;
                      setSelectedYear(String(y));
                      setEditedItems({});
                    }}
                    className={`px-2 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                      selectedYear === String(y)
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Thông báo lưu thành công */}
            {saveSuccessMsg && (
              <div className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* 5 Thẻ tóm tắt tiến độ trực tiếp */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-slate-500">Tổng số nhiệm vụ</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-800">{currentStats.total}</span>
                <span className="text-[10px] text-slate-400">cuộc</span>
              </div>
            </div>

            <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-teal-800 flex items-center justify-between">
                <span>Đã hoàn thành</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-teal-700">{currentStats.daHoanThanh}</span>
                <span className="text-[10px] font-bold text-teal-600">
                  {currentStats.total > 0 ? Math.round((currentStats.daHoanThanh / currentStats.total) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-emerald-800 flex items-center justify-between">
                <span>Đang thực hiện</span>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-emerald-700">{currentStats.dangThucHien}</span>
                <span className="text-[10px] text-emerald-600 font-medium">đang làm</span>
              </div>
            </div>

            <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-amber-800 flex items-center justify-between">
                <span>Chưa thực hiện</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-amber-700">{currentStats.chuaThucHien}</span>
                <span className="text-[10px] text-amber-600 font-medium">chưa làm</span>
              </div>
            </div>

            <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-rose-800 flex items-center justify-between">
                <span>Quá hạn</span>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-rose-700">{currentStats.quaHan}</span>
                <span className="text-[10px] text-rose-600 font-bold">cần xử lý</span>
              </div>
            </div>

            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200 flex flex-col justify-between shadow-2xs">
              <span className="text-[10.5px] font-semibold text-indigo-800 flex items-center justify-between">
                <span>Tỷ lệ tiến độ</span>
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-800">{currentStats.tyLeHoanThanh}%</span>
                <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full"
                    style={{ width: `${currentStats.tyLeHoanThanh}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh công cụ tìm kiếm & Thao tác hàng loạt */}
        <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Ô tìm kiếm */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo nội dung, đối tượng..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Lọc trạng thái */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CHUA_THUC_HIEN">Chưa thực hiện</option>
              <option value="DANG_THUC_HIEN">Đang thực hiện</option>
              <option value="DA_HOAN_THANH">Đã hoàn thành</option>
              <option value="QUA_HAN">Quá hạn</option>
            </select>

            {/* Lọc loại hình */}
            <select
              value={filterLoaiHinh}
              onChange={(e) => setFilterLoaiHinh(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả loại hình</option>
              <option value="KIEM_TRA">Kiểm tra</option>
              <option value="GIAM_SAT">Giám sát</option>
            </select>
          </div>

          {/* Các nút tác vụ nhanh */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Tác vụ nhanh:</span>
            <button
              type="button"
              onClick={() => handleBatchSetStatus('DANG_THUC_HIEN')}
              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center space-x-1"
              title="Đổi tất cả nhiệm vụ đang hiển thị sang Đang thực hiện"
            >
              <Play className="w-3 h-3 text-emerald-600 fill-current" />
              <span>Chuyển Đang làm</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchSetStatus('DA_HOAN_THANH')}
              className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center space-x-1"
              title="Đổi tất cả nhiệm vụ đang hiển thị sang Đã hoàn thành"
            >
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              <span>Đánh dấu Hoàn thành</span>
            </button>
            <button
              type="button"
              onClick={handleAutoCheckOverdue}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center space-x-1"
              title="Tự động kiểm tra các nhiệm vụ có ngày kết thúc đã qua để chuyển sang Quá hạn"
            >
              <Zap className="w-3 h-3 text-rose-600" />
              <span>Phát hiện Quá hạn</span>
            </button>
          </div>
        </div>

        {/* Bảng danh sách chỉnh sửa trực tiếp */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPrograms.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                Không tìm thấy chương trình KT-GS nào trong năm {selectedYear === 'ALL' ? 'đã chọn' : selectedYear}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hãy chọn năm khác hoặc nhập dữ liệu mới để bắt đầu theo dõi tiến độ.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 w-28">Loại hình / Năm</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Nội dung cuộc KT-GS</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Đối tượng</th>
                    <th className="py-2.5 px-3 w-36">Thời gian thực hiện</th>
                    <th className="py-2.5 px-3 w-40 text-center">Trạng thái tiến độ</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Số VB / Báo cáo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPrograms.map((item, idx) => {
                    const current = getItemValue(item);
                    const isRowEdited = Boolean(editedItems[item.id]);

                    return (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-slate-50/80 ${
                          isRowEdited ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : ''
                        }`}
                      >
                        {/* STT */}
                        <td className="py-2 px-3 text-center text-slate-500 font-medium">
                          {idx + 1}
                        </td>

                        {/* Loại hình & Năm */}
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              item.loai_hinh === 'GIAM_SAT'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {item.loai_hinh === 'GIAM_SAT' ? 'Giám sát' : 'Kiểm tra'}
                          </span>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Năm {item.nam}
                          </div>
                        </td>

                        {/* Nội dung */}
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800 line-clamp-2" title={item.noi_dung}>
                            {item.noi_dung}
                          </div>
                          <div className="text-[10.5px] text-slate-500 mt-0.5">
                            Chủ thể: <span className="font-medium text-slate-700">{item.chu_the}</span>
                          </div>
                        </td>

                        {/* Đối tượng */}
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-700 block">
                            {item.doi_tuong || 'Toàn Đảng bộ'}
                          </span>
                          <span className="text-[10.5px] text-slate-500">
                            {item.linh_vuc || 'Công tác xây dựng Đảng'}
                          </span>
                        </td>

                        {/* Thời gian Từ ngày - Đến ngày */}
                        <td className="py-2 px-3 space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-slate-400 w-6">Từ:</span>
                            <input
                              type="text"
                              placeholder="dd/mm/yyyy"
                              value={current.ngay_bat_dau}
                              onChange={(e) => handleFieldChange(item.id, 'ngay_bat_dau', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-slate-400 w-6">Đến:</span>
                            <input
                              type="text"
                              placeholder="dd/mm/yyyy"
                              value={current.ngay_ket_thuc}
                              onChange={(e) => handleFieldChange(item.id, 'ngay_ket_thuc', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </td>

                        {/* Trạng thái Dropdown trực tiếp */}
                        <td className="py-2 px-3 text-center">
                          <select
                            value={current.trang_thai}
                            onChange={(e) =>
                              handleFieldChange(item.id, 'trang_thai', e.target.value as TrangThaiKtGs)
                            }
                            className={`w-full font-bold text-xs rounded-lg px-2 py-1.5 border transition cursor-pointer ${
                              current.trang_thai === 'DA_HOAN_THANH'
                                ? 'bg-teal-50 text-teal-800 border-teal-300 focus:ring-teal-500'
                                : current.trang_thai === 'DANG_THUC_HIEN'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500'
                                : current.trang_thai === 'QUA_HAN'
                                ? 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500'
                                : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500'
                            }`}
                          >
                            <option value="CHUA_THUC_HIEN">Chưa thực hiện</option>
                            <option value="DANG_THUC_HIEN">Đang thực hiện</option>
                            <option value="DA_HOAN_THANH">Đã hoàn thành</option>
                            <option value="QUA_HAN">Quá hạn</option>
                          </select>
                        </td>

                        {/* Số văn bản / Báo cáo */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Số kết luận / VB..."
                            value={current.so_van_ban}
                            onChange={(e) => handleFieldChange(item.id, 'so_van_ban', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center space-x-2">
            <span>
              Đang hiển thị <strong>{filteredPrograms.length}</strong> / {programsInYear.length} nhiệm vụ
            </span>
            {modifiedCount > 0 && (
              <span className="font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                Đã chỉnh sửa: {modifiedCount} mục chưa lưu
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {modifiedCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hủy thay đổi</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || modifiedCount === 0}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-xs ${
                modifiedCount > 0
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : `Lưu tiến độ (${modifiedCount})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
