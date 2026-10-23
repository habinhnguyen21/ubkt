import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import type {
  DonThu,
  LoaiDonThu,
  LinhVucDonThu,
  DoiTuongLienQuanDonThu,
  PhanLoaiXuLyDonThu,
  HuongXuLyDonThu,
  TrangThaiDonThu,
  User,
} from '../types';
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Download,
  Printer,
  RefreshCw,
  X,
  FileText,
  SlidersHorizontal,
  Info,
  Check,
  Building,
} from 'lucide-react';

interface DonThuManagerProps {
  user: User;
  onDataChanged?: () => void;
}

// ── CẤU HÌNH DANH MỤC MẶC ĐỊNH ──────────────────────────────────────────────
const DEFAULT_LOAI_DON: LoaiDonThu[] = ['Khiếu nại', 'Tố cáo', 'Kiến nghị', 'Phản ánh', 'Đơn khác'];

const DEFAULT_LINH_VUC: LinhVucDonThu[] = [
  'Công tác đảng',
  'Phẩm chất đạo đức',
  'Thực hiện nhiệm vụ',
  'Quản lý kinh tế',
  'Khác',
];

const DEFAULT_DOI_TUONG: DoiTuongLienQuanDonThu[] = [
  'Tổ chức đảng',
  'Đảng viên',
  'Công dân',
  'Khác',
];

const DEFAULT_PHAN_LOAI: PhanLoaiXuLyDonThu[] = ['Thuộc thẩm quyền', 'Không thuộc thẩm quyền'];

const DEFAULT_HUONG_XU_LY: HuongXuLyDonThu[] = [
  'Xem xét giải quyết',
  'Chuyển cơ quan khác',
  'Lưu đơn',
  'Hướng dẫn trả lời',
];

const DEFAULT_TRANG_THAI: TrangThaiDonThu[] = ['Mới tiếp nhận', 'Đang xử lý', 'Đã hoàn thành', 'Quá hạn'];

// Thời hạn mặc định theo quy định (ngày)
const DEFAULT_THOI_HAN_MAP: Record<LoaiDonThu, number> = {
  'Khiếu nại': 30,
  'Tố cáo': 60,
  'Kiến nghị': 30,
  'Phản ánh': 20,
  'Đơn khác': 10,
};

const DEFAULT_CAN_BO_LIST = [
  'Đ/c Nguyễn Văn A',
  'Đ/c Trần Thị B',
  'Đ/c Lê Văn C',
];

// Màu sắc nhận diện Loại đơn
const LOAI_DON_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  'Khiếu nại': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hex: '#2563eb' },
  'Tố cáo': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', hex: '#e11d48' },
  'Kiến nghị': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#d97706' },
  'Phản ánh': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hex: '#9333ea' },
  'Đơn khác': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', hex: '#64748b' },
};

// Màu sắc Lĩnh vực
const LINH_VUC_COLORS: Record<string, string> = {
  'Công tác đảng': '#3b82f6',
  'Phẩm chất đạo đức': '#ec4899',
  'Thực hiện nhiệm vụ': '#f59e0b',
  'Quản lý kinh tế': '#10b981',
  'Khác': '#6b7280',
};

// Màu sắc Hướng xử lý
const HUONG_XU_LY_COLORS: Record<string, string> = {
  'Xem xét giải quyết': '#2563eb',
  'Chuyển cơ quan khác': '#f97316',
  'Lưu đơn': '#64748b',
  'Hướng dẫn trả lời': '#06b6d4',
};

export const DonThuManager: React.FC<DonThuManagerProps> = ({ user, onDataChanged }) => {
  const [dataList, setDataList] = useState<DonThu[]>([]);
  const [loading, setLoading] = useState(false);

  // Bộ lọc danh sách
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLoaiDon, setFilterLoaiDon] = useState<string>('ALL');
  const [filterLinhVuc, setFilterLinhVuc] = useState<string>('ALL');
  const [filterTrangThai, setFilterTrangThai] = useState<string>('ALL');
  const [filterCanBo, setFilterCanBo] = useState<string>('ALL');
  const [filterHuongXuLy, setFilterHuongXuLy] = useState<string>('ALL');
  const [kpiFilter, setKpiFilter] = useState<'ALL' | 'DANG_XU_LY' | 'DA_HOAN_THANH' | 'QUA_HAN'>('ALL');

  // Modal Thêm / Cập nhật Đơn thư (Data Entry Form)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DonThu | null>(null);

  // Modal Chi tiết
  const [viewingItem, setViewingItem] = useState<DonThu | null>(null);

  // Modal Xóa
  const [deletingItem, setDeletingItem] = useState<DonThu | null>(null);

  // Modal Cập nhật Danh mục
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [customCanBoList, setCustomCanBoList] = useState<string[]>(() => {
    const saved = localStorage.getItem('ubkt_custom_can_bo_don_thu');
    return saved ? JSON.parse(saved) : DEFAULT_CAN_BO_LIST;
  });
  const [newCanBoName, setNewCanBoName] = useState('');

  // Form State
  const [formData, setFormData] = useState<{
    ma_don: string;
    ngay_tiep_nhan: string;
    loai_don: LoaiDonThu;
    linh_vuc: LinhVucDonThu;
    linh_vuc_khac: string;
    doi_tuong_lien_quan: DoiTuongLienQuanDonThu;
    doi_tuong_khac: string;
    phan_loai_xu_ly: PhanLoaiXuLyDonThu;
    huong_xu_ly: HuongXuLyDonThu;
    thoi_han_quy_dinh: number;
    can_bo_phu_trach: string;
    trang_thai: TrangThaiDonThu;
    ngay_hoan_thanh: string;
    ghi_chu_nghiep_vu: string;
  }>({
    ma_don: '',
    ngay_tiep_nhan: new Date().toISOString().slice(0, 10),
    loai_don: 'Khiếu nại',
    linh_vuc: 'Công tác đảng',
    linh_vuc_khac: '',
    doi_tuong_lien_quan: 'Tổ chức đảng',
    doi_tuong_khac: '',
    phan_loai_xu_ly: 'Thuộc thẩm quyền',
    huong_xu_ly: 'Xem xét giải quyết',
    thoi_han_quy_dinh: 30,
    can_bo_phu_trach: 'Đ/c Nguyễn Văn A',
    trang_thai: 'Mới tiếp nhận',
    ngay_hoan_thanh: '',
    ghi_chu_nghiep_vu: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nạp dữ liệu
  const loadData = async () => {
    setLoading(true);
    try {
      const items = await api.getAllDonThu();
      setDataList(items);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đơn thư:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tính toán thời hạn và cảnh báo quá hạn cho từng đơn
  const getDeadlineInfo = (item: DonThu) => {
    if (!item.ngay_tiep_nhan) return { isOverdue: false, daysLeft: 0, deadlineStr: '' };

    const receiveDate = new Date(item.ngay_tiep_nhan);
    const deadlineDate = new Date(receiveDate);
    deadlineDate.setDate(deadlineDate.getDate() + (item.thoi_han_quy_dinh || 30));

    const deadlineStr = deadlineDate.toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Tính số ngày chênh lệch
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (item.trang_thai === 'Đã hoàn thành') {
      return {
        isOverdue: false,
        daysLeft: 0,
        deadlineStr,
        isCompleted: true,
        completionDate: item.ngay_hoan_thanh,
      };
    }

    const isOverdue = diffDays < 0;
    return {
      isOverdue,
      daysLeft: diffDays,
      deadlineStr,
      isCompleted: false,
    };
  };

  // ── PHẦN A: TỔNG QUAN TIẾN ĐỘ XỬ LÝ (4 KPI CARDS) ──────────────────────────
  const kpiStats = useMemo(() => {
    const tongSoDon = dataList.length;
    const trongKy = dataList.filter((d) => d.trong_ky !== false).length;
    const dangXuLy = dataList.filter((d) => d.trang_thai !== 'Đã hoàn thành').length;
    const daHoanThanh = dataList.filter((d) => d.trang_thai === 'Đã hoàn thành').length;

    // Đơn quá hạn cần chú ý: trạng thái chưa hoàn thành và đã vượt quá thời hạn quy định
    const quaHan = dataList.filter((d) => {
      if (d.trang_thai === 'Đã hoàn thành') return false;
      const { isOverdue } = getDeadlineInfo(d);
      return isOverdue || d.trang_thai === 'Quá hạn';
    }).length;

    return {
      tongSoDon,
      trongKy,
      dangXuLy,
      daHoanThanh,
      quaHan,
    };
  }, [dataList]);

  // ── PHẦN B: THỐNG KÊ THEO CÁC TIÊU CHÍ ─────────────────────────────────────
  // 1. Thống kê theo Loại đơn
  const theoLoaiDon = useMemo(() => {
    const counts: Record<string, number> = {
      'Khiếu nại': 0,
      'Tố cáo': 0,
      'Kiến nghị': 0,
      'Phản ánh': 0,
      'Đơn khác': 0,
    };
    dataList.forEach((d) => {
      counts[d.loai_don] = (counts[d.loai_don] || 0) + 1;
    });
    return counts;
  }, [dataList]);

  // 2. Thống kê theo Lĩnh vực
  const theoLinhVuc = useMemo(() => {
    const counts: Record<string, number> = {
      'Công tác đảng': 0,
      'Phẩm chất đạo đức': 0,
      'Thực hiện nhiệm vụ': 0,
      'Quản lý kinh tế': 0,
      'Khác': 0,
    };
    dataList.forEach((d) => {
      counts[d.linh_vuc] = (counts[d.linh_vuc] || 0) + 1;
    });
    return counts;
  }, [dataList]);

  // 3. Thống kê theo Hướng xử lý
  const theoHuongXuLy = useMemo(() => {
    const counts: Record<string, number> = {
      'Xem xét giải quyết': 0,
      'Chuyển cơ quan khác': 0,
      'Lưu đơn': 0,
    };
    dataList.forEach((d) => {
      counts[d.huong_xu_ly] = (counts[d.huong_xu_ly] || 0) + 1;
    });
    return counts;
  }, [dataList]);

  // 4. Thống kê theo Cán bộ phụ trách
  const theoCanBo = useMemo(() => {
    const counts: Record<string, { total: number; dangXuLy: number; daXong: number }> = {};
    customCanBoList.forEach((cb) => {
      counts[cb] = { total: 0, dangXuLy: 0, daXong: 0 };
    });
    dataList.forEach((d) => {
      if (!counts[d.can_bo_phu_trach]) {
        counts[d.can_bo_phu_trach] = { total: 0, dangXuLy: 0, daXong: 0 };
      }
      counts[d.can_bo_phu_trach].total += 1;
      if (d.trang_thai === 'Đã hoàn thành') {
        counts[d.can_bo_phu_trach].daXong += 1;
      } else {
        counts[d.can_bo_phu_trach].dangXuLy += 1;
      }
    });
    return counts;
  }, [dataList, customCanBoList]);

  // ── DANH SÁCH LỌC VÀ TÌM KIẾM ─────────────────────────────────────────────
  const filteredData = useMemo(() => {
    return dataList.filter((item) => {
      // Bộ lọc từ KPI Cards
      if (kpiFilter === 'DANG_XU_LY' && item.trang_thai === 'Đã hoàn thành') return false;
      if (kpiFilter === 'DA_HOAN_THANH' && item.trang_thai !== 'Đã hoàn thành') return false;
      if (kpiFilter === 'QUA_HAN') {
        const { isOverdue } = getDeadlineInfo(item);
        if (item.trang_thai === 'Đã hoàn thành' || (!isOverdue && item.trang_thai !== 'Quá hạn')) {
          return false;
        }
      }

      // Bộ lọc thả xuống
      if (filterLoaiDon !== 'ALL' && item.loai_don !== filterLoaiDon) return false;
      if (filterLinhVuc !== 'ALL' && item.linh_vuc !== filterLinhVuc) return false;
      if (filterTrangThai !== 'ALL' && item.trang_thai !== filterTrangThai) return false;
      if (filterCanBo !== 'ALL' && item.can_bo_phu_trach !== filterCanBo) return false;
      if (filterHuongXuLy !== 'ALL' && item.huong_xu_ly !== filterHuongXuLy) return false;

      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMa = item.ma_don.toLowerCase().includes(q);
        const matchCanBo = item.can_bo_phu_trach.toLowerCase().includes(q);
        const matchGhiChu = (item.ghi_chu_nghiep_vu || '').toLowerCase().includes(q);
        const matchLoai = item.loai_don.toLowerCase().includes(q);
        const matchLinhVuc = item.linh_vuc.toLowerCase().includes(q);
        if (!matchMa && !matchCanBo && !matchGhiChu && !matchLoai && !matchLinhVuc) {
          return false;
        }
      }

      return true;
    });
  }, [
    dataList,
    kpiFilter,
    filterLoaiDon,
    filterLinhVuc,
    filterTrangThai,
    filterCanBo,
    filterHuongXuLy,
    searchQuery,
  ]);

  // Mở Form Thêm Mới
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormErrors({});
    const defaultLoai: LoaiDonThu = 'Khiếu nại';

    setFormData({
      ma_don: '',
      ngay_tiep_nhan: new Date().toISOString().slice(0, 10),
      loai_don: defaultLoai,
      linh_vuc: 'Công tác đảng',
      linh_vuc_khac: '',
      doi_tuong_lien_quan: 'Tổ chức đảng',
      doi_tuong_khac: '',
      phan_loai_xu_ly: 'Thuộc thẩm quyền',
      huong_xu_ly: 'Xem xét giải quyết',
      thoi_han_quy_dinh: DEFAULT_THOI_HAN_MAP[defaultLoai] || 30,
      can_bo_phu_trach: customCanBoList[0] || 'Đ/c Nguyễn Văn A',
      trang_thai: 'Mới tiếp nhận',
      ngay_hoan_thanh: '',
      ghi_chu_nghiep_vu: '',
    });
    setIsFormModalOpen(true);
  };

  // Mở Form Cập Nhật
  const handleOpenEditModal = (item: DonThu) => {
    setEditingItem(item);
    setFormErrors({});
    setFormData({
      ma_don: item.ma_don,
      ngay_tiep_nhan: item.ngay_tiep_nhan,
      loai_don: item.loai_don,
      linh_vuc: (item.linh_vuc as LinhVucDonThu) || 'Khác',
      linh_vuc_khac: item.linh_vuc_khac || '',
      doi_tuong_lien_quan: (item.doi_tuong_lien_quan as DoiTuongLienQuanDonThu) || 'Khác',
      doi_tuong_khac: item.doi_tuong_khac || '',
      phan_loai_xu_ly: item.phan_loai_xu_ly,
      huong_xu_ly: item.huong_xu_ly,
      thoi_han_quy_dinh: item.thoi_han_quy_dinh,
      can_bo_phu_trach: item.can_bo_phu_trach,
      trang_thai: item.trang_thai,
      ngay_hoan_thanh: item.ngay_hoan_thanh || '',
      ghi_chu_nghiep_vu: item.ghi_chu_nghiep_vu || '',
    });
    setIsFormModalOpen(true);
  };

  // Xử lý thay đổi Loại đơn tự cập nhật thời hạn quy định gợi ý
  const handleLoaiDonChange = (loai: LoaiDonThu) => {
    const suggestedTime = DEFAULT_THOI_HAN_MAP[loai] || 30;
    setFormData((prev) => ({
      ...prev,
      loai_don: loai,
      thoi_han_quy_dinh: suggestedTime,
    }));
  };

  // Validate form
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.ngay_tiep_nhan) errs.ngay_tiep_nhan = 'Vui lòng chọn ngày tiếp nhận';
    if (!formData.loai_don) errs.loai_don = 'Vui lòng chọn loại đơn';
    if (!formData.linh_vuc) errs.linh_vuc = 'Vui lòng chọn lĩnh vực';
    if (formData.linh_vuc === 'Khác' && !formData.linh_vuc_khac.trim()) {
      errs.linh_vuc_khac = 'Vui lòng nhập nội dung chi tiết lĩnh vực khác';
    }
    if (!formData.doi_tuong_lien_quan) errs.doi_tuong_lien_quan = 'Vui lòng chọn đối tượng liên quan';
    if (formData.doi_tuong_lien_quan === 'Khác' && !formData.doi_tuong_khac.trim()) {
      errs.doi_tuong_khac = 'Vui lòng nhập nội dung chi tiết đối tượng liên quan khác';
    }
    if (!formData.phan_loai_xu_ly) errs.phan_loai_xu_ly = 'Vui lòng chọn phân loại xử lý';
    if (!formData.huong_xu_ly) errs.huong_xu_ly = 'Vui lòng chọn hướng xử lý';
    if (!formData.can_bo_phu_trach) errs.can_bo_phu_trach = 'Vui lòng chọn cán bộ phụ trách';
    if (!formData.trang_thai) errs.trang_thai = 'Vui lòng chọn trạng thái';
    if (formData.thoi_han_quy_dinh <= 0) errs.thoi_han_quy_dinh = 'Thời hạn phải lớn hơn 0 ngày';

    if (formData.trang_thai === 'Đã hoàn thành') {
      if (!formData.ngay_hoan_thanh) {
        errs.ngay_hoan_thanh = 'Vui lòng chọn ngày hoàn thành khi trạng thái là Đã hoàn thành';
      } else if (formData.ngay_tiep_nhan && formData.ngay_hoan_thanh < formData.ngay_tiep_nhan) {
        errs.ngay_hoan_thanh =
          'Ngày hoàn thành không được trước ngày tiếp nhận (ngày tiếp nhận không được sau ngày hoàn thành)';
      }
    }

    if (formData.ghi_chu_nghiep_vu && formData.ghi_chu_nghiep_vu.length > 255) {
      errs.ghi_chu_nghiep_vu = 'Ghi chú nghiệp vụ tối đa 255 ký tự';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Lưu Đơn
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const autoMa = editingItem?.ma_don || `ĐT-2026-${String(dataList.length + 1).padStart(3, '0')}`;
      const payload: Partial<DonThu> = {
        ma_don: autoMa,
        ngay_tiep_nhan: formData.ngay_tiep_nhan,
        loai_don: formData.loai_don,
        linh_vuc: formData.linh_vuc,
        linh_vuc_khac: formData.linh_vuc === 'Khác' ? formData.linh_vuc_khac.trim() : undefined,
        doi_tuong_lien_quan: formData.doi_tuong_lien_quan,
        doi_tuong_khac: formData.doi_tuong_lien_quan === 'Khác' ? formData.doi_tuong_khac.trim() : undefined,
        phan_loai_xu_ly: formData.phan_loai_xu_ly,
        huong_xu_ly: formData.huong_xu_ly,
        thoi_han_quy_dinh: Number(formData.thoi_han_quy_dinh),
        can_bo_phu_trach: formData.can_bo_phu_trach,
        trang_thai: formData.trang_thai,
        ngay_hoan_thanh: formData.trang_thai === 'Đã hoàn thành' ? formData.ngay_hoan_thanh : null,
        ghi_chu_nghiep_vu: formData.ghi_chu_nghiep_vu.trim(),
        trong_ky: true,
      };

      if (editingItem) {
        await api.updateDonThu(editingItem.id, payload, user.ho_ten);
      } else {
        await api.createDonThu(payload, user.ho_ten);
      }

      await loadData();
      setIsFormModalOpen(false);
      onDataChanged?.();
    } catch (err) {
      console.error('Lỗi khi lưu đơn thư:', err);
      alert('Không thể lưu đơn thư. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa đơn thư
  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await api.deleteDonThu(deletingItem.id, user.ho_ten);
      await loadData();
      setDeletingItem(null);
      onDataChanged?.();
    } catch (err) {
      console.error('Lỗi khi xóa đơn thư:', err);
      alert('Không thể xóa đơn thư. Vui lòng thử lại!');
    }
  };

  // Thêm cán bộ vào danh mục
  const handleAddCanBo = () => {
    if (!newCanBoName.trim()) return;
    const name = newCanBoName.trim();
    if (!customCanBoList.includes(name)) {
      const updated = [...customCanBoList, name];
      setCustomCanBoList(updated);
      localStorage.setItem('ubkt_custom_can_bo_don_thu', JSON.stringify(updated));
    }
    setNewCanBoName('');
  };

  const handleRemoveCanBo = (name: string) => {
    if (customCanBoList.length <= 1) {
      alert('Phải giữ lại ít nhất 1 cán bộ phụ trách');
      return;
    }
    const updated = customCanBoList.filter((c) => c !== name);
    setCustomCanBoList(updated);
    localStorage.setItem('ubkt_custom_can_bo_don_thu', JSON.stringify(updated));
  };

  // Xuất file CSV / Excel
  const handleExportCsv = () => {
    const headers = [
      'STT',
      'Ngày tiếp nhận',
      'Loại đơn',
      'Lĩnh vực',
      'Đối tượng liên quan',
      'Phân loại xử lý',
      'Hướng xử lý',
      'Thời hạn quy định (ngày)',
      'Hạn chót giải quyết',
      'Cán bộ phụ trách',
      'Trạng thái',
      'Ngày hoàn thành',
      'Ghi chú nghiệp vụ',
    ];

    const rows = filteredData.map((d, index) => {
      const { deadlineStr } = getDeadlineInfo(d);
      return [
        index + 1,
        `"${d.ngay_tiep_nhan}"`,
        `"${d.loai_don}"`,
        `"${d.linh_vuc === 'Khác' && d.linh_vuc_khac ? `Khác: ${d.linh_vuc_khac}` : d.linh_vuc}"`,
        `"${d.doi_tuong_lien_quan === 'Khác' && d.doi_tuong_khac ? `Khác: ${d.doi_tuong_khac}` : d.doi_tuong_lien_quan}"`,
        `"${d.phan_loai_xu_ly}"`,
        `"${d.huong_xu_ly}"`,
        d.thoi_han_quy_dinh,
        `"${deadlineStr}"`,
        `"${d.can_bo_phu_trach}"`,
        `"${d.trang_thai}"`,
        `"${d.ngay_hoan_thanh || ''}"`,
        `"${(d.ghi_chu_nghiep_vu || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `So_Theo_Doi_Don_Thu_UBKT_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // In ấn biểu mẫu
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* ── HEADER TIÊU ĐỀ PHÂN HỆ ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Quản lý Đơn thư Khiếu nại, Tố cáo, Kiến nghị & Phản ánh
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Chế độ dữ liệu tối giản
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ủy ban Kiểm tra Đảng ủy • Hệ thống theo dõi tiến độ giải quyết & cảnh báo hạn quy định tự động
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={loadData}
            title="Tải lại dữ liệu mới nhất"
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={handleExportCsv}
            title="Xuất danh sách ra file Excel / CSV"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={handlePrint}
            title="In sổ theo dõi đơn thư"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In sổ</span>
          </button>

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <span>Danh mục</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-lg shadow-sm shadow-blue-900/25 transition cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Cập nhật theo dõi đơn thư</span>
          </button>
        </div>
      </div>

      {/* ── PHẦN A: TỔNG QUAN TIẾN ĐỘ XỬ LÝ (4 KPI CARDS) ──────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              A. TỔNG QUAN TIẾN ĐỘ XỬ LÝ
            </h2>
          </div>
          {kpiFilter !== 'ALL' && (
            <button
              onClick={() => setKpiFilter('ALL')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>Xem tất cả ({kpiStats.tongSoDon})</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Tổng số đơn */}
          <div
            onClick={() => setKpiFilter('ALL')}
            className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border ${
              kpiFilter === 'ALL'
                ? 'bg-gradient-to-br from-blue-500/10 via-blue-50 to-indigo-50/40 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tổng số đơn
                </p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {kpiStats.tongSoDon}
                  </span>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    (Trong kỳ: {kpiStats.trongKy})
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1">
              <span>Đơn thư tiếp nhận toàn Đảng bộ</span>
            </p>
          </div>

          {/* Card 2: Đang xử lý */}
          <div
            onClick={() => setKpiFilter(kpiFilter === 'DANG_XU_LY' ? 'ALL' : 'DANG_XU_LY')}
            className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border ${
              kpiFilter === 'DANG_XU_LY'
                ? 'bg-gradient-to-br from-amber-500/10 via-amber-50 to-yellow-50/40 border-amber-400 ring-2 ring-amber-500/20 shadow-md'
                : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs hover:border-amber-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Đang xử lý
                </p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-extrabold text-amber-600">
                    {kpiStats.dangXuLy}
                  </span>
                  <span className="text-xs font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                    (Chưa hoàn thành)
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1">
              <span>Đang xác minh, thụ lý và xem xét</span>
            </p>
          </div>

          {/* Card 3: Đã hoàn thành */}
          <div
            onClick={() => setKpiFilter(kpiFilter === 'DA_HOAN_THANH' ? 'ALL' : 'DA_HOAN_THANH')}
            className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border ${
              kpiFilter === 'DA_HOAN_THANH'
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-green-50/40 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs hover:border-emerald-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Đã hoàn thành
                </p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-extrabold text-emerald-600">
                    {kpiStats.daHoanThanh}
                  </span>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                    (Đã kết thúc)
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-1">
              <span>Đã có kết luận, giải quyết hoặc lưu đơn</span>
            </p>
          </div>

          {/* Card 4: Quá hạn cần chú ý */}
          <div
            onClick={() => setKpiFilter(kpiFilter === 'QUA_HAN' ? 'ALL' : 'QUA_HAN')}
            className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border relative overflow-hidden ${
              kpiFilter === 'QUA_HAN'
                ? 'bg-gradient-to-br from-rose-500/15 via-rose-50 to-red-50/40 border-rose-500 ring-2 ring-rose-500/30 shadow-md'
                : 'bg-white hover:bg-rose-50/40 border-rose-200 shadow-xs hover:border-rose-400'
            }`}
          >
            {kpiStats.quaHan > 0 && (
              <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
            )}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
                  Quá hạn cần chú ý
                </p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-3xl font-extrabold text-rose-600">
                    {kpiStats.quaHan}
                  </span>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                    (Đã quá thời hạn)
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-rose-600 font-medium mt-3 pt-2.5 border-t border-rose-100 flex items-center gap-1">
              <span>Cần lãnh đạo UBKT tập trung chỉ đạo xử lý</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── PHẦN B: THỐNG KÊ THEO CÁC TIÊU CHÍ (4 BIỂU ĐỒ) ────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            B. THỐNG KÊ THEO CÁC TIÊU CHÍ
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Biểu đồ 1: Thống kê theo Loại đơn (Donut SVG) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Thống kê theo Loại đơn
                </span>
                <span className="text-[11px] font-medium text-slate-500">Biểu đồ tròn</span>
              </div>

              {/* Visual representation: Donut breakdown */}
              <div className="py-4 flex items-center justify-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {(() => {
                      const total = kpiStats.tongSoDon || 1;
                      let accumulated = 0;
                      return Object.entries(theoLoaiDon).map(([key, val]) => {
                        const percent = (val / total) * 100;
                        const strokeDasharray = `${percent} ${100 - percent}`;
                        const strokeDashoffset = -accumulated;
                        accumulated += percent;
                        const color = LOAI_DON_COLORS[key]?.hex || '#94a3b8';
                        return (
                          <circle
                            key={key}
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke={color}
                            strokeWidth="18"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-300 hover:opacity-85"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-xl font-extrabold text-slate-900">{kpiStats.tongSoDon}</span>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase">Đơn</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chú giải chi tiết */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {Object.entries(theoLoaiDon).map(([key, val]) => {
                const percent = kpiStats.tongSoDon ? Math.round((val / kpiStats.tongSoDon) * 100) : 0;
                return (
                  <div
                    key={key}
                    onClick={() => setFilterLoaiDon(filterLoaiDon === key ? 'ALL' : key)}
                    className={`flex items-center justify-between py-1 px-1.5 rounded-lg cursor-pointer transition ${
                      filterLoaiDon === key ? 'bg-blue-50 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: LOAI_DON_COLORS[key]?.hex }}
                      ></span>
                      <span className="text-slate-700">{key}:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{val}</span>
                      <span className="text-[11px] text-slate-400">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Biểu đồ 2: Thống kê theo Lĩnh vực (Bar Chart) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Thống kê theo Lĩnh vực
                </span>
                <span className="text-[11px] font-medium text-slate-500">Biểu đồ thanh</span>
              </div>

              <div className="space-y-3 py-3">
                {Object.entries(theoLinhVuc).map(([key, val]) => {
                  const maxVal = Math.max(...Object.values(theoLinhVuc), 1);
                  const barPercent = Math.round((val / maxVal) * 100);
                  const color = LINH_VUC_COLORS[key] || '#3b82f6';

                  return (
                    <div
                      key={key}
                      onClick={() => setFilterLinhVuc(filterLinhVuc === key ? 'ALL' : key)}
                      className={`cursor-pointer p-1 rounded-lg transition ${
                        filterLinhVuc === key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 truncate pr-2">{key}</span>
                        <span className="font-bold text-slate-900 shrink-0">{val} đơn</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barPercent}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Đa số tập trung vào:</span>
              <span className="font-bold text-pink-600">Phẩm chất đạo đức (6 đơn)</span>
            </div>
          </div>

          {/* Biểu đồ 3: Thống kê theo Hướng xử lý */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Thống kê theo Hướng xử lý
                </span>
                <span className="text-[11px] font-medium text-slate-500">Biểu đồ</span>
              </div>

              <div className="space-y-3 py-3">
                {Object.entries(theoHuongXuLy).map(([key, val]) => {
                  const total = kpiStats.tongSoDon || 1;
                  const percent = Math.round((val / total) * 100);
                  const color = HUONG_XU_LY_COLORS[key] || '#2563eb';

                  return (
                    <div
                      key={key}
                      onClick={() => setFilterHuongXuLy(filterHuongXuLy === key ? 'ALL' : key)}
                      className={`cursor-pointer p-1.5 rounded-xl border border-slate-100 transition ${
                        filterHuongXuLy === key ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-800">{key}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{val}</span>
                          <span className="text-[11px] text-slate-400">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Thẩm quyền giải quyết UBKT:</span>
              <span className="font-bold text-blue-700">9 đơn (60%)</span>
            </div>
          </div>

          {/* Biểu đồ 4: Thống kê theo Cán bộ phụ trách */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Cán bộ phụ trách
                </span>
                <span className="text-[11px] font-medium text-slate-500">Biểu đồ</span>
              </div>

              <div className="space-y-3 py-3">
                {Object.entries(theoCanBo).map(([name, item]) => {
                  const maxTotal = Math.max(
                    ...Object.values(theoCanBo).map((c) => c.total),
                    1
                  );
                  const barPercent = Math.round((item.total / maxTotal) * 100);

                  return (
                    <div
                      key={name}
                      onClick={() => setFilterCanBo(filterCanBo === name ? 'ALL' : name)}
                      className={`cursor-pointer p-2 rounded-xl border border-slate-100 transition ${
                        filterCanBo === name ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{name}</span>
                        </div>
                        <span className="font-extrabold text-slate-900">{item.total} đơn</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                          style={{ width: `${barPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="text-amber-700">Đang xử lý: {item.dangXuLy}</span>
                        <span className="text-emerald-700">Đã xong: {item.daXong}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Phân bổ khối lượng:</span>
              <span className="font-semibold text-indigo-700">Đồng đều</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BẢNG THEO DÕI VÀ BỘ LỌC ĐA CHIỀU ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Thanh công cụ tìm kiếm và bộ lọc */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo cán bộ, loại đơn, lĩnh vực, ghi chú..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Đếm số lượng kết quả & Nút Reset */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">
                Hiển thị: <span className="text-blue-700 font-bold">{filteredData.length}</span> / {dataList.length} đơn
              </span>
              {(filterLoaiDon !== 'ALL' ||
                filterLinhVuc !== 'ALL' ||
                filterTrangThai !== 'ALL' ||
                filterCanBo !== 'ALL' ||
                filterHuongXuLy !== 'ALL' ||
                kpiFilter !== 'ALL' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setFilterLoaiDon('ALL');
                    setFilterLinhVuc('ALL');
                    setFilterTrangThai('ALL');
                    setFilterCanBo('ALL');
                    setFilterHuongXuLy('ALL');
                    setKpiFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-medium transition cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Hàng bộ lọc thả xuống */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
            {/* Lọc Loại đơn */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loại đơn:</label>
              <select
                value={filterLoaiDon}
                onChange={(e) => setFilterLoaiDon(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả loại đơn</option>
                {DEFAULT_LOAI_DON.map((l) => (
                  <option key={l} value={l}>
                    {l} ({theoLoaiDon[l] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Lĩnh vực */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lĩnh vực:</label>
              <select
                value={filterLinhVuc}
                onChange={(e) => setFilterLinhVuc(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả lĩnh vực</option>
                {DEFAULT_LINH_VUC.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv} ({theoLinhVuc[lv] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Hướng xử lý */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Hướng xử lý:</label>
              <select
                value={filterHuongXuLy}
                onChange={(e) => setFilterHuongXuLy(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả hướng xử lý</option>
                {DEFAULT_HUONG_XU_LY.map((hx) => (
                  <option key={hx} value={hx}>
                    {hx}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Cán bộ phụ trách */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Cán bộ phụ trách:</label>
              <select
                value={filterCanBo}
                onChange={(e) => setFilterCanBo(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả cán bộ</option>
                {customCanBoList.map((cb) => (
                  <option key={cb} value={cb}>
                    {cb} ({theoCanBo[cb]?.total || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Trạng thái */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Trạng thái:</label>
              <select
                value={filterTrangThai}
                onChange={(e) => setFilterTrangThai(e.target.value)}
                className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {DEFAULT_TRANG_THAI.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3 min-w-[120px]">Tiếp nhận</th>
                <th className="py-3 px-3 min-w-[150px]">Loại & Lĩnh vực</th>
                <th className="py-3 px-3 min-w-[130px]">Đối tượng</th>
                <th className="py-3 px-3 min-w-[160px]">Phân loại / Hướng xử lý</th>
                <th className="py-3 px-3 min-w-[140px]">Cán bộ phụ trách</th>
                <th className="py-3 px-3 min-w-[150px]">Tiến độ & Hạn</th>
                <th className="py-3 px-3 min-w-[180px]">Ghi chú nghiệp vụ</th>
                <th className="py-3 px-3 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-500">Không tìm thấy đơn thư nào phù hợp với bộ lọc</p>
                    <button
                      onClick={() => {
                        setFilterLoaiDon('ALL');
                        setFilterLinhVuc('ALL');
                        setFilterTrangThai('ALL');
                        setFilterCanBo('ALL');
                        setFilterHuongXuLy('ALL');
                        setKpiFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Xóa tất cả bộ lọc để xem toàn bộ danh sách
                    </button>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const deadline = getDeadlineInfo(item);
                  const loaiStyle = LOAI_DON_COLORS[item.loai_don] || LOAI_DON_COLORS['Đơn khác'];

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        deadline.isOverdue ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* Ngày tiếp nhận */}
                      <td className="py-3 px-3 text-slate-600">
                        <div className="font-medium text-slate-800">
                          {new Date(item.ngay_tiep_nhan).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Hạn: {item.thoi_han_quy_dinh} ngày
                        </div>
                        {item.trong_ky === false && (
                          <span className="inline-block mt-1 text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Kỳ trước chuyển sang
                          </span>
                        )}
                      </td>

                      {/* Loại đơn & Lĩnh vực */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${loaiStyle.bg} ${loaiStyle.text} ${loaiStyle.border}`}
                          >
                            {item.loai_don}
                          </span>
                          <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: LINH_VUC_COLORS[item.linh_vuc] || '#94a3b8' }}
                            ></span>
                            {item.linh_vuc === 'Khác' && item.linh_vuc_khac ? `Khác: ${item.linh_vuc_khac}` : item.linh_vuc}
                          </span>
                        </div>
                      </td>

                      {/* Đối tượng liên quan */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.doi_tuong_lien_quan === 'Tổ chức đảng' ? (
                            <Building className="w-3 h-3 text-slate-500" />
                          ) : (
                            <UserIcon className="w-3 h-3 text-slate-500" />
                          )}
                          {item.doi_tuong_lien_quan === 'Khác' && item.doi_tuong_khac ? `Khác: ${item.doi_tuong_khac}` : item.doi_tuong_lien_quan}
                        </span>
                      </td>

                      {/* Phân loại & Hướng xử lý */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <span>{item.huong_xu_ly}</span>
                          </div>
                          <div
                            className={`text-[10px] font-medium ${
                              item.phan_loai_xu_ly === 'Thuộc thẩm quyền'
                                ? 'text-blue-600'
                                : 'text-slate-500'
                            }`}
                          >
                            • {item.phan_loai_xu_ly}
                          </div>
                        </div>
                      </td>

                      {/* Cán bộ phụ trách */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.can_bo_phu_trach}</span>
                        </div>
                      </td>

                      {/* Tiến độ & Cảnh báo hạn */}
                      <td className="py-3 px-3">
                        {item.trang_thai === 'Đã hoàn thành' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã hoàn thành
                            </span>
                            {item.ngay_hoan_thanh && (
                              <div className="text-[10px] text-slate-500">
                                Xong ngày: {new Date(item.ngay_hoan_thanh).toLocaleDateString('vi-VN')}
                              </div>
                            )}
                          </div>
                        ) : deadline.isOverdue || item.trang_thai === 'Quá hạn' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              Quá hạn {Math.abs(deadline.daysLeft)} ngày
                            </span>
                            <div className="text-[10px] text-rose-600">
                              Hạn chót: {new Date(deadline.deadlineStr).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : deadline.daysLeft <= 5 ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Còn {deadline.daysLeft} ngày
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Hạn: {new Date(deadline.deadlineStr).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3" />
                              {item.trang_thai} (Còn {deadline.daysLeft} ngày)
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Hạn: {new Date(deadline.deadlineStr).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Ghi chú nghiệp vụ */}
                      <td className="py-3 px-3">
                        <p
                          className="text-slate-600 text-xs truncate max-w-xs cursor-help"
                          title={item.ghi_chu_nghiep_vu || 'Không có ghi chú'}
                        >
                          {item.ghi_chu_nghiep_vu || <span className="text-slate-300 italic">Không có ghi chú</span>}
                        </p>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingItem(item)}
                            title="Xem chi tiết đơn thư"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            title="Cập nhật tiến độ / Sửa đơn"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            title="Xóa đơn thư"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DATA ENTRY FORM (THÊM / CẬP NHẬT ĐƠN THƯ) ────────────────── */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-800 to-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide">
                  CẬP NHẬT THEO DÕI ĐƠN THƯ
                </h3>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  Các trường có dấu (*) là bắt buộc • Không nhận nội dung chi tiết đơn hoặc tải tệp đính kèm
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitForm} className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* KHỐI 1: THÔNG TIN CHUNG */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    THÔNG TIN CHUNG
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ngày tiếp nhận */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ngày tiếp nhận (*) [Lịch]:
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.ngay_tiep_nhan}
                        max={
                          formData.trang_thai === 'Đã hoàn thành' && formData.ngay_hoan_thanh
                            ? formData.ngay_hoan_thanh
                            : undefined
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, ngay_tiep_nhan: val });
                          if (formErrors.ngay_tiep_nhan) {
                            setFormErrors((prev) => ({ ...prev, ngay_tiep_nhan: '' }));
                          }
                          if (
                            formData.trang_thai === 'Đã hoàn thành' &&
                            formData.ngay_hoan_thanh &&
                            val > formData.ngay_hoan_thanh
                          ) {
                            setFormErrors((prev) => ({
                              ...prev,
                              ngay_hoan_thanh:
                                'Ngày hoàn thành không được trước ngày tiếp nhận (ngày tiếp nhận không được sau ngày hoàn thành)',
                            }));
                          } else if (
                            formErrors.ngay_hoan_thanh &&
                            formData.ngay_hoan_thanh &&
                            val <= formData.ngay_hoan_thanh
                          ) {
                            setFormErrors((prev) => ({ ...prev, ngay_hoan_thanh: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                          formErrors.ngay_tiep_nhan ? 'border-rose-400' : 'border-slate-300'
                        }`}
                      />
                    </div>
                    {formErrors.ngay_tiep_nhan && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.ngay_tiep_nhan}</p>
                    )}
                  </div>

                  {/* Loại đơn */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Loại đơn (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.loai_don}
                      onChange={(e) => handleLoaiDonChange(e.target.value as LoaiDonThu)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_LOAI_DON.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lĩnh vực */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lĩnh vực (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.linh_vuc}
                      onChange={(e) => {
                        const val = e.target.value as LinhVucDonThu;
                        setFormData({
                          ...formData,
                          linh_vuc: val,
                          linh_vuc_khac: val === 'Khác' ? formData.linh_vuc_khac : '',
                        });
                        if (val !== 'Khác' && formErrors.linh_vuc_khac) {
                          setFormErrors((prev) => ({ ...prev, linh_vuc_khac: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_LINH_VUC.map((lv) => (
                        <option key={lv} value={lv}>
                          {lv}
                        </option>
                      ))}
                    </select>
                    {formData.linh_vuc === 'Khác' && (
                      <div className="mt-2 animate-fadeIn">
                        <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                          Nội dung lĩnh vực khác (*):
                        </label>
                        <input
                          type="text"
                          value={formData.linh_vuc_khac}
                          onChange={(e) => {
                            setFormData({ ...formData, linh_vuc_khac: e.target.value });
                            if (e.target.value.trim() && formErrors.linh_vuc_khac) {
                              setFormErrors((prev) => ({ ...prev, linh_vuc_khac: '' }));
                            }
                          }}
                          placeholder="Nhập nội dung lĩnh vực khác..."
                          className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                            formErrors.linh_vuc_khac
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'border-amber-300 bg-amber-50/20'
                          }`}
                        />
                        {formErrors.linh_vuc_khac && (
                          <p className="text-[11px] text-rose-600 mt-1">{formErrors.linh_vuc_khac}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Đối tượng liên quan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đối tượng liên quan (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.doi_tuong_lien_quan}
                      onChange={(e) => {
                        const val = e.target.value as DoiTuongLienQuanDonThu;
                        setFormData({
                          ...formData,
                          doi_tuong_lien_quan: val,
                          doi_tuong_khac: val === 'Khác' ? formData.doi_tuong_khac : '',
                        });
                        if (val !== 'Khác' && formErrors.doi_tuong_khac) {
                          setFormErrors((prev) => ({ ...prev, doi_tuong_khac: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_DOI_TUONG.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                    {formData.doi_tuong_lien_quan === 'Khác' && (
                      <div className="mt-2 animate-fadeIn">
                        <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                          Nội dung đối tượng liên quan khác (*):
                        </label>
                        <input
                          type="text"
                          value={formData.doi_tuong_khac}
                          onChange={(e) => {
                            setFormData({ ...formData, doi_tuong_khac: e.target.value });
                            if (e.target.value.trim() && formErrors.doi_tuong_khac) {
                              setFormErrors((prev) => ({ ...prev, doi_tuong_khac: '' }));
                            }
                          }}
                          placeholder="Nhập nội dung đối tượng khác..."
                          className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                            formErrors.doi_tuong_khac
                              ? 'border-rose-400 bg-rose-50/20'
                              : 'border-amber-300 bg-amber-50/20'
                          }`}
                        />
                        {formErrors.doi_tuong_khac && (
                          <p className="text-[11px] text-rose-600 mt-1">{formErrors.doi_tuong_khac}</p>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      *(Chỉ phân loại, không ghi thông tin định danh cụ thể để đảm bảo bảo mật)*
                    </p>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: XỬ LÝ VÀ THEO DÕI */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    XỬ LÝ VÀ THEO DÕI
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phân loại xử lý */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phân loại xử lý (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.phan_loai_xu_ly}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phan_loai_xu_ly: e.target.value as PhanLoaiXuLyDonThu,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_PHAN_LOAI.map((pl) => (
                        <option key={pl} value={pl}>
                          {pl}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hướng xử lý */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hướng xử lý (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.huong_xu_ly}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          huong_xu_ly: e.target.value as HuongXuLyDonThu,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_HUONG_XU_LY.map((hx) => (
                        <option key={hx} value={hx}>
                          {hx}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Thời hạn quy định */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Thời hạn quy định (ngày) (*):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.thoi_han_quy_dinh}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            thoi_han_quy_dinh: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      (Tự động tính theo loại đơn để cảnh báo quá hạn tự động)
                    </span>
                  </div>

                  {/* Cán bộ phụ trách */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cán bộ phụ trách (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.can_bo_phu_trach}
                      onChange={(e) => setFormData({ ...formData, can_bo_phu_trach: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {customCanBoList.map((cb) => (
                        <option key={cb} value={cb}>
                          {cb}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Trạng thái */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Trạng thái (*) <span className="text-slate-400 font-normal">(Danh mục thả xuống)</span>:
                    </label>
                    <select
                      value={formData.trang_thai}
                      onChange={(e) => {
                        const newStatus = e.target.value as TrangThaiDonThu;
                        setFormData({
                          ...formData,
                          trang_thai: newStatus,
                          ngay_hoan_thanh:
                            newStatus === 'Đã hoàn thành' && !formData.ngay_hoan_thanh
                              ? new Date().toISOString().slice(0, 10)
                              : formData.ngay_hoan_thanh,
                        });
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      {DEFAULT_TRANG_THAI.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ngày hoàn thành (nếu đã xong) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ngày hoàn thành (nếu đã xong) [Lịch]:
                    </label>
                    <input
                      type="date"
                      value={formData.ngay_hoan_thanh}
                      min={formData.ngay_tiep_nhan || undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, ngay_hoan_thanh: val });
                        if (formData.ngay_tiep_nhan && val < formData.ngay_tiep_nhan) {
                          setFormErrors((prev) => ({
                            ...prev,
                            ngay_hoan_thanh:
                              'Ngày hoàn thành không được trước ngày tiếp nhận (ngày tiếp nhận không được sau ngày hoàn thành)',
                          }));
                        } else if (formErrors.ngay_hoan_thanh) {
                          setFormErrors((prev) => ({ ...prev, ngay_hoan_thanh: '' }));
                        }
                      }}
                      disabled={formData.trang_thai !== 'Đã hoàn thành'}
                      className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        formData.trang_thai !== 'Đã hoàn thành'
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : formErrors.ngay_hoan_thanh
                          ? 'border-rose-400 bg-rose-50/20'
                          : 'border-slate-300'
                      }`}
                    />
                    {formErrors.ngay_hoan_thanh && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.ngay_hoan_thanh}</p>
                    )}
                  </div>

                  {/* Ghi chú nghiệp vụ */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Ghi chú nghiệp vụ (Tối đa 255 ký tự):
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {formData.ghi_chu_nghiep_vu.length}/255 ký tự
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={255}
                      value={formData.ghi_chu_nghiep_vu}
                      onChange={(e) => setFormData({ ...formData, ghi_chu_nghiep_vu: e.target.value })}
                      placeholder="Chỉ ghi thông tin phục vụ theo dõi tiến độ (ví dụ: 'Đã mời đối tượng lên làm việc lần 1'), không ghi nội dung đơn"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                    {formErrors.ghi_chu_nghiep_vu && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.ghi_chu_nghiep_vu}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: [ Hủy bỏ ] [ Cập nhật danh mục ] [ Ghi lại (Lưu đơn) ] */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Cập nhật danh mục</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-lg shadow-md shadow-blue-900/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Đang lưu...' : 'Ghi lại (Lưu đơn)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL XEM CHI TIẾT ĐƠN THƯ ────────────────────────────────────── */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-300" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Chi tiết đơn thư
                </h3>
              </div>
              <button
                onClick={() => setViewingItem(null)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày tiếp nhận:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(viewingItem.ngay_tiep_nhan).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Thời hạn quy định:</span>
                  <span className="font-semibold text-slate-800">{viewingItem.thoi_han_quy_dinh} ngày</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Loại đơn:</span>
                  <span className="font-semibold text-blue-700">{viewingItem.loai_don}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lĩnh vực:</span>
                  <span className="font-semibold text-slate-800">
                    {viewingItem.linh_vuc === 'Khác' && viewingItem.linh_vuc_khac
                      ? `Khác: ${viewingItem.linh_vuc_khac}`
                      : viewingItem.linh_vuc}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Đối tượng liên quan:</span>
                  <span className="font-semibold text-slate-800">
                    {viewingItem.doi_tuong_lien_quan === 'Khác' && viewingItem.doi_tuong_khac
                      ? `Khác: ${viewingItem.doi_tuong_khac}`
                      : viewingItem.doi_tuong_lien_quan}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phân loại xử lý:</span>
                  <span className="font-semibold text-slate-800">{viewingItem.phan_loai_xu_ly}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hướng xử lý:</span>
                  <span className="font-semibold text-indigo-700">{viewingItem.huong_xu_ly}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Cán bộ phụ trách:</span>
                  <span className="font-semibold text-slate-800">{viewingItem.can_bo_phu_trach}</span>
                </div>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-400 block text-[11px] mb-1">Tiến độ & Hạn chót:</span>
                {(() => {
                  const deadline = getDeadlineInfo(viewingItem);
                  return (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{viewingItem.trang_thai}</span>
                        {deadline.isOverdue ? (
                          <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                            Quá hạn {Math.abs(deadline.daysLeft)} ngày
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            Hạn chót: {new Date(deadline.deadlineStr).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                      {viewingItem.ngay_hoan_thanh && (
                        <p className="text-[11px] text-emerald-700 mt-1 font-semibold">
                          Hoàn thành ngày: {new Date(viewingItem.ngay_hoan_thanh).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Ghi chú nghiệp vụ:</span>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700 italic border border-slate-200">
                  {viewingItem.ghi_chu_nghiep_vu || 'Không có ghi chú nào'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setViewingItem(null);
                  handleOpenEditModal(viewingItem);
                }}
                className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
              >
                Cập nhật đơn này
              </button>
              <button
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CẬP NHẬT DANH MỤC ────────────────────────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Cập nhật danh mục Cán bộ phụ trách
                </h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thêm cán bộ mới:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCanBoName}
                    onChange={(e) => setNewCanBoName(e.target.value)}
                    placeholder="VD: Đ/c Phạm Văn D"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCanBo}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Danh sách cán bộ hiện có ({customCanBoList.length}):
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {customCanBoList.map((cb) => (
                    <div
                      key={cb}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cb}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCanBo(cb)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Xóa khỏi danh mục"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-[11px] text-blue-800 flex items-start gap-2 border border-blue-100">
                <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                <p>
                  Danh mục cán bộ được lưu trữ và dùng chung cho toàn bộ phân hệ theo dõi đơn thư khi phân công thụ lý.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XÓA ĐƠN THƯ ────────────────────────────────────── */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Xác nhận xóa hồ sơ đơn thư</h4>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa hồ sơ đơn ({deletingItem.loai_don} -{' '}
                {deletingItem.linh_vuc}) tiếp nhận ngày {new Date(deletingItem.ngay_tiep_nhan).toLocaleDateString('vi-VN')}? Hành động này sẽ được ghi vào nhật ký hệ thống.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
