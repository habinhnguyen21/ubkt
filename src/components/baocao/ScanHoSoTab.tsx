import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Undo2,
  Search,
  Check,
  Calendar,
  AlertCircle,
  Building2,
  ClipboardList,
  X,
  Clock,
} from 'lucide-react';
import type { User, ChuongTrinhKtGs, DonVi } from '../../types';
import { api } from '../../services/api';
import { db as firestoreDb } from '../../services/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import {
  filterScanPrograms,
  extractScannedMap,
  type ScannedMap,
  type ScanRecordInfo,
  type ScanProgramItem,
} from '../../utils/scanView';
import { formatDateVn } from '../../services/chuongTrinhExcelService';

interface ScanHoSoTabProps {
  user: User;
}

export const ScanHoSoTab: React.FC<ScanHoSoTabProps> = ({ user }) => {
  const isAdmin = user?.vai_tro === 'ADMIN';

  // 1. Dữ liệu chương trình KT-GS & danh mục đơn vị
  const [chuongTrinhList, setChuongTrinhList] = useState<ChuongTrinhKtGs[]>([]);
  const [donViList, setDonViList] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 2. Dữ liệu scan
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [scannedMap, setScannedMap] = useState<ScannedMap>(() => {
    try {
      const local = localStorage.getItem(`ubkt_scan_${new Date().getFullYear()}`);
      return local ? JSON.parse(local) : {};
    } catch {
      return {};
    }
  });

  // 3. Bộ lọc & tìm kiếm
  const [showScanned, setShowScanned] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. Hiệu ứng mờ dần (0.3s) khi tích chọn
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // 5. Toast thông báo hoàn tác (6 giây)
  const [toast, setToast] = useState<{
    ctId: string;
    scanData: ScanRecordInfo;
  } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // 6. Thông báo lỗi nếu có
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorTimeoutRef = useRef<any>(null);

  const showErrorToast = (msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorToast(msg);
    errorTimeoutRef.current = setTimeout(() => setErrorToast(null), 4000);
  };

  // Nạp danh sách chương trình và danh mục đơn vị khi mở thẻ
  useEffect(() => {
    let isCancelled = false;
    Promise.all([
      api.getAllChuongTrinh().catch(() => []),
      api.getAllDonVi().catch(() => []),
    ])
      .then(([ctData, dvData]) => {
        if (isCancelled) return;
        const validList = Array.isArray(ctData) ? ctData : [];
        const units = Array.isArray(dvData) ? dvData : [];
        setChuongTrinhList(validList);
        setDonViList(units);

        // Mặc định chọn năm mới nhất có dữ liệu HANG_NAM
        const hnPrograms = validList.filter(
          (p) => (p.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM' && !(p as any).is_deleted && !(p as any).deleted_at
        );
        if (hnPrograms.length > 0) {
          const years = Array.from(new Set(hnPrograms.map((p) => Number(p.nam)))).sort((a, b) => b - a);
          if (years[0]) {
            setSelectedYear(years[0]);
          }
        }
      })
      .catch((err) => {
        console.error('Lỗi tải dữ liệu:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Danh sách năm có dữ liệu để chọn
  const availableYears = useMemo(() => {
    const hnPrograms = chuongTrinhList.filter(
      (p) => (p.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM' && !(p as any).is_deleted && !(p as any).deleted_at
    );
    const yearsSet = new Set(hnPrograms.map((p) => Number(p.nam)));
    if (!yearsSet.has(selectedYear)) {
      yearsSet.add(Number(selectedYear));
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [chuongTrinhList, selectedYear]);

  // Đọc dữ liệu scan (Ưu tiên localStorage, sau đó đồng bộ Firestore realtime)
  useEffect(() => {
    let isCancelled = false;

    // 1. Nạp ngay từ localStorage nếu có để UI không bị giật
    try {
      const local = localStorage.getItem(`ubkt_scan_${selectedYear}`);
      if (local) {
        setScannedMap(JSON.parse(local));
      } else {
        setScannedMap({});
      }
    } catch {
      setScannedMap({});
    }

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);

    // 2. getDoc lần đầu
    getDoc(docRef)
      .then((snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const parsed = extractScannedMap(snap.data());
          setScannedMap((prev) => {
            const merged = { ...prev, ...parsed };
            try {
              localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('Lỗi getDoc scan:', err);
      });

    // 3. onSnapshot lắng nghe thay đổi thời gian thực
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const parsed = extractScannedMap(snap.data());
          setScannedMap((prev) => {
            const merged = { ...prev, ...parsed };
            try {
              localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      },
      (err) => {
        console.warn('Lỗi onSnapshot scan:', err);
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [selectedYear]);

  // Dọn dẹp timer
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Tính toán danh sách và hai thanh tiến độ
  const { items, stats } = useMemo(() => {
    return filterScanPrograms(
      chuongTrinhList,
      scannedMap,
      selectedYear,
      showScanned,
      searchQuery,
      donViList
    );
  }, [chuongTrinhList, scannedMap, selectedYear, showScanned, searchQuery, donViList]);

  // Giữ lại các dòng đang mờ dần 0.3s trước khi ẩn hẳn
  const displayedItems = useMemo(() => {
    if (showScanned || fadingIds.size === 0) return items;
    // Thêm các item đang fade vào cuối danh sách hiển thị tạm thời
    const fadingItems: ScanProgramItem[] = chuongTrinhList
      .filter((ct) => fadingIds.has(ct.id) && !items.some((i) => i.id === ct.id))
      .map((ct) => ({
        ...ct,
        isScanned: true,
        scanInfo: (scannedMap[ct.id] as ScanRecordInfo) || undefined,
        chiBoKey: '',
        chiBoTen: ct.chu_the || '',
        chiBoProgress: '',
      }));
    return [...items, ...fadingItems];
  }, [items, showScanned, fadingIds, chuongTrinhList, scannedMap]);

  // Phân chia danh sách khi bật "Hiện cả đã scan"
  const { itemsChuaScan, itemsDaScan } = useMemo(() => {
    const chuaScan: ScanProgramItem[] = [];
    const daScan: ScanProgramItem[] = [];
    for (const item of displayedItems) {
      if (item.isScanned) {
        daScan.push(item);
      } else {
        chuaScan.push(item);
      }
    }
    return { itemsChuaScan: chuaScan, itemsDaScan: daScan };
  }, [displayedItems]);

  // Xử lý tích / bỏ tích
  const handleToggleScan = async (ctId: string, currentScanned: boolean) => {
    if (!isAdmin) return;

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);

    if (!currentScanned) {
      // 1. ĐÁNH DẤU SCAN
      const nowIso = new Date().toISOString();
      const userName = user?.ho_ten || user?.ten_dang_nhap || 'Quản trị viên';
      const scanData: ScanRecordInfo = { ngay: nowIso, nguoi: userName };

      const updated = {
        ...scannedMap,
        [ctId]: scanData,
      };

      // Cập nhật state + localStorage ngay lập tức
      setScannedMap(updated);
      try {
        localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(updated));
      } catch {}

      // Kích hoạt hiệu ứng mờ dần 0.3s nếu ở chế độ ẩn đã scan
      if (!showScanned) {
        setFadingIds((prev) => new Set(prev).add(ctId));
        setTimeout(() => {
          setFadingIds((prev) => {
            const next = new Set(prev);
            next.delete(ctId);
            return next;
          });
        }, 300);
      }

      // Thông báo hoàn tác trong 6 giây
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ ctId, scanData });
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 6000);

      // Ghi Firestore (dùng updateDoc và fallback setDoc merge)
      try {
        try {
          await updateDoc(docRef, {
            [`scanned.${ctId}`]: scanData,
          });
        } catch {
          await setDoc(
            docRef,
            {
              id: `scan_${selectedYear}`,
              nam: Number(selectedYear),
              scanned: {
                [ctId]: scanData,
              },
              [`scanned.${ctId}`]: scanData,
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error('Lỗi khi ghi scan vào Firestore:', err);
        showErrorToast('Đã lưu cục bộ. Đang đồng bộ nền lên đám mây.');
      }
    } else {
      // 2. BỎ ĐÁNH DẤU SCAN (QUAY LẠI CHƯA SCAN)
      const updated = { ...scannedMap };
      delete updated[ctId];

      setScannedMap(updated);
      try {
        localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(updated));
      } catch {}

      if (toast?.ctId === ctId) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast(null);
      }

      try {
        try {
          await updateDoc(docRef, {
            [`scanned.${ctId}`]: deleteField(),
          });
        } catch {
          await setDoc(
            docRef,
            {
              [`scanned.${ctId}`]: deleteField(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error('Lỗi khi bỏ đánh dấu scan:', err);
      }
    }
  };

  // Hoàn tác ngay
  const handleUndo = async () => {
    if (!toast) return;
    const { ctId } = toast;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(null);

    const updated = { ...scannedMap };
    delete updated[ctId];
    setScannedMap(updated);
    try {
      localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(updated));
    } catch {}

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);
    try {
      try {
        await updateDoc(docRef, {
          [`scanned.${ctId}`]: deleteField(),
        });
      } catch {
        await setDoc(
          docRef,
          {
            [`scanned.${ctId}`]: deleteField(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Lỗi khi hoàn tác scan:', err);
    }
  };

  const renderThoiGian = (item: ChuongTrinhKtGs) => {
    if (item.ngay_bat_dau && item.ngay_ket_thuc) {
      return `${formatDateVn(item.ngay_bat_dau)} – ${formatDateVn(item.ngay_ket_thuc)}`;
    }
    if (item.ngay_bat_dau) {
      return `Từ ${formatDateVn(item.ngay_bat_dau)}`;
    }
    if (item.ngay_ket_thuc) {
      return `Đến ${formatDateVn(item.ngay_ket_thuc)}`;
    }
    return `Năm ${item.nam}`;
  };

  const renderLoaiHinhBadge = (loaiHinh?: string | null) => {
    if (loaiHinh === 'KIEM_TRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Kiểm tra
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
        Giám sát
      </span>
    );
  };

  const renderTrangThaiBadge = (status?: string | null) => {
    switch (status) {
      case 'DANG_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            Đang thực hiện
          </span>
        );
      case 'DA_HOAN_THANH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
            Hoàn thành
          </span>
        );
      case 'QUA_HAN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            Quá hạn
          </span>
        );
      case 'CHUA_THUC_HIEN':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            Chưa thực hiện
          </span>
        );
    }
  };

  const formatPercentStr = (rate: number, denom: number) => {
    if (denom === 0) return '—';
    return `${String(rate).replace('.', ',')}%`;
  };

  const isCompletedAll =
    stats.tongCuoc > 0 &&
    stats.daScanCuoc === stats.tongCuoc &&
    stats.tongChiBo > 0 &&
    stats.chiBoDaScanDu === stats.tongChiBo;

  // Render một hàng bảng
  const renderTableRow = (item: ScanProgramItem) => {
    const isFading = fadingIds.has(item.id);
    const scanDateText = item.scanInfo?.ngay
      ? formatDateVn(item.scanInfo.ngay.slice(0, 10))
      : '';

    return (
      <tr
        key={item.id}
        className={`transition-all duration-300 ${
          isFading
            ? 'opacity-0 scale-95 pointer-events-none'
            : item.isScanned
            ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
            : 'hover:bg-slate-50/80'
        }`}
      >
        {/* Ô tích */}
        <td className="py-3 px-3 text-center align-middle">
          <input
            type="checkbox"
            checked={item.isScanned}
            disabled={!isAdmin}
            onChange={() => handleToggleScan(item.id, item.isScanned)}
            title={
              isAdmin
                ? item.isScanned
                  ? 'Bỏ đánh dấu scan'
                  : 'Đánh dấu đã scan'
                : 'Chỉ Quản trị viên (ADMIN) mới có quyền đánh dấu scan'
            }
            className={`w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 ${
              isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          />
        </td>

        {/* Tên chi bộ / chủ thể */}
        <td className="py-3 px-4">
          <div className="font-semibold text-slate-900">{item.chu_the || item.co_quan_ban_hanh}</div>
          {item.doi_tuong && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              Đối tượng: <span className="font-medium text-slate-700">{item.doi_tuong}</span>
            </div>
          )}
          {item.isScanned && (
            <div className="text-[10.5px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600 inline" />
              <span>
                Đã scan{scanDateText ? ` ngày ${scanDateText}` : ''}
                {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
              </span>
            </div>
          )}
        </td>

        {/* Tiến độ chi bộ */}
        <td className="py-3 px-3 text-center align-middle">
          {item.chiBoProgress ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                item.chiBoProgress.split('/')[0] === item.chiBoProgress.split('/')[1] && item.chiBoProgress !== '0/0'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Số cuộc đã scan trên tổng số cuộc của chi bộ này"
            >
              {item.chiBoProgress}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        {/* Loại hình */}
        <td className="py-3 px-3 text-center align-middle">{renderLoaiHinhBadge(item.loai_hinh)}</td>

        {/* Thời gian */}
        <td className="py-3 px-3 text-slate-600 align-middle whitespace-nowrap">
          {renderThoiGian(item)}
        </td>

        {/* Trạng thái */}
        <td className="py-3 px-3 text-center align-middle">{renderTrangThaiBadge(item.trang_thai)}</td>
      </tr>
    );
  };

  // Render một thẻ điện thoại
  const renderCardItem = (item: ScanProgramItem) => {
    const isFading = fadingIds.has(item.id);
    const scanDateText = item.scanInfo?.ngay
      ? formatDateVn(item.scanInfo.ngay.slice(0, 10))
      : '';

    return (
      <div
        key={item.id}
        className={`bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs transition-all duration-300 space-y-2 ${
          isFading
            ? 'opacity-0 scale-95 pointer-events-none'
            : item.isScanned
            ? 'bg-emerald-50/20 border-emerald-200'
            : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <input
              type="checkbox"
              checked={item.isScanned}
              disabled={!isAdmin}
              onChange={() => handleToggleScan(item.id, item.isScanned)}
              title={
                isAdmin
                  ? item.isScanned
                    ? 'Bỏ đánh dấu scan'
                    : 'Đánh dấu đã scan'
                  : 'Chỉ Quản trị viên (ADMIN) mới có quyền đánh dấu scan'
              }
              className={`w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 ${
                isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
            />
            <div>
              <div className="text-xs font-bold text-slate-900 leading-snug">
                {item.chu_the || item.co_quan_ban_hanh}
              </div>
              {item.doi_tuong && (
                <div className="text-[11px] text-slate-600 mt-0.5">Đối tượng: {item.doi_tuong}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {renderLoaiHinhBadge(item.loai_hinh)}
            {item.chiBoProgress && (
              <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {item.chiBoProgress}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 gap-2">
          <div>{renderThoiGian(item)}</div>
          <div>{renderTrangThaiBadge(item.trang_thai)}</div>
        </div>

        {item.isScanned && (
          <div className="text-[10.5px] text-emerald-700 font-medium flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>
              Đã scan{scanDateText ? ` ngày ${scanDateText}` : ''}
              {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── DÒNG CHỮ NHỎ DƯỚI TIÊU ĐỀ ── */}
      <p className="text-xs text-slate-500 italic">
        Bảng đánh dấu hồ sơ đã scan, chỉ để theo dõi, không tải tệp lên hệ thống.
      </p>

      {/* ── 1. ĐẦU THẺ: Ô CHỌN NĂM, CÔNG TẮC & TÌM KIẾM ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <label htmlFor="scan-year-select" className="text-xs font-semibold text-slate-700">
                Năm:
              </label>
              <select
                id="scan-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showScanned}
                onChange={(e) => setShowScanned(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span>Hiện cả đã scan</span>
            </label>
          </div>

          {/* Ô TÌM KIẾM CHUYÊN DỤNG */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo chi bộ, nội dung, loại hình..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* HAI THANH TIẾN ĐỘ TỔNG HỢP (LUÔN HIỂN THỊ) */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {isCompletedAll && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Hoàn tất scan năm {selectedYear}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Thanh a: Chi bộ đã scan đủ */}
            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chi bộ đã scan đủ:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {stats.tongChiBo > 0 ? `${stats.chiBoDaScanDu} / ${stats.tongChiBo}` : '—'}{' '}
                  <span className={isCompletedAll ? 'text-emerald-700' : 'text-blue-700'}>
                    ({formatPercentStr(stats.tyLeChiBo, stats.tongChiBo)})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isCompletedAll ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{
                    width: `${stats.tongChiBo > 0 ? Math.min(100, (stats.chiBoDaScanDu / stats.tongChiBo) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Thanh b: Cuộc đã scan */}
            <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cuộc đã scan:</span>
                </span>
                <span className="font-bold text-slate-800">
                  {stats.tongCuoc > 0 ? `${stats.daScanCuoc} / ${stats.tongCuoc}` : '—'}{' '}
                  <span className={isCompletedAll ? 'text-emerald-700' : 'text-indigo-700'}>
                    ({formatPercentStr(stats.tyLeCuoc, stats.tongCuoc)})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isCompletedAll ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{
                    width: `${stats.tongCuoc > 0 ? Math.min(100, (stats.daScanCuoc / stats.tongCuoc) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Dòng nhỏ nếu có cuộc phải gom theo tên */}
          {stats.soCuocChuaGanDonVi > 0 && (
            <p className="text-[11px] text-amber-700 italic">
              {stats.soCuocChuaGanDonVi} cuộc chưa gắn đơn vị (được gom tự động theo tên chi bộ)
            </p>
          )}
        </div>
      </div>

      {/* ── 2. DANH SÁCH CUỘC KT-GS ── */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Đang tải danh sách chương trình...</p>
        </div>
      ) : stats.tongCuoc === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs text-slate-500">
          <p className="text-xs">Không có cuộc kiểm tra, giám sát hằng năm trong năm {selectedYear}</p>
        </div>
      ) : !showScanned && stats.daScanCuoc === stats.tongCuoc ? (
        <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
          <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-900">Đã scan xong năm {selectedYear}</h3>
          <p className="text-xs text-emerald-700">
            Tất cả {stats.tongCuoc} cuộc kiểm tra, giám sát trong năm {selectedYear} đã được tích scan hồ sơ.
          </p>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs text-slate-500">
          <p className="text-xs">Không tìm thấy cuộc kiểm tra, giám sát nào phù hợp với từ khóa "{searchQuery}"</p>
        </div>
      ) : !showScanned ? (
        /* CHẾ ĐỘ MẶC ĐỊNH: CHỈ HIỆN CUỘC CHƯA SCAN */
        <>
          {/* Máy tính */}
          <div className="hidden sm:block overflow-x-auto w-full border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">Scan</th>
                  <th className="py-3 px-4">Tên chi bộ / Chủ thể</th>
                  <th className="py-3 px-3 w-28 text-center">Tiến độ chi bộ</th>
                  <th className="py-3 px-3 w-28 text-center">Loại hình</th>
                  <th className="py-3 px-3 w-40">Thời gian</th>
                  <th className="py-3 px-3 w-32 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.map(renderTableRow)}
              </tbody>
            </table>
          </div>

          {/* Điện thoại */}
          <div className="sm:hidden space-y-2.5">
            {displayedItems.map(renderCardItem)}
          </div>
        </>
      ) : (
        /* KHI BẬT "HIỆN CẢ ĐÃ SCAN": CHIA RÕ 2 PHẦN (CHƯA SCAN VÀ ĐÃ SCAN) */
        <div className="space-y-6">
          {/* PHẦN 1: CÁC CUỘC CHƯA SCAN */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Danh sách cuộc chưa scan</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-bold">
                  {itemsChuaScan.length}
                </span>
              </h4>
            </div>

            {itemsChuaScan.length === 0 ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold text-center">
                Tất cả các cuộc trong năm đã được scan đầy đủ!
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto w-full border border-slate-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3 w-12 text-center">Scan</th>
                        <th className="py-3 px-4">Tên chi bộ / Chủ thể</th>
                        <th className="py-3 px-3 w-28 text-center">Tiến độ chi bộ</th>
                        <th className="py-3 px-3 w-28 text-center">Loại hình</th>
                        <th className="py-3 px-3 w-40">Thời gian</th>
                        <th className="py-3 px-3 w-32 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsChuaScan.map(renderTableRow)}
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden space-y-2.5">
                  {itemsChuaScan.map(renderCardItem)}
                </div>
              </>
            )}
          </div>

          {/* PHẦN 2: CÁC CUỘC ĐÃ SCAN XONG */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Danh sách cuộc đã scan xong</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-bold">
                  {itemsDaScan.length}
                </span>
              </h4>
            </div>

            {itemsDaScan.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-500 rounded-xl border border-slate-200 text-xs text-center">
                Chưa có cuộc nào được đánh dấu scan.
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto w-full border border-emerald-200 rounded-xl bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-emerald-50/80 border-b border-emerald-200 text-emerald-900 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3 w-12 text-center">Scan</th>
                        <th className="py-3 px-4">Tên chi bộ / Chủ thể</th>
                        <th className="py-3 px-3 w-28 text-center">Tiến độ chi bộ</th>
                        <th className="py-3 px-3 w-28 text-center">Loại hình</th>
                        <th className="py-3 px-3 w-40">Thời gian</th>
                        <th className="py-3 px-3 w-32 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {itemsDaScan.map(renderTableRow)}
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden space-y-2.5">
                  {itemsDaScan.map(renderCardItem)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 5. THÔNG BÁO HOÀN TÁC (TOAST 6 GIÂY) ── */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Đã đánh dấu đã scan</span>
          <span className="text-slate-500">·</span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center space-x-1 font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>
        </div>
      )}

      {/* ── 6. THÔNG BÁO LỖI (NẾU CÓ) ── */}
      {errorToast && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center space-x-2 px-4 py-3 bg-rose-900 text-white text-xs rounded-xl shadow-xl border border-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-300" />
          <span>{errorToast}</span>
        </div>
      )}
    </div>
  );
};
