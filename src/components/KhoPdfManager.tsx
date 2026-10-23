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
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { GoogleDriveConfigModal } from './GoogleDriveConfigModal';
import {
  getGoogleDriveConfig,
  uploadFileToGoogleDrive,
  isGoogleDriveConfigured,
} from '../services/googleDriveService';

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

interface KhoPdfManagerProps {
  user: User;
  onDataChanged?: () => void;
}

export const KhoPdfManager: React.FC<KhoPdfManagerProps> = ({ user, onDataChanged }) => {
  const [dataList, setDataList] = useState<PdfKhoItem[]>([]);
  const [allPrograms, setAllPrograms] = useState<ChuongTrinhKtGs[]>([]);
  const [allDonVi, setAllDonVi] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(false);

  // Google Drive Modal & State
  const [isGdriveModalOpen, setIsGdriveModalOpen] = useState(false);
  const [isGdriveActive, setIsGdriveActive] = useState(() => isGoogleDriveConfigured());
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

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
            const hasMock = hsdbFiles.some((f: any) => f.id === 'f-01' || f.id === 'f-02' || f.ten_don_vi?.includes('Quân sự'));
            if (hasMock) {
              localStorage.removeItem('ubkt_ho_so_dia_ban_files');
            } else {
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
                    google_drive_id: f.google_drive_id || (f as any).google_drive_id || null,
                    google_drive_preview_url: f.google_drive_preview_url || (f as any).google_drive_preview_url || null,
                    is_google_drive: Boolean(f.is_google_drive || (f as any).is_google_drive || (f.url && f.url.includes('drive.google.com'))),
                    created_at: f.ngay_tao || new Date().toISOString(),
                  });
                }
              });
            }
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

    const handleGdriveUpdate = () => {
      setIsGdriveActive(isGoogleDriveConfigured());
    };
    window.addEventListener('ubkt_gdrive_config_updated', handleGdriveUpdate);

    return () => {
      window.removeEventListener('ubkt_diaban_records_updated', handleSync);
      window.removeEventListener('ubkt_kho_du_lieu_updated', handleSync);
      window.removeEventListener('ubkt_assignments_updated', handleSync);
      window.removeEventListener('ubkt_gdrive_config_updated', handleGdriveUpdate);
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
      let finalUrl = '';
      let googleDriveId: string | undefined = undefined;
      let googleDrivePreviewUrl: string | undefined = undefined;
      let isGoogleDrive = false;

      // Kiểm tra cấu hình Google Drive và thực hiện tải lên nếu được bật
      const gdriveCfg = getGoogleDriveConfig();
      if (gdriveCfg.scriptUrl && gdriveCfg.autoUpload) {
        setIsUploadingToDrive(true);
        try {
          const driveRes = await uploadFileToGoogleDrive(selectedFile, gdriveCfg.folderId);
          if (driveRes.success && driveRes.fileUrl) {
            finalUrl = driveRes.fileUrl;
            googleDriveId = driveRes.fileId;
            googleDrivePreviewUrl = driveRes.previewUrl;
            isGoogleDrive = true;
          }
        } catch (gdriveErr: any) {
          console.warn('Lỗi tải tệp lên Google Drive, chuyển sang lưu Base64 dự phòng:', gdriveErr);
        } finally {
          setIsUploadingToDrive(false);
        }
      }

      // Nếu không dùng Google Drive hoặc tải lên Drive gặp lỗi, fallback sang đọc DataURL Base64
      if (!finalUrl) {
        const reader = new FileReader();
        const readPromise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(selectedFile);
        finalUrl = await readPromise;
      }

      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'docx';
      const fileType = ext === 'pdf' ? 'pdf' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'docx';

      const donViObj = allDonVi.find((d) => d.id === selectedDonViId);

      // 1. Lưu vào kho dữ liệu tập trung qua API
      await api.createOrAttachPdf({
        ten_file: selectedFile.name,
        dung_luong: selectedFile.size,
        url: finalUrl,
        file_url: finalUrl,
        google_drive_id: googleDriveId,
        google_drive_preview_url: googleDrivePreviewUrl,
        is_google_drive: isGoogleDrive,
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
          url: finalUrl,
          file_url: finalUrl,
          google_drive_id: googleDriveId,
          google_drive_preview_url: googleDrivePreviewUrl,
          is_google_drive: isGoogleDrive,
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
    setPreviewPdf(item);
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
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsGdriveModalOpen(true)}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                isGdriveActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Cấu hình lưu trữ tệp lên Google Drive qua Google Apps Script Web App"
            >
              <Cloud className={`w-4 h-4 ${isGdriveActive ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>{isGdriveActive ? 'Google Drive: BẬT' : 'Cấu hình Google Drive'}</span>
            </button>
          )}

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
                          {(item.is_google_drive || item.google_drive_id || item.file_url?.includes('drive.google.com')) && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-0.5"
                              title="Tệp được lưu trữ trên Google Drive"
                            >
                              <Cloud className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Drive</span>
                            </span>
                          )}
                          <span className="text-slate-500 text-[11px]">
                            {formatFileSize(item.dung_luong)}
                          </span>
                        </div>
                      </td>

                      {/* 8. Thao tác */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleViewPdf(item)}
                            title={`Xem trực tiếp / Chi tiết: ${item.ten_file}`}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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

              {/* Trạng thái Google Drive */}
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                  isGdriveActive
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Cloud className={`w-4 h-4 ${isGdriveActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>
                    Lưu trữ đám mây: <strong>{isGdriveActive ? 'Google Drive (Tự động tải lên)' : 'Cục bộ (Chưa cấu hình Drive)'}</strong>
                  </span>
                </div>
                {!isGdriveActive && canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setIsGdriveModalOpen(true);
                    }}
                    className="text-[11px] text-blue-700 font-bold hover:underline cursor-pointer"
                  >
                    Bật Drive
                  </button>
                )}
              </div>

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
                  className="px-5 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isUploadingToDrive ? 'Đang tải lên Drive...' : 'Đang lưu tệp...'}</span>
                    </>
                  ) : (
                    <span>Lưu vào Kho dữ liệu</span>
                  )}
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

      {/* ── MODAL XEM TRƯỚC TỆP TRỰC TIẾP ────────────────────────────────────────── */}
      {previewPdf && (() => {
        const fileRawUrl = previewPdf.url || previewPdf.file_url;
        const isDrive = Boolean(
          previewPdf.is_google_drive ||
          previewPdf.google_drive_preview_url ||
          previewPdf.google_drive_id ||
          fileRawUrl?.includes('drive.google.com')
        );

        // Chuẩn hóa link preview và link mở Google Drive
        let drivePreviewUrl: string | null = null;
        let driveOpenUrl: string | null = null;
        if (isDrive) {
          if (previewPdf.google_drive_preview_url) {
            drivePreviewUrl = previewPdf.google_drive_preview_url;
          } else if (previewPdf.google_drive_id) {
            drivePreviewUrl = `https://drive.google.com/file/d/${previewPdf.google_drive_id}/preview`;
          } else if (fileRawUrl?.includes('drive.google.com')) {
            drivePreviewUrl = fileRawUrl.replace(/\/view(\?.*)?$/, '/preview');
          }

          driveOpenUrl =
            fileRawUrl ||
            (previewPdf.google_drive_id ? `https://drive.google.com/file/d/${previewPdf.google_drive_id}/view` : null) ||
            drivePreviewUrl;
        }

        // Chuyển đổi Base64 Data URL sang Blob URL an toàn
        const blobUrl = getBlobUrlFromDataUrl(fileRawUrl);

        const fileNameLower = previewPdf.ten_file.toLowerCase();
        const isPdf = fileNameLower.endsWith('.pdf') || previewPdf.loai_file === 'pdf' || (fileRawUrl?.startsWith('data:application/pdf') ?? false);
        const isWord = fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc') || previewPdf.loai_file === 'docx' || previewPdf.loai_file === 'doc';
        const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || previewPdf.loai_file === 'xlsx' || previewPdf.loai_file === 'xls';
        const isImage = /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(fileNameLower) || (fileRawUrl?.startsWith('data:image/') ?? false);

        const handleOpenExternal = () => {
          if (isDrive && driveOpenUrl) {
            window.open(driveOpenUrl, '_blank');
          } else if (blobUrl) {
            window.open(blobUrl, '_blank');
          } else {
            handleDownload(previewPdf);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header Modal */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
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
                      <h3 className="text-sm font-bold text-slate-900 truncate" title={previewPdf.ten_file}>
                        {previewPdf.ten_file}
                      </h3>
                      {isDrive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Google Drive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                      <span>{formatFileSize(previewPdf.dung_luong)}</span>
                      <span>•</span>
                      <span>{previewPdf.the_loai_van_ban || 'Văn bản'}</span>
                      {previewPdf.ten_don_vi && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{previewPdf.ten_don_vi}</span>
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
                    onClick={() => handleDownload(previewPdf)}
                    title={`Tải tệp về máy: ${previewPdf.ten_file}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tải về máy</span>
                  </button>

                  {/* Nút đóng */}
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(null)}
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
                        title={previewPdf.ten_file}
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
                ) : isPdf ? (
                  /* 2. Nếu là PDF (Data URL Base64 / Blob URL / Cục bộ) */
                  <div className="space-y-2">
                    <div className="w-full h-[560px] rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs">
                      {blobUrl ? (
                        <iframe
                          src={`${blobUrl}#toolbar=1`}
                          className="w-full h-full border-0"
                          title={previewPdf.ten_file}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                          <FileText className="w-12 h-12 text-slate-300" />
                          <p className="text-xs">Không tìm thấy nội dung PDF để xem trực tiếp.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : isImage ? (
                  /* 3. Nếu là Hình ảnh */
                  <div className="w-full min-h-[420px] max-h-[560px] flex items-center justify-center rounded-xl overflow-hidden border border-slate-300 bg-slate-900/5 p-4 shadow-xs">
                    <img
                      src={blobUrl || fileRawUrl || ''}
                      alt={previewPdf.ten_file}
                      className="max-h-[520px] max-w-full object-contain rounded-lg shadow-md"
                    />
                  </div>
                ) : (isWord || isExcel) ? (
                  /* 4. Nếu là Word / Excel lưu cục bộ */
                  <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 bg-slate-50">
                      {isWord ? (
                        <FileText className="w-10 h-10 text-blue-600" />
                      ) : (
                        <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                      )}
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-base font-bold text-slate-900">{previewPdf.ten_file}</h4>
                      <p className="text-xs text-slate-500">
                        Định dạng: <strong className="uppercase">{isWord ? 'Microsoft Word' : 'Microsoft Excel'}</strong> • Dung lượng: {formatFileSize(previewPdf.dung_luong)}
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
                        onClick={() => handleDownload(previewPdf)}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#133863] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải tệp về máy ({formatFileSize(previewPdf.dung_luong)})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 5. Tệp định dạng khác */
                  <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{previewPdf.ten_file}</h4>
                      <p className="text-xs text-slate-500 mt-1">Dung lượng: {formatFileSize(previewPdf.dung_luong)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewPdf)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải tệp về máy</span>
                    </button>
                  </div>
                )}

                {/* Khung chi tiết Metadata của văn bản */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <Info className="w-3.5 h-3.5 text-[#133863]" />
                    <span>Thông tin hồ sơ / Thuộc tính văn bản</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Đơn vị / Địa bàn:</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {previewPdf.ten_don_vi || previewPdf.doi_tuong || 'Tài liệu dùng chung'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Thể loại văn bản:</span>
                        <span className="font-semibold text-slate-900">{previewPdf.the_loai_van_ban || 'Văn bản'}</span>
                      </div>
                      {previewPdf.so_van_ban && (
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Số ký hiệu:</span>
                          <span className="font-mono font-bold text-slate-900">{previewPdf.so_van_ban}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Người ký / Ban hành:</span>
                        <span className="font-medium text-slate-900">{previewPdf.nguoi_ky || previewPdf.chu_the || 'Ủy ban Kiểm tra Đảng ủy'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Ngày ban hành:</span>
                        <span className="font-mono font-semibold text-slate-900">{formatDateVn(previewPdf.ngay_ban_hanh || previewPdf.created_at)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Dung lượng tệp:</span>
                        <span className="font-semibold text-slate-900">{formatFileSize(previewPdf.dung_luong)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Nguồn dữ liệu:</span>
                        <span className="font-medium text-slate-800">
                          {previewPdf.nguon_goc === 'HO_SO_DIA_BAN' ? 'Hồ sơ địa bàn' : previewPdf.nguon_goc === 'BAO_CAO_THANG' ? 'Báo cáo định kỳ tháng' : 'Kho dữ liệu tập trung'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Trạng thái lưu trữ:</span>
                        <span className="font-semibold text-emerald-700">
                          {isDrive ? 'Đám mây Google Drive' : 'Bộ nhớ máy chủ nội bộ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {previewPdf.trich_yeu && (
                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 block mb-1 font-medium">Trích yếu nội dung:</span>
                      <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-slate-800 leading-relaxed italic">
                        "{previewPdf.trich_yeu}"
                      </p>
                    </div>
                  )}

                  {previewPdf.ghi_chu && previewPdf.ghi_chu !== previewPdf.trich_yeu && (
                    <div className="text-xs text-slate-500 pt-1">
                      <span className="font-medium">Ghi chú thêm:</span> {previewPdf.ghi_chu}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                <span className="text-xs text-slate-500 font-mono">
                  Mã tài liệu: {previewPdf.id}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(previewPdf)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải tệp về</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPdf(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL CẤU HÌNH GOOGLE DRIVE ────────────────────────────────────── */}
      <GoogleDriveConfigModal
        isOpen={isGdriveModalOpen}
        onClose={() => setIsGdriveModalOpen(false)}
        onSaved={() => setIsGdriveActive(isGoogleDriveConfigured())}
      />
    </div>
  );
};

export default KhoPdfManager;
