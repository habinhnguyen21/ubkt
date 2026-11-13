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
} from 'lucide-react';
import type { User, ChuongTrinhKtGs, DonVi } from '../../types';
import { api } from '../../services/api';
import { db as firestoreDb } from '../../services/firebase';
import { doc, getDoc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import {
  filterScanPrograms,
  type ScannedMap,
  type ScanRecordInfo,
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

  // 2. Dữ liệu scan từ Firestore system_config/scan_<nam>
  const [scannedMap, setScannedMap] = useState<ScannedMap>({});

  // 3. Bộ lọc
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
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

  // 6. Thông báo lỗi nhẹ nếu ghi Firestore thất bại
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorTimeoutRef = useRef<any>(null);

  const showErrorToast = (msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorToast(msg);
    errorTimeoutRef.current = setTimeout(() => setErrorToast(null), 4000);
  };

  // Nạp danh sách chương trình và danh mục đơn vị một lần khi mở thẻ
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

  // Lấy danh sách năm có dữ liệu để hiển thị trong select
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

  // Lắng nghe dữ liệu scan từ Firestore cho đúng năm đã chọn
  useEffect(() => {
    let isCancelled = false;
    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);

    // Đọc một lần khi mở thẻ / đổi năm (getDoc)
    getDoc(docRef)
      .then((snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setScannedMap((data?.scanned as ScannedMap) || {});
        } else {
          setScannedMap({});
        }
      })
      .catch((err) => {
        console.warn('Lỗi getDoc scan:', err);
      });

    // Cập nhật khi người khác thay đổi (onSnapshot trên đúng tài liệu đó, hủy đăng ký khi rời thẻ)
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setScannedMap((data?.scanned as ScannedMap) || {});
        } else {
          setScannedMap({});
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

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Tính toán danh sách và hai thanh tiến độ bằng hàm thuần
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

  // Giữ các dòng đang mờ dần khoảng 0.3s trước khi ẩn hẳn khỏi DOM
  const displayedItems = useMemo(() => {
    if (showScanned || fadingIds.size === 0) return items;
    const fadingItems = chuongTrinhList
      .filter((ct) => fadingIds.has(ct.id))
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

  // Xử lý tích / bỏ tích
  const handleToggleScan = async (ctId: string, currentScanned: boolean) => {
    if (!isAdmin) return;

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);
    const prevScannedMap = { ...scannedMap };

    if (!currentScanned) {
      // 1. ĐÁNH DẤU SCAN
      const nowIso = new Date().toISOString();
      const userName = user?.ho_ten || user?.ten_dang_nhap || 'Quản trị viên';
      const scanData: ScanRecordInfo = { ngay: nowIso, nguoi: userName };

      // Cập nhật giao diện ngay (optimistic)
      setScannedMap((prev) => ({
        ...prev,
        [ctId]: scanData,
      }));

      // Kích hoạt hiệu ứng mờ dần 0.3s
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

      // Ghi Firestore (setDoc merge chỉ ghi trường scanned.<id>)
      try {
        await setDoc(
          docRef,
          {
            id: `scan_${selectedYear}`,
            nam: Number(selectedYear),
            [`scanned.${ctId}`]: scanData,
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Lỗi khi ghi scan vào Firestore:', err);
        setScannedMap(prevScannedMap);
        setToast(null);
        showErrorToast('Lỗi lưu trạng thái scan. Đã khôi phục.');
      }
    } else {
      // 2. BỎ ĐÁNH DẤU SCAN (QUAY LẠI CHƯA SCAN)
      const updated = { ...scannedMap };
      delete updated[ctId];
      setScannedMap(updated);

      if (toast?.ctId === ctId) {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast(null);
      }

      try {
        await setDoc(
          docRef,
          {
            [`scanned.${ctId}`]: deleteField(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Lỗi khi bỏ đánh dấu scan:', err);
        setScannedMap(prevScannedMap);
        showErrorToast('Lỗi cập nhật. Đã khôi phục.');
      }
    }
  };

  // Hoàn tác ngay
  const handleUndo = async () => {
    if (!toast) return;
    const { ctId } = toast;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(null);

    const prevScannedMap = { ...scannedMap };
    const updated = { ...scannedMap };
    delete updated[ctId];
    setScannedMap(updated);

    const docRef = doc(firestoreDb, 'system_config', `scan_${selectedYear}`);
    try {
      await setDoc(
        docRef,
        {
          [`scanned.${ctId}`]: deleteField(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Lỗi khi hoàn tác scan:', err);
      setScannedMap(prevScannedMap);
      showErrorToast('Lỗi khi hoàn tác. Đã khôi phục.');
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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            Đang thực hiện
          </span>
        );
      case 'DA_HOAN_THANH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
            Hoàn thành
          </span>
        );
      case 'QUA_HAN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            Quá hạn
          </span>
        );
      case 'CHUA_THUC_HIEN':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
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

  return (
    <div className="space-y-4">
      {/* ── DÒNG CHỮ NHỎ DƯỚI TIÊU ĐỀ ── */}
      <p className="text-xs text-slate-500 italic">
        Bảng đánh dấu hồ sơ đã scan, chỉ để theo dõi, không tải tệp lên hệ thống.
      </p>

      {/* ── 1. ĐẦU THẺ: Ô CHỌN NĂM, CÔNG TẮC, Ô TÌM KIẾM & HAI THANH TIẾN ĐỘ ── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        {/* Hàng điều khiển: Năm, Công tắc, Tìm kiếm */}
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

          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo chi bộ, loại hình, trạng thái..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* HAI THANH TIẾN ĐỘ (LUÔN HIỂN THỊ, XẾP CHỒNG TRÊN ĐIỆN THOẠI) */}
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

          {/* Dòng nhỏ thông báo nếu có cuộc phải gom theo tên */}
          {stats.soCuocChuaGanDonVi > 0 && (
            <p className="text-[11px] text-amber-700 italic">
              {stats.soCuocChuaGanDonVi} cuộc chưa gắn đơn vị (được gom tự động theo tên chi bộ)
            </p>
          )}
        </div>
      </div>

      {/* ── 2. TRẠNG THÁI TẢI HOẶC TRỐNG ── */}
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
          <p className="text-xs">Không tìm thấy cuộc kiểm tra, giám sát nào phù hợp với từ khóa</p>
        </div>
      ) : (
        <>
          {/* ── 3. DANH SÁCH MÁY TÍNH (BẢNG CUỘN NGANG) ── */}
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
                {displayedItems.map((item) => {
                  const isFading = fadingIds.has(item.id);
                  const scanDateText = item.scanInfo?.ngay
                    ? formatDateVn(item.scanInfo.ngay.slice(0, 10))
                    : '';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-opacity duration-300 ${
                        isFading
                          ? 'opacity-0 pointer-events-none'
                          : item.isScanned
                          ? 'opacity-60 bg-slate-50/60'
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
                        {item.isScanned && scanDateText && (
                          <div className="text-[10.5px] text-emerald-700 font-medium mt-0.5">
                            Đã scan ngày: {scanDateText}
                            {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
                          </div>
                        )}
                      </td>

                      {/* Tiến độ scan của chi bộ đó (ví dụ "2/3") */}
                      <td className="py-3 px-3 text-center align-middle">
                        {item.chiBoProgress ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap"
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

                      {/* Tháng / thời gian thực hiện */}
                      <td className="py-3 px-3 text-slate-600 align-middle whitespace-nowrap">
                        {renderThoiGian(item)}
                      </td>

                      {/* Trạng thái thực hiện */}
                      <td className="py-3 px-3 text-center align-middle">{renderTrangThaiBadge(item.trang_thai)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── 4. DANH SÁCH ĐIỆN THOẠI (DÒNG DẠNG THẺ) ── */}
          <div className="sm:hidden space-y-2.5">
            {displayedItems.map((item) => {
              const isFading = fadingIds.has(item.id);
              const scanDateText = item.scanInfo?.ngay
                ? formatDateVn(item.scanInfo.ngay.slice(0, 10))
                : '';

              return (
                <div
                  key={item.id}
                  className={`bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs transition-opacity duration-300 space-y-2 ${
                    isFading
                      ? 'opacity-0 pointer-events-none'
                      : item.isScanned
                      ? 'opacity-60 bg-slate-50/60'
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

                  {item.isScanned && scanDateText && (
                    <div className="text-[10.5px] text-emerald-700 font-medium">
                      Đã scan: {scanDateText}
                      {item.scanInfo?.nguoi ? ` (${item.scanInfo.nguoi})` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 5. THÔNG BÁO HOÀN TÁC (TOAST KÉO DÀI 6 GIÂY) ── */}
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
