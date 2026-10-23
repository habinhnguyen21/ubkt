import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import type { ChuongTrinhKtGs, PdfKhoItem, User, DonVi, HoSoDiaBanFile } from '../types';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Search,
  AlertCircle,
  Eye,
  CheckCircle2,
  ArrowUpDown,
  Building2,
  Upload,
  Database,
  RefreshCw,
  X,
} from 'lucide-react';

interface KhoPdfManagerProps {
  user: User;
  onDataChanged?: () => void;
}

export const KhoPdfManager: React.FC<KhoPdfManagerProps> = ({ user, onDataChanged }) => {
  const [dataList, setDataList] = useState<PdfKhoItem[]>([]);
  const [allPrograms, setAllPrograms] = useState<ChuongTrinhKtGs[]>([]);
  const [allDonVi, setAllDonVi] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(false);

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDonVi, setFilterDonVi] = useState<string>('ALL');
  const [filterTheLoai, setFilterTheLoai] = useState<string>('ALL');
  const [filterLoaiFile, setFilterLoaiFile] = useState<string>('ALL');
  const [filterNguonGoc, setFilterNguonGoc] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Modal thêm tệp mới vào kho dữ liệu
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTheLoai, setDocTheLoai] = useState<string>('Quyết định');
  const [docSoVanBan, setDocSoVanBan] = useState<string>('');
  const [docTrichYeu, setDocTrichYeu] = useState<string>('');
  const [docNguoiKy, setDocNguoiKy] = useState<string>('Ủy ban Kiểm tra Đảng ủy');
  const [docNgayBanHanh, setDocNgayBanHanh] = useState<string>(new Date().toLocaleDateString('vi-VN'));
  const [selectedDonViId, setSelectedDonViId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [ghiChu, setGhiChu] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal xác nhận xóa
  const [deleteTarget, setDeleteTarget] = useState<PdfKhoItem | null>(null);

  // Modal xem preview tệp
  const [previewPdf, setPreviewPdf] = useState<PdfKhoItem | null>(null);

  const canEdit = user.vai_tro === 'ADMIN' || user.vai_tro === 'BIEN_TAP';

  // Nạp dữ liệu tổng hợp & đồng bộ 2 chiều với Hồ sơ địa bàn
  const loadData = async () => {
    setLoading(true);
    try {
      const [pdfs, programs, donVis] = await Promise.all([
        api.getAllPdfs(),
        api.getAllChuongTrinh(),
        api.getAllDonVi(),
      ]);

      // Nạp và hợp nhất thêm tệp trực tiếp từ LocalStorage để bảo đảm đồng bộ tức thời
      const seenIds = new Set<string>();
      const combinedList: PdfKhoItem[] = [];

      // 1. Thêm từ api.getAllPdfs
      pdfs.forEach((p) => {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          combinedList.push(p);
        }
      });

      // 2. Đồng bộ từ ubkt_ho_so_dia_ban_files
      try {
        const rawHsdb = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (rawHsdb) {
          const hsdbFiles = JSON.parse(rawHsdb);
          if (Array.isArray(hsdbFiles)) {
            hsdbFiles.forEach((f: HoSoDiaBanFile) => {
              const fileKey = 'hsdb-' + f.id;
              if (!seenIds.has(fileKey)) {
                seenIds.add(fileKey);
                combinedList.push({
                  id: fileKey,
                  ten_file: f.ten_file,
                  dung_luong: f.dung_luong || 250000,
                  url: f.url || f.file_url || null,
                  file_url: f.file_url || f.url || null,
                  loai_file: f.loai_file || (f.ten_file?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'),
                  the_loai_van_ban: f.the_loai_van_ban || 'Tài liệu hồ sơ',
                  so_van_ban: f.so_van_ban || null,
                  trich_yeu: f.trich_yeu || f.mo_ta || null,
                  nguoi_ky: f.nguoi_ky || null,
                  don_vi_id: f.don_vi_id || null,
                  ten_don_vi: f.ten_don_vi || null,
                  nguon_goc: 'HO_SO_DIA_BAN',
                  chu_the: f.ten_don_vi ? `Hồ sơ địa bàn ${f.ten_don_vi}` : 'Hồ sơ địa bàn cơ sở',
                  doi_tuong: f.ten_don_vi || 'Cơ sở',
                  nam: new Date().getFullYear(),
                  ngay_ban_hanh: f.ngay_ban_hanh || (f.ngay_tao ? f.ngay_tao.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                  ghi_chu: f.loai_tai_lieu || 'Tài liệu hồ sơ địa bàn',
                  created_at: f.ngay_tao || new Date().toISOString(),
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('Lỗi nạp tệp hồ sơ địa bàn bổ sung:', err);
      }

      setDataList(combinedList);
      setAllPrograms(programs);
      setAllDonVi(donVis);
    } catch (err) {
      console.error('Lỗi nạp kho dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Lắng nghe các sự kiện cập nhật để đồng bộ thời gian thực
    const handleSync = () => {
      loadData();
    };

    window.addEventListener('ubkt_diaban_records_updated', handleSync);
    window.addEventListener('ubkt_kho_du_lieu_updated', handleSync);
    window.addEventListener('ubkt_assignments_updated', handleSync);

    return () => {
      window.removeEventListener('ubkt_diaban_records_updated', handleSync);
      window.removeEventListener('ubkt_kho_du_lieu_updated', handleSync);
      window.removeEventListener('ubkt_assignments_updated', handleSync);
    };
  }, []);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'Không rõ';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDateVn = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const trimmed = dateStr.trim();
    if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(trimmed)) return trimmed.replace(/[\-\.]/g, '/');
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
    try {
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return trimmed;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return trimmed;
    }
  };

  const handleOpenAddModal = () => {
    setSelectedFile(null);
    setDocTheLoai('Quyết định');
    setDocSoVanBan('');
    setDocTrichYeu('');
    setDocNguoiKy('Ủy ban Kiểm tra Đảng ủy');
    setDocNgayBanHanh(new Date().toLocaleDateString('vi-VN'));
    setSelectedDonViId('');
    setSelectedProgramId('');
    setGhiChu('');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormError(null);
      if (!docTrichYeu) {
        setDocTrichYeu(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    }
  };

  const handleSaveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFormError('Vui lòng chọn một tệp văn bản từ máy tính.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const reader = new FileReader();
      const readPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(selectedFile);
      const dataUrl = await readPromise;

      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'docx';
      const fileType = ext === 'pdf' ? 'pdf' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'docx';

      const donViObj = allDonVi.find((d) => d.id === selectedDonViId);

      // 1. Lưu vào kho dữ liệu tập trung qua API
      await api.createOrAttachPdf({
        ten_file: selectedFile.name,
        dung_luong: selectedFile.size,
        url: dataUrl,
        chuong_trinh_id: selectedProgramId || null,
        don_vi_id: selectedDonViId || null,
        ten_don_vi: donViObj ? donViObj.ten : null,
        nguon_goc: selectedDonViId ? 'HO_SO_DIA_BAN' : 'KHO_PDF',
        ghi_chu: ghiChu.trim() || docTrichYeu.trim() || null,
      });

      // 2. Nếu có chọn đơn vị: Đồng bộ trực tiếp sang Hồ sơ địa bàn của đơn vị đó
      if (selectedDonViId && donViObj) {
        const newDiaBanFile: HoSoDiaBanFile = {
          id: 'file-kdl-' + Date.now(),
          don_vi_id: selectedDonViId,
          ten_don_vi: donViObj.ten,
          the_loai_van_ban: docTheLoai,
          so_van_ban: docSoVanBan.trim() || undefined,
          trich_yeu: docTrichYeu.trim() || selectedFile.name,
          nguoi_ky: docNguoiKy.trim() || 'UBKT Đảng ủy',
          ngay_ban_hanh: docNgayBanHanh.trim() || new Date().toLocaleDateString('vi-VN'),
          ten_file: selectedFile.name,
          loai_file: fileType,
          dung_luong: selectedFile.size,
          url: dataUrl,
          file_url: dataUrl,
          loai_tai_lieu: '5. Tài liệu của cơ sở và hồ sơ liên quan',
          mo_ta: docTrichYeu.trim(),
          ngay_tao: new Date().toLocaleDateString('vi-VN'),
          nguoi_tao: user.ho_ten,
        };

        try {
          const rawFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
          const currentFiles: HoSoDiaBanFile[] = rawFiles ? JSON.parse(rawFiles) : [];
          const nextFiles = [newDiaBanFile, ...currentFiles.filter((f) => f.ten_file !== selectedFile.name)];
          localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(nextFiles));
        } catch (storageErr) {
          console.error('Lỗi đồng bộ sang Hồ sơ địa bàn:', storageErr);
        }

        // Phát sự kiện đồng bộ
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      }

      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

      setIsAddModalOpen(false);
      await loadData();
      onDataChanged?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePdf(deleteTarget.id);

      // Nếu tệp có nguồn gốc từ Hồ sơ địa bàn: Đồng thời gỡ khỏi ubkt_ho_so_dia_ban_files
      try {
        const rawFiles = localStorage.getItem('ubkt_ho_so_dia_ban_files');
        if (rawFiles) {
          const currentFiles: HoSoDiaBanFile[] = JSON.parse(rawFiles);
          const filtered = currentFiles.filter((f) => f.ten_file !== deleteTarget.ten_file && ('hsdb-' + f.id) !== deleteTarget.id);
          localStorage.setItem('ubkt_ho_so_dia_ban_files', JSON.stringify(filtered));
          window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
        }
      } catch (err) {
        console.error('Lỗi xóa tệp liên thông hồ sơ địa bàn:', err);
      }

      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      setDeleteTarget(null);
      await loadData();
      onDataChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDownload = (item: PdfKhoItem) => {
    if (item.url || item.file_url) {
      const a = document.createElement('a');
      a.href = (item.url || item.file_url)!;
      a.download = item.ten_file;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const blob = new Blob([`Tài liệu: ${item.ten_file}\nĐơn vị: ${item.ten_don_vi || item.doi_tuong || 'UBKT'}`], {
        type: item.ten_file.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.ten_file;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleViewPdf = (item: PdfKhoItem) => {
    if (item.url || item.file_url) {
      window.open((item.url || item.file_url)!, '_blank');
    } else {
      setPreviewPdf(item);
    }
  };

  const filteredData = useMemo(() => {
    const filtered = dataList.filter((item) => {
      // 1. Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          item.ten_file.toLowerCase().includes(q) ||
          (item.so_van_ban && item.so_van_ban.toLowerCase().includes(q)) ||
          (item.trich_yeu && item.trich_yeu.toLowerCase().includes(q)) ||
          (item.the_loai_van_ban && item.the_loai_van_ban.toLowerCase().includes(q)) ||
          (item.ten_don_vi && item.ten_don_vi.toLowerCase().includes(q)) ||
          (item.doi_tuong && item.doi_tuong.toLowerCase().includes(q)) ||
          (item.chu_the && item.chu_the.toLowerCase().includes(q)) ||
          (item.nguoi_ky && item.nguoi_ky.toLowerCase().includes(q)) ||
          (item.ghi_chu && item.ghi_chu.toLowerCase().includes(q)) ||
          (item.ngay_ban_hanh && formatDateVn(item.ngay_ban_hanh).includes(q));

        if (!matchSearch) return false;
      }

      // 2. Lọc theo đơn vị / địa bàn
      if (filterDonVi !== 'ALL') {
        if (item.don_vi_id !== filterDonVi && item.ten_don_vi !== filterDonVi) return false;
      }

      // 3. Lọc theo thể loại văn bản
      if (filterTheLoai !== 'ALL') {
        const tl = (item.the_loai_van_ban || '').toLowerCase();
        if (!tl.includes(filterTheLoai.toLowerCase())) return false;
      }

      // 4. Lọc theo định dạng file
      if (filterLoaiFile !== 'ALL') {
        const fname = item.ten_file.toLowerCase();
        if (filterLoaiFile === 'pdf' && !fname.endsWith('.pdf')) return false;
        if (filterLoaiFile === 'docx' && !fname.endsWith('.docx') && !fname.endsWith('.doc')) return false;
        if (filterLoaiFile === 'xlsx' && !fname.endsWith('.xlsx') && !fname.endsWith('.xls')) return false;
      }

      // 5. Lọc theo nguồn gốc
      if (filterNguonGoc !== 'ALL') {
        if (item.nguon_goc !== filterNguonGoc) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const dateA = a.ngay_ban_hanh || a.created_at || '';
      const dateB = b.ngay_ban_hanh || b.created_at || '';
      return sortOrder === 'DESC' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
  }, [dataList, searchQuery, filterDonVi, filterTheLoai, filterLoaiFile, filterNguonGoc, sortOrder]);

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#133863] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase">
              Kho Dữ Liệu Điện Tử
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kho lưu trữ dữ liệu tập trung · Đồng bộ liên thông 2 chiều với Hồ sơ địa bàn, Báo cáo tháng & KT-GS
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#133863] hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Đồng bộ & làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#133863]' : ''}`} />
          </button>

          {canEdit && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm dữ liệu / Tệp văn bản</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KHUNG CHÍNH ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-5">
        {/* Hộp thông báo đồng bộ 2 chiều */}
        <div className="border-l-[3px] border-[#133863] bg-blue-50/50 px-4 py-3 rounded-r-lg text-xs text-blue-950 leading-relaxed flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#133863] flex-shrink-0" />
            <span>
              <strong>Đồng bộ liên thông 2 chiều: </strong> Mọi báo cáo tháng, tài liệu, quyết định tải lên từ phân hệ Hồ sơ địa bàn được tự động tổng hợp vào Kho dữ liệu; ngược lại văn bản gắn với địa bàn trong kho dữ liệu sẽ hiển thị ngay tại hồ sơ cơ sở.
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#133863] whitespace-nowrap ml-3">
            Tổng cộng: {dataList.length} tệp
          </span>
        </div>

        {/* ── BỘ LỌC TÌM KIẾM ĐA TIÊU CHÍ ───────────────────────────────── */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            {/* 1. Tìm kiếm từ khóa */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên tệp, số văn bản, trích yếu nội dung, người ký..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#133863]"
              />
            </div>

            {/* 2. Lọc theo Địa bàn / Đơn vị */}
            <div>
              <select
                value={filterDonVi}
                onChange={(e) => setFilterDonVi(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
              >
                <option value="ALL">-- Tất cả địa bàn / Đơn vị --</option>
                {allDonVi.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ten}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Lọc theo Thể loại văn bản */}
            <div>
              <select
                value={filterTheLoai}
                onChange={(e) => setFilterTheLoai(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
              >
                <option value="ALL">-- Tất cả thể loại văn bản --</option>
                <option value="Quyết định">Quyết định</option>
                <option value="Báo cáo">Báo cáo</option>
                <option value="Kế hoạch">Kế hoạch</option>
                <option value="Quy chế">Quy chế</option>
                <option value="Kết luận">Kết luận</option>
                <option value="Nghị quyết">Nghị quyết</option>
                <option value="Thông báo">Thông báo</option>
                <option value="Công văn">Công văn</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Định dạng */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Định dạng:</span>
                <select
                  value={filterLoaiFile}
                  onChange={(e) => setFilterLoaiFile(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700"
                >
                  <option value="ALL">Tất cả định dạng</option>
                  <option value="pdf">Tệp PDF (.pdf)</option>
                  <option value="docx">Tài liệu Word (.docx, .doc)</option>
                  <option value="xlsx">Bảng tính Excel (.xlsx, .xls)</option>
                </select>
              </div>

              {/* Nguồn gốc */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Nguồn:</span>
                <select
                  value={filterNguonGoc}
                  onChange={(e) => setFilterNguonGoc(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700"
                >
                  <option value="ALL">Tất cả nguồn dữ liệu</option>
                  <option value="HO_SO_DIA_BAN">Hồ sơ địa bàn</option>
                  <option value="BAO_CAO_THANG">Báo cáo định kỳ tháng</option>
                  <option value="CHUONG_TRINH">Chương trình KT-GS</option>
                  <option value="KHO_PDF">Kho dữ liệu chung</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-500 text-[11px]">
                Hiển thị: <strong>{filteredData.length}</strong> / {dataList.length} tệp
              </span>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
                className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>Ngày BH: {sortOrder === 'DESC' ? 'Mới nhất' : 'Cũ nhất'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── BẢNG DỮ LIỆU CHUẨN ─────────────────────────────────────────── */}
        {filteredData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Không tìm thấy tệp tài liệu nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">STT</th>
                  <th className="py-3 px-3 min-w-[120px]">Thể loại</th>
                  <th className="py-3 px-3 min-w-[280px]">Trích yếu nội dung & Số hiệu</th>
                  <th className="py-3 px-3 min-w-[180px]">Thuộc địa bàn / Đơn vị</th>
                  <th className="py-3 px-3 min-w-[130px]">Người ký</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Ngày ban hành</th>
                  <th className="py-3 px-3 min-w-[130px]">Định dạng & Size</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredData.map((item, idx) => {
                  const fname = item.ten_file.toLowerCase();
                  const isPdf = fname.endsWith('.pdf') || item.loai_file === 'pdf';
                  const isWord = fname.endsWith('.docx') || fname.endsWith('.doc') || item.loai_file === 'docx';
                  const isExcel = fname.endsWith('.xlsx') || fname.endsWith('.xls') || item.loai_file === 'xlsx';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {/* 1. STT */}
                      <td className="py-3 px-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* 2. Thể loại văn bản */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-[#133863] border border-blue-200">
                          {item.the_loai_van_ban || (isPdf ? 'Văn bản PDF' : isWord ? 'Văn bản Word' : 'Tài liệu')}
                        </span>
                      </td>

                      {/* 3. Trích yếu & Số ký hiệu */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          {item.so_van_ban && (
                            <span className="text-[11px] font-bold text-[#133863] font-mono mr-1.5">
                              [{item.so_van_ban}]
                            </span>
                          )}
                          <span className="font-semibold text-slate-800 leading-snug">
                            {item.trich_yeu || item.ghi_chu || item.ten_file}
                          </span>
                        </div>
                      </td>

                      {/* 4. Địa bàn / Đơn vị */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.ten_don_vi || item.doi_tuong || 'UBKT dùng chung'}</span>
                        </div>
                        {item.nguon_goc && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Nguồn: {item.nguon_goc === 'HO_SO_DIA_BAN' ? 'Hồ sơ địa bàn' : item.nguon_goc === 'BAO_CAO_THANG' ? 'Báo cáo tháng' : 'KT-GS'}
                          </span>
                        )}
                      </td>

                      {/* 5. Người ký */}
                      <td className="py-3 px-3 text-slate-700">
                        <span className="font-medium">{item.nguoi_ky || item.chu_the || '---'}</span>
                      </td>

                      {/* 6. Ngày ban hành */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                          {formatDateVn(item.ngay_ban_hanh || item.created_at)}
                        </span>
                      </td>

                      {/* 7. Định dạng & Dung lượng */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPdf
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : isWord
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : isExcel
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isPdf ? 'PDF' : isWord ? 'DOCX' : isExcel ? 'XLSX' : 'FILE'}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {formatFileSize(item.dung_luong)}
                          </span>
                        </div>
                      </td>

                      {/* 8. Thao tác */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          {isPdf && (
                            <button
                              type="button"
                              onClick={() => handleViewPdf(item)}
                              title="Xem trực tiếp PDF"
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            title={`Tải về: ${item.ten_file}`}
                            className="p-1.5 text-[#133863] hover:bg-blue-50 rounded cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Gỡ khỏi kho dữ liệu"
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL THÊM TÀI LIỆU VÀO KHO DỮ LIỆU ─────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-[#133863] text-white border-b-2 border-amber-500">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-amber-300" />
                <h2 className="text-sm font-bold uppercase tracking-wide">
                  Thêm tài liệu vào Kho dữ liệu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFile} className="p-6 space-y-3.5 text-xs max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Chọn tệp từ máy */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn tệp văn bản từ máy tính (PDF, Word, Excel...) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center space-x-1.5 font-semibold cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#133863]" />
                    <span>Duyệt tệp...</span>
                  </button>
                  <span className="text-xs text-slate-600 truncate font-mono">
                    {selectedFile ? selectedFile.name : 'Chưa chọn tệp'}
                  </span>
                </div>
              </div>

              {/* Thể loại & Số văn bản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Thể loại văn bản *
                  </label>
                  <select
                    value={docTheLoai}
                    onChange={(e) => setDocTheLoai(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Quyết định">Quyết định</option>
                    <option value="Báo cáo">Báo cáo</option>
                    <option value="Kế hoạch">Kế hoạch</option>
                    <option value="Quy chế">Quy chế</option>
                    <option value="Kết luận">Kết luận</option>
                    <option value="Nghị quyết">Nghị quyết</option>
                    <option value="Thông báo">Thông báo</option>
                    <option value="Công văn">Công văn</option>
                    <option value="Khác">Văn bản khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số / Ký hiệu văn bản
                  </label>
                  <input
                    type="text"
                    value={docSoVanBan}
                    onChange={(e) => setDocSoVanBan(e.target.value)}
                    placeholder="Ví dụ: 15-QĐ/UBKT"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Trích yếu nội dung */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trích yếu tóm tắt nội dung *
                </label>
                <textarea
                  rows={2}
                  value={docTrichYeu}
                  onChange={(e) => setDocTrichYeu(e.target.value)}
                  placeholder="Ví dụ: Quyết định phân công phụ trách địa bàn chi bộ Hiệp Hòa nhiệm kỳ 2025-2030..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Người ký & Ngày ban hành */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Người ký / Thẩm quyền
                  </label>
                  <input
                    type="text"
                    value={docNguoiKy}
                    onChange={(e) => setDocNguoiKy(e.target.value)}
                    placeholder="Ví dụ: Đ/c Nguyễn Văn An - UV BTV"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày ban hành (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={docNgayBanHanh}
                    onChange={(e) => setDocNgayBanHanh(e.target.value)}
                    placeholder="Ví dụ: 15/01/2026"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Đơn vị / Địa bàn liên kết (Tự động đồng bộ vào Hồ sơ địa bàn) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Liên kết với Địa bàn / Tổ chức Đảng:
                </label>
                <select
                  value={selectedDonViId}
                  onChange={(e) => setSelectedDonViId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- Tài liệu dùng chung cơ quan UBKT --</option>
                  {allDonVi.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.ten} ({d.loai === 'DANG_BO' ? 'Đảng bộ' : 'Chi bộ'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-blue-700 mt-1">
                  * Nếu chọn đơn vị, tệp này sẽ tự động xuất hiện ngay trong phân hệ <strong>Hồ sơ địa bàn</strong> của đơn vị tương ứng.
                </p>
              </div>

              {/* Chương trình KT-GS liên kết */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Liên kết với Chương trình KT-GS (nếu có):
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="">-- Không liên kết chương trình KT-GS --</option>
                  {allPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.noi_dung || p.ten_chuong_trinh || 'Chương trình KT-GS'} ({p.khoa_nhiem_ky || p.nam})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú lưu trữ
                </label>
                <input
                  type="text"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Ghi chú thêm về văn bản..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu vào Kho dữ liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XÓA ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Gỡ tệp khỏi kho</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn gỡ tệp <strong className="text-slate-800">{deleteTarget.ten_file}</strong> khỏi Kho dữ liệu? Nếu tệp thuộc hồ sơ địa bàn, hồ sơ đó cũng sẽ được đồng bộ gỡ bỏ.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Xác nhận gỡ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XEM TRƯỚC TỆP KHI KHÔNG CÓ DATA URL BLOB ─────────────── */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                  {previewPdf.ten_file}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPdf(null)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <p><strong>Địa bàn / Đơn vị:</strong> {previewPdf.ten_don_vi || previewPdf.doi_tuong || 'Tài liệu dùng chung'}</p>
              <p><strong>Thể loại:</strong> {previewPdf.the_loai_van_ban || 'Văn bản'}</p>
              {previewPdf.so_van_ban && <p><strong>Số ký hiệu:</strong> {previewPdf.so_van_ban}</p>}
              {previewPdf.trich_yeu && <p><strong>Trích yếu:</strong> {previewPdf.trich_yeu}</p>}
              <p><strong>Dung lượng:</strong> {formatFileSize(previewPdf.dung_luong)}</p>
              {previewPdf.ghi_chu && <p><strong>Ghi chú:</strong> {previewPdf.ghi_chu}</p>}
              <p className="text-slate-500 italic pt-2">
                Bạn có thể bấm nút &quot;Tải tệp về&quot; bên dưới để mở và đọc trên máy tính.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => handleDownload(previewPdf)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải tệp về</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewPdf(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KhoPdfManager;
