import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import type {
  ChuongTrinhKtGs,
  CreateChuongTrinhInput,
  DonVi,
  TrangThaiKtGs,
  User,
  ThayDoiBoSungKtGs,
  LoaiHinhKtGs,
  LoaiChuongTrinh,
} from '../types';
import {
  isGoogleDriveConfigured,
  getGoogleDriveConfig,
  uploadBase64OrUrlToGoogleDrive,
  extractGoogleDriveFileId,
  deleteFileFromGoogleDrive,
} from '../services/googleDriveService';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  Eye,
  Download,
  Printer,
  Copy,
  Check,
  Bell,
  Play,
  Building2,
  CheckCircle2,
  X,
  MapPin,
  GitCompare,
  ArrowRight,
  Home,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  Layers,
  Clock,
  BookOpen,
  BarChart3,
  PieChart,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  ShieldAlert,
  ListChecks,
  Settings,
  Cloud,
  ExternalLink,
  Info,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { ChuongTrinhImportExcelModal } from './chuongtrinh/ChuongTrinhImportExcelModal';
import { exportChuongTrinhToExcel } from '../services/chuongTrinhExcelService';

// Chuyển đổi an toàn Base64 Data URL sang Blob URL để xem trực tiếp trong iframe và mở tab mới
const getBlobUrlFromDataUrl = (dataUrl?: string | null): string | null => {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }
  if (dataUrl.startsWith('data:')) {
    try {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const byteCharacters = atob(parts[1]);
      const byteArrays = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArrays], { type: mime });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('Lỗi chuyển data URL sang Blob:', err);
      return dataUrl;
    }
  }
  return dataUrl;
};

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DANH_MUC_LINH_VUC = [
  'Công tác xây dựng Đảng',
  'Công tác cán bộ',
  'Tài chính – ngân sách',
  'Thực hiện nhiệm vụ chính trị',
  'Dân chủ ở cơ sở',
  'Lĩnh vực khác',
] as const;

export const DEFAULT_CUSTOM_CO_QUAN = [
  'Ban Thường vụ Đảng ủy phường',
  'Ban Chấp hành Đảng bộ phường',
  'Ủy ban Kiểm tra Đảng ủy phường',
  'Chi bộ, cơ quan khác',
] as const;

interface ChuongTrinhManagerProps {
  user: User;
  onDataChanged?: () => void;
}

export const ChuongTrinhManager: React.FC<ChuongTrinhManagerProps> = ({ user, onDataChanged }) => {
  const [list, setList] = useState<ChuongTrinhKtGs[]>([]);
  const [allDonVi, setAllDonVi] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(false);

  // Chuyển đổi giữa 2 phân hệ: 'NHIEM_KY' (Toàn khóa / Nhiệm kỳ) và 'HANG_NAM' (Phần năm công tác)
  const [activeTab, setActiveTab] = useState<LoaiChuongTrinh>(() => {
    const saved = localStorage.getItem('ubkt_chuong_trinh_subtab');
    return (saved === 'HANG_NAM' || saved === 'NHIEM_KY') ? saved : 'HANG_NAM';
  });

  const handleSubTabChange = (tab: LoaiChuongTrinh) => {
    setActiveTab(tab);
    localStorage.setItem('ubkt_chuong_trinh_subtab', tab);
  };

  const [searchQuery, setSearchQuery] = useState('');

  // 4 Cơ quan ban hành có thể tùy chỉnh theo yêu cầu người dùng
  const [customCoQuanList, setCustomCoQuanList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ubkt_custom_co_quan_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {
      // ignore
    }
    return [...DEFAULT_CUSTOM_CO_QUAN];
  });
  const [isEditingCoQuanModalOpen, setIsEditingCoQuanModalOpen] = useState(false);
  const [tempCoQuanList, setTempCoQuanList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ubkt_custom_co_quan_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {
      // ignore
    }
    return [...DEFAULT_CUSTOM_CO_QUAN];
  });

  // Bộ lọc cho Phần Nhiệm kỳ (Khớp giao diện mẫu)
  const [filterNhiemKy, setFilterNhiemKy] = useState<string>('ALL');
  const [filterThoiGian, setFilterThoiGian] = useState<string>('ALL');
  const [filterLoaiChuongTrinh, setFilterLoaiChuongTrinh] = useState<string>('ALL');

  // Bộ lọc cho Phần Hàng năm (6 phần A, B, C, D, E, F)
  const [filterNam, setFilterNam] = useState<string>('ALL');
  const [filterHnChuThe, setFilterHnChuThe] = useState<string>('ALL');
  const [filterHnLoaiHinh, setFilterHnLoaiHinh] = useState<string>('ALL');
  const [filterHnTrangThai, setFilterHnTrangThai] = useState<string>('ALL');
  const [filterHnLinhVuc, setFilterHnLinhVuc] = useState<string>('ALL');
  const [filterHnDonVi, setFilterHnDonVi] = useState<string>('ALL');
  const [hnProgressFilter, setHnProgressFilter] = useState<
    'ALL' | 'CHUA_TRIEN_KHAI' | 'SAP_DEN_HAN' | 'DANG_THUC_HIEN_DUNG_HAN' | 'QUA_HAN' | 'THIEU_VAN_BAN'
  >('ALL');
  const [timeViewMode, setTimeViewMode] = useState<'QUY' | 'THANG'>('QUY');
  const [currentPageHn, setCurrentPageHn] = useState<number>(1);
  const pageSizeHn = 8;

  // Modal Thêm mới / Chỉnh sửa Chương trình Hàng năm (Phần năm)
  const [isHnModalOpen, setIsHnModalOpen] = useState(false);
  const [editingHnItem, setEditingHnItem] = useState<ChuongTrinhKtGs | null>(null);
  const [hnNam, setHnNam] = useState<number>(new Date().getFullYear());
  const [hnLoaiHinh, setHnLoaiHinh] = useState<LoaiHinhKtGs>('KIEM_TRA');
  const [hnLinhVuc, setHnLinhVuc] = useState<string>('Công tác xây dựng Đảng');
  const [hnChuThe, setHnChuThe] = useState<string>('');
  const [hnDonViId, setHnDonViId] = useState<string | null>(null);
  const [hnDoiTuong, setHnDoiTuong] = useState<string>('');
  const [hnNoiDung, setHnNoiDung] = useState<string>('');
  const [hnNoiDungVanBan, setHnNoiDungVanBan] = useState<string>('');
  const [hnSoVanBan, setHnSoVanBan] = useState<string>('');
  const [hnNgayBanHanh, setHnNgayBanHanh] = useState<string>('');
  const [hnNguoiKy, setHnNguoiKy] = useState<string>('');
  const [hnNgayBatDau, setHnNgayBatDau] = useState<string>('');
  const [hnNgayKetThuc, setHnNgayKetThuc] = useState<string>('');
  const [hnTrangThai, setHnTrangThai] = useState<TrangThaiKtGs>('CHUA_THUC_HIEN');
  const [hnPdfFileName, setHnPdfFileName] = useState<string | null>(null);
  const [hnPdfFileUrl, setHnPdfFileUrl] = useState<string | null>(null);
  const [hnPdfFileSize, setHnPdfFileSize] = useState<number | null>(null);
  const [hnRemovePdf, setHnRemovePdf] = useState(false);
  const [hnGhiChuPdf, setHnGhiChuPdf] = useState<string>('');
  const [hnExtractingPdf, setHnExtractingPdf] = useState(false);
  const [hnIsSaving, setHnIsSaving] = useState(false);
  const [hnFormError, setHnFormError] = useState<string | null>(null);

  // Modal Nhập / Xuất Excel Chương trình KT-GS năm
  const [isHnImportExcelOpen, setIsHnImportExcelOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Phân trang cho Nhiệm kỳ
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  // Chương trình đang chọn để hiển thị chi tiết (Card 2)
  const [selectedProgram, setSelectedProgram] = useState<ChuongTrinhKtGs | null>(null);
  const [detailTab, setDetailTab] = useState<'tong_quan' | 'tai_lieu' | 'lich_su'>('tong_quan');

  // Form Thêm mới / Chỉnh sửa trực tiếp (Card 1)
  const formRef = useRef<HTMLDivElement>(null);
  const [formEditingId, setFormEditingId] = useState<string | null>(null);
  const [formTenChuongTrinh, setFormTenChuongTrinh] = useState<string>(
    'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030'
  );
  const [formHasNhiemKy, setFormHasNhiemKy] = useState<boolean>(true);
  const [formTermStartYear, setFormTermStartYear] = useState<number>(2025);
  const [formTermEndYear, setFormTermEndYear] = useState<number>(2030);
  const [formSoVanBan, setFormSoVanBan] = useState<string>('01-CTr/ĐU');
  const [formCoQuanBanHanh, setFormCoQuanBanHanh] = useState<string>('BCH Đảng bộ phường Ái Quốc');
  const [formChuTheApDung, setFormChuTheApDung] = useState<string>('Toàn Đảng bộ');
  const [formNoiDung, setFormNoiDung] = useState<string>(
    'Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...: Kiểm tra việc lãnh đạo, chỉ đạo và tổ chức thực hiện nhiệm vụ chính trị, công tác xây dựng Đảng, giữ gìn đoàn kết nội bộ.'
  );
  const [formTuNgay, setFormTuNgay] = useState<string>('2025-08-15');
  const [formDenNgay, setFormDenNgay] = useState<string>('2030-05-30');
  const [formTrangThai, setFormTrangThai] = useState<TrangThaiKtGs>('CHUA_THUC_HIEN');
  const [isFormSaving, setIsFormSaving] = useState<boolean>(false);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [formNoiDungVanBan, setFormNoiDungVanBan] = useState<string>('');
  const [formPdfFileName, setFormPdfFileName] = useState<string | null>(null);
  const [formPdfFileUrl, setFormPdfFileUrl] = useState<string | null>(null);
  const [formPdfFileSize, setFormPdfFileSize] = useState<number | null>(null);
  const [formRemovePdf, setFormRemovePdf] = useState<boolean>(false);
  const [formGhiChuPdf, setFormGhiChuPdf] = useState<string>('');
  const [formExtractingPdf, setFormExtractingPdf] = useState<boolean>(false);

  // Trạng thái mở cửa sổ Chỉnh sửa / Thêm mới & Chi tiết chương trình Nhiệm kỳ (chỉ hiện khi ấn sửa / thêm mới)
  const [isNhiemKyEditorOpen, setIsNhiemKyEditorOpen] = useState<boolean>(false);
  const [nhiemKyModalTab, setNhiemKyModalTab] = useState<'FORM' | 'DETAIL'>('FORM');

  // Định dạng ngày hiển thị mặc định: dd-mm-yyyy
  const formatDateVn = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const trimmed = dateStr.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed.replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-');
      return `${d}-${m}-${y}`;
    }
    try {
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return trimmed;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return trimmed;
    }
  };

  // Logic kiểm tra và nhắc nhở thời gian thực hiện trong tháng
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const isScheduledThisMonth = (item: ChuongTrinhKtGs): boolean => {
    const checkDate = (dStr?: string | null) => {
      if (!dStr) return false;
      const trimmed = dStr.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parts = trimmed.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return y === currentYear && m === currentMonth;
      }
      if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(trimmed)) {
        const parts = trimmed.split(/[-/]/);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        return y === currentYear && m === currentMonth;
      }
      return false;
    };

    if (checkDate(item.ngay_bat_dau) || checkDate(item.ngay_ket_thuc)) return true;
    if (item.nam === currentYear) {
      const text = `${item.noi_dung} ${item.ten_chuong_trinh || ''}`.toLowerCase();
      if (text.includes(`tháng ${currentMonth}`) || text.includes(`tháng ${currentMonth < 10 ? '0' + currentMonth : currentMonth}`)) {
        return true;
      }
    }
    return false;
  };

  // Danh sách các chương trình chưa thực hiện thuộc năm đang lọc
  const pendingPrograms = useMemo(() => {
    return list.filter((item) => {
      const isHangNam = (item.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM';
      if (!isHangNam) return false;
      if (filterNam !== 'ALL' && item.nam !== Number(filterNam)) return false;
      return item.trang_thai === 'CHUA_THUC_HIEN';
    });
  }, [list, filterNam]);

  const dueThisMonthPrograms = useMemo(() => {
    return list.filter((item) => {
      const isHangNam = (item.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM';
      if (!isHangNam) return false;
      if (item.trang_thai !== 'CHUA_THUC_HIEN') return false;
      if (filterNam !== 'ALL' && item.nam !== Number(filterNam)) return false;
      return isScheduledThisMonth(item);
    });
  }, [list, filterNam, currentMonth, currentYear]);

  const handleQuickSetDangThucHien = async (item: ChuongTrinhKtGs) => {
    try {
      await api.updateChuongTrinh({
        ...item,
        trang_thai: 'DANG_THUC_HIEN',
      });
      await loadData();
      onDataChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleActivateAllThisMonth = async () => {
    const targetList = dueThisMonthPrograms.length > 0 ? dueThisMonthPrograms : pendingPrograms;
    if (targetList.length === 0) {
      alert('Hiện không có chương trình nào ở trạng thái "Chưa thực hiện" để chuyển đổi.');
      return;
    }
    const confirmMsg = dueThisMonthPrograms.length > 0
      ? `Xác nhận chuyển ${dueThisMonthPrograms.length} chương trình đến hạn trong tháng sang trạng thái "Đang thực hiện"?`
      : `Xác nhận chuyển tất cả ${pendingPrograms.length} chương trình chưa thực hiện sang trạng thái "Đang thực hiện"?`;
    if (!confirm(confirmMsg)) return;

    try {
      for (const item of targetList) {
        await api.updateChuongTrinh({
          ...item,
          trang_thai: 'DANG_THUC_HIEN',
        });
      }
      await loadData();
      onDataChanged?.();
      setHnProgressFilter('DANG_THUC_HIEN_DUNG_HAN');
      setFilterHnTrangThai('DANG_THUC_HIEN');
      alert(`Đã chuyển thành công ${targetList.length} cuộc kiểm tra, giám sát sang trạng thái "Đang thực hiện".`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Logic phát hiện và thông báo các chương trình quá hạn để bấm Hoàn thành
  const isProgramOverdue = (item: ChuongTrinhKtGs): boolean => {
    if (item.trang_thai === 'DA_HOAN_THANH') return false;
    if (item.trang_thai === 'QUA_HAN') return true;
    if (item.ngay_ket_thuc) {
      try {
        const trimmed = item.ngay_ket_thuc.trim();
        let endD: Date | null = null;
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          const parts = trimmed.split('-');
          endD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(trimmed)) {
          const parts = trimmed.split(/[-/]/);
          endD = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        if (endD && !isNaN(endD.getTime())) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          return endD < now;
        }
      } catch {
        return false;
      }
    }
    return false;
  };

  const overduePrograms = useMemo(() => {
    return list.filter((item) => {
      const isHangNam = (item.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM';
      if (!isHangNam) return false;
      if (filterNam !== 'ALL' && item.nam !== Number(filterNam)) return false;
      return isProgramOverdue(item);
    });
  }, [list, filterNam]);

  const handleQuickSetHoanThanh = async (item: ChuongTrinhKtGs) => {
    try {
      await api.updateChuongTrinh({
        ...item,
        trang_thai: 'DA_HOAN_THANH',
      });
      await loadData();
      onDataChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCompleteAllOverdue = async () => {
    if (overduePrograms.length === 0) return;
    if (!confirm(`Xác nhận chuyển toàn bộ ${overduePrograms.length} cuộc kiểm tra, giám sát quá hạn sang trạng thái Đã hoàn thành?`)) {
      return;
    }
    try {
      for (const item of overduePrograms) {
        await api.updateChuongTrinh({
          ...item,
          trang_thai: 'DA_HOAN_THANH',
        });
      }
      await loadData();
      onDataChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };



  // Modal Xem nội dung văn bản đính kèm theo
  const [viewingDocItem, setViewingDocItem] = useState<ChuongTrinhKtGs | null>(null);

  // Modal Bảng đối chiếu & Nạp thay đổi, bổ sung chương trình nhiệm kỳ
  const [managingThayDoiItem, setManagingThayDoiItem] = useState<ChuongTrinhKtGs | null>(null);
  const [isAddingThayDoi, setIsAddingThayDoi] = useState(false);
  const [tdSoVanBan, setTdSoVanBan] = useState('');
  const [tdNgayBanHanh, setTdNgayBanHanh] = useState('');
  const [tdNguoiKy, setTdNguoiKy] = useState('');
  const [tdDonViId, setTdDonViId] = useState<string | null>(null);
  const [tdTenDonVi, setTdTenDonVi] = useState('');
  const [tdNoiDungDieuChinh, setTdNoiDungDieuChinh] = useState('');
  const [tdNoiDungGoc, setTdNoiDungGoc] = useState('');
  const [tdPdfFileName, setTdPdfFileName] = useState<string | null>(null);
  const [tdPdfFileUrl, setTdPdfFileUrl] = useState<string | null>(null);
  const [tdPdfFileSize, setTdPdfFileSize] = useState<number | null>(null);
  const [tdGhiChu, setTdGhiChu] = useState('');
  const [isSavingThayDoi, setIsSavingThayDoi] = useState(false);

  // Modal xác nhận xóa
  const [deleteTarget, setDeleteTarget] = useState<ChuongTrinhKtGs | null>(null);

  const canEdit = user.vai_tro === 'ADMIN' || user.vai_tro === 'BIEN_TAP';

  const loadData = async () => {
    setLoading(true);
    try {
      const [programs, units] = await Promise.all([
        api.getAllChuongTrinh(),
        api.getAllDonVi(),
      ]);
      setList(programs);
      setAllDonVi(units);
      if (programs.length > 0) {
        setSelectedProgram((prev) => {
          if (!prev) return programs[0];
          const found = programs.find((p) => p.id === prev.id);
          return found || programs[0];
        });
      }
    } catch (err) {
      console.error('Lỗi tải danh sách chương trình:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('ubkt_chuong_trinh_updated', handleUpdate);
    window.addEventListener('ubkt_kho_du_lieu_updated', handleUpdate);
    return () => {
      window.removeEventListener('ubkt_chuong_trinh_updated', handleUpdate);
      window.removeEventListener('ubkt_kho_du_lieu_updated', handleUpdate);
    };
  }, []);

  // Danh sách các tổ chức Chi bộ & Đảng bộ trực thuộc
  const chiDangBoList = useMemo(() => {
    return allDonVi.filter((d) => d.loai === 'CHI_BO' || d.loai === 'DANG_BO');
  }, [allDonVi]);

  // Danh sách nhiệm kỳ có trong hệ thống (Chuẩn hóa 5 năm 1 nhiệm kỳ: bắt đầu 2025 – 2030, 2020 – 2025, 2015 – 2020, 2030 – 2035)
  const availableNhiemKyList = useMemo(() => {
    const standardTerms = ['2025 – 2030', '2020 – 2025', '2015 – 2020', '2030 – 2035'];
    const nks = new Set<string>(standardTerms);
    list.forEach((item) => {
      if (item.nhiem_ky && !item.nhiem_ky.includes('2027')) {
        const parts = item.nhiem_ky.split(/[-–]/).map((p) => parseInt(p.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          if (parts[1] - parts[0] === 5) {
            nks.add(`${parts[0]} – ${parts[1]}`);
          }
        }
      }
    });
    return Array.from(nks).sort((a, b) => {
      if (a === '2025 – 2030') return -1;
      if (b === '2025 – 2030') return 1;
      const yA = parseInt(a.slice(0, 4), 10) || 0;
      const yB = parseInt(b.slice(0, 4), 10) || 0;
      return yB - yA;
    });
  }, [list]);

  // Đếm số lượng theo 2 mục lớn
  const countNhiemKy = useMemo(
    () =>
      list.filter(
        (i) =>
          (i.loai_chuong_trinh || 'HANG_NAM') === 'NHIEM_KY' ||
          Boolean(i.nhiem_ky) ||
          Boolean(i.has_nhiem_ky)
      ).length,
    [list]
  );
  const countHangNam = useMemo(
    () => list.filter((i) => (i.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM').length,
    [list]
  );

  // Danh sách các năm có trong hệ thống (cho mục Hàng năm)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    list
      .filter((i) => (i.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM')
      .forEach((i) => {
        if (i.nam) years.add(i.nam);
      });
    years.add(2026);
    years.add(2025);
    years.add(2024);
    return Array.from(years).sort((a, b) => b - a);
  }, [list]);

  // Helper phân loại chi tiết tiến độ thực hiện (Phần E)
  const isChuaTrienKhai = (item: ChuongTrinhKtGs): boolean => {
    return item.trang_thai === 'CHUA_THUC_HIEN' && !isScheduledThisMonth(item);
  };

  const isSapDenHan = (item: ChuongTrinhKtGs): boolean => {
    return item.trang_thai === 'CHUA_THUC_HIEN' && isScheduledThisMonth(item);
  };

  const isDangThucHienDungHan = (item: ChuongTrinhKtGs): boolean => {
    return item.trang_thai === 'DANG_THUC_HIEN';
  };

  const isChamTienDoQuaHan = (item: ChuongTrinhKtGs): boolean => {
    return isProgramOverdue(item) && item.trang_thai !== 'DA_HOAN_THANH';
  };

  const isThieuVanBan = (item: ChuongTrinhKtGs): boolean => {
    return item.trang_thai === 'DA_HOAN_THANH' && !item.file_pdf_ten;
  };

  // Helper xác định tháng công tác của một chương trình (1-12)
  const getProgramMonth = (item: ChuongTrinhKtGs): number => {
    const dStr = item.ngay_bat_dau || item.ngay_ket_thuc || item.ngay_ban_hanh;
    if (dStr) {
      const trimmed = dStr.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const m = parseInt(trimmed.split('-')[1], 10);
        if (m >= 1 && m <= 12) return m;
      }
      if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(trimmed)) {
        const m = parseInt(trimmed.split(/[-/]/)[1], 10);
        if (m >= 1 && m <= 12) return m;
      }
    }
    const text = `${item.noi_dung} ${item.ten_chuong_trinh || ''}`.toLowerCase();
    const match = text.match(/tháng\s*([0-1]?[0-9])/i);
    if (match && match[1]) {
      const m = parseInt(match[1], 10);
      if (m >= 1 && m <= 12) return m;
    }
    return 1;
  };

  // Thống kê toàn diện cho Chương trình Hàng năm (Phần A & B & E)
  const statsHangNam = useMemo(() => {
    const hnItems = list.filter((i) => (i.loai_chuong_trinh || 'HANG_NAM') === 'HANG_NAM');
    const filteredByYear =
      filterNam === 'ALL' ? hnItems : hnItems.filter((i) => i.nam === Number(filterNam));

    const total = filteredByYear.length;
    const kiemTra = filteredByYear.filter((i) => i.loai_hinh === 'KIEM_TRA').length;
    const giamSat = filteredByYear.filter((i) => i.loai_hinh === 'GIAM_SAT').length;
    const daHoanThanh = filteredByYear.filter((i) => i.trang_thai === 'DA_HOAN_THANH').length;
    const dangThucHien = filteredByYear.filter((i) => i.trang_thai === 'DANG_THUC_HIEN').length;
    const chuaThucHien = filteredByYear.filter((i) => i.trang_thai === 'CHUA_THUC_HIEN').length;
    const quaHan = filteredByYear.filter((i) => isChamTienDoQuaHan(i)).length;
    const tyLeHoanThanh = total > 0 ? Math.round((daHoanThanh / total) * 100) : 0;

    // Thống kê theo 4 Cơ quan ban hành có thể tùy chỉnh
    const theoCoQuan: Record<string, number> = {};
    customCoQuanList.forEach((cq) => {
      theoCoQuan[cq] = 0;
    });

    filteredByYear.forEach((item) => {
      const cq = (item.chu_the || item.co_quan_ban_hanh || '').trim();
      const foundIdx = customCoQuanList.findIndex((customName, idx) => {
        if (idx === 3) return false;
        const cLower = customName.toLowerCase().trim();
        const itemLower = cq.toLowerCase().trim();
        if (itemLower === cLower) return true;
        if (cLower.includes('thường vụ') && itemLower.includes('thường vụ')) return true;
        if ((cLower.includes('chấp hành') || cLower.includes('đảng bộ phường')) && (itemLower.includes('chấp hành') || itemLower.includes('đảng bộ phường'))) return true;
        if ((cLower.includes('kiểm tra') || cLower.includes('ubkt')) && (itemLower.includes('kiểm tra') || itemLower.includes('ubkt'))) return true;
        return itemLower.includes(cLower) || cLower.includes(itemLower);
      });

      if (foundIdx >= 0) {
        theoCoQuan[customCoQuanList[foundIdx]]++;
      } else {
        const fourthCq = customCoQuanList[3] || 'Chi bộ, cơ quan khác';
        theoCoQuan[fourthCq] = (theoCoQuan[fourthCq] || 0) + 1;
      }
    });

    // Thống kê theo Lĩnh vực (6 lĩnh vực)
    const theoLinhVuc: Record<string, number> = {};
    DANH_MUC_LINH_VUC.forEach((lv) => {
      theoLinhVuc[lv] = 0;
    });
    filteredByYear.forEach((item) => {
      const lv = item.linh_vuc || 'Công tác xây dựng Đảng';
      if (theoLinhVuc[lv] !== undefined) {
        theoLinhVuc[lv]++;
      } else {
        theoLinhVuc['Lĩnh vực khác'] = (theoLinhVuc['Lĩnh vực khác'] || 0) + 1;
      }
    });

    // Thống kê theo Đơn vị được kiểm tra, giám sát (Top đơn vị)
    const theoDonViMap: Record<string, number> = {};
    filteredByYear.forEach((item) => {
      const dv = item.doi_tuong?.trim() || 'Chưa xác định';
      theoDonViMap[dv] = (theoDonViMap[dv] || 0) + 1;
    });
    const theoDonVi = Object.entries(theoDonViMap)
      .map(([ten, count]) => ({ ten, count }))
      .sort((a, b) => b.count - a.count);

    // Thống kê theo Quý (I, II, III, IV)
    const tienDoQuy = [
      { quy: 'Quý I (Tháng 1-3)', keHoach: 0, thucTe: 0 },
      { quy: 'Quý II (Tháng 4-6)', keHoach: 0, thucTe: 0 },
      { quy: 'Quý III (Tháng 7-9)', keHoach: 0, thucTe: 0 },
      { quy: 'Quý IV (Tháng 10-12)', keHoach: 0, thucTe: 0 },
    ];
    filteredByYear.forEach((item) => {
      const m = getProgramMonth(item);
      const qIndex = Math.min(3, Math.floor((m - 1) / 3));
      tienDoQuy[qIndex].keHoach++;
      if (item.trang_thai === 'DA_HOAN_THANH') {
        tienDoQuy[qIndex].thucTe++;
      }
    });

    // Thống kê theo 12 Tháng
    const tienDoThang = Array.from({ length: 12 }).map((_, idx) => ({
      thang: `Tháng ${idx + 1}`,
      keHoach: 0,
      thucTe: 0,
    }));
    filteredByYear.forEach((item) => {
      const m = getProgramMonth(item);
      const mIndex = Math.max(0, Math.min(11, m - 1));
      tienDoThang[mIndex].keHoach++;
      if (item.trang_thai === 'DA_HOAN_THANH') {
        tienDoThang[mIndex].thucTe++;
      }
    });

    // Thống kê chi tiết 5 nhóm cảnh báo tiến độ (Phần E)
    const tienDoChiTiet = {
      chuaTrienKhai: filteredByYear.filter(isChuaTrienKhai).length,
      sapDenHan: filteredByYear.filter(isSapDenHan).length,
      dangThucHienDungHan: filteredByYear.filter(isDangThucHienDungHan).length,
      chamTienDoQuaHan: filteredByYear.filter(isChamTienDoQuaHan).length,
      thieuVanBan: filteredByYear.filter(isThieuVanBan).length,
    };

    return {
      total,
      kiemTra,
      giamSat,
      daHoanThanh,
      dangThucHien,
      chuaThucHien,
      quaHan,
      tyLeHoanThanh,
      theoCoQuan,
      theoLinhVuc,
      theoDonVi,
      tienDoQuy,
      tienDoThang,
      tienDoChiTiet,
    };
  }, [list, filterNam, currentMonth, currentYear, customCoQuanList]);

  // Danh sách Hàng năm đã lọc theo Năm, Loại hình, Chủ thể, Lĩnh vực, Đơn vị, Trạng thái, Cảnh báo tiến độ E, Tìm kiếm D
  const filteredHangNamList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => {
      if ((item.loai_chuong_trinh || 'HANG_NAM') !== 'HANG_NAM') return false;
      if (filterNam !== 'ALL' && item.nam !== Number(filterNam)) return false;
      if (filterHnChuThe !== 'ALL' && item.chu_the !== filterHnChuThe) return false;
      if (filterHnLoaiHinh !== 'ALL' && item.loai_hinh !== filterHnLoaiHinh) return false;
      if (filterHnTrangThai !== 'ALL' && item.trang_thai !== filterHnTrangThai) return false;
      if (filterHnLinhVuc !== 'ALL') {
        const itemLv = item.linh_vuc || 'Công tác xây dựng Đảng';
        if (itemLv !== filterHnLinhVuc) return false;
      }
      if (filterHnDonVi !== 'ALL' && item.doi_tuong !== filterHnDonVi) return false;

      // Bộ lọc cảnh báo tiến độ thông minh Phần E
      if (hnProgressFilter !== 'ALL') {
        if (hnProgressFilter === 'CHUA_TRIEN_KHAI' && !isChuaTrienKhai(item)) return false;
        if (hnProgressFilter === 'SAP_DEN_HAN' && !isSapDenHan(item)) return false;
        if (hnProgressFilter === 'DANG_THUC_HIEN_DUNG_HAN' && !isDangThucHienDungHan(item)) return false;
        if (hnProgressFilter === 'QUA_HAN' && !isChamTienDoQuaHan(item)) return false;
        if (hnProgressFilter === 'THIEU_VAN_BAN' && !isThieuVanBan(item)) return false;
      }

      // Tìm kiếm theo tên chương trình, số văn bản hoặc nội dung
      if (q) {
        const matchTitle = Boolean(item.ten_chuong_trinh && item.ten_chuong_trinh.toLowerCase().includes(q));
        const matchDoiTuong = Boolean(item.doi_tuong && item.doi_tuong.toLowerCase().includes(q));
        const matchNoiDung = Boolean(item.noi_dung && item.noi_dung.toLowerCase().includes(q));
        const matchNoiDungVB = Boolean(item.noi_dung_van_ban && item.noi_dung_van_ban.toLowerCase().includes(q));
        const matchSoVB = Boolean(item.so_van_ban && item.so_van_ban.toLowerCase().includes(q));
        const matchChuThe = Boolean(item.chu_the && item.chu_the.toLowerCase().includes(q));
        const matchLinhVuc = Boolean(item.linh_vuc && item.linh_vuc.toLowerCase().includes(q));
        if (
          !matchTitle &&
          !matchDoiTuong &&
          !matchNoiDung &&
          !matchNoiDungVB &&
          !matchSoVB &&
          !matchChuThe &&
          !matchLinhVuc
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    list,
    filterNam,
    filterHnChuThe,
    filterHnLoaiHinh,
    filterHnTrangThai,
    filterHnLinhVuc,
    filterHnDonVi,
    hnProgressFilter,
    searchQuery,
    currentMonth,
    currentYear,
  ]);

  const renderLoaiHinhBadge = (loaiHinh?: LoaiHinhKtGs | null) => {
    if (!loaiHinh) return <span className="text-slate-400 italic text-[11px]">—</span>;
    if (loaiHinh === 'KIEM_TRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
          Kiểm tra
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap">
        Giám sát
      </span>
    );
  };

  const renderTrangThaiBadge = (status: TrangThaiKtGs) => {
    switch (status) {
      case 'DANG_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            Đang thực hiện
          </span>
        );
      case 'CHUA_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            Chưa thực hiện
          </span>
        );
      case 'DA_HOAN_THANH':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
            Hoàn thành
          </span>
        );
      case 'QUA_HAN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            Quá hạn
          </span>
        );
    }
  };

  // Handlers cho Phần Hàng năm (Phần F)
  const handleOpenAddHn = () => {
    const defaultUnit = allDonVi.find((d) => d.loai === 'BTV' || d.loai === 'UBKT') || allDonVi[0];
    setEditingHnItem(null);
    setHnNam(filterNam !== 'ALL' ? Number(filterNam) : new Date().getFullYear());
    setHnLoaiHinh('KIEM_TRA');
    setHnLinhVuc(DANH_MUC_LINH_VUC[0]);
    setHnChuThe(defaultUnit ? defaultUnit.ten : 'Ban Chấp hành Đảng bộ phường');
    setHnDonViId(defaultUnit ? defaultUnit.id : null);
    setHnDoiTuong('');
    setHnNoiDung('');
    setHnNoiDungVanBan('');
    setHnSoVanBan('');
    setHnNgayBanHanh('');
    setHnNguoiKy('');
    setHnNgayBatDau('');
    setHnNgayKetThuc('');
    setHnTrangThai('CHUA_THUC_HIEN');
    setHnPdfFileName(null);
    setHnPdfFileUrl(null);
    setHnPdfFileSize(null);
    setHnRemovePdf(false);
    setHnGhiChuPdf('');
    setHnFormError(null);
    setIsHnModalOpen(true);
  };

  const handleOpenEditHn = (item: ChuongTrinhKtGs) => {
    setEditingHnItem(item);
    setHnNam(item.nam || new Date().getFullYear());
    setHnLoaiHinh(item.loai_hinh || 'KIEM_TRA');
    setHnLinhVuc(item.linh_vuc || DANH_MUC_LINH_VUC[0]);
    setHnChuThe(item.chu_the);
    setHnDonViId(item.don_vi_id || null);
    setHnDoiTuong(item.doi_tuong || '');
    setHnNoiDung(item.noi_dung || '');
    setHnNoiDungVanBan(item.noi_dung_van_ban || '');
    setHnSoVanBan(item.so_van_ban || '');
    setHnNgayBanHanh(item.ngay_ban_hanh || '');
    setHnNguoiKy(item.nguoi_ky || '');
    setHnNgayBatDau(item.ngay_bat_dau || '');
    setHnNgayKetThuc(item.ngay_ket_thuc || '');
    setHnTrangThai(item.trang_thai || 'DANG_THUC_HIEN');
    setHnPdfFileName(item.file_pdf_ten || null);
    setHnPdfFileUrl(item.file_pdf_url || null);
    setHnPdfFileSize(item.file_pdf_dung_luong || null);
    setHnRemovePdf(false);
    setHnGhiChuPdf(item.ghi_chu_pdf || '');
    setHnFormError(null);
    setIsHnModalOpen(true);
  };

  const handleDuplicateHn = (item: ChuongTrinhKtGs) => {
    setEditingHnItem(null); // Tạo mới dựa trên bản mẫu
    setHnNam(item.nam || new Date().getFullYear());
    setHnLoaiHinh(item.loai_hinh || 'KIEM_TRA');
    setHnLinhVuc(item.linh_vuc || DANH_MUC_LINH_VUC[0]);
    setHnChuThe(item.chu_the);
    setHnDonViId(item.don_vi_id || null);
    setHnDoiTuong(`${item.doi_tuong || ''} (Sao chép)`);
    setHnNoiDung(item.noi_dung || '');
    setHnNoiDungVanBan(item.noi_dung_van_ban || '');
    setHnSoVanBan(item.so_van_ban ? `${item.so_van_ban}-BS` : '');
    setHnNgayBanHanh(new Date().toISOString().slice(0, 10));
    setHnNguoiKy(item.nguoi_ky || '');
    setHnNgayBatDau(item.ngay_bat_dau || '');
    setHnNgayKetThuc(item.ngay_ket_thuc || '');
    setHnTrangThai('CHUA_THUC_HIEN');
    setHnPdfFileName(item.file_pdf_ten || null);
    setHnPdfFileUrl(item.file_pdf_url || null);
    setHnPdfFileSize(item.file_pdf_dung_luong || null);
    setHnRemovePdf(false);
    setHnGhiChuPdf(item.ghi_chu_pdf || '');
    setHnFormError(null);
    setIsHnModalOpen(true);
  };

  const handleHnFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHnPdfFileName(file.name);
      setHnPdfFileSize(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        setHnPdfFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setHnRemovePdf(false);
    }
  };

  const handleHnExtractPdfText = () => {
    if (!hnPdfFileName) {
      alert('Vui lòng chọn hoặc đính kèm tệp PDF trước khi trích xuất.');
      return;
    }
    setHnExtractingPdf(true);
    setTimeout(() => {
      setHnExtractingPdf(false);
      if (!hnNoiDung.trim()) {
        setHnNoiDung(
          `Kế hoạch ${hnLoaiHinh === 'KIEM_TRA' ? 'kiểm tra' : 'giám sát'} năm ${hnNam} theo số ${hnSoVanBan || '.../KH'}: Kiểm tra việc lãnh đạo, chỉ đạo và thực hiện nhiệm vụ được giao đối với ${hnDoiTuong || 'đơn vị'}.`
        );
      }
    }, 500);
  };

  const handleFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormPdfFileName(file.name);
      setFormPdfFileSize(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        setFormPdfFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setFormRemovePdf(false);
    }
  };

  const handleFormExtractPdfText = () => {
    if (!formPdfFileName) {
      alert('Vui lòng chọn hoặc đính kèm tệp PDF trước khi trích xuất.');
      return;
    }
    setFormExtractingPdf(true);
    setTimeout(() => {
      setFormExtractingPdf(false);
      if (!formNoiDung.trim()) {
        setFormNoiDung(
          `Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ ${formTermStartYear} – ${formTermEndYear} theo số ${formSoVanBan || '.../CTr-ĐU'}: Kiểm tra việc lãnh đạo, chỉ đạo và tổ chức thực hiện Nghị quyết Đại hội Đảng bộ.`
        );
      }
    }, 500);
  };

  const handleSaveHn = async (e: React.FormEvent) => {
    e.preventDefault();
    setHnFormError(null);
    if (!hnNam) {
      setHnFormError('Vui lòng nhập năm thực hiện.');
      return;
    }
    if (!hnChuThe.trim()) {
      setHnFormError('Vui lòng chọn cơ quan / chủ thể ban hành.');
      return;
    }
    if (!hnDoiTuong.trim()) {
      setHnFormError('Đối tượng được kiểm tra, giám sát không được để trống.');
      return;
    }
    if (!hnNoiDung.trim()) {
      setHnFormError('Nội dung kiểm tra, giám sát không được để trống.');
      return;
    }

    setHnIsSaving(true);
    try {
      const finalPdfName = hnRemovePdf ? null : hnPdfFileName;
      const finalPdfUrl = hnRemovePdf ? null : hnPdfFileUrl;
      const finalPdfSize = hnRemovePdf ? null : hnPdfFileSize;
      const matchedDonVi = allDonVi.find((d) => d.ten === hnChuThe);
      const finalDonViId = matchedDonVi ? matchedDonVi.id : hnDonViId;

      let finalDriveUrl = finalPdfUrl;
      let driveFileId: string | undefined = undefined;
      let drivePreviewUrl: string | undefined = undefined;
      let isDrive = false;

      if (finalPdfName && finalPdfUrl && isGoogleDriveConfigured()) {
        try {
          const cfg = getGoogleDriveConfig();
          if (cfg.autoUpload) {
            const driveRes = await uploadBase64OrUrlToGoogleDrive(
              finalPdfName,
              finalPdfUrl,
              undefined,
              cfg.folderId
            );
            if (driveRes.success && driveRes.fileUrl) {
              finalDriveUrl = driveRes.fileUrl;
              driveFileId = driveRes.fileId;
              drivePreviewUrl = driveRes.previewUrl;
              isDrive = true;
            }
          }
        } catch (err) {
          console.warn('Lỗi tải tệp kế hoạch năm lên Google Drive:', err);
        }
      }

      const payload: CreateChuongTrinhInput = {
        nam: Number(hnNam),
        loai_chuong_trinh: 'HANG_NAM',
        nhiem_ky: null,
        has_nhiem_ky: false,
        chu_the: hnChuThe,
        don_vi_id: finalDonViId,
        ten_don_vi: null,
        chi_dang_bo_id: null,
        ten_chi_dang_bo: null,
        loai_hinh: hnLoaiHinh,
        linh_vuc: hnLinhVuc || DANH_MUC_LINH_VUC[0],
        doi_tuong: hnDoiTuong.trim(),
        noi_dung: hnNoiDung.trim(),
        ten_chuong_trinh: `Kế hoạch ${hnLoaiHinh === 'KIEM_TRA' ? 'kiểm tra' : 'giám sát'} năm ${hnNam} đối với ${hnDoiTuong.trim()}`,
        noi_dung_van_ban: hnNoiDungVanBan.trim() || null,
        ngay_bat_dau: hnNgayBatDau || null,
        ngay_ket_thuc: hnNgayKetThuc || null,
        so_van_ban: hnSoVanBan.trim() || null,
        ngay_ban_hanh: hnNgayBanHanh || null,
        nguoi_ky: hnNguoiKy.trim() || null,
        trang_thai: hnTrangThai,
        file_pdf_ten: finalPdfName,
        file_pdf_url: finalDriveUrl,
        file_pdf_dung_luong: finalPdfSize,
        ghi_chu_pdf: hnGhiChuPdf.trim() || null,
      };
      (payload as any).google_drive_id = driveFileId;
      (payload as any).google_drive_preview_url = drivePreviewUrl;
      (payload as any).is_google_drive = isDrive;

      let savedHnItem: ChuongTrinhKtGs;
      if (editingHnItem) {
        savedHnItem = await api.updateChuongTrinh({
          ...payload,
          id: editingHnItem.id,
        });
      } else {
        savedHnItem = await api.createChuongTrinh(payload);
      }

      if (finalPdfName) {
        try {
          await api.createOrAttachPdf({
            ten_file: finalPdfName,
            dung_luong: finalPdfSize || 350000,
            url: finalDriveUrl,
            file_url: finalDriveUrl,
            google_drive_id: driveFileId,
            google_drive_preview_url: drivePreviewUrl,
            is_google_drive: isDrive,
            chuong_trinh_id: savedHnItem.id,
            ghi_chu: `Văn bản kế hoạch năm ${hnNam}: ${payload.so_van_ban || payload.chu_the}`,
            nguon_goc: 'CHUONG_TRINH',
          });
        } catch {
          // ignore
        }
      } else if (hnRemovePdf && editingHnItem) {
        const existingDriveId = (editingHnItem as any)?.google_drive_id || extractGoogleDriveFileId(editingHnItem?.file_pdf_url);
        if (existingDriveId) {
          deleteFileFromGoogleDrive(existingDriveId).catch(() => {});
        }
        await api.deletePdf('ct-pdf-' + editingHnItem.id).catch(() => {});
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      }

      setIsHnModalOpen(false);
      await loadData();
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      onDataChanged?.();
    } catch (err: unknown) {
      setHnFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setHnIsSaving(false);
    }
  };

  // Xuất file Excel (.xlsx chuẩn hoặc .csv UTF-8 BOM)
  const handleExportHn = (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsExportMenuOpen(false);
    if (filteredHangNamList.length === 0) {
      alert('Không có dữ liệu chương trình kiểm tra, giám sát để xuất file.');
      return;
    }
    const yearStr = filterNam === 'ALL' ? 'tat_ca_cac_nam' : `nam_${filterNam}`;
    const fileName = `chuong_trinh_kiem_tra_giam_sat_${yearStr}`;
    exportChuongTrinhToExcel(filteredHangNamList, format, fileName);
  };

  // Nhập hàng loạt chương trình KT-GS năm từ Excel
  const handleBatchImportHn = async (
    items: CreateChuongTrinhInput[],
    duplicateAction: 'OVERWRITE' | 'SKIP' | 'CREATE_NEW'
  ) => {
    const res = await api.batchImportChuongTrinh(
      items,
      duplicateAction,
      user?.ho_ten || 'Cán bộ UBKT',
      user?.id
    );
    await loadData();
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
    onDataChanged?.();
    return res;
  };

  const handleClearHnFilter = () => {
    setFilterNam('ALL');
    setFilterHnChuThe('ALL');
    setFilterHnLoaiHinh('ALL');
    setFilterHnTrangThai('ALL');
    setFilterHnLinhVuc('ALL');
    setFilterHnDonVi('ALL');
    setHnProgressFilter('ALL');
    setSearchQuery('');
  };

  // Danh sách đã lọc theo các tiêu chí ở thanh công cụ (Phần Nhiệm kỳ)
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => {
      // Chỉ lấy chương trình toàn khóa / nhiệm kỳ cho bảng này
      const isNhiemKy = (item.loai_chuong_trinh || 'HANG_NAM') === 'NHIEM_KY' || Boolean(item.nhiem_ky) || Boolean(item.has_nhiem_ky);
      if (!isNhiemKy) return false;

      // 1. Lọc nhiệm kỳ
      if (filterNhiemKy !== 'ALL') {
        const itemNk = (item.nhiem_ky || (item.term_start_year && item.term_end_year ? `${item.term_start_year} - ${item.term_end_year}` : '')).replace('–', '-');
        const targetNk = filterNhiemKy.replace('–', '-');
        if (!itemNk.includes(targetNk)) return false;
      }

      // 2. Lọc thời gian thực hiện
      if (filterThoiGian !== 'ALL') {
        if (filterThoiGian === 'CA_NHIEM_KY') {
          if (item.thoi_gian_loai !== 'CA_NHIEM_KY' && item.ngay_bat_dau) return false;
        } else if (filterThoiGian === 'DANG_THUC_HIEN') {
          if (item.trang_thai !== 'DANG_THUC_HIEN') return false;
        } else if (filterThoiGian === 'HOAN_THANH') {
          if (item.trang_thai !== 'DA_HOAN_THANH') return false;
        }
      }

      // 3. Lọc loại chương trình
      if (filterLoaiChuongTrinh !== 'ALL') {
        if (filterLoaiChuongTrinh === 'NHIEM_KY' && !isNhiemKy) return false;
        if (filterLoaiChuongTrinh === 'HANG_NAM' && isNhiemKy) return false;
      }

      // 4. Tìm kiếm từ khóa
      if (q) {
        const matchTitle = Boolean(item.ten_chuong_trinh && item.ten_chuong_trinh.toLowerCase().includes(q));
        const matchNoiDung = Boolean(item.noi_dung && item.noi_dung.toLowerCase().includes(q));
        const matchNoiDungVB = Boolean(item.noi_dung_van_ban && item.noi_dung_van_ban.toLowerCase().includes(q));
        const matchSoVB = Boolean(item.so_van_ban && item.so_van_ban.toLowerCase().includes(q));
        const matchCq = Boolean((item.co_quan_ban_hanh || item.chu_the) && (item.co_quan_ban_hanh || item.chu_the).toLowerCase().includes(q));
        const matchCt = Boolean((item.chu_the_ap_dung || item.ten_chi_dang_bo) && (item.chu_the_ap_dung || item.ten_chi_dang_bo)!.toLowerCase().includes(q));
        const matchNk = Boolean(item.nhiem_ky && item.nhiem_ky.toLowerCase().includes(q));

        if (!matchTitle && !matchNoiDung && !matchNoiDungVB && !matchSoVB && !matchCq && !matchCt && !matchNk) {
          return false;
        }
      }

      return true;
    });
  }, [list, filterNhiemKy, filterThoiGian, filterLoaiChuongTrinh, searchQuery]);

  // Cập nhật selectedProgram khi filteredList thay đổi
  useEffect(() => {
    if (filteredList.length > 0) {
      if (!selectedProgram || !filteredList.some((p) => p.id === selectedProgram.id)) {
        const first = filteredList[0];
        setSelectedProgram(first);
        setFormEditingId(first.id);
        setFormTenChuongTrinh(first.ten_chuong_trinh || first.noi_dung.slice(0, 80));
        setFormHasNhiemKy(first.has_nhiem_ky !== false);
        setFormTermStartYear(first.term_start_year || (first.nhiem_ky ? parseInt(first.nhiem_ky.split('-')[0]?.trim() || '2025', 10) : 2025));
        setFormTermEndYear(first.term_end_year || (first.nhiem_ky ? parseInt(first.nhiem_ky.split('-')[1]?.trim() || '2030', 10) : 2030));
        setFormSoVanBan(first.so_van_ban || '');
        setFormCoQuanBanHanh(first.co_quan_ban_hanh || first.chu_the || 'BCH Đảng bộ phường Ái Quốc');
        setFormChuTheApDung(first.chu_the_ap_dung || first.ten_chi_dang_bo || 'Toàn Đảng bộ');
        setFormNoiDung(first.noi_dung || '');
        setFormNoiDungVanBan(first.noi_dung_van_ban || '');
        setFormTuNgay(first.ngay_bat_dau || '');
        setFormDenNgay(first.ngay_ket_thuc || '');
        setFormTrangThai(first.trang_thai || 'DANG_THUC_HIEN');
        setFormPdfFileName(first.file_pdf_ten || null);
        setFormPdfFileUrl(first.file_pdf_url || null);
        setFormPdfFileSize(first.file_pdf_dung_luong || null);
        setFormRemovePdf(false);
        setFormGhiChuPdf(first.ghi_chu_pdf || '');
      }
    }
  }, [filteredList]);

  // Handlers cho Card 1 và tương tác bảng
  const handleSelectForEdit = (item: ChuongTrinhKtGs) => {
    setSelectedProgram(item);
    setFormEditingId(item.id);
    setFormTenChuongTrinh(item.ten_chuong_trinh || item.noi_dung.slice(0, 80));
    setFormHasNhiemKy(item.has_nhiem_ky !== false);
    setFormTermStartYear(item.term_start_year || (item.nhiem_ky ? parseInt(item.nhiem_ky.split('-')[0]?.trim() || '2025', 10) : 2025));
    setFormTermEndYear(item.term_end_year || (item.nhiem_ky ? parseInt(item.nhiem_ky.split('-')[1]?.trim() || '2030', 10) : 2030));
    setFormSoVanBan(item.so_van_ban || '');
    setFormCoQuanBanHanh(item.co_quan_ban_hanh || item.chu_the || 'BCH Đảng bộ phường Ái Quốc');
    setFormChuTheApDung(item.chu_the_ap_dung || item.ten_chi_dang_bo || 'Toàn Đảng bộ');
    setFormNoiDung(item.noi_dung || '');
    setFormNoiDungVanBan(item.noi_dung_van_ban || '');
    setFormTuNgay(item.ngay_bat_dau || '');
    setFormDenNgay(item.ngay_ket_thuc || '');
    setFormTrangThai(item.trang_thai || 'DANG_THUC_HIEN');
    setFormPdfFileName(item.file_pdf_ten || null);
    setFormPdfFileUrl(item.file_pdf_url || null);
    setFormPdfFileSize(item.file_pdf_dung_luong || null);
    setFormRemovePdf(false);
    setFormGhiChuPdf(item.ghi_chu_pdf || '');
    setFormErrorMsg(null);
    setNhiemKyModalTab('FORM');
    setIsNhiemKyEditorOpen(true);
  };

  const handleAddNew = () => {
    setFormEditingId(null);
    setFormTenChuongTrinh('');
    setFormHasNhiemKy(true);
    setFormTermStartYear(2025);
    setFormTermEndYear(2030);
    setFormSoVanBan('');
    setFormCoQuanBanHanh('BCH Đảng bộ phường Ái Quốc');
    setFormChuTheApDung('Toàn Đảng bộ');
    setFormNoiDung('');
    setFormNoiDungVanBan('');
    setFormTuNgay('');
    setFormDenNgay('');
    setFormTrangThai('CHUA_THUC_HIEN');
    setFormPdfFileName(null);
    setFormPdfFileUrl(null);
    setFormPdfFileSize(null);
    setFormRemovePdf(false);
    setFormGhiChuPdf('');
    setFormErrorMsg(null);
    setNhiemKyModalTab('FORM');
    setIsNhiemKyEditorOpen(true);
  };

  const handleDuplicate = (item: ChuongTrinhKtGs) => {
    setFormEditingId(null);
    setFormTenChuongTrinh((item.ten_chuong_trinh || item.noi_dung.slice(0, 60)) + ' (Bản sao)');
    setFormHasNhiemKy(item.has_nhiem_ky !== false);
    setFormTermStartYear(item.term_start_year || 2025);
    setFormTermEndYear(item.term_end_year || 2030);
    setFormSoVanBan(item.so_van_ban ? `${item.so_van_ban}-BS` : '');
    setFormCoQuanBanHanh(item.co_quan_ban_hanh || item.chu_the);
    setFormChuTheApDung(item.chu_the_ap_dung || item.ten_chi_dang_bo || 'Toàn Đảng bộ');
    setFormNoiDung(item.noi_dung || '');
    setFormNoiDungVanBan(item.noi_dung_van_ban || '');
    setFormTuNgay(item.ngay_bat_dau || '');
    setFormDenNgay(item.ngay_ket_thuc || '');
    setFormTrangThai('CHUA_THUC_HIEN');
    setFormPdfFileName(item.file_pdf_ten || null);
    setFormPdfFileUrl(item.file_pdf_url || null);
    setFormPdfFileSize(item.file_pdf_dung_luong || null);
    setFormRemovePdf(false);
    setFormGhiChuPdf(item.ghi_chu_pdf || '');
    setFormErrorMsg(null);
    setSelectedProgram(item);
    setNhiemKyModalTab('FORM');
    setIsNhiemKyEditorOpen(true);
  };

  const handleResetForm = () => {
    if (selectedProgram) {
      handleSelectForEdit(selectedProgram);
    } else {
      handleAddNew();
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg(null);

    if (!formTenChuongTrinh.trim()) {
      setFormErrorMsg('Vui lòng nhập tên chương trình');
      return;
    }
    if (formHasNhiemKy) {
      if (!formTermStartYear || !formTermEndYear) {
        setFormErrorMsg('Vui lòng chọn đầy đủ Năm bắt đầu và Năm kết thúc nhiệm kỳ');
        return;
      }
      if (Number(formTermEndYear) < Number(formTermStartYear)) {
        setFormErrorMsg('Năm kết thúc phải lớn hơn hoặc bằng năm bắt đầu');
        return;
      }
    }
    if (!formNoiDung.trim()) {
      setFormErrorMsg('Vui lòng nhập nội dung kiểm tra, giám sát');
      return;
    }

    setIsFormSaving(true);
    try {
      const nkString = formHasNhiemKy && formTermStartYear && formTermEndYear ? `${formTermStartYear} – ${formTermEndYear}` : null;
      const isCA_NHIEM_KY = !formTuNgay && !formDenNgay;

      let formDriveUrl = formRemovePdf ? null : (formPdfFileUrl || null);
      let formDriveId: string | undefined = undefined;
      let formPreviewUrl: string | undefined = undefined;
      let isFormDrive = false;

      if (formPdfFileName && formPdfFileUrl && !formRemovePdf && isGoogleDriveConfigured()) {
        try {
          const cfg = getGoogleDriveConfig();
          if (cfg.autoUpload) {
            const driveRes = await uploadBase64OrUrlToGoogleDrive(
              formPdfFileName,
              formPdfFileUrl,
              undefined,
              cfg.folderId
            );
            if (driveRes.success && driveRes.fileUrl) {
              formDriveUrl = driveRes.fileUrl;
              formDriveId = driveRes.fileId;
              formPreviewUrl = driveRes.previewUrl;
              isFormDrive = true;
            }
          }
        } catch (err) {
          console.warn('Lỗi tải tệp chương trình toàn khóa lên Google Drive:', err);
        }
      }

      const payload: CreateChuongTrinhInput = {
        nam: formTermStartYear || new Date().getFullYear(),
        loai_chuong_trinh: formHasNhiemKy ? 'NHIEM_KY' : 'HANG_NAM',
        nhiem_ky: nkString,
        has_nhiem_ky: formHasNhiemKy,
        term_start_year: formHasNhiemKy ? Number(formTermStartYear) : null,
        term_end_year: formHasNhiemKy ? Number(formTermEndYear) : null,
        ten_chuong_trinh: formTenChuongTrinh.trim(),
        co_quan_ban_hanh: formCoQuanBanHanh.trim(),
        chu_the_ap_dung: formChuTheApDung.trim(),
        thoi_gian_loai: isCA_NHIEM_KY ? 'CA_NHIEM_KY' : 'KHOANG_THOI_GIAN',
        chu_the: formCoQuanBanHanh.trim(),
        doi_tuong: formChuTheApDung.trim(),
        noi_dung: formNoiDung.trim(),
        noi_dung_van_ban: formNoiDungVanBan.trim() || null,
        so_van_ban: formSoVanBan.trim() || null,
        ngay_bat_dau: formTuNgay || null,
        ngay_ket_thuc: formDenNgay || null,
        trang_thai: formTrangThai,
        file_pdf_ten: formRemovePdf ? null : (formPdfFileName || null),
        file_pdf_url: formDriveUrl,
        file_pdf_dung_luong: formRemovePdf ? null : (formPdfFileSize || null),
        ghi_chu_pdf: formGhiChuPdf.trim() || 'Văn bản chương trình toàn khóa nhiệm kỳ',
      };
      (payload as any).google_drive_id = formDriveId;
      (payload as any).google_drive_preview_url = formPreviewUrl;
      (payload as any).is_google_drive = isFormDrive;

      let savedItem: ChuongTrinhKtGs;
      if (formEditingId) {
        savedItem = await api.updateChuongTrinh({
          ...payload,
          id: formEditingId,
        });
      } else {
        savedItem = await api.createChuongTrinh(payload);
      }

      // Tự động tổng hợp file PDF tải lên vào Kho PDF nếu có file mới
      if (formPdfFileName && formDriveUrl && !formRemovePdf) {
        try {
          await api.createOrAttachPdf({
            ten_file: formPdfFileName,
            dung_luong: formPdfFileSize || 350000,
            url: formDriveUrl,
            file_url: formDriveUrl,
            google_drive_id: formDriveId,
            google_drive_preview_url: formPreviewUrl,
            is_google_drive: isFormDrive,
            chuong_trinh_id: savedItem.id,
            ghi_chu: `Văn bản gốc chương trình nhiệm kỳ ${savedItem.nhiem_ky || ''} (${savedItem.so_van_ban || ''})`,
            nguon_goc: 'CHUONG_TRINH',
          });
        } catch (pdfErr) {
          console.warn('Lỗi đồng bộ PDF sang Kho dữ liệu:', pdfErr);
        }
      } else if (formRemovePdf && formEditingId) {
        const existingItem = list.find((c) => c.id === formEditingId);
        const existingDriveId = (existingItem as any)?.google_drive_id || extractGoogleDriveFileId(existingItem?.file_pdf_url);
        if (existingDriveId) {
          deleteFileFromGoogleDrive(existingDriveId).catch(() => {});
        }
        await api.deletePdf('ct-pdf-' + formEditingId).catch(() => {});
        window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      }

      await loadData();
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      setSelectedProgram(savedItem);
      setFormEditingId(savedItem.id);
      setIsNhiemKyEditorOpen(false);
      onDataChanged?.();
    } catch (err: unknown) {
      setFormErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFormSaving(false);
    }
  };





  // Điều hướng liên kết sang tab Hồ sơ địa bàn
  const handleLinkToDiaBan = (donViId?: string | null, tenDonVi?: string | null) => {
    if (donViId) {
      localStorage.setItem('ubkt_target_dia_ban_id', donViId);
    }
    window.dispatchEvent(
      new CustomEvent('ubkt_navigate', {
        detail: {
          tab: 'ho_so_dia_ban',
          donViId: donViId || undefined,
          tenDonVi: tenDonVi || undefined,
        },
      })
    );
  };

  // Mở modal quản lý & nạp bảng đối chiếu thay đổi, bổ sung
  const handleOpenThayDoiModal = (item: ChuongTrinhKtGs) => {
    setManagingThayDoiItem(item);
    setIsAddingThayDoi(false);
    setTdSoVanBan('');
    setTdNgayBanHanh(new Date().toISOString().split('T')[0]);
    setTdNguoiKy('');
    setTdDonViId(item.chi_dang_bo_id || null);
    setTdTenDonVi(item.ten_chi_dang_bo || '');
    setTdNoiDungDieuChinh('');
    setTdNoiDungGoc(item.noi_dung ? `Theo chương trình gốc: ${item.noi_dung}` : '');
    setTdPdfFileName(null);
    setTdPdfFileUrl(null);
    setTdPdfFileSize(null);
    setTdGhiChu('');
  };

  const handleTdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Vui lòng chọn tệp định dạng .PDF');
        return;
      }
      setTdPdfFileName(file.name);
      setTdPdfFileSize(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        setTdPdfFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveThayDoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingThayDoiItem) return;
    if (!tdSoVanBan.trim() || !tdNoiDungDieuChinh.trim()) {
      alert('Vui lòng nhập số văn bản và nội dung điều chỉnh/bổ sung.');
      return;
    }

    setIsSavingThayDoi(true);
    try {
      const matchedUnit = allDonVi.find((d) => d.id === tdDonViId);
      const tenDonViFinal = matchedUnit ? matchedUnit.ten : (tdDonViId ? tdTenDonVi : 'Toàn Đảng bộ');

      let tdDriveUrl = tdPdfFileUrl;
      let tdDriveId: string | undefined = undefined;
      let tdPreviewUrl: string | undefined = undefined;
      let isTdDrive = false;

      if (tdPdfFileName && tdPdfFileUrl && isGoogleDriveConfigured()) {
        try {
          const cfg = getGoogleDriveConfig();
          if (cfg.autoUpload) {
            const driveRes = await uploadBase64OrUrlToGoogleDrive(
              tdPdfFileName,
              tdPdfFileUrl,
              undefined,
              cfg.folderId
            );
            if (driveRes.success && driveRes.fileUrl) {
              tdDriveUrl = driveRes.fileUrl;
              tdDriveId = driveRes.fileId;
              tdPreviewUrl = driveRes.previewUrl;
              isTdDrive = true;
            }
          }
        } catch (err) {
          console.warn('Lỗi tải tệp điều chỉnh bổ sung lên Google Drive:', err);
        }
      }

      const newTd: ThayDoiBoSungKtGs = {
        id: 'td-' + Date.now(),
        chuong_trinh_id: managingThayDoiItem.id,
        lan_dieu_chinh: (managingThayDoiItem.danh_sach_thay_doi_bo_sung?.length || 0) + 1,
        so_van_ban: tdSoVanBan.trim(),
        ngay_ban_hanh: tdNgayBanHanh || new Date().toISOString().split('T')[0],
        nguoi_ky: tdNguoiKy.trim() || null,
        don_vi_id: tdDonViId || null,
        ten_don_vi: tenDonViFinal,
        noi_dung_dieu_chinh: tdNoiDungDieuChinh.trim(),
        noi_dung_goc: tdNoiDungGoc.trim() || (managingThayDoiItem.noi_dung ? `Chương trình gốc: ${managingThayDoiItem.noi_dung.slice(0, 100)}...` : null),
        file_pdf_ten: tdPdfFileName,
        file_pdf_url: tdDriveUrl,
        file_pdf_dung_luong: tdPdfFileSize,
        ghi_chu: tdGhiChu.trim() || null,
        created_at: new Date().toISOString(),
      };
      (newTd as any).google_drive_id = tdDriveId;
      (newTd as any).google_drive_preview_url = tdPreviewUrl;
      (newTd as any).is_google_drive = isTdDrive;

      await api.addThayDoiBoSung(newTd);

      // Tự động tổng hợp file PDF tải lên vào Kho PDF
      if (tdPdfFileName) {
        await api.createOrAttachPdf({
          ten_file: tdPdfFileName,
          dung_luong: tdPdfFileSize || 350000,
          url: tdDriveUrl,
          file_url: tdDriveUrl,
          google_drive_id: tdDriveId,
          google_drive_preview_url: tdPreviewUrl,
          is_google_drive: isTdDrive,
          chuong_trinh_id: managingThayDoiItem.id,
          ghi_chu: `Văn bản điều chỉnh ${newTd.so_van_ban} (${tenDonViFinal})`,
          nguon_goc: 'THAY_DOI_BO_SUNG',
        });
      }

      setIsAddingThayDoi(false);
      setTdSoVanBan('');
      setTdNoiDungDieuChinh('');
      setTdNoiDungGoc('');
      setTdPdfFileName(null);
      setTdPdfFileUrl(null);
      setTdPdfFileSize(null);
      setTdGhiChu('');

      await loadData();
      const updatedList = await api.getAllChuongTrinh();
      const refreshed = updatedList.find((c) => c.id === managingThayDoiItem.id);
      if (refreshed) setManagingThayDoiItem(refreshed);
      onDataChanged?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingThayDoi(false);
    }
  };

  const handleDeleteThayDoi = async (thayDoiId: string) => {
    if (!managingThayDoiItem) return;
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi thay đổi, bổ sung này? Thao tác này sẽ gỡ bỏ tệp đính kèm trên cả Google Drive và Kho dữ liệu.')) return;
    try {
      const targetTd = managingThayDoiItem.danh_sach_thay_doi_bo_sung?.find((t) => t.id === thayDoiId);
      if (targetTd) {
        const driveId = (targetTd as any).google_drive_id || extractGoogleDriveFileId(targetTd.file_pdf_url);
        if (driveId) {
          try {
            await deleteFileFromGoogleDrive(driveId);
          } catch (gdriveErr) {
            console.warn('Lỗi xóa tệp thay đổi bổ sung trên Google Drive:', gdriveErr);
          }
        }
        await api.deletePdf('td-pdf-' + managingThayDoiItem.id + '-' + thayDoiId).catch(() => {});
        await api.deletePdf('td-pdf-' + thayDoiId).catch(() => {});
      }

      await api.deleteThayDoiBoSung(managingThayDoiItem.id, thayDoiId);
      await loadData();
      const updatedList = await api.getAllChuongTrinh();
      const refreshed = updatedList.find((c) => c.id === managingThayDoiItem.id);
      if (refreshed) setManagingThayDoiItem(refreshed);
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      onDataChanged?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      // 1. Tự động xóa tệp chương trình trên Google Drive nếu có
      const driveFileId =
        (deleteTarget as any).google_drive_id ||
        extractGoogleDriveFileId(deleteTarget.file_pdf_url);
      if (driveFileId) {
        try {
          await deleteFileFromGoogleDrive(driveFileId);
        } catch (gdriveErr) {
          console.warn('Lỗi khi xóa tệp chương trình trên Google Drive:', gdriveErr);
        }
      }

      // Xóa các tệp đính kèm trong danh sách thay đổi bổ sung nếu có
      if (deleteTarget.danh_sach_thay_doi_bo_sung) {
        for (const td of deleteTarget.danh_sach_thay_doi_bo_sung) {
          const tdDriveId = (td as any).google_drive_id || extractGoogleDriveFileId(td.file_pdf_url);
          if (tdDriveId) {
            try {
              await deleteFileFromGoogleDrive(tdDriveId);
            } catch (err) {
              console.warn('Lỗi khi xóa tệp thay đổi bổ sung trên Google Drive:', err);
            }
          }
          await api.deletePdf('td-pdf-' + deleteTarget.id + '-' + td.id).catch(() => {});
        }
      }

      // 2. Xóa khỏi Kho PDF
      await api.deletePdf('ct-pdf-' + deleteTarget.id).catch(() => {});

      // 3. Xóa bản ghi chương trình
      await api.deleteChuongTrinh(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      onDataChanged?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePrintDoc = () => {
    window.print();
  };

  const handleDownloadPdf = (item: ChuongTrinhKtGs) => {
    if (item.file_pdf_url) {
      if (item.file_pdf_url.includes('drive.google.com')) {
        window.open(item.file_pdf_url, '_blank');
        return;
      }
      const a = document.createElement('a');
      a.href = item.file_pdf_url;
      a.download = item.file_pdf_ten || 'van_ban_chuong_trinh.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const docText = `${item.noi_dung_van_ban || item.noi_dung}\n\nChương trình: ${item.so_van_ban || ''} - Ban hành: ${item.chu_the}`;
      const blob = new Blob([docText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.file_pdf_ten || (item.so_van_ban ? item.so_van_ban.replace(/[/\\?%*:|"<>]/g, '_') : 'van_ban')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreviewThayDoi = (td: ThayDoiBoSungKtGs) => {
    const parent = managingThayDoiItem || selectedProgram;
    setViewingDocItem({
      id: td.id,
      nam: parent?.nam || (td.ngay_ban_hanh ? parseInt(td.ngay_ban_hanh.slice(0, 4), 10) : 2025),
      so_van_ban: td.so_van_ban,
      chu_the: td.nguoi_ky || parent?.chu_the || 'Ủy ban Kiểm tra Đảng ủy',
      co_quan_ban_hanh: td.nguoi_ky || parent?.co_quan_ban_hanh || parent?.chu_the || 'Ủy ban Kiểm tra Đảng ủy',
      ten_chi_dang_bo: td.ten_don_vi || 'Toàn Đảng bộ',
      chu_the_ap_dung: td.ten_don_vi || 'Toàn Đảng bộ',
      don_vi_id: td.don_vi_id || null,
      ten_don_vi: td.ten_don_vi || 'Toàn Đảng bộ',
      noi_dung: td.noi_dung_dieu_chinh,
      noi_dung_van_ban: `[VĂN BẢN ĐIỀU CHỈNH, BỔ SUNG CHƯƠNG TRÌNH]\nSố ký hiệu: ${td.so_van_ban}\nNgày ban hành: ${formatDateVn(td.ngay_ban_hanh)}\nĐơn vị / Địa bàn áp dụng: ${td.ten_don_vi || 'Toàn Đảng bộ'}\nNgười ký / Ban hành: ${td.nguoi_ky || '—'}\n\nNỘI DUNG ĐIỀU CHỈNH:\n${td.noi_dung_dieu_chinh}${td.noi_dung_goc ? `\n\nNỘI DUNG CHƯƠNG TRÌNH GỐC ĐỐI CHIẾU:\n${td.noi_dung_goc}` : ''}`,
      file_pdf_ten: td.file_pdf_ten || null,
      file_pdf_url: td.file_pdf_url || null,
      file_pdf_dung_luong: td.file_pdf_dung_luong || null,
      ghi_chu_pdf: td.ghi_chu || 'Văn bản điều chỉnh, bổ sung chương trình kiểm tra, giám sát',
      loai_hinh: 'KIEM_TRA',
      trang_thai: 'DANG_THUC_HIEN',
      ngay_bat_dau: td.ngay_ban_hanh,
      ngay_ket_thuc: td.ngay_ban_hanh,
      loai_chuong_trinh: 'NHIEM_KY',
      nhiem_ky: parent?.nhiem_ky || '2025 - 2030',
      created_at: td.created_at,
      updated_at: td.updated_at || td.created_at,
    });
  };



  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* ── BREADCRUMB ────────────────────────────────────────── */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Home className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-700 font-medium">Chương trình kiểm tra, giám sát</span>
      </div>

      {/* ── TAB CHUYỂN ĐỔI: TOÀN KHÓA / NHIỆM KỲ vs CÔNG TÁC HÀNG NĂM (PHẦN NĂM) ── */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              handleSubTabChange('NHIEM_KY');
              setFilterLoaiChuongTrinh('NHIEM_KY');
            }}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'NHIEM_KY'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-200" />
            <span>Chương trình toàn khóa / Nhiệm kỳ</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === 'NHIEM_KY' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {countNhiemKy}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSubTabChange('HANG_NAM');
              setFilterLoaiChuongTrinh('HANG_NAM');
            }}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'HANG_NAM'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-200" />
            <span>Chương trình kiểm tra, giám sát năm</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === 'HANG_NAM' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {countHangNam}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Tổng số chương trình: <strong className="text-slate-800">{list.length}</strong></span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Năm công tác: <strong>{filterNam === 'ALL' ? new Date().getFullYear() : filterNam}</strong></span>
          </span>
        </div>
      </div>

      {activeTab === 'NHIEM_KY' && (
        <>
          {/* ── HEADER VÀ BỘ LỌC NHIỆM KỲ ────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Danh sách chương trình kiểm tra, giám sát
            </h1>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Ô tìm kiếm */}
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm theo tên, số văn bản, nội dung..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition shadow-2xs"
                />
              </div>

              {/* Lọc Nhiệm kỳ */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-600 whitespace-nowrap font-semibold">Nhiệm kỳ:</span>
                <select
                  value={filterNhiemKy}
                  onChange={(e) => {
                    setFilterNhiemKy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-blue-50 text-blue-950 font-bold border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả nhiệm kỳ</option>
                  {availableNhiemKyList.map((nk) => (
                    <option key={nk} value={nk}>
                      Nhiệm kỳ {nk}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc Thời gian thực hiện */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-600 whitespace-nowrap">Thời gian thực hiện</span>
                <select
                  value={filterThoiGian}
                  onChange={(e) => {
                    setFilterThoiGian(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="CA_NHIEM_KY">Cả nhiệm kỳ</option>
                  <option value="DANG_THUC_HIEN">Đang thực hiện</option>
                  <option value="HOAN_THANH">Hoàn thành</option>
                </select>
              </div>

              {/* Lọc Loại chương trình */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-600 whitespace-nowrap">Loại chương trình</span>
                <select
                  value={filterLoaiChuongTrinh}
                  onChange={(e) => {
                    const val = e.target.value as 'ALL' | 'NHIEM_KY' | 'HANG_NAM';
                    setFilterLoaiChuongTrinh(val);
                    if (val === 'HANG_NAM') {
                      setActiveTab('HANG_NAM');
                    } else if (val === 'NHIEM_KY') {
                      setActiveTab('NHIEM_KY');
                    }
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="NHIEM_KY">Toàn khóa (Nhiệm kỳ)</option>
                  <option value="HANG_NAM">Chương trình kiểm tra, giám sát năm</option>
                </select>
              </div>

          {/* Nút Thêm mới */}
          {canEdit && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BẢNG DANH SÁCH 11 CỘT CHUẨN ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-2 w-10 text-center">STT</th>
                <th className="py-3 px-3 w-32 text-center">NHIỆM KỲ</th>
                <th className="py-3 px-3 w-36">SỐ HIỆU VĂN BẢN</th>
                <th className="py-3 px-3 w-40">CƠ QUAN BAN HÀNH</th>
                <th className="py-3 px-3 w-36">CHỦ THỂ ÁP DỤNG</th>
                <th className="py-3 px-3 w-44 text-center">THAY ĐỔI, BỔ SUNG & ĐỐI CHIẾU</th>
                <th className="py-3 px-4 min-w-[220px]">NỘI DUNG KIỂM TRA, GIÁM SÁT</th>
                <th className="py-3 px-3 w-32">THỜI GIAN</th>
                <th className="py-3 px-3 w-28 text-center">TRẠNG THÁI</th>
                <th className="py-3 px-3 w-36 text-center">VĂN BẢN ĐÍNH KÈM</th>
                <th className="py-3 px-3 w-24 text-center">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <span className="inline-block animate-spin mr-2">⟳</span>
                    Đang nạp dữ liệu chương trình...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Không tìm thấy chương trình phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredList
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((item, idx) => {
                    const rowStt = (currentPage - 1) * pageSize + idx + 1;
                    const isSelected = selectedProgram?.id === item.id;
                    const termRange =
                      item.term_start_year && item.term_end_year
                        ? `${item.term_start_year} – ${item.term_end_year}`
                        : item.nhiem_ky || '2025 – 2030';
                    const hasTerm = item.has_nhiem_ky !== false && (item.nhiem_ky || item.term_start_year);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleSelectForEdit(item)}
                        className={`transition cursor-pointer ${
                          isSelected ? 'bg-sky-50/70 border-l-2 border-l-sky-600' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. STT */}
                        <td className="py-3.5 px-2 text-center text-slate-500 font-mono text-xs">
                          {rowStt}
                        </td>

                        {/* 2. NHIỆM KỲ */}
                        <td className="py-3.5 px-3 text-center">
                          {hasTerm ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-block border border-slate-300 rounded px-2.5 py-0.5 bg-white text-slate-800 font-bold text-xs shadow-2xs">
                                {termRange}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-1">
                                Năm bắt đầu – kết thúc
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">—</span>
                          )}
                        </td>

                        {/* 3. SỐ HIỆU VĂN BẢN */}
                        <td className="py-3.5 px-3">
                          {item.so_van_ban ? (
                            item.so_van_ban.includes('CBQS') ? (
                              <span className="border border-sky-400 bg-sky-50 text-sky-800 px-2 py-0.5 rounded text-xs font-bold font-mono inline-block">
                                {item.so_van_ban}
                              </span>
                            ) : item.so_van_ban.includes('CBCA') ? (
                              <span className="font-bold text-slate-800 font-mono text-xs">
                                {item.so_van_ban}
                              </span>
                            ) : (
                              <span className="font-bold text-slate-800 font-mono text-xs">
                                {item.so_van_ban}
                              </span>
                            )
                          ) : (
                            <div className="text-slate-400">
                              <span className="text-xs font-bold">—</span>
                              <div className="text-[10px] text-slate-400">Không có số hiệu văn bản</div>
                            </div>
                          )}
                        </td>

                        {/* 4. CƠ QUAN BAN HÀNH */}
                        <td className="py-3.5 px-3 font-semibold text-slate-800 text-xs">
                          {item.co_quan_ban_hanh || item.chu_the}
                        </td>

                        {/* 5. CHỦ THỂ ÁP DỤNG */}
                        <td className="py-3.5 px-3">
                          {(item.chu_the_ap_dung || item.ten_chi_dang_bo || '').includes('Toàn Đảng bộ') || !item.chi_dang_bo_id ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Building2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>Toàn Đảng bộ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <Building2 className="w-3.5 h-3.5 text-sky-600" />
                              <span className="truncate max-w-[120px]">{item.chu_the_ap_dung || item.ten_chi_dang_bo}</span>
                            </span>
                          )}
                        </td>

                        {/* 6. THAY ĐỔI, BỔ SUNG & ĐỐI CHIẾU */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenThayDoiModal(item);
                              }}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-300 transition cursor-pointer shadow-2xs"
                              title="Xem bảng đối chiếu và nạp văn bản thay đổi, bổ sung"
                            >
                              <GitCompare className="w-3.5 h-3.5 text-amber-700" />
                              <span>Đối chiếu thay đổi</span>
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                  (item.danh_sach_thay_doi_bo_sung?.length || 0) > 0
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-amber-200 text-amber-900'
                                }`}
                              >
                                {item.danh_sach_thay_doi_bo_sung?.length || 0}
                              </span>
                            </button>
                            {(item.danh_sach_thay_doi_bo_sung?.length || 0) > 0 && (
                              <span className="text-[10px] text-slate-500 mt-1 font-medium">
                                {item.danh_sach_thay_doi_bo_sung?.length} đợt điều chỉnh
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 7. NỘI DUNG KIỂM TRA, GIÁM SÁT */}
                        <td className="py-3.5 px-4 text-xs text-slate-700 leading-relaxed">
                          <p className="line-clamp-2" title={item.noi_dung}>
                            {item.noi_dung}
                          </p>
                        </td>

                        {/* 8. THỜI GIAN */}
                        <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {item.thoi_gian_loai === 'CA_NHIEM_KY' || (!item.ngay_bat_dau && !item.ngay_ket_thuc) ? (
                            <span className="text-slate-600 font-medium">Cả nhiệm kỳ</span>
                          ) : (
                            <div className="space-y-0.5 text-[11.5px]">
                              {item.ngay_bat_dau && <div>Từ: {formatDateVn(item.ngay_bat_dau)}</div>}
                              {item.ngay_ket_thuc && <div>Đến: {formatDateVn(item.ngay_ket_thuc)}</div>}
                            </div>
                          )}
                        </td>

                        {/* 9. TRẠNG THÁI */}
                        <td className="py-3.5 px-3 text-center">
                          {item.trang_thai === 'DA_HOAN_THANH' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              Hoàn thành
                            </span>
                          ) : item.trang_thai === 'DANG_THUC_HIEN' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                              Đang thực hiện
                            </span>
                          ) : item.trang_thai === 'QUA_HAN' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-300">
                              Quá hạn
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                              Chưa thực hiện
                            </span>
                          )}
                        </td>

                        {/* 10. VĂN BẢN ĐÍNH KÈM */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingDocItem(item);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[11px] font-semibold border border-sky-200 transition cursor-pointer shadow-2xs"
                              title="Xem tài liệu văn bản chương trình"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-600" />
                              <span>Xem văn bản</span>
                            </button>

                            {item.file_pdf_ten ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingDocItem(item);
                                }}
                                className="flex items-center space-x-1 text-[11px] text-red-600 hover:text-red-800 cursor-pointer max-w-[135px] truncate font-medium"
                                title={`Xem trực tiếp tệp gốc: ${item.file_pdf_ten}`}
                              >
                                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                                <span className="truncate">{item.file_pdf_ten}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Chưa đính kèm PDF gốc</span>
                            )}
                          </div>
                        </td>

                        {/* 11. THAO TÁC */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectForEdit(item);
                              }}
                              title="Chỉnh sửa chương trình (Mở form sửa & chi tiết)"
                              className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProgram(item);
                                setNhiemKyModalTab('DETAIL');
                                setIsNhiemKyEditorOpen(true);
                              }}
                              title="Xem chi tiết chương trình & tài liệu"
                              className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(item);
                              }}
                              title="Nhân bản chương trình"
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(item);
                                }}
                                title="Xóa chương trình"
                                className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

        {/* ── THANH PHÂN TRANG ────────────────────────────────────────── */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Hiển thị{' '}
            <strong className="text-slate-800">
              {filteredList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredList.length)}
            </strong>{' '}
            / <strong className="text-slate-800">{filteredList.length}</strong> kết quả
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: Math.max(1, Math.ceil(filteredList.length / pageSize)) }).map((_, i) => {
              const pageNum = i + 1;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= Math.ceil(filteredList.length / pageSize)}
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredList.length / pageSize), p + 1))}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CỬA SỔ CHI TIẾT & CHỈNH SỬA / THÊM MỚI (CHỈ HIỂN THỊ KHI BẤM SỬA HOẶC THÊM MỚI) ── */}
      {isNhiemKyEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-4 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#0f2d4a] via-[#1a3a5c] to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b-2 border-blue-500">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-blue-950 border border-blue-400 flex items-center justify-center shadow">
                  <Layers className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {nhiemKyModalTab === 'FORM'
                      ? formEditingId
                        ? 'CHỈNH SỬA CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT NHIỆM KỲ'
                        : 'THÊM MỚI CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT NHIỆM KỲ'
                      : 'CHI TIẾT CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT NHIỆM KỲ'}
                  </h3>
                  <p className="text-xs text-blue-200 truncate max-w-md">
                    {selectedProgram?.ten_chuong_trinh || 'Chương trình toàn khóa nhiệm kỳ 2025 - 2030'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="bg-white/10 p-0.5 rounded-lg flex items-center mr-2">
                  <button
                    type="button"
                    onClick={() => setNhiemKyModalTab('FORM')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      nhiemKyModalTab === 'FORM'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {formEditingId ? 'Sửa thông tin' : 'Thêm mới'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNhiemKyModalTab('DETAIL')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      nhiemKyModalTab === 'DETAIL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Chi tiết & Tài liệu
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNhiemKyEditorOpen(false)}
                  className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {nhiemKyModalTab === 'FORM' ? (
                /* FORM */
                <div ref={formRef} className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-bold text-slate-900">
              {formEditingId ? 'Chỉnh sửa chương trình kiểm tra, giám sát' : 'Thêm mới chương trình kiểm tra, giám sát'}
            </h2>
          </div>

          {formErrorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CỘT TRÁI: THÔNG TIN CHUNG */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Thông tin chung
                </h3>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Tên chương trình <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTenChuongTrinh}
                    onChange={(e) => setFormTenChuongTrinh(e.target.value)}
                    placeholder="Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030"
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Nhiệm kỳ */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 font-semibold">Nhiệm kỳ</label>
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={formHasNhiemKy}
                        onChange={(e) => setFormHasNhiemKy(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Văn bản có gắn với nhiệm kỳ</span>
                    </label>
                  </div>

                  {formHasNhiemKy ? (
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            Năm bắt đầu <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formTermStartYear}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormTermStartYear(val);
                              setFormTermEndYear(val + 5);
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          >
                            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            Năm kết thúc <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formTermEndYear}
                            onChange={(e) => setFormTermEndYear(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          >
                            {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Hiển thị: <strong className="text-slate-800">{formTermStartYear} – {formTermEndYear}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Không gắn với khoảng nhiệm kỳ cụ thể
                    </div>
                  )}
                </div>

                {/* Số hiệu văn bản */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-0.5">
                    Số hiệu văn bản
                  </label>
                  <input
                    type="text"
                    value={formSoVanBan}
                    onChange={(e) => setFormSoVanBan(e.target.value)}
                    placeholder="01-CTr/ĐU"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Nhập đúng số và ký hiệu trên văn bản gốc. Được phép bỏ trống nếu chưa có.
                  </p>
                </div>

                {/* Cơ quan ban hành */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-0.5">
                    Cơ quan ban hành <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCoQuanBanHanh}
                    onChange={(e) => setFormCoQuanBanHanh(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="BCH Đảng bộ phường Ái Quốc">BCH Đảng bộ phường Ái Quốc</option>
                    <option value="Ban Thường vụ Đảng ủy phường">Ban Thường vụ Đảng ủy phường</option>
                    <option value="UBKT Đảng ủy phường">UBKT Đảng ủy phường</option>
                    <option value="Chi bộ Quân sự">Chi bộ Quân sự</option>
                    <option value="Chi bộ Công an">Chi bộ Công an</option>
                    <option value="Đảng bộ Trường THCS Ái Quốc">Đảng bộ Trường THCS Ái Quốc</option>
                    {allDonVi.map((d) => (
                      <option key={d.id} value={d.ten}>
                        {d.ten}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chủ thể áp dụng */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-0.5">
                    Chủ thể áp dụng <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formChuTheApDung}
                    onChange={(e) => setFormChuTheApDung(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  >
                    <option value="Toàn Đảng bộ">🏛️ Toàn Đảng bộ</option>
                    {chiDangBoList.map((cb) => (
                      <option key={cb.id} value={cb.ten}>
                        🏛️ {cb.ten}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CỘT PHẢI: NỘI DUNG VÀ THỜI GIAN */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                  Nội dung và thời gian
                </h3>

                {/* Thay đổi, bổ sung & đối chiếu */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Thay đổi, bổ sung & đối chiếu
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProgram) {
                        handleOpenThayDoiModal(selectedProgram);
                      } else if (filteredList[0]) {
                        handleOpenThayDoiModal(filteredList[0]);
                      }
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-amber-700" />
                    <span>Đính kèm tài liệu</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                      {selectedProgram?.danh_sach_thay_doi_bo_sung?.length || 0}
                    </span>
                  </button>
                </div>

                {/* Nội dung kiểm tra, giám sát */}
                <div className="relative">
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nội dung kiểm tra, giám sát <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={formNoiDung}
                    onChange={(e) => setFormNoiDung(e.target.value)}
                    placeholder="Kiểm tra, giám sát theo Quyết định/Kế hoạch số ...: Kiểm tra việc lãnh đạo, chỉ đạo và tổ chức thực hiện..."
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none leading-relaxed"
                  />
                  <div className="text-right text-[10px] text-slate-400 mt-0.5">
                    {formNoiDung.length}/2000
                  </div>
                </div>

                {/* Thời gian thực hiện */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Thời gian thực hiện
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-0.5">Từ ngày</span>
                      <input
                        type="date"
                        value={formTuNgay}
                        onChange={(e) => setFormTuNgay(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-0.5">Đến ngày</span>
                      <input
                        type="date"
                        value={formDenNgay}
                        onChange={(e) => setFormDenNgay(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Trạng thái */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={formTrangThai}
                    onChange={(e) => setFormTrangThai(e.target.value as TrangThaiKtGs)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  >
                    <option value="DANG_THUC_HIEN">🟢 Đang thực hiện</option>
                    <option value="DA_HOAN_THANH">🔵 Hoàn thành</option>
                    <option value="CHUA_THUC_HIEN">⚪ Chưa thực hiện</option>
                    <option value="QUA_HAN">🔴 Quá hạn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ĐÍNH KÈM TỆP VĂN BẢN GỐC (PDF / WORD) CỦA CHƯƠNG TRÌNH NHIỆM KỲ */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <label className="font-bold text-blue-950 text-xs">
                    Văn bản gốc đính kèm (Tệp PDF / Word) — Tự động đồng bộ Kho dữ liệu
                  </label>
                </div>
                {formPdfFileName && (
                  <button
                    type="button"
                    onClick={handleFormExtractPdfText}
                    disabled={formExtractingPdf}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 rounded text-xs font-bold border border-blue-300 cursor-pointer shadow-2xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>{formExtractingPdf ? 'Đang trích xuất...' : 'Trích xuất nội dung từ PDF'}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFormFileChange}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-800 cursor-pointer"
                />
                {formPdfFileName && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-blue-900 flex items-center gap-1">
                      <FileText className="w-4 h-4 text-red-600" />
                      <span>{formPdfFileName}</span>
                      {formPdfFileSize && <span className="text-[10px] text-slate-500">({formatFileSize(formPdfFileSize)})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormRemovePdf(true);
                        setFormPdfFileName(null);
                        setFormPdfFileUrl(null);
                        setFormPdfFileSize(null);
                      }}
                      className="text-rose-600 hover:text-rose-800 text-xs cursor-pointer font-bold"
                    >
                      (Xóa tệp)
                    </button>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={formGhiChuPdf}
                  onChange={(e) => setFormGhiChuPdf(e.target.value)}
                  placeholder="Ghi chú tệp văn bản gốc (VD: Văn bản gốc đã ký, ban hành chính thức...)"
                  className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Buttons Hủy & Lưu */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isFormSaving}
                className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition flex items-center space-x-1"
              >
                {isFormSaving ? (
                  <>
                    <span className="inline-block animate-spin mr-1">⟳</span>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu</span>
                )}
              </button>
            </div>
          </form>
                </div>
              ) : (
                /* CHI TIẾT CHƯƠNG TRÌNH */
                <div className="space-y-4">

          {/* Banner Hero Xanh Đậm (#0f2d4a) */}
          <div className="bg-[#0f2d4a] text-white p-4 rounded-xl space-y-2 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-sm leading-snug">
                {selectedProgram?.ten_chuong_trinh || 'Chương trình kiểm tra, giám sát toàn khóa nhiệm kỳ 2025 - 2030'}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white shrink-0">
                {selectedProgram?.trang_thai === 'DA_HOAN_THANH' ? 'Hoàn thành' : 'Đang thực hiện'}
              </span>
            </div>

            <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-white/10">
              <div>
                <span>Số hiệu: <strong>{selectedProgram?.so_van_ban || '—'}</strong></span>
                <span className="mx-2 opacity-60">|</span>
                <span>Cơ quan ban hành: <strong>{selectedProgram?.co_quan_ban_hanh || selectedProgram?.chu_the}</strong></span>
              </div>
              <div>
                <span>
                  Thời gian: Từ{' '}
                  <strong>
                    {selectedProgram?.ngay_bat_dau
                      ? `${selectedProgram.ngay_bat_dau} – ${selectedProgram.ngay_ket_thuc || '30/05/2030'}`
                      : 'Cả nhiệm kỳ'}
                  </strong>
                </span>
                <span className="mx-2 opacity-60">|</span>
                <span>
                  Chủ thể áp dụng: <strong>{selectedProgram?.chu_the_ap_dung || selectedProgram?.ten_chi_dang_bo || 'Toàn Đảng bộ'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 3 Tabs */}
          <div className="flex items-center border-b border-slate-200 pb-1 gap-1">
            <button
              type="button"
              onClick={() => setDetailTab('tong_quan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                detailTab === 'tong_quan'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('tai_lieu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                detailTab === 'tai_lieu'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tài liệu đính kèm
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('lich_su')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                detailTab === 'lich_su'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Lịch sử chỉnh sửa
            </button>
          </div>

          {/* Tab content */}
          {detailTab === 'tong_quan' && (
            <div className="space-y-3.5 text-xs">
              {/* Thông tin nhiệm kỳ */}
              <div>
                <h4 className="font-bold text-slate-800 text-[11.5px] mb-1.5">Thông tin nhiệm kỳ</h4>
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Năm bắt đầu:</span>
                    <strong className="text-slate-900">
                      {selectedProgram?.term_start_year || (selectedProgram?.nhiem_ky ? selectedProgram.nhiem_ky.split('-')[0]?.trim() : '2025')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Năm kết thúc:</span>
                    <strong className="text-slate-900">
                      {selectedProgram?.term_end_year || (selectedProgram?.nhiem_ky ? selectedProgram.nhiem_ky.split('-')[1]?.trim() : '2030')}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Hiển thị trên danh sách</span>
                    <strong className="text-blue-700 font-bold">
                      {selectedProgram?.term_start_year && selectedProgram?.term_end_year
                        ? `${selectedProgram.term_start_year} – ${selectedProgram.term_end_year}`
                        : (selectedProgram?.nhiem_ky || '2025 – 2030')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Nội dung chương trình */}
              <div>
                <h4 className="font-bold text-slate-800 text-[11.5px] mb-1">Nội dung chương trình</h4>
                <p className="text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-slate-200 text-[11.5px]">
                  {selectedProgram?.noi_dung || 'Chưa có nội dung chi tiết.'}
                </p>
              </div>

              {/* Tài liệu đính kèm */}
              <div>
                <h4 className="font-bold text-slate-800 text-[11.5px] mb-1">Tài liệu văn bản gốc</h4>
                {selectedProgram?.file_pdf_ten ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-xs truncate max-w-[170px]" title={selectedProgram.file_pdf_ten}>
                          {selectedProgram.file_pdf_ten}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatFileSize(selectedProgram.file_pdf_dung_luong)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProgram) setViewingDocItem(selectedProgram);
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700 flex items-center space-x-1 shrink-0 font-medium cursor-pointer transition shadow-2xs"
                    >
                      <Eye className="w-3 h-3 text-blue-600" />
                      <span>Xem</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-amber-50/70 rounded-lg border border-amber-200/80">
                    <span className="text-amber-900 text-xs italic">Chưa đính kèm tệp văn bản gốc.</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProgram) handleSelectForEdit(selectedProgram);
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-2xs transition"
                    >
                      + Bổ sung văn bản gốc
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {detailTab === 'tai_lieu' && (
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Tệp đính kèm gốc của chương trình:</span>
                {selectedProgram?.file_pdf_ten ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="text-red-700 font-semibold truncate max-w-[200px]" title={selectedProgram.file_pdf_ten}>
                        {selectedProgram.file_pdf_ten}
                      </span>
                      {selectedProgram.file_pdf_dung_luong && (
                        <span className="text-[10px] text-slate-400">({formatFileSize(selectedProgram.file_pdf_dung_luong)})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => selectedProgram && setViewingDocItem(selectedProgram)}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-medium cursor-pointer transition shadow-2xs shrink-0"
                    >
                      Xem trực tiếp
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 italic">Chưa tải tệp PDF đính kèm.</span>
                    <button
                      type="button"
                      onClick={() => selectedProgram && handleSelectForEdit(selectedProgram)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-2xs transition"
                    >
                      + Bổ sung văn bản gốc
                    </button>
                  </div>
                )}
              </div>

              {selectedProgram?.danh_sach_thay_doi_bo_sung && selectedProgram.danh_sach_thay_doi_bo_sung.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Văn bản điều chỉnh, bổ sung:</span>
                  {selectedProgram.danh_sach_thay_doi_bo_sung.map((td) => (
                    <div key={td.id} className="p-2 bg-amber-50 rounded border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-amber-950">{td.so_van_ban}</span>
                        <span className="text-[10px] text-slate-500 ml-2">({td.ten_don_vi})</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {td.file_pdf_ten && <span className="text-[10px] text-red-700 font-semibold">{td.file_pdf_ten}</span>}
                        <button
                          type="button"
                          onClick={() => handlePreviewThayDoi(td)}
                          className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded font-medium cursor-pointer"
                        >
                          Xem tệp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {detailTab === 'lich_su' && (
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">Khởi tạo chương trình</div>
                <div className="text-[10px] text-slate-500">
                  Thời gian: {selectedProgram?.created_at ? new Date(selectedProgram.created_at).toLocaleDateString('vi-VN') : '15/08/2025'}
                </div>
                <div className="text-slate-600">Ban hành bởi: {selectedProgram?.co_quan_ban_hanh || selectedProgram?.chu_the}</div>
              </div>

              {(selectedProgram?.danh_sach_thay_doi_bo_sung || []).map((td, i) => (
                <div key={td.id} className="p-2.5 bg-amber-50/70 rounded-lg border border-amber-200 space-y-1">
                  <div className="font-bold text-amber-900">Đợt điều chỉnh #{i + 1}: {td.so_van_ban}</div>
                  <div className="text-[10px] text-slate-500">Ngày: {td.ngay_ban_hanh} — Địa bàn: {td.ten_don_vi}</div>
                  <div className="text-slate-700">{td.noi_dung_dieu_chinh}</div>
                </div>
              ))}
            </div>
          )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* ── GIAO DIỆN CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT NĂM (6 PHẦN A, B, C, D, E, F) ───────── */}
      {activeTab === 'HANG_NAM' && (
        <div className="space-y-4">
          {/* ══════════════════════════════════════════════════════════════════════════════
              PHẦN A. TỔNG QUAN TIẾN ĐỘ THỰC HIỆN (MÀU SẮC NHẸ NHÀNG, DỊU MẮT, THANH LỊCH)
          ══════════════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <span>TỔNG QUAN TIẾN ĐỘ THỰC HIỆN</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {filterNam === 'ALL' ? 'Tất cả các năm' : `Năm ${filterNam}`}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Theo dõi số lượng, tỷ lệ hoàn thành chung và tiến độ thực tế so với kế hoạch
                  </p>
                </div>
              </div>

              {/* Tỷ lệ hoàn thành chung của năm (KPI Badge nhẹ nhàng) */}
              <div className="flex items-center space-x-3 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-medium block">Tỷ lệ hoàn thành chung</span>
                  <strong className="text-sm font-black text-emerald-700">
                    {statsHangNam.tyLeHoanThanh}%
                  </strong>
                </div>
                <div className="w-16 bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${statsHangNam.tyLeHoanThanh}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 6 Thẻ số liệu tổng quan tiến độ (Phần A - Tông màu Pastel nhẹ nhàng) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* 1. Tổng số chương trình */}
              <button
                type="button"
                onClick={() => {
                  setFilterHnTrangThai('ALL');
                  setHnProgressFilter('ALL');
                  setCurrentPageHn(1);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  filterHnTrangThai === 'ALL' && hnProgressFilter === 'ALL'
                    ? 'bg-slate-100/90 border-slate-400 ring-2 ring-slate-300 shadow-xs'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Tổng số CT</span>
                  <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-800">{statsHangNam.total}</span>
                  <span className="text-[10.5px] text-slate-500">nhiệm vụ</span>
                </div>
              </button>

              {/* 2. Đã hoàn thành */}
              <button
                type="button"
                onClick={() => {
                  setFilterHnTrangThai('DA_HOAN_THANH');
                  setHnProgressFilter('ALL');
                  setCurrentPageHn(1);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  filterHnTrangThai === 'DA_HOAN_THANH'
                    ? 'bg-teal-100/80 border-teal-400 ring-2 ring-teal-300 shadow-xs text-teal-950'
                    : 'bg-teal-50/50 hover:bg-teal-50/90 border-teal-200/80 text-teal-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-teal-800">Đã hoàn thành</span>
                  <div className="w-6 h-6 rounded-md bg-teal-100/80 text-teal-700 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-teal-700">{statsHangNam.daHoanThanh}</span>
                  <span className="text-[10.5px] text-teal-600 font-medium">
                    ({statsHangNam.total > 0 ? Math.round((statsHangNam.daHoanThanh / statsHangNam.total) * 100) : 0}%)
                  </span>
                </div>
              </button>

              {/* 3. Đang thực hiện */}
              <button
                type="button"
                onClick={() => {
                  setFilterHnTrangThai('DANG_THUC_HIEN');
                  setHnProgressFilter('DANG_THUC_HIEN_DUNG_HAN');
                  setCurrentPageHn(1);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  filterHnTrangThai === 'DANG_THUC_HIEN'
                    ? 'bg-emerald-100/80 border-emerald-400 ring-2 ring-emerald-300 shadow-xs text-emerald-950'
                    : 'bg-emerald-50/50 hover:bg-emerald-50/90 border-emerald-200/80 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800">Đang thực hiện</span>
                  <div className="w-6 h-6 rounded-md bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-emerald-700">{statsHangNam.dangThucHien}</span>
                  <span className="text-[10.5px] text-emerald-600 font-medium">đang làm</span>
                </div>
              </button>

              {/* 4. Chưa thực hiện */}
              <button
                type="button"
                onClick={() => {
                  setFilterHnTrangThai('CHUA_THUC_HIEN');
                  setHnProgressFilter('ALL');
                  setCurrentPageHn(1);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  filterHnTrangThai === 'CHUA_THUC_HIEN'
                    ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-300 shadow-xs text-amber-950'
                    : 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/80 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-800">Chưa thực hiện</span>
                  <div className="w-6 h-6 rounded-md bg-amber-100/80 text-amber-700 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-amber-700">{statsHangNam.chuaThucHien}</span>
                  <span className="text-[10.5px] text-amber-600 font-medium">chưa làm</span>
                </div>
              </button>

              {/* 5. Quá hạn cần chú ý */}
              <button
                type="button"
                onClick={() => {
                  setHnProgressFilter('QUA_HAN');
                  setFilterHnTrangThai('ALL');
                  setCurrentPageHn(1);
                }}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  hnProgressFilter === 'QUA_HAN'
                    ? 'bg-rose-100/80 border-rose-400 ring-2 ring-rose-300 shadow-xs text-rose-950'
                    : 'bg-rose-50/50 hover:bg-rose-50/90 border-rose-200/80 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-rose-800">Quá hạn</span>
                  <div className="w-6 h-6 rounded-md bg-rose-100/80 text-rose-700 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-rose-700">{statsHangNam.quaHan}</span>
                  <span className="text-[10.5px] text-rose-600 font-bold">cần xử lý</span>
                </div>
              </button>

              {/* 6. Tỷ lệ hoàn thành chung */}
              <div className="p-3 rounded-xl border border-indigo-200/80 bg-indigo-50/40 text-indigo-950 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-800">Tiến độ chung</span>
                  <div className="w-6 h-6 rounded-md bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-indigo-800">
                    {statsHangNam.daHoanThanh}/{statsHangNam.total}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">{statsHangNam.tyLeHoanThanh}%</span>
                </div>
              </div>
            </div>

            {/* Tiến độ thực hiện theo Quý / Tháng: So sánh Kế hoạch với Kết quả thực tế */}
            <div className="mt-2.5 pt-2.5 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Tiến độ thực hiện: So sánh Kế hoạch với Kết quả thực tế
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (Xám xanh: Kế hoạch | Xanh lá nhẹ: Hoàn thành thực tế)
                  </span>
                </div>

                <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimeViewMode('QUY')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      timeViewMode === 'QUY'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Theo Quý (I - IV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeViewMode('THANG')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      timeViewMode === 'THANG'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Theo Tháng (1 - 12)
                  </button>
                </div>
              </div>

              {timeViewMode === 'QUY' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {statsHangNam.tienDoQuy.map((q) => {
                    const percent = q.keHoach > 0 ? Math.min(100, Math.round((q.thucTe / q.keHoach) * 100)) : 0;
                    return (
                      <div key={q.quy} className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
                          <span>{q.quy}</span>
                          <span className="text-[11px] font-bold text-emerald-700">{percent}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                          <span>Kế hoạch: <strong className="text-slate-700">{q.keHoach}</strong></span>
                          <span>Thực tế: <strong className="text-emerald-700">{q.thucTe}</strong></span>
                        </div>
                        {/* Thanh so sánh kép */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-1.5 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                            title={`Đã hoàn thành: ${q.thucTe}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {statsHangNam.tienDoThang.map((m) => {
                    const percent = m.keHoach > 0 ? Math.min(100, Math.round((m.thucTe / m.keHoach) * 100)) : 0;
                    return (
                      <div key={m.thang} className="p-2 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] mb-1">
                          <span>{m.thang}</span>
                          <span className="text-[10px] text-slate-500">{m.thucTe}/{m.keHoach}</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════
              PHẦN B. THỐNG KÊ CHƯƠNG TRÌNH ĐA CHIỀU (BÊN DƯỚI PHẦN A)
          ══════════════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center justify-center font-bold text-xs">
                B
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span>THỐNG KÊ CHƯƠNG TRÌNH THEO CÁC TIÊU CHÍ</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    (Nhấp vào thẻ để lọc nhanh danh sách)
                  </span>
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              {/* B1. Theo Loại hình */}
              <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="font-bold text-slate-700 text-[11.5px] mb-2 flex items-center gap-1.5">
                  <PieChart className="w-3.5 h-3.5 text-blue-600" />
                  <span>Theo Loại hình</span>
                </span>
                <div className="space-y-1.5">
                  <div
                    onClick={() => {
                      setFilterHnLoaiHinh('KIEM_TRA');
                      setCurrentPageHn(1);
                    }}
                    className={`flex items-center justify-between p-1.5 rounded-lg border transition cursor-pointer ${
                      filterHnLoaiHinh === 'KIEM_TRA'
                        ? 'bg-blue-100/70 border-blue-300 font-bold text-blue-900'
                        : 'bg-white hover:bg-slate-100/70 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Kiểm tra</span>
                    <strong className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                      {statsHangNam.kiemTra}
                    </strong>
                  </div>

                  <div
                    onClick={() => {
                      setFilterHnLoaiHinh('GIAM_SAT');
                      setCurrentPageHn(1);
                    }}
                    className={`flex items-center justify-between p-1.5 rounded-lg border transition cursor-pointer ${
                      filterHnLoaiHinh === 'GIAM_SAT'
                        ? 'bg-purple-100/70 border-purple-300 font-bold text-purple-900'
                        : 'bg-white hover:bg-slate-100/70 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Giám sát</span>
                    <strong className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs">
                      {statsHangNam.giamSat}
                    </strong>
                  </div>
                </div>
              </div>

              {/* B2. Theo Cơ quan ban hành (4 CƠ QUAN CÓ THỂ TÙY CHỈNH) */}
              <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 text-[11.5px] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Theo Cơ quan ban hành</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTempCoQuanList([...customCoQuanList]);
                      setIsEditingCoQuanModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 transition cursor-pointer"
                    title="Bấm để tùy chỉnh tên 4 cơ quan ban hành"
                  >
                    <Settings className="w-3 h-3 text-slate-500" />
                    <span>Tùy chỉnh</span>
                  </button>
                </div>
                <div className="space-y-1">
                  {customCoQuanList.map((cq) => {
                    const count = statsHangNam.theoCoQuan[cq] || 0;
                    return (
                      <div
                        key={cq}
                        onClick={() => {
                          setFilterHnChuThe(cq);
                          setCurrentPageHn(1);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg border transition cursor-pointer text-[11.5px] ${
                          filterHnChuThe === cq
                            ? 'bg-emerald-100/70 border-emerald-300 font-bold text-emerald-950'
                            : 'bg-white hover:bg-slate-100/70 border-slate-200 text-slate-700'
                        }`}
                        title={cq}
                      >
                        <span className="truncate max-w-[170px]">{cq.replace(' phường', '')}</span>
                        <strong className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px]">
                          {count}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* B3. Theo Lĩnh vực (6 lĩnh vực) */}
              <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 md:col-span-1 lg:col-span-2 flex flex-col justify-between">
                <span className="font-bold text-slate-700 text-[11.5px] mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                  <span>Theo 6 Lĩnh vực kiểm tra, giám sát</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {DANH_MUC_LINH_VUC.map((lv) => {
                    const count = statsHangNam.theoLinhVuc[lv] || 0;
                    return (
                      <div
                        key={lv}
                        onClick={() => {
                          setFilterHnLinhVuc(lv);
                          setCurrentPageHn(1);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg border transition cursor-pointer text-[11px] ${
                          filterHnLinhVuc === lv
                            ? 'bg-amber-100/70 border-amber-300 font-bold text-amber-950'
                            : 'bg-white hover:bg-slate-100/70 border-slate-200 text-slate-700'
                        }`}
                        title={lv}
                      >
                        <span className="truncate max-w-[150px]">{lv}</span>
                        <strong className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10.5px]">
                          {count}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════
              BỐ CỤC CHÍNH 2 CỘT: CỘT TRÁI (D + C + F) & CỘT PHẢI (E. THEO DÕI TIẾN ĐỘ)
          ══════════════════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* ── CỘT TRÁI: PHẦN D (BỘ LỌC & TÌM KIẾM) + PHẦN C (DANH SÁCH BẢNG) ── */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-3.5">
              {/* ══════════════════════════════════════════════════════════════════════════════
                  PHẦN D. BỘ LỌC VÀ TÌM KIẾM + PHẦN F. THAO TÁC DỮ LIỆU
              ══════════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold text-xs">
                      D
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Bộ lọc & Tìm kiếm chương trình
                    </span>
                    {hnProgressFilter !== 'ALL' && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                        Đang lọc: {
                          hnProgressFilter === 'CHUA_TRIEN_KHAI' ? 'Chưa triển khai' :
                          hnProgressFilter === 'SAP_DEN_HAN' ? 'Sắp đến hạn' :
                          hnProgressFilter === 'DANG_THUC_HIEN_DUNG_HAN' ? 'Đang thực hiện' :
                          hnProgressFilter === 'QUA_HAN' ? 'Quá hạn' : 'Thiếu văn bản'
                        }
                      </span>
                    )}
                  </div>

                  {/* Nút Phần F: Thao tác & Quản lý dữ liệu tích hợp */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Nhập file Excel nhiều cái 1 lần */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setIsHnImportExcelOpen(true)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300 transition cursor-pointer shadow-2xs"
                        title="Nhập hàng loạt chương trình kiểm tra, giám sát từ tệp Excel (.xlsx, .csv)"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Nhập Excel</span>
                      </button>
                    )}

                    {/* Xuất file Excel / CSV có menu tùy chọn định dạng */}
                    <div className="relative inline-block text-left" ref={exportMenuRef}>
                      <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleExportHn('xlsx')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                          title="Xuất danh sách ra file Excel (.xlsx) chuẩn"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Xuất Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen((prev) => !prev)}
                          className="px-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border-l border-slate-200 transition cursor-pointer"
                          title="Tùy chọn định dạng xuất (.xlsx / .csv)"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {isExportMenuOpen && (
                        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-fadeIn text-xs">
                          <button
                            type="button"
                            onClick={() => handleExportHn('xlsx')}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 flex items-center space-x-2 transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <div>
                              <p className="font-bold">File Excel (.xlsx)</p>
                              <p className="text-[10px] text-slate-400">Bảng tính Excel chuẩn (.xlsx)</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportHn('csv')}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center space-x-2 transition cursor-pointer border-t border-slate-100"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="font-semibold">File CSV UTF-8 (.csv)</p>
                              <p className="text-[10px] text-slate-400">Mở trên Excel không lỗi tiếng Việt</p>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* In sổ */}
                    <button
                      type="button"
                      onClick={handlePrintDoc}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition cursor-pointer"
                      title="In sổ chương trình kiểm tra, giám sát"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>In sổ</span>
                    </button>

                    {/* Thêm chương trình mới */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleOpenAddHn}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm CT Mới</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Các trường lọc Phần D */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {/* 1. Năm thực hiện */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Năm:</label>
                    <select
                      value={filterNam}
                      onChange={(e) => {
                        setFilterNam(e.target.value);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-slate-50 text-slate-900 font-bold border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả năm</option>
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          Năm {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Cơ quan ban hành (ƯU TIÊN 4 CƠ QUAN TÙY CHỈNH) */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Cơ quan:</label>
                    <select
                      value={filterHnChuThe}
                      onChange={(e) => {
                        setFilterHnChuThe(e.target.value);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả cơ quan</option>
                      <optgroup label="4 Cơ quan ban hành cấu hình">
                        {customCoQuanList.map((cq) => (
                          <option key={cq} value={cq}>
                            {cq}
                          </option>
                        ))}
                      </optgroup>
                      {allDonVi.length > 0 && (
                        <optgroup label="Đơn vị từ Cơ cấu tổ chức">
                          {allDonVi
                            .filter((d) => !customCoQuanList.includes(d.ten))
                            .map((d) => (
                              <option key={d.id} value={d.ten}>
                                {d.ten}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* 3. Loại hình */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Loại hình:</label>
                    <select
                      value={filterHnLoaiHinh}
                      onChange={(e) => {
                        setFilterHnLoaiHinh(e.target.value as 'ALL' | LoaiHinhKtGs);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả loại hình</option>
                      <option value="KIEM_TRA">Kiểm tra</option>
                      <option value="GIAM_SAT">Giám sát</option>
                    </select>
                  </div>

                  {/* 4. Lĩnh vực (6 lĩnh vực) */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Lĩnh vực:</label>
                    <select
                      value={filterHnLinhVuc}
                      onChange={(e) => {
                        setFilterHnLinhVuc(e.target.value);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả lĩnh vực</option>
                      {DANH_MUC_LINH_VUC.map((lv) => (
                        <option key={lv} value={lv}>
                          {lv}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Đơn vị được KT-GS */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Đơn vị KT-GS:</label>
                    <select
                      value={filterHnDonVi}
                      onChange={(e) => {
                        setFilterHnDonVi(e.target.value);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả đơn vị</option>
                      {statsHangNam.theoDonVi.map((d) => (
                        <option key={d.ten} value={d.ten}>
                          {d.ten} ({d.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 6. Trạng thái thực hiện */}
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Trạng thái:</label>
                    <select
                      value={filterHnTrangThai}
                      onChange={(e) => {
                        setFilterHnTrangThai(e.target.value as 'ALL' | TrangThaiKtGs);
                        setCurrentPageHn(1);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="DANG_THUC_HIEN">Đang thực hiện</option>
                      <option value="CHUA_THUC_HIEN">Chưa thực hiện</option>
                      <option value="DA_HOAN_THANH">Đã hoàn thành</option>
                      <option value="QUA_HAN">Quá hạn</option>
                    </select>
                  </div>
                </div>

                {/* Hàng tìm kiếm tức thời & nút xóa lọc */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPageHn(1);
                      }}
                      placeholder="Tìm kiếm nhanh theo tên chương trình, số văn bản, đối tượng hoặc nội dung..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
                    />
                  </div>

                  {(filterNam !== 'ALL' ||
                    filterHnChuThe !== 'ALL' ||
                    filterHnLoaiHinh !== 'ALL' ||
                    filterHnLinhVuc !== 'ALL' ||
                    filterHnDonVi !== 'ALL' ||
                    filterHnTrangThai !== 'ALL' ||
                    hnProgressFilter !== 'ALL' ||
                    searchQuery) && (
                    <button
                      type="button"
                      onClick={handleClearHnFilter}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Xóa toàn bộ lọc</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════════════
                  PHẦN C. DANH SÁCH CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT (10 CỘT CHUẨN)
              ══════════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                      C
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Danh sách chương trình kiểm tra, giám sát
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Tổng cộng: <strong>{filteredHangNamList.length}</strong> chương trình
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-[#f8fafc] border-b border-slate-200 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-2 w-10 text-center">STT</th>
                        <th className="py-3 px-3 w-36 text-center">NĂM / SỐ VB</th>
                        <th className="py-3 px-3 w-40">CƠ QUAN BAN HÀNH</th>
                        <th className="py-3 px-2 w-28 text-center">LOẠI HÌNH</th>
                        <th className="py-3 px-3 w-48">ĐỐI TƯỢNG KT-GS</th>
                        <th className="py-3 px-4 min-w-[220px]">NỘI DUNG KIỂM TRA, GIÁM SÁT</th>
                        <th className="py-3 px-3 w-32">THỜI GIAN</th>
                        <th className="py-3 px-3 w-32 text-center">TRẠNG THÁI</th>
                        <th className="py-3 px-3 w-36 text-center">VĂN BẢN ĐÍNH KÈM</th>
                        <th className="py-3 px-3 w-28 text-center">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400">
                            <span className="inline-block animate-spin mr-2">⟳</span>
                            Đang nạp dữ liệu chương trình kiểm tra, giám sát...
                          </td>
                        </tr>
                      ) : filteredHangNamList.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400">
                            Không tìm thấy chương trình nào phù hợp với bộ lọc hiện tại. Vui lòng bấm &quot;Xóa toàn bộ lọc&quot; để hiển thị lại.
                          </td>
                        </tr>
                      ) : (
                        filteredHangNamList
                          .slice((currentPageHn - 1) * pageSizeHn, currentPageHn * pageSizeHn)
                          .map((item, idx) => {
                            const rowStt = (currentPageHn - 1) * pageSizeHn + idx + 1;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition">
                                {/* 1. STT */}
                                <td className="py-3.5 px-2 text-center text-slate-500 font-mono text-xs font-semibold">
                                  {rowStt}
                                </td>

                                {/* 2. NĂM / SỐ VĂN BẢN */}
                                <td className="py-3.5 px-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                      Năm {item.nam}
                                    </span>
                                    {item.so_van_ban ? (
                                      <span className="font-mono text-xs font-bold text-slate-800">
                                        {item.so_van_ban}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Chưa có số VB</span>
                                    )}
                                  </div>
                                </td>

                                {/* 3. CƠ QUAN BAN HÀNH */}
                                <td className="py-3.5 px-3 font-semibold text-slate-800 text-xs">
                                  {item.chu_the || item.co_quan_ban_hanh}
                                </td>

                                {/* 4. LOẠI HÌNH */}
                                <td className="py-3.5 px-2 text-center">
                                  {renderLoaiHinhBadge(item.loai_hinh)}
                                </td>

                                {/* 5. ĐỐI TƯỢNG KT-GS (KÈM TAG LĨNH VỰC) */}
                                <td className="py-3.5 px-3">
                                  <div className="font-semibold text-slate-900 text-xs">
                                    {item.doi_tuong || 'Chi bộ trực thuộc'}
                                  </div>
                                  <div className="mt-1">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50/80 text-amber-900 border border-amber-200">
                                      {item.linh_vuc || 'Công tác xây dựng Đảng'}
                                    </span>
                                  </div>
                                </td>

                                {/* 6. NỘI DUNG KIỂM TRA, GIÁM SÁT */}
                                <td className="py-3.5 px-4 text-xs text-slate-700 leading-relaxed">
                                  <p className="line-clamp-2" title={item.noi_dung}>
                                    {item.noi_dung}
                                  </p>
                                </td>

                                {/* 7. THỜI GIAN THỰC HIỆN */}
                                <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                                  {item.ngay_bat_dau || item.ngay_ket_thuc ? (
                                    <div className="space-y-0.5 text-[11.5px]">
                                      {item.ngay_bat_dau && <div>Từ: {formatDateVn(item.ngay_bat_dau)}</div>}
                                      {item.ngay_ket_thuc && <div>Đến: {formatDateVn(item.ngay_ket_thuc)}</div>}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500">Năm {item.nam}</span>
                                  )}
                                </td>

                                {/* 8. TRẠNG THÁI */}
                                <td className="py-3.5 px-3 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    {renderTrangThaiBadge(item.trang_thai)}
                                    {item.trang_thai === 'CHUA_THUC_HIEN' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickSetDangThucHien(item);
                                        }}
                                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px] font-bold shadow-2xs transition cursor-pointer"
                                        title="Bấm để chuyển ngay sang trạng thái Đang thực hiện"
                                      >
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                        <span>Bấm: Đang TH</span>
                                      </button>
                                    )}
                                    {isChamTienDoQuaHan(item) && (
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <Clock className="w-3 h-3 text-rose-600" />
                                          <span>Quá hạn</span>
                                        </span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuickSetHoanThanh(item);
                                            }}
                                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold shadow-2xs transition cursor-pointer"
                                            title="Bấm để chuyển ngay sang trạng thái Đã hoàn thành"
                                          >
                                            <Check className="w-2.5 h-2.5" />
                                            <span>Bấm: Hoàn thành</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* 9. VĂN BẢN ĐÍNH KÈM */}
                                <td className="py-3.5 px-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingDocItem(item);
                                      }}
                                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[11px] font-semibold border border-sky-200 transition cursor-pointer shadow-2xs"
                                      title="Xem tài liệu văn bản chương trình"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                                      <span>Xem văn bản</span>
                                    </button>

                                    {item.file_pdf_ten ? (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingDocItem(item);
                                        }}
                                        className="flex items-center space-x-1 text-[10.5px] text-red-600 hover:text-red-800 cursor-pointer max-w-[135px] truncate font-medium"
                                        title={`Xem trực tiếp tệp: ${item.file_pdf_ten}`}
                                      >
                                        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                                        <span className="truncate">{item.file_pdf_ten}</span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Chưa có tệp PDF</span>
                                    )}
                                  </div>
                                </td>

                                {/* 10. THAO TÁC (XEM, SỬA, NHÂN BẢN, XÓA) */}
                                <td className="py-3.5 px-3 text-center">
                                  <div className="inline-flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingDocItem(item);
                                      }}
                                      title="Xem chi tiết chương trình"
                                      className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded transition cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditHn(item);
                                      }}
                                      title="Chỉnh sửa thông tin chương trình"
                                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateHn(item);
                                      }}
                                      title="Nhân bản chương trình này"
                                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget(item);
                                        }}
                                        title="Xóa chương trình"
                                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
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

                {/* Phân trang Chương trình Hàng năm */}
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div>
                    Hiển thị{' '}
                    <strong className="text-slate-800">
                      {filteredHangNamList.length === 0 ? 0 : (currentPageHn - 1) * pageSizeHn + 1} -{' '}
                      {Math.min(currentPageHn * pageSizeHn, filteredHangNamList.length)}
                    </strong>{' '}
                    / <strong className="text-slate-800">{filteredHangNamList.length}</strong> chương trình kiểm tra, giám sát
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      disabled={currentPageHn <= 1}
                      onClick={() => setCurrentPageHn((p) => Math.max(1, p - 1))}
                      className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {Array.from({ length: Math.max(1, Math.ceil(filteredHangNamList.length / pageSizeHn)) }).map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = pageNum === currentPageHn;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPageHn(pageNum)}
                          className={`w-7 h-7 rounded text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={currentPageHn >= Math.ceil(filteredHangNamList.length / pageSizeHn)}
                      onClick={() => setCurrentPageHn((p) => Math.min(Math.ceil(filteredHangNamList.length / pageSizeHn), p + 1))}
                      className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════════
                CỘT PHẢI: PHẦN E. THEO DÕI TIẾN ĐỘ CHI TIẾT (CẢNH BÁO TIẾN ĐỘ BÊN PHẢI - NHẸ NHÀNG)
            ══════════════════════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-xs">
                      E
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Theo dõi tiến độ chi tiết
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Cảnh báo thời hạn & tình trạng cập nhật
                      </p>
                    </div>
                  </div>

                  {hnProgressFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setHnProgressFilter('ALL');
                        setFilterHnTrangThai('ALL');
                        setCurrentPageHn(1);
                      }}
                      className="text-[10.5px] text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>

                {/* 5 Nhóm cảnh báo tiến độ chi tiết Phần E */}
                <div className="space-y-2.5">
                  {/* E1. Chưa triển khai */}
                  <div
                    onClick={() => {
                      if (hnProgressFilter === 'CHUA_TRIEN_KHAI') {
                        setHnProgressFilter('ALL');
                        setFilterHnTrangThai('ALL');
                      } else {
                        setHnProgressFilter('CHUA_TRIEN_KHAI');
                        setFilterHnTrangThai('CHUA_THUC_HIEN');
                      }
                      setCurrentPageHn(1);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      hnProgressFilter === 'CHUA_TRIEN_KHAI'
                        ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300 text-slate-900 shadow-xs'
                        : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold">Chưa triển khai</span>
                      </div>
                      <strong className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-800">
                        {statsHangNam.tienDoChiTiet.chuaTrienKhai}
                      </strong>
                    </div>
                    <p className="text-[11px] mt-1.5 text-slate-500">
                      Chương trình trong kế hoạch chưa đến mốc triển khai
                    </p>
                  </div>

                  {/* E2. Sắp đến thời hạn thực hiện */}
                  <div
                    onClick={() => {
                      if (hnProgressFilter === 'SAP_DEN_HAN') {
                        setHnProgressFilter('ALL');
                      } else {
                        setHnProgressFilter('SAP_DEN_HAN');
                        setFilterHnTrangThai('ALL');
                      }
                      setCurrentPageHn(1);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      hnProgressFilter === 'SAP_DEN_HAN'
                        ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-300 text-amber-950 shadow-xs'
                        : 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200/80 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
                        <span className="text-xs font-bold">Sắp đến hạn thực hiện</span>
                      </div>
                      <strong className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900">
                        {statsHangNam.tienDoChiTiet.sapDenHan}
                      </strong>
                    </div>
                    <p className="text-[11px] mt-1.5 text-amber-900/80">
                      Có mốc thời gian thực hiện trong tháng {currentMonth}/{currentYear}
                    </p>
                    {statsHangNam.tienDoChiTiet.sapDenHan > 0 && canEdit && (
                      <div className="mt-2 pt-2 border-t border-amber-200/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivateAllThisMonth();
                          }}
                          className="w-full inline-flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
                          title="Bấm để kích hoạt chuyển sang Đang thực hiện"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>
                            Chuyển {statsHangNam.tienDoChiTiet.sapDenHan} CT đến hạn sang Đang thực hiện
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* E3. Đang thực hiện đúng tiến độ (BẤM VÀO ĐỂ CHUYỂN SANG HIỂN THỊ CÁC CT ĐANG THỰC HIỆN) */}
                  <div
                    onClick={() => {
                      if (hnProgressFilter === 'DANG_THUC_HIEN_DUNG_HAN') {
                        setHnProgressFilter('ALL');
                        setFilterHnTrangThai('ALL');
                      } else {
                        setHnProgressFilter('DANG_THUC_HIEN_DUNG_HAN');
                        setFilterHnTrangThai('DANG_THUC_HIEN');
                      }
                      setCurrentPageHn(1);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      hnProgressFilter === 'DANG_THUC_HIEN_DUNG_HAN' || filterHnTrangThai === 'DANG_THUC_HIEN'
                        ? 'bg-emerald-100/80 border-emerald-400 ring-2 ring-emerald-300 text-emerald-950 shadow-xs'
                        : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/80 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold">Đang thực hiện đúng tiến độ</span>
                      </div>
                      <strong className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-200 text-emerald-900">
                        {statsHangNam.tienDoChiTiet.dangThucHienDungHan}
                      </strong>
                    </div>
                    <p className="text-[11px] mt-1.5 text-emerald-900/80">
                      Đoàn kiểm tra, tổ giám sát đang tiến hành trong hạn quy định (Bấm để xem)
                    </p>
                  </div>

                  {/* E4. Chậm tiến độ hoặc quá hạn */}
                  <div
                    onClick={() => {
                      if (hnProgressFilter === 'QUA_HAN') {
                        setHnProgressFilter('ALL');
                        setFilterHnTrangThai('ALL');
                      } else {
                        setHnProgressFilter('QUA_HAN');
                        setFilterHnTrangThai('ALL');
                      }
                      setCurrentPageHn(1);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      hnProgressFilter === 'QUA_HAN'
                        ? 'bg-rose-100/80 border-rose-400 ring-2 ring-rose-300 text-rose-950 shadow-xs'
                        : 'bg-rose-50/40 hover:bg-rose-50/80 border-rose-200/80 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span className="text-xs font-bold">Chậm tiến độ / Quá hạn</span>
                      </div>
                      <strong className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-200 text-rose-900">
                        {statsHangNam.tienDoChiTiet.chamTienDoQuaHan}
                      </strong>
                    </div>
                    <p className="text-[11px] mt-1.5 text-rose-900/80">
                      Đã quá mốc thời gian quy định nhưng chưa xác nhận hoàn thành
                    </p>
                    {statsHangNam.tienDoChiTiet.chamTienDoQuaHan > 0 && canEdit && (
                      <div className="mt-2 pt-2 border-t border-rose-200/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteAllOverdue();
                          }}
                          className="w-full inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Hoàn thành tất cả cuộc quá hạn</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* E5. Đã hoàn thành nhưng chưa cập nhật đủ văn bản / kết quả */}
                  <div
                    onClick={() => {
                      if (hnProgressFilter === 'THIEU_VAN_BAN') {
                        setHnProgressFilter('ALL');
                      } else {
                        setHnProgressFilter('THIEU_VAN_BAN');
                        setFilterHnTrangThai('ALL');
                      }
                      setCurrentPageHn(1);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      hnProgressFilter === 'THIEU_VAN_BAN'
                        ? 'bg-indigo-100/80 border-indigo-400 ring-2 ring-indigo-300 text-indigo-950 shadow-xs'
                        : 'bg-indigo-50/40 hover:bg-indigo-50/80 border-indigo-200/80 text-indigo-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold">Chưa cập nhật đủ văn bản</span>
                      </div>
                      <strong className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-200 text-indigo-900">
                        {statsHangNam.tienDoChiTiet.thieuVanBan}
                      </strong>
                    </div>
                    <p className="text-[11px] mt-1.5 text-indigo-900/80">
                      Đã hoàn thành nhưng chưa đính kèm file PDF hoặc nội dung văn bản kết luận
                    </p>
                  </div>
                </div>

                {/* Hướng dẫn thao tác */}
                <div className="mt-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lưu ý nghiệp vụ kiểm tra, giám sát:</span>
                  </div>
                  <p className="leading-relaxed">
                    Sau khi kết thúc cuộc kiểm tra, giám sát, đồng chí cần bấm biểu tượng bút sửa để tải lên tệp PDF thông báo kết luận và cập nhật trạng thái <strong>Đã hoàn thành</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TÙY CHỈNH 4 CƠ QUAN BAN HÀNH (PHẦN B) ───────────────────────── */}
      {isEditingCoQuanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Tùy chỉnh 4 Cơ quan ban hành
                  </h3>
                  <p className="text-[10px] text-slate-300">
                    Cấu hình tên 4 cơ quan hiển thị ở Phần B và bộ lọc theo tổ chức của bạn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCoQuanModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleaned = tempCoQuanList.map((c, i) => c.trim() || DEFAULT_CUSTOM_CO_QUAN[i]);
                setCustomCoQuanList(cleaned);
                try {
                  localStorage.setItem('ubkt_custom_co_quan_list', JSON.stringify(cleaned));
                } catch {
                  // ignore
                }
                setIsEditingCoQuanModalOpen(false);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div className="space-y-2.5">
                {tempCoQuanList.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Cơ quan {idx + 1}:
                    </label>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const next = [...tempCoQuanList];
                        next[idx] = e.target.value;
                        setTempCoQuanList(next);
                      }}
                      placeholder={`Nhập tên cơ quan ${idx + 1}...`}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                ))}
              </div>

              {/* Gợi ý từ Cơ cấu tổ chức */}
              {allDonVi.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10.5px] font-semibold text-slate-500 block mb-1.5">
                    Gợi ý tên từ cơ cấu tổ chức (nhấp để sao chép vào cơ quan đang chọn):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {allDonVi.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          const next = [...tempCoQuanList];
                          // Điền vào ô còn trống hoặc ô thứ 4
                          const emptyIdx = next.findIndex((n) => !n.trim());
                          if (emptyIdx >= 0) {
                            next[emptyIdx] = d.ten;
                          } else {
                            next[3] = d.ten;
                          }
                          setTempCoQuanList(next);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10.5px] transition cursor-pointer"
                      >
                        + {d.ten}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTempCoQuanList([...DEFAULT_CUSTOM_CO_QUAN])}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Khôi phục mặc định
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingCoQuanModalOpen(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu cấu hình</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL XEM TRỰC TIẾP TỆP VĂN BẢN VÀ NỘI DUNG CHƯƠNG TRÌNH (DOCUMENT VIEWER) ───────── */}
      {viewingDocItem && (() => {
        const fileRawUrl = viewingDocItem.file_pdf_url || (viewingDocItem as any).url || (viewingDocItem as any).file_url;
        const isDrive = Boolean(
          (viewingDocItem as any).is_google_drive ||
          (viewingDocItem as any).google_drive_preview_url ||
          (viewingDocItem as any).google_drive_id ||
          fileRawUrl?.includes('drive.google.com')
        );

        let drivePreviewUrl: string | null = null;
        let driveOpenUrl: string | null = null;
        if (isDrive) {
          if ((viewingDocItem as any).google_drive_preview_url) {
            drivePreviewUrl = (viewingDocItem as any).google_drive_preview_url;
          } else if ((viewingDocItem as any).google_drive_id) {
            drivePreviewUrl = `https://drive.google.com/file/d/${(viewingDocItem as any).google_drive_id}/preview`;
          } else if (fileRawUrl?.includes('drive.google.com')) {
            drivePreviewUrl = fileRawUrl.replace(/\/view(\?.*)?$/, '/preview');
          }

          driveOpenUrl =
            fileRawUrl ||
            ((viewingDocItem as any).google_drive_id ? `https://drive.google.com/file/d/${(viewingDocItem as any).google_drive_id}/view` : null) ||
            drivePreviewUrl;
        }

        const blobUrl = getBlobUrlFromDataUrl(fileRawUrl);
        const fileName = viewingDocItem.file_pdf_ten || (viewingDocItem.so_van_ban ? `Văn bản ${viewingDocItem.so_van_ban}` : (viewingDocItem.ten_chuong_trinh || 'Tài liệu chương trình'));
        const fileNameLower = fileName.toLowerCase();
        const hasAttachedFile = Boolean(fileRawUrl || viewingDocItem.file_pdf_ten);
        const isPdf = fileNameLower.endsWith('.pdf') || (fileRawUrl?.startsWith('data:application/pdf') ?? false) || (!fileNameLower.includes('.') && Boolean(fileRawUrl));
        const isWord = fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
        const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
        const isImage = /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(fileNameLower) || (fileRawUrl?.startsWith('data:image/') ?? false);

        const handleOpenExternal = () => {
          if (isDrive && driveOpenUrl) {
            window.open(driveOpenUrl, '_blank');
          } else if (blobUrl) {
            window.open(blobUrl, '_blank');
          } else {
            handleDownloadPdf(viewingDocItem);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header Modal */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
                <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs border bg-white">
                    {isDrive ? (
                      <Cloud className="w-4 h-4 text-emerald-600" />
                    ) : isPdf ? (
                      <FileText className="w-4 h-4 text-red-600" />
                    ) : isWord ? (
                      <FileText className="w-4 h-4 text-blue-600" />
                    ) : isExcel ? (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate" title={fileName}>
                        {fileName}
                      </h3>
                      {isDrive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Google Drive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                      <span>{formatFileSize(viewingDocItem.file_pdf_dung_luong)}</span>
                      <span>•</span>
                      <span>
                        {viewingDocItem.loai_chuong_trinh === 'NHIEM_KY'
                          ? `Nhiệm kỳ ${viewingDocItem.nhiem_ky || '2025 - 2030'}`
                          : `Năm ${viewingDocItem.nam}`}
                      </span>
                      {viewingDocItem.ten_chi_dang_bo && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{viewingDocItem.ten_chi_dang_bo}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {/* Nút mở tab mới */}
                  {(isDrive || blobUrl) && (
                    <button
                      type="button"
                      onClick={handleOpenExternal}
                      title={isDrive ? 'Mở trực tiếp trên Google Drive trong tab mới' : 'Mở toàn màn hình tab mới'}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isDrive ? 'Mở Google Drive' : 'Mở toàn màn hình'}</span>
                    </button>
                  )}

                  {/* Nút tải về */}
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(viewingDocItem)}
                    title={`Tải tệp về máy: ${fileName}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tải về máy</span>
                  </button>

                  {/* Nút đóng */}
                  <button
                    type="button"
                    onClick={() => setViewingDocItem(null)}
                    title="Đóng bản xem trước"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Vùng xem trước tệp chính */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/50">
                {/* 1. Nếu là Google Drive */}
                {isDrive && drivePreviewUrl ? (
                  <div className="space-y-2">
                    <div className="w-full h-[540px] rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs relative">
                      <iframe
                        src={drivePreviewUrl}
                        className="w-full h-full border-0"
                        allow="autoplay"
                        title={fileName}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-emerald-50/60 border border-emerald-200/60 rounded-lg px-3 py-2">
                      <div className="flex items-center space-x-1.5 text-emerald-800">
                        <Cloud className="w-3.5 h-3.5 shrink-0" />
                        <span>Tệp được đồng bộ trên Google Drive bảo mật đám mây.</span>
                      </div>
                      {driveOpenUrl && (
                        <a
                          href={driveOpenUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-emerald-700 hover:underline inline-flex items-center space-x-1"
                        >
                          <span>Xem trên Google Drive nếu trình duyệt chặn nhúng iframe</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : isPdf && blobUrl ? (
                  /* 2. Nếu là PDF (Data URL Base64 / Blob URL / Cục bộ) */
                  <div className="space-y-2">
                    <div className="w-full h-[560px] rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs">
                      <iframe
                        src={`${blobUrl}#toolbar=1`}
                        className="w-full h-full border-0"
                        title={fileName}
                      />
                    </div>
                  </div>
                ) : isImage ? (
                  /* 3. Nếu là Hình ảnh */
                  <div className="w-full min-h-[420px] max-h-[560px] flex items-center justify-center rounded-xl overflow-hidden border border-slate-300 bg-slate-900/5 p-4 shadow-xs">
                    <img
                      src={blobUrl || fileRawUrl || ''}
                      alt={fileName}
                      className="max-h-[520px] max-w-full object-contain rounded-lg shadow-md"
                    />
                  </div>
                ) : (isWord || isExcel) ? (
                  /* 4. Nếu là Word / Excel */
                  <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 bg-slate-50">
                      {isWord ? (
                        <FileText className="w-10 h-10 text-blue-600" />
                      ) : (
                        <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                      )}
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-base font-bold text-slate-900">{fileName}</h4>
                      <p className="text-xs text-slate-500">
                        Định dạng: <strong className="uppercase">{isWord ? 'Microsoft Word' : 'Microsoft Excel'}</strong> • Dung lượng: {formatFileSize(viewingDocItem.file_pdf_dung_luong)}
                      </p>
                    </div>

                    <div className="bg-blue-50/60 border border-blue-200/70 rounded-xl p-4 max-w-lg mx-auto text-xs text-blue-900 text-left space-y-1.5 leading-relaxed">
                      <div className="flex items-center space-x-1.5 font-bold text-blue-950">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Xem và chỉnh sửa tài liệu:</span>
                      </div>
                      <p className="text-slate-600">
                        Tệp văn bản này được lưu trữ ở máy chủ nội bộ. Quý đồng chí vui lòng tải tệp về máy để mở trực tiếp bằng Microsoft Office / WPS hoặc lưu trữ qua Google Drive để đọc trực tuyến trên trình duyệt.
                      </p>
                    </div>

                    <div className="flex items-center justify-center space-x-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(viewingDocItem)}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#133863] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải tệp về máy ({formatFileSize(viewingDocItem.file_pdf_dung_luong)})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 5. Không có tệp đính kèm hoặc tệp định dạng khác */
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {hasAttachedFile ? fileName : 'Chưa đính kèm tệp PDF văn bản gốc'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {hasAttachedFile
                          ? `Dung lượng: ${formatFileSize(viewingDocItem.file_pdf_dung_luong)}`
                          : 'Chưa có tệp văn bản đính kèm.'}
                      </p>
                    </div>
                    {hasAttachedFile && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(viewingDocItem)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải tệp về máy</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Khung chi tiết Metadata của văn bản */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <Info className="w-3.5 h-3.5 text-[#133863]" />
                    <span>Thông tin hồ sơ / Thuộc tính văn bản chương trình</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Cơ quan ban hành:</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {viewingDocItem.chu_the || viewingDocItem.co_quan_ban_hanh || 'Ủy ban Kiểm tra Đảng ủy'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Áp dụng cho Chi, Đảng bộ:</span>
                        <span className="font-semibold text-slate-900">
                          {viewingDocItem.ten_chi_dang_bo || viewingDocItem.chu_the_ap_dung || 'Toàn Đảng bộ'}
                        </span>
                      </div>
                      {viewingDocItem.so_van_ban && (
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Số ký hiệu văn bản:</span>
                          <span className="font-mono font-bold text-slate-900">{viewingDocItem.so_van_ban}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Người ký / Ban hành:</span>
                        <span className="font-medium text-slate-900">
                          {viewingDocItem.nguoi_ky || viewingDocItem.chu_the || 'Ủy ban Kiểm tra Đảng ủy'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Thời gian thực hiện:</span>
                        <span className="font-semibold text-slate-900">
                          {viewingDocItem.nhiem_ky
                            ? `Nhiệm kỳ ${viewingDocItem.nhiem_ky}`
                            : `${viewingDocItem.ngay_bat_dau || '--'} đến ${viewingDocItem.ngay_ket_thuc || '--'}`}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Loại hình & Trạng thái:</span>
                        <span className="font-semibold text-slate-900">
                          {viewingDocItem.loai_hinh === 'KIEM_TRA' ? 'Kiểm tra' : 'Giám sát'} •{' '}
                          {viewingDocItem.trang_thai === 'DA_HOAN_THANH'
                            ? 'Đã hoàn thành'
                            : viewingDocItem.trang_thai === 'DANG_THUC_HIEN'
                            ? 'Đang thực hiện'
                            : viewingDocItem.trang_thai === 'QUA_HAN'
                            ? 'Quá hạn'
                            : 'Chưa thực hiện'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Dung lượng tệp:</span>
                        <span className="font-semibold text-slate-900">{formatFileSize(viewingDocItem.file_pdf_dung_luong)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Trạng thái lưu trữ:</span>
                        <span className="font-semibold text-emerald-700">
                          {isDrive ? 'Đám mây Google Drive' : 'Bộ nhớ máy chủ nội bộ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {viewingDocItem.noi_dung && (
                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 block mb-1 font-medium">Nội dung tóm tắt:</span>
                      <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-slate-800 leading-relaxed italic">
                        "{viewingDocItem.noi_dung}"
                      </p>
                    </div>
                  )}

                  {viewingDocItem.ghi_chu_pdf && (
                    <div className="text-xs text-slate-500 pt-1">
                      <span className="font-medium">Ghi chú tệp:</span> {viewingDocItem.ghi_chu_pdf}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/80">
                <span className="text-xs text-slate-500 font-mono">
                  Mã tài liệu: {viewingDocItem.id}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(viewingDocItem)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải tệp về</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingDocItem(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer transition"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL BẢNG ĐỐI CHIẾU THAY ĐỔI, BỔ SUNG CHƯƠNG TRÌNH NHIỆM KỲ ─────── */}
      {managingThayDoiItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-6 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-amber-200 shadow-inner">
                  <GitCompare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                    <span>BẢNG ĐỐI CHIẾU THAY ĐỔI, BỔ SUNG CHƯƠNG TRÌNH NHIỆM KỲ</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-400 text-slate-900">
                      Nhiệm kỳ {managingThayDoiItem.nhiem_ky || '2025 - 2030'}
                    </span>
                  </h3>
                  <p className="text-xs text-amber-200/90 mt-0.5">
                    Chương trình gốc: {managingThayDoiItem.so_van_ban ? `Số ${managingThayDoiItem.so_van_ban}` : ''} — Cơ quan ban hành: {managingThayDoiItem.chu_the}
                    {managingThayDoiItem.ten_chi_dang_bo ? ` — Áp dụng: ${managingThayDoiItem.ten_chi_dang_bo}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingThayDoiItem(null)}
                className="text-amber-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 bg-slate-50 flex-1">
              {/* Thẻ tóm tắt thông tin chương trình gốc */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-700" />
                    <span>Nội dung cơ sở của chương trình gốc</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    {managingThayDoiItem.file_pdf_ten && (
                      <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Tệp gốc: {managingThayDoiItem.file_pdf_ten}</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-serif bg-amber-50/50 p-3 rounded-lg border border-amber-100/70">
                  {managingThayDoiItem.noi_dung}
                </p>
              </div>

              {/* Thanh tiêu đề quản lý & nút nạp thêm bản ghi thay đổi bổ sung */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900">
                    Danh mục các văn bản thay đổi, bổ sung đã nạp
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {managingThayDoiItem.danh_sach_thay_doi_bo_sung?.length || 0} đợt điều chỉnh
                  </span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsAddingThayDoi(!isAddingThayDoi)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAddingThayDoi ? 'Thu gọn biểu mẫu' : 'Nạp văn bản thay đổi, bổ sung'}</span>
                  </button>
                )}
              </div>

              {/* Form nạp thay đổi bổ sung */}
              {isAddingThayDoi && (
                <form
                  onSubmit={handleSaveThayDoi}
                  className="bg-white p-5 rounded-xl border border-amber-300 shadow-sm space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-amber-700" />
                      <span>Thêm văn bản điều chỉnh, bổ sung chương trình nhiệm kỳ</span>
                    </h4>
                    <span className="text-[11px] text-amber-800 italic">
                      * Tệp PDF tải lên sẽ được tự động tổng hợp vào Kho PDF và liên kết vào Hồ sơ địa bàn
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Số ký hiệu văn bản điều chỉnh <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={tdSoVanBan}
                        onChange={(e) => setTdSoVanBan(e.target.value)}
                        placeholder="Ví dụ: 08-KH/ĐU hoặc 12-QĐ/ĐU"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ngày ban hành điều chỉnh <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={tdNgayBanHanh}
                        onChange={(e) => setTdNgayBanHanh(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Người ký văn bản
                      </label>
                      <input
                        type="text"
                        value={tdNguoiKy}
                        onChange={(e) => setTdNguoiKy(e.target.value)}
                        placeholder="Ví dụ: Bí thư Đảng ủy, Phó Bí thư..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      />
                    </div>
                  </div>

                  {/* Địa bàn áp dụng liên kết */}
                  <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-1.5">
                    <label className="block text-xs font-bold text-amber-950">
                      Địa bàn / Chi bộ áp dụng điều chỉnh (để tạo liên kết sang Hồ sơ địa bàn)
                    </label>
                    <select
                      value={tdDonViId || 'ALL_PARTY'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'ALL_PARTY') {
                          setTdDonViId(null);
                          setTdTenDonVi('Toàn Đảng bộ (28 Chi, Đảng bộ)');
                        } else {
                          setTdDonViId(val);
                          const found = allDonVi.find((d) => d.id === val);
                          if (found) setTdTenDonVi(found.ten);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700 font-medium"
                    >
                      <option value="ALL_PARTY">🏛️ Toàn Đảng bộ (Áp dụng chung 28 Chi, Đảng bộ cơ sở)</option>
                      {chiDangBoList.map((cb) => (
                        <option key={cb.id} value={cb.id}>
                          📍 {cb.ten} {cb.loai === 'DANG_BO' ? '(Đảng bộ)' : '(Chi bộ)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Đối chiếu nội dung: Gốc vs Điều chỉnh mới */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nội dung gốc tương ứng (để đối chiếu)
                      </label>
                      <textarea
                        rows={3}
                        value={tdNoiDungGoc}
                        onChange={(e) => setTdNoiDungGoc(e.target.value)}
                        placeholder="Trích dẫn nội dung theo kế hoạch/chương trình ban đầu..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nội dung thay đổi, bổ sung mới <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={tdNoiDungDieuChinh}
                        onChange={(e) => setTdNoiDungDieuChinh(e.target.value)}
                        placeholder="Nêu rõ các nội dung bổ sung, điều chỉnh mốc thời gian, bổ sung nội dung kiểm tra..."
                        required
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-y font-medium"
                      />
                    </div>
                  </div>

                  {/* Đính kèm tệp PDF văn bản điều chỉnh */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
                    <label className="block text-xs font-bold text-blue-950">
                      Tệp PDF văn bản điều chỉnh đính kèm (Tự động tổng hợp vào Kho PDF)
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleTdFileChange}
                        className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                      {tdPdfFileName && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Đã chọn: {tdPdfFileName}</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={tdGhiChu}
                      onChange={(e) => setTdGhiChu(e.target.value)}
                      placeholder="Ghi chú thêm về văn bản điều chỉnh (VD: Quyết định bổ sung đợt 1/2026)..."
                      className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingThayDoi(false)}
                      className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingThayDoi}
                      className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center space-x-1"
                    >
                      {isSavingThayDoi ? (
                        <>
                          <span className="inline-block animate-spin mr-1">⟳</span>
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Lưu văn bản thay đổi, bổ sung</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* BẢNG LIST ĐỐI CHIẾU */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200 text-xs text-slate-700 font-bold uppercase">
                      <tr>
                        <th className="py-3 px-3 w-12 text-center">Lần</th>
                        <th className="py-3 px-3 w-36">Văn bản điều chỉnh</th>
                        <th className="py-3 px-3 w-48">Địa bàn liên quan</th>
                        <th className="py-3 px-4 min-w-[280px]">Nội dung đối chiếu (Gốc ↔ Thay đổi, bổ sung)</th>
                        <th className="py-3 px-3 w-40 text-center">Tệp PDF & Kho lưu</th>
                        {canEdit && <th className="py-3 px-3 w-16 text-center">Xóa</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!managingThayDoiItem.danh_sach_thay_doi_bo_sung ||
                      managingThayDoiItem.danh_sach_thay_doi_bo_sung.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            Chưa có bản ghi thay đổi, bổ sung nào cho chương trình nhiệm kỳ này. Hãy bấm &quot;Nạp văn bản thay đổi, bổ sung&quot; ở trên để tạo bản ghi đối chiếu.
                          </td>
                        </tr>
                      ) : (
                        managingThayDoiItem.danh_sach_thay_doi_bo_sung.map((td, idx) => (
                          <tr key={td.id} className="hover:bg-amber-50/40 transition">
                            <td className="py-3 px-3 text-center font-bold font-mono text-amber-900 bg-amber-50/50">
                              #{td.lan_dieu_chinh || idx + 1}
                            </td>

                            <td className="py-3 px-3 font-mono">
                              <div className="font-bold text-slate-900 text-[12.5px]">{td.so_van_ban}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Ngày: {td.ngay_ban_hanh}</div>
                              {td.nguoi_ky && (
                                <div className="text-[11px] text-slate-400 italic">Ký: {td.nguoi_ky}</div>
                              )}
                            </td>

                            {/* Cột Địa bàn liên quan kèm Nút LINK VÀO HỒ SƠ ĐỊA BÀN */}
                            <td className="py-3 px-3">
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded font-bold text-xs bg-indigo-50 text-indigo-900 border border-indigo-200">
                                  <Building2 className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
                                  <span className="truncate max-w-[150px]" title={td.ten_don_vi || 'Toàn Đảng bộ'}>
                                    {td.ten_don_vi || 'Toàn Đảng bộ'}
                                  </span>
                                </span>

                                {td.don_vi_id && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManagingThayDoiItem(null);
                                        handleLinkToDiaBan(td.don_vi_id, td.ten_don_vi);
                                      }}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 transition cursor-pointer"
                                      title="Chuyển ngay sang xem Hồ sơ địa bàn của đơn vị này"
                                    >
                                      <MapPin className="w-3 h-3 text-blue-700" />
                                      <span>Link vào Hồ sơ địa bàn</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Nội dung đối chiếu */}
                            <td className="py-3 px-4 text-xs">
                              <div className="space-y-2">
                                {td.noi_dung_goc && (
                                  <div className="p-2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11.5px] leading-relaxed">
                                    <strong className="text-slate-800 block text-[11px] uppercase font-bold">
                                      [Chương trình gốc]:
                                    </strong>
                                    {td.noi_dung_goc}
                                  </div>
                                )}
                                <div className="p-2 rounded bg-amber-50/80 text-amber-950 border border-amber-200 text-[11.5px] leading-relaxed font-medium">
                                  <strong className="text-amber-900 block text-[11px] uppercase font-bold flex items-center gap-1">
                                    <GitCompare className="w-3.5 h-3.5 text-amber-700" />
                                    <span>[Nội dung thay đổi, bổ sung đối chiếu]:</span>
                                  </strong>
                                  {td.noi_dung_dieu_chinh}
                                </div>
                              </div>
                            </td>

                            {/* Tệp PDF & Kho PDF */}
                            <td className="py-3 px-3 text-center">
                              {td.file_pdf_ten ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewThayDoi(td)}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition cursor-pointer shadow-2xs"
                                    title="Xem trực tiếp tệp văn bản điều chỉnh này"
                                  >
                                    <Eye className="w-3 h-3 text-sky-600" />
                                    <span>Xem tệp</span>
                                  </button>
                                  <div
                                    onClick={() => handlePreviewThayDoi(td)}
                                    className="flex items-center space-x-1 text-[11px] text-red-700 hover:text-red-900 font-semibold truncate max-w-[130px] cursor-pointer"
                                    title={`Xem trực tiếp: ${td.file_pdf_ten}`}
                                  >
                                    <FileText className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                    <span className="truncate">{td.file_pdf_ten}</span>
                                  </div>
                                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Đã lưu Kho PDF</span>
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Không có file</span>
                              )}
                            </td>

                            {/* Thao tác xóa */}
                            {canEdit && (
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteThayDoi(td.id)}
                                  className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                                  title="Xóa bản ghi thay đổi này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Ủy ban Kiểm tra Đảng ủy phường Ái Quốc — Hệ thống theo dõi & đối chiếu chương trình KT-GS
              </span>
              <button
                type="button"
                onClick={() => setManagingThayDoiItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL THÊM MỚI / CHỈNH SỬA CHƯƠNG TRÌNH HÀNG NĂM (PHẦN NĂM) ──────── */}
      {isHnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-4 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 px-6 py-4 text-white flex items-center justify-between border-b-2 border-emerald-400">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-emerald-950 border border-emerald-300 flex items-center justify-center shadow">
                  <Calendar className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {editingHnItem ? 'CHỈNH SỬA CHƯƠNG TRÌNH CÔNG TÁC HÀNG NĂM' : 'THÊM MỚI CHƯƠNG TRÌNH CÔNG TÁC HÀNG NĂM'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Ủy ban Kiểm tra Đảng ủy phường Ái Quốc — Kế hoạch kiểm tra, giám sát thường niên
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHnModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveHn} className="p-6 overflow-y-auto space-y-4 text-xs">
              {hnFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hnFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Năm thực hiện */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Năm thực hiện <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={hnNam}
                    onChange={(e) => setHnNam(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loại hình */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Loại hình KT-GS <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={hnLoaiHinh}
                    onChange={(e) => setHnLoaiHinh(e.target.value as LoaiHinhKtGs)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="KIEM_TRA">Kiểm tra</option>
                    <option value="GIAM_SAT">Giám sát</option>
                  </select>
                </div>

                {/* Trạng thái */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trạng thái thực hiện
                  </label>
                  <select
                    value={hnTrangThai}
                    onChange={(e) => setHnTrangThai(e.target.value as TrangThaiKtGs)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="CHUA_THUC_HIEN">Chưa thực hiện (Mặc định)</option>
                    <option value="DANG_THUC_HIEN">Đang thực hiện</option>
                    <option value="DA_HOAN_THANH">Đã hoàn thành</option>
                    <option value="QUA_HAN">Quá hạn</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Cơ quan ban hành (Đồng bộ với cơ cấu tổ chức) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cơ quan ban hành <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={hnChuThe}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHnChuThe(val);
                      const unit = allDonVi.find((d) => d.ten === val);
                      if (unit) setHnDonViId(unit.id);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <optgroup label="Cơ quan chỉ đạo, lãnh đạo">
                      <option value="Ban Chấp hành Đảng bộ phường">Ban Chấp hành Đảng bộ phường</option>
                      <option value="Ban Thường vụ Đảng ủy phường">Ban Thường vụ Đảng ủy phường</option>
                      <option value="Ủy ban Kiểm tra Đảng ủy phường">Ủy ban Kiểm tra Đảng ủy phường</option>
                    </optgroup>
                    {allDonVi.length > 0 && (
                      <optgroup label="Đơn vị từ Cơ cấu tổ chức (Phường/Xã, Chi bộ, Đảng bộ)">
                        {allDonVi.map((d) => (
                          <option key={d.id} value={d.ten}>
                            {d.ten} {d.loai === 'CHI_BO' ? '(Chi bộ)' : d.loai === 'DANG_BO' ? '(Đảng bộ)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {hnChuThe &&
                      !['Ban Chấp hành Đảng bộ phường', 'Ban Thường vụ Đảng ủy phường', 'Ủy ban Kiểm tra Đảng ủy phường'].includes(hnChuThe) &&
                      !allDonVi.some((d) => d.ten === hnChuThe) && (
                        <option value={hnChuThe}>{hnChuThe}</option>
                      )}
                  </select>
                </div>

                {/* Lĩnh vực KT-GS (6 lĩnh vực) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lĩnh vực kiểm tra, giám sát <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={hnLinhVuc}
                    onChange={(e) => setHnLinhVuc(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {DANH_MUC_LINH_VUC.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Đối tượng KT-GS (Gợi ý từ Cơ cấu tổ chức) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đối tượng KT-GS <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="hn-modal-doi-tuong-list"
                    value={hnDoiTuong}
                    onChange={(e) => setHnDoiTuong(e.target.value)}
                    placeholder="Chọn hoặc nhập đối tượng (VD: Chi bộ Tiền Trung...)"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <datalist id="hn-modal-doi-tuong-list">
                    {allDonVi.map((d) => (
                      <option key={d.id} value={d.ten}>
                        {d.ten}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Số văn bản */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số hiệu văn bản</label>
                  <input
                    type="text"
                    value={hnSoVanBan}
                    onChange={(e) => setHnSoVanBan(e.target.value)}
                    placeholder="VD: 05-KH/UBKT"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>

                {/* Ngày ban hành */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày ban hành</label>
                  <input
                    type="date"
                    value={hnNgayBanHanh}
                    onChange={(e) => setHnNgayBanHanh(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Từ ngày */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thời gian từ ngày</label>
                  <input
                    type="date"
                    value={hnNgayBatDau}
                    onChange={(e) => setHnNgayBatDau(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Đến ngày */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={hnNgayKetThuc}
                    onChange={(e) => setHnNgayKetThuc(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Người ký */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Người ký văn bản</label>
                <input
                  type="text"
                  value={hnNguoiKy}
                  onChange={(e) => setHnNguoiKy(e.target.value)}
                  placeholder="VD: Nguyễn Văn A - Chủ nhiệm UBKT"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Nội dung tóm tắt */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nội dung tóm tắt cuộc kiểm tra, giám sát <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={hnNoiDung}
                  onChange={(e) => setHnNoiDung(e.target.value)}
                  placeholder="Nêu tóm tắt mục tiêu, nhiệm vụ và nội dung kiểm tra, giám sát..."
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-y"
                />
              </div>


              {/* Đính kèm tệp PDF */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-emerald-950 text-xs">
                    Tệp PDF đính kèm (Tự động tổng hợp vào Kho PDF điện tử)
                  </label>
                  {hnPdfFileName && (
                    <button
                      type="button"
                      onClick={handleHnExtractPdfText}
                      disabled={hnExtractingPdf}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded text-xs font-bold border border-emerald-300 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{hnExtractingPdf ? 'Đang trích xuất...' : 'Trích xuất nội dung từ PDF'}</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleHnFileChange}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 cursor-pointer"
                  />
                  {hnPdfFileName && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>{hnPdfFileName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHnRemovePdf(true);
                          setHnPdfFileName(null);
                          setHnPdfFileUrl(null);
                        }}
                        className="text-rose-600 hover:text-rose-800 text-xs cursor-pointer font-bold"
                      >
                        (Xóa tệp)
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={hnGhiChuPdf}
                  onChange={(e) => setHnGhiChuPdf(e.target.value)}
                  placeholder="Ghi chú về văn bản PDF (VD: Bản chính thức có đóng dấu)..."
                  className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHnModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={hnIsSaving}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center space-x-1"
                >
                  {hnIsSaving ? (
                    <>
                      <span className="inline-block animate-spin mr-1">⟳</span>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingHnItem ? 'Cập nhật chương trình' : 'Lưu chương trình hàng năm'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XÓA ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa chương trình</h3>
            </div>
            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa chương trình của <strong className="text-slate-800">{deleteTarget.chu_the}</strong> đối với <strong className="text-slate-800">{deleteTarget.doi_tuong}</strong>? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NHẬP HÀNG LOẠT EXCEL CHƯƠNG TRÌNH NĂM ────────────────── */}
      <ChuongTrinhImportExcelModal
        isOpen={isHnImportExcelOpen}
        existingList={list}
        onClose={() => setIsHnImportExcelOpen(false)}
        onImportSuccess={async () => {
          await loadData();
          window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
          onDataChanged?.();
        }}
        onBatchImport={handleBatchImportHn}
      />
    </div>
  );
};

export default ChuongTrinhManager;
