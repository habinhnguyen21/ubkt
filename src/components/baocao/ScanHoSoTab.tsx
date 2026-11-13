import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Undo2,
  Search,
  Check,
  Calendar,
  Building2,
  ClipboardList,
  X,
  Clock,
  Filter,
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

  // 2. Dữ liệu scan theo năm
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [scannedMap, setScannedMap] = useState<ScannedMap>(() => {
    try {
      const local = localStorage.getItem(`ubkt_scan_${new Date().getFullYear()}`);
      return local ? JSON.parse(local) : {};
    } catch {
      return {};
    }
  });

  // 3. Chế độ xem: 'CHUA_SCAN' (chưa scan), 'DA_SCAN' (đã scan), 'ALL' (tất cả)
  const [filterMode, setFilterMode] = useState<'CHUA_SCAN' | 'DA_SCAN' | 'ALL'>('CHUA_SCAN');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. Hiệu ứng mờ dần (0.3s) khi tích chọn
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // 5. Toast thông báo hoàn tác (6 giây)
  const [toast, setToast] = useState<{
    ctId: string;
    scanData: ScanRecordInfo;
  } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

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
          (p) =>
            (p.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM' &&
            !(p as any).is_deleted &&
            !(p as any).deleted_at
        );
        if (hnPrograms.length > 0) {
          const years = Array.from(new Set(hnPrograms.map((p) => Number(p.nam)))).sort(
            (a, b) => b - a
          );
          if (years[0]) {
            setSelectedYear(years[0]);
          }
        }
      })
      .catch((err) => {
        console.error('Lỗi tải dữ liệu chương trình/đơn vị:', err);
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
      (p) =>
        (p.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM' &&
        !(p as any).is_deleted &&
        !(p as any).deleted_at
    );
    const yearsSet = new Set(hnPrograms.map((p) => Number(p.nam)));
    if (!yearsSet.has(selectedYear)) {
      yearsSet.add(Number(selectedYear));
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [chuongTrinhList, selectedYear]);

  // Đọc dữ liệu scan: Ưu tiên localStorage, sau đó đồng bộ với Firestore
  useEffect(() => {
    let isCancelled = false;

    // 1. Đọc ngay từ localStorage
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

    // Hàm hợp nhất dữ liệu từ Firestore vào state và localStorage
    const mergeFirestoreData = (snapData: any) => {
      if (!snapData) return;
      const parsed = extractScannedMap(snapData);
      setScannedMap((prev) => {
        const merged = { ...prev, ...parsed };
        try {
          localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(merged));
        } catch {}
        return merged;
      });
    };

    // 2. getDoc lần đầu
    getDoc(docRef)
      .then((snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          mergeFirestoreData(snap.data());
        }
      })
      .catch((err) => {
        console.warn('Lỗi đọc Firestore system_config:', err);
      });

    // 3. onSnapshot lắng nghe thay đổi thời gian thực
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          mergeFirestoreData(snap.data());
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
    };
  }, []);

  // Tính toán danh sách và hai thanh tiến độ
  const { items, stats } = useMemo(() => {
    return filterScanPrograms(
      chuongTrinhList,
      scannedMap,
      selectedYear,
      filterMode,
      searchQuery,
      donViList
    );
  }, [chuongTrinhList, scannedMap, selectedYear, filterMode, searchQuery, donViList]);

  // Giữ lại các dòng đang mờ dần 0.3s trước khi ẩn khỏi danh sách Chưa scan
  const displayedItems = useMemo(() => {
    if (filterMode !== 'CHUA_SCAN' || fadingIds.size === 0) return items;
    // Tìm các cuộc đang trong giai đoạn mờ dần để hiển thị nốt 0.3s
    const fadingItems: ScanProgramItem[] = chuongTrinhList
      .filter((ct) => fadingIds.has(ct.id) && !items.some((i) => i.id === ct.id))
      .map((ct) => ({
        ...ct,
        isScanned: true,
        scanInfo: (scannedMap[ct.id] as ScanRecordInfo) || undefined,
        chiBoKey: '',
        chiBoTen: ct.chu_the || ct.co_quan_ban_hanh || '',
        chiBoProgress: '',
      }));
    return [...items, ...fadingItems];
  }, [items, filterMode, fadingIds, chuongTrinhList, scannedMap]);

  // Xử lý tích / bỏ tích
  const handleToggleScan = async (ctId: string, currentScanned: boolean) => {
    if (!isAdmin) return;

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);

    if (!currentScanned) {
      // 1. ĐÁNH DẤU ĐÃ SCAN
      const nowIso = new Date().toISOString();
      const userName = user?.ho_ten || user?.ten_dang_nhap || 'Quản trị viên';
      const scanData: ScanRecordInfo = { ngay: nowIso, nguoi: userName };

      // Cập nhật state + localStorage ngay lập tức
      setScannedMap((prev) => {
        const next = { ...prev, [ctId]: scanData };
        try {
          localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Kích hoạt hiệu ứng mờ dần 0.3s nếu đang ở tab Chưa scan
      if (filterMode === 'CHUA_SCAN') {
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

      // Ghi vào Firestore
      try {
        try {
          await updateDoc(docRef, {
            [`scanned.${ctId}`]: scanData,
          });
        } catch {
          // Nếu document chưa tồn tại, setDoc với đối tượng lồng nhau { scanned: { [ctId]: scanData } }
          await setDoc(
            docRef,
            {
              id: `scan_${selectedYear}`,
              nam: Number(selectedYear),
              scanned: {
                [ctId]: scanData,
              },
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('Lỗi ghi Firestore scan (đã lưu an toàn ở bộ nhớ máy):', err);
      }
    } else {
      // 2. BỎ ĐÁNH DẤU SCAN (QUAY LẠI CHƯA SCAN)
      setScannedMap((prev) => {
        const next = { ...prev };
        delete next[ctId];
        try {
          localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      if (toast?.ctId === ctId) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast(null);
      }

      // Ghi vào Firestore
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
        console.warn('Lỗi bỏ đánh dấu scan trên Firestore:', err);
      }
    }
  };

  // Hoàn tác ngay khi bấm nút Hoàn tác trên toast
  const handleUndo = async () => {
    if (!toast) return;
    const { ctId } = toast;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(null);

    // Bỏ khỏi fading nếu có
    setFadingIds((prev) => {
      const next = new Set(prev);
      next.delete(ctId);
      return next;
    });

    // Cập nhật state + localStorage
    setScannedMap((prev) => {
      const next = { ...prev };
      delete next[ctId];
      try {
        localStorage.setItem(`ubkt_scan_${selectedYear}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Cập nhật Firestore
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
      console.warn('Lỗi hoàn tác scan trên Firestore:', err);
    }
  };

  const renderLoaiHinhBadge = (type?: string | null) => {
    if (type === 'KIEM_TRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Kiểm tra
        </span>
      );
    }
    if (type === 'GIAM_SAT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
          Giám sát
        </span>
      );
    }
    return <span className="text-slate-400 text-xs">—</span>;
  };

  const renderThoiGian = (item: ScanProgramItem) => {
    const rawThoiGian = (item as any).thoi_gian_thuc_hien || (item as any).thoi_gian;
    if (rawThoiGian) {
      return rawThoiGian;
    }
    if (item.ngay_bat_dau && item.ngay_ket_thuc) {
      return `${formatDateVn(item.ngay_bat_dau)} – ${formatDateVn(item.ngay_ket_thuc)}`;
    }
    if (item.ngay_bat_dau) {
      return `Từ ${formatDateVn(item.ngay_bat_dau)}`;
    }
    const rawThang = (item as any).thang || (item as any).thang_du_kien;
    if (rawThang) {
      return `Tháng ${rawThang}/${item.nam}`;
    }
    return `Năm ${item.nam}`;
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

  // Render một hàng bảng (desktop)
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
            ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
            : 'hover:bg-slate-50/80'
        }`}
      >
        {/* Ô tích scan */}
        <td className="py-3 px-3 text-center align-middle">
          <input
            type="checkbox"
            checked={Boolean(item.isScanned)}
            disabled={!isAdmin}
            onChange={() => handleToggleScan(item.id, Boolean(item.isScanned))}
            title={
              isAdmin
                ? item.isScanned
                  ? 'Bấm để bỏ đánh dấu scan (chuyển về Chưa scan)'
                  : 'Bấm để đánh dấu đã scan (chuyển sang Đã scan)'
                : 'Chỉ Quản trị viên (ADMIN) mới có quyền đánh dấu scan'
            }
            className={`w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition ${
              isAdmin ? 'cursor-pointer hover:border-emerald-500' : 'cursor-not-allowed opacity-60'
            }`}
          />
        </td>

        {/* Tên chi bộ / chủ thể & đối tượng */}
        <td className="py-3 px-4">
          <div className="font-semibold text-slate-900 leading-snug">
            {item.chu_the || item.co_quan_ban_hanh}
          </div>
          {item.doi_tuong && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              Đối tượng: <span className="font-medium text-slate-700">{item.doi_tuong}</span>
            </div>
          )}
          {item.isScanned && (
            <div className="text-[10.5px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
              <span>
                Đã scan{scanDateText ? ` ngày ${scanDateText}` : ''}
                {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
              </span>
            </div>
          )}
        </td>

        {/* Tiến độ chi bộ (ví dụ: "2/3") */}
        <td className="py-3 px-3 text-center align-middle">
          {item.chiBoProgress ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                item.chiBoProgress.split('/')[0] === item.chiBoProgress.split('/')[1] &&
                item.chiBoProgress !== '0/0'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Số cuộc đã scan trên tổng số cuộc của chi bộ này trong năm"
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

        {/* Trạng thái thực hiện */}
        <td className="py-3 px-3 text-center align-middle">{renderTrangThaiBadge(item.trang_thai)}</td>
      </tr>
    );
  };

  // Render một thẻ điện thoại (mobile)
  const renderCardItem = (item: ScanProgramItem) => {
    const isFading = fadingIds.has(item.id);
    const scanDateText = item.scanInfo?.ngay
      ? formatDateVn(item.scanInfo.ngay.slice(0, 10))
      : '';

    return (
      <div
        key={item.id}
        className={`bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs transition-all duration-300 space-y-2.5 ${
          isFading
            ? 'opacity-0 scale-95 pointer-events-none'
            : item.isScanned
            ? 'bg-emerald-50/25 border-emerald-200'
            : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <input
              type="checkbox"
              checked={Boolean(item.isScanned)}
              disabled={!isAdmin}
              onChange={() => handleToggleScan(item.id, Boolean(item.isScanned))}
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
          <div className="flex flex-col items-end gap-1 shrink-0">
            {renderLoaiHinhBadge(item.loai_hinh)}
            {item.chiBoProgress && (
              <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {item.chiBoProgress}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 gap-2">
          <div>{renderThoiGian(item)}</div>
          <div>{renderTrangThaiBadge(item.trang_thai)}</div>
        </div>

        {item.isScanned && (
          <div className="text-[10.5px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Đã scan{scanDateText ? ` ngày ${scanDateText}` : ''}
              {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  const chuaScanCount = Math.max(0, stats.tongCuoc - stats.daScanCuoc);
  const daScanCount = stats.daScanCuoc;

  return (
    <div className="space-y-4">
      {/* ── DÒNG CHỮ NHỎ DƯỚI TIÊU ĐỀ ── */}
      <p className="text-xs text-slate-500 italic">
        Bảng đánh dấu hồ sơ đã scan, chỉ để theo dõi, không tải tệp lên hệ thống.
      </p>

      {/* ── 1. ĐẦU THẺ: Ô CHỌN NĂM & Ô TÌM KIẾM ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Ô chọn năm */}
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

          {/* Ô TÌM KIẾM (không phân biệt dấu tiếng Việt) */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm theo chi bộ, đối tượng, nội dung..."
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

        {/* HAI THANH TIẾN ĐỘ TỔNG HỢP (LUÔN HIỂN THỊ, ĐỘC LẬP TÌM KIẾM/BỘ LỌC) */}
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

      {/* ── 2. THANH CHUYỂN ĐỔI CHẾ ĐỘ XEM: CHƯA SCAN / ĐÃ SCAN / TẤT CẢ ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="inline-flex rounded-lg bg-slate-200/80 p-1 border border-slate-300/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setFilterMode('CHUA_SCAN')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'CHUA_SCAN'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Chưa scan</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10.5px] ${
                filterMode === 'CHUA_SCAN'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-300/60 text-slate-700'
              }`}
            >
              {chuaScanCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('DA_SCAN')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'DA_SCAN'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã scan</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10.5px] ${
                filterMode === 'DA_SCAN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-300/60 text-slate-700'
              }`}
            >
              {daScanCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('ALL')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Tất cả</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10.5px] ${
                filterMode === 'ALL'
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-slate-300/60 text-slate-700'
              }`}
            >
              {stats.tongCuoc}
            </span>
          </button>
        </div>

        {searchQuery && (
          <div className="text-xs text-slate-500 font-medium">
            Tìm thấy <strong className="text-slate-800">{displayedItems.length}</strong> kết quả cho "
            <span className="text-blue-600">{searchQuery}</span>"
          </div>
        )}
      </div>

      {/* ── 3. DANH SÁCH CUỘC KT-GS THEO CHẾ ĐỘ ── */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Đang tải danh sách chương trình...</p>
        </div>
      ) : stats.tongCuoc === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs text-slate-500">
          <p className="text-xs">Không có cuộc kiểm tra, giám sát hằng năm trong năm {selectedYear}</p>
        </div>
      ) : filterMode === 'CHUA_SCAN' && chuaScanCount === 0 ? (
        /* Khi xem tab Chưa scan nhưng đã scan xong tất cả */
        <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-900">Đã scan xong năm {selectedYear}</h3>
          <p className="text-xs text-emerald-700">
            Tất cả {stats.tongCuoc} cuộc kiểm tra, giám sát trong năm {selectedYear} đã được đánh dấu scan hồ sơ.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setFilterMode('DA_SCAN')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
            >
              <span>Xem danh sách cuộc đã scan</span>
            </button>
          </div>
        </div>
      ) : filterMode === 'DA_SCAN' && daScanCount === 0 ? (
        /* Khi xem tab Đã scan nhưng chưa có cuộc nào được tích */
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs text-slate-500 space-y-2">
          <Clock className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-xs font-medium">Chưa có cuộc kiểm tra, giám sát nào được đánh dấu đã scan trong năm {selectedYear}.</p>
          <button
            type="button"
            onClick={() => setFilterMode('CHUA_SCAN')}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Quay lại danh sách Chưa scan
          </button>
        </div>
      ) : displayedItems.length === 0 ? (
        /* Khi tìm kiếm không có kết quả */
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs text-slate-500">
          <p className="text-xs">Không tìm thấy cuộc kiểm tra, giám sát nào phù hợp với từ khóa "{searchQuery}"</p>
        </div>
      ) : (
        /* BẢNG DỮ LIỆU HIỂN THỊ */
        <>
          {/* Bảng trên máy tính */}
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

          {/* Dạng thẻ trên điện thoại */}
          <div className="sm:hidden space-y-2.5">
            {displayedItems.map(renderCardItem)}
          </div>
        </>
      )}

      {/* ── 4. TOAST THÔNG BÁO HOÀN TÁC (6 GIÂY) ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">Đã đánh dấu đã scan</span>
          <button
            type="button"
            onClick={handleUndo}
            className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 font-bold pl-2 border-l border-slate-700 cursor-pointer transition hover:underline"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác</span>
          </button>
        </div>
      )}
    </div>
  );
};
