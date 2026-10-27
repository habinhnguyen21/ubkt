import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import type {
  User,
  DiaBanRecord,
  BaoCaoThangStatus,
  BaoCaoThangItem,
  VanDeTheoDoi,
  ChiDaoNhiemVu,
  HoSoDiaBanFile,
  ChuongTrinhKtGs,
  ThayDoiBoSungKtGs,
  LichSuPhuTrachDiaBan,
  TrangThaiHoSoDiaBan,
} from '../types';
import {
  isGoogleDriveConfigured,
  getGoogleDriveConfig,
  uploadBase64OrUrlToGoogleDrive,
  extractGoogleDriveFileId,
  deleteFileFromGoogleDrive,
} from '../services/googleDriveService';
import { centralDataService } from '../services/centralDataService';
import {
  MapPin,
  Building2,
  Users,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Download,
  Upload,
  Eye,
  X,
  Folder,
  Briefcase,
  AlertCircle,
  Layers,
  Check,
  BookmarkCheck,
  Edit3,
  Trash2,
  Paperclip,
  History,
  UserCheck,
  ShieldCheck,
  Archive,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import { TongQuanExecutiveDashboard } from './TongQuanExecutiveDashboard';

interface Props {
  user: User;
}

const STORAGE_DIA_BAN_RECORDS = 'ubkt_ho_so_dia_ban_records';
const STORAGE_HO_SO_FILES = 'ubkt_ho_so_dia_ban_files';
const STORAGE_BAO_CAO_THANG = 'ubkt_bao_cao_thang';
const STORAGE_DELETED_DIA_BAN_IDS = 'ubkt_deleted_diaban_ids';

const getDeletedDiaBanIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_DIA_BAN_IDS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
};

// 6 nhóm hồ sơ tài liệu địa bàn
export const NHOM_HO_SO = [
  { id: '1', ten: '1. Hồ sơ pháp lý & Quyết định phân công', mo_ta: 'Quyết định thành lập, phân công cán bộ, quy chế' },
  { id: '2', ten: '2. Quy chế làm việc & Danh sách cấp ủy', mo_ta: 'Quy chế cấp ủy, danh sách cấp ủy viên và đảng viên' },
  { id: '3', ten: '3. Báo cáo định kỳ (tháng, quý, năm)', mo_ta: 'Các báo cáo định kỳ cán bộ phụ trách nộp về UBKT' },
  { id: '4', ten: '4. Biên bản kiểm tra, giám sát chuyên đề', mo_ta: 'Biên bản làm việc, thông báo kiểm tra, giám sát' },
  { id: '5', ten: '5. Đơn thư, kiến nghị & Phản ánh địa bàn', mo_ta: 'Tổng hợp phản ánh của nhân dân, đơn thư phát sinh' },
  { id: '6', ten: '6. Kết luận kiểm tra & Văn bản chỉ đạo', mo_ta: 'Kết luận của Đảng ủy, UBKT và thông báo chỉ đạo' },
];

export function HoSoDiaBanManager({ user }: Props) {
  // Tab con: 'tong_quan' | 'danh_sach' | 'kho_tai_lieu' (Đã bỏ tab báo cáo tháng độc lập)
  const [subTab, setSubTab] = useState<'tong_quan' | 'danh_sach' | 'kho_tai_lieu'>('danh_sach');

  // Chế độ xem Phân công địa bàn: 'CAN_BO' (căn cứ theo cán bộ được phân công) | 'BANG_PHANG'
  const [viewModePhanCong, setViewModePhanCong] = useState<'CAN_BO' | 'BANG_PHANG'>('CAN_BO');

  // Dữ liệu địa bàn
  const [records, setRecords] = useState<DiaBanRecord[]>(() => {
    try {
      const deletedIds = getDeletedDiaBanIds();
      const saved = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
      if (saved) {
        const list: DiaBanRecord[] = JSON.parse(saved);
        if (Array.isArray(list)) {
          return list.filter((r) => !deletedIds.has(r.id));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Dữ liệu tài liệu hồ sơ địa bàn
  const [files, setFiles] = useState<HoSoDiaBanFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HO_SO_FILES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Danh sách các báo cáo tháng đã tiếp nhận (tích hợp nhiều địa bàn)
  const [baoCaoThangList, setBaoCaoThangList] = useState<BaoCaoThangItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BAO_CAO_THANG) || localStorage.getItem('ubkt_bao_cao_thang_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Danh sách người dùng
  const [usersList, setUsersList] = useState<User[]>([]);

  // Bộ lọc danh sách địa bàn
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCanBo, setFilterCanBo] = useState<string>('ALL');
  const [filterBaoCao, setFilterBaoCao] = useState<string>('ALL');
  const [filterVanDe, setFilterVanDe] = useState<string>('ALL');
  const [filterTrangThaiHoSo, setFilterTrangThaiHoSo] = useState<'ALL' | 'DANG_THEO_DOI' | 'DA_KET_THUC'>('ALL');

  // Modal Chi tiết Hồ sơ địa bàn
  const [selectedRecord, setSelectedRecord] = useState<DiaBanRecord | null>(null);
  const [modalTab, setModalTab] = useState<
    'thong_tin' | 'lich_su' | 'van_de' | 'chi_dao' | 'bao_cao' | 'tai_lieu' | 'chuong_trinh_nhiem_ky'
  >('thong_tin');

  // Modal Đổi cán bộ phụ trách & Bàn giao hồ sơ
  const [isDoiCanBoOpen, setIsDoiCanBoOpen] = useState(false);
  const [doiCanBoRecord, setDoiCanBoRecord] = useState<DiaBanRecord | null>(null);
  const [doiCanBoNewUserId, setDoiCanBoNewUserId] = useState('');
  const [doiCanBoVanBan, setDoiCanBoVanBan] = useState('QĐ số 15-QĐ/UBKT');
  const [doiCanBoNgay, setDoiCanBoNgay] = useState(new Date().toLocaleDateString('vi-VN'));
  const [doiCanBoLyDo, setDoiCanBoLyDo] = useState('Luân chuyển cán bộ phụ trách địa bàn');
  const [doiCanBoGhiChu, setDoiCanBoGhiChu] = useState('');
  const [doiCanBoXacNhan, setDoiCanBoXacNhan] = useState(true);

  // Modal Kết thúc hồ sơ địa bàn
  const [isKetThucModalOpen, setIsKetThucModalOpen] = useState(false);
  const [ketThucRecord, setKetThucRecord] = useState<DiaBanRecord | null>(null);
  const [ketThucNgay, setKetThucNgay] = useState(new Date().toLocaleDateString('vi-VN'));
  const [ketThucVanBan, setKetThucVanBan] = useState('Báo cáo kết luận giám sát');
  const [ketThucGhiChu, setKetThucGhiChu] = useState(
    'Đã thu thập đầy đủ tài liệu 6 nhóm hồ sơ, các báo cáo tháng đã tiếp nhận đầy đủ, không còn vấn đề phức tạp hoặc chỉ đạo tồn đọng.'
  );

  // Modal Vấn đề theo dõi (Thêm, Sửa, Xóa, Đính kèm File, Chọn 6 Nhóm hồ sơ)
  const [isAddVanDeOpen, setIsAddVanDeOpen] = useState(false);
  const [editingVanDe, setEditingVanDe] = useState<VanDeTheoDoi | null>(null);
  const [vanDeNoiDung, setVanDeNoiDung] = useState('');
  const [vanDeMucDo, setVanDeMucDo] = useState<'THUONG' | 'QUAN_TRONG' | 'PHUC_TAP'>('THUONG');
  const [vanDeTrangThai, setVanDeTrangThai] = useState<'DANG_THEO_DOI' | 'DA_XU_LY'>('DANG_THEO_DOI');
  const [vanDeNhomHoSo, setVanDeNhomHoSo] = useState<string>('5. Đơn thư, kiến nghị & Phản ánh địa bàn');
  const [vanDeFileTen, setVanDeFileTen] = useState('');
  const [vanDeFileUrl, setVanDeFileUrl] = useState<string | null>(null);
  const [vanDeFileLoai, setVanDeFileLoai] = useState<string>('docx');
  const vanDeFileInputRef = useRef<HTMLInputElement>(null);

  // Modal Chỉ đạo của cấp trên (Thêm, Sửa, Xóa, Đính kèm File, Chọn 6 Nhóm hồ sơ)
  const [isAddChiDaoOpen, setIsAddChiDaoOpen] = useState(false);
  const [editingChiDao, setEditingChiDao] = useState<ChiDaoNhiemVu | null>(null);
  const [chiDaoNoiDung, setChiDaoNoiDung] = useState('');
  const [chiDaoVanBan, setChiDaoVanBan] = useState('');
  const [chiDaoHan, setChiDaoHan] = useState('');
  const [chiDaoTrangThai, setChiDaoTrangThai] = useState<'CHUA_HOAN_THANH' | 'DA_HOAN_THANH'>('CHUA_HOAN_THANH');
  const [chiDaoNhomHoSo, setChiDaoNhomHoSo] = useState<string>('6. Kết luận kiểm tra & Văn bản chỉ đạo');
  const [chiDaoFileTen, setChiDaoFileTen] = useState('');
  const [chiDaoFileUrl, setChiDaoFileUrl] = useState<string | null>(null);
  const [chiDaoFileLoai, setChiDaoFileLoai] = useState<string>('pdf');
  const chiDaoFileInputRef = useRef<HTMLInputElement>(null);

  // Modal Thay đổi, bổ sung chương trình & bảng đối chiếu
  const [isThayDoiModalOpen, setIsThayDoiModalOpen] = useState(false);
  const [editingThayDoi, setEditingThayDoi] = useState<ThayDoiBoSungKtGs | null>(null);
  const [thayDoiChuongTrinhId, setThayDoiChuongTrinhId] = useState('');
  const [thayDoiLan, setThayDoiLan] = useState(1);
  const [thayDoiSoVanBan, setThayDoiSoVanBan] = useState('');
  const [thayDoiNgayBanHanh, setThayDoiNgayBanHanh] = useState('');
  const [thayDoiNguoiKy, setThayDoiNguoiKy] = useState('');
  const [thayDoiNoiDungGoc, setThayDoiNoiDungGoc] = useState('');
  const [thayDoiNoiDungMoi, setThayDoiNoiDungMoi] = useState('');
  const [thayDoiGhiChu, setThayDoiGhiChu] = useState('');
  const [thayDoiNhomHoSo, setThayDoiNhomHoSo] = useState('1. Hồ sơ pháp lý & Quyết định phân công');
  const [thayDoiFileTen, setThayDoiFileTen] = useState('');
  const [thayDoiFileUrl, setThayDoiFileUrl] = useState<string | null>(null);
  const thayDoiFileInputRef = useRef<HTMLInputElement>(null);

  // Modal Nộp / Tiếp nhận báo cáo tháng (Hỗ trợ tích hợp 1 lần nhiều địa bàn)
  const [isNopBaoCaoOpen, setIsNopBaoCaoOpen] = useState(false);
  const [baoCaoSelectedDiaBanIds, setBaoCaoSelectedDiaBanIds] = useState<string[]>([]);
  const [baoCaoTieuDe, setBaoCaoTieuDe] = useState('');
  const [baoCaoThangNum, setBaoCaoThangNum] = useState(10);
  const [baoCaoNam, setBaoCaoNam] = useState(2026);
  const [baoCaoTinhTrang, setBaoCaoTinhTrang] = useState<BaoCaoThangStatus>('DA_NOP_DUNG_HAN');
  const [baoCaoCanBoId, setBaoCaoCanBoId] = useState('');
  const [baoCaoCanBoTen, setBaoCaoCanBoTen] = useState('');
  const [baoCaoFileTen, setBaoCaoFileTen] = useState('');
  const [baoCaoFileLoai, setBaoCaoFileLoai] = useState<'docx' | 'pdf' | 'doc'>('docx');
  const [baoCaoFileUrl, setBaoCaoFileUrl] = useState<string | null>(null);
  const [baoCaoNoiDung, setBaoCaoNoiDung] = useState('');
  const [baoCaoGhiChu, setBaoCaoGhiChu] = useState('');

  // Bộ lọc cho Phân hệ Báo cáo theo tháng
  const [baoCaoSubView, setBaoCaoSubView] = useState<'DANH_SACH_BC' | 'TIEN_DO_DIA_BAN'>('DANH_SACH_BC');
  const [filterBaoCaoThangMonth, setFilterBaoCaoThangMonth] = useState<number>(10);
  const [filterBaoCaoThangYear, setFilterBaoCaoThangYear] = useState<number>(2026);
  const [filterBaoCaoCanBo, setFilterBaoCaoCanBo] = useState<string>('ALL');

  // Bộ lọc cho Phân hệ Kho tài liệu địa bàn
  const [filterKhoNhom, setFilterKhoNhom] = useState<string>('ALL');
  const [filterKhoDiaBan, setFilterKhoDiaBan] = useState<string>('ALL');
  const [filterKhoLoaiFile, setFilterKhoLoaiFile] = useState<string>('ALL');
  const [searchKhoQuery, setSearchKhoQuery] = useState<string>('');

  // Modal Thêm tài liệu mới
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [uploadTargetDonViId, setUploadTargetDonViId] = useState<string>('');
  const [docNhom, setDocNhom] = useState('3. Báo cáo định kỳ (tháng, quý, năm)');
  const [docTheLoai, setDocTheLoai] = useState<string>('Báo cáo');
  const [docSoVanBan, setDocSoVanBan] = useState<string>('');
  const [docTrichYeu, setDocTrichYeu] = useState<string>('');
  const [docNguoiKy, setDocNguoiKy] = useState<string>('');
  const [docNgayBanHanh, setDocNgayBanHanh] = useState<string>(new Date().toLocaleDateString('vi-VN'));
  const [docTenFile, setDocTenFile] = useState('');
  const [docLoaiFile, setDocLoaiFile] = useState<'docx' | 'doc' | 'pdf'>('docx');
  const [docFileUrl, setDocFileUrl] = useState<string | null>(null);
  const [docFileSize, setDocFileSize] = useState<number>(320000);
  const [docMoTa, setDocMoTa] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baoCaoFileInputRef = useRef<HTMLInputElement>(null);
  const canCuFileInputRef = useRef<HTMLInputElement>(null);

  // Modal bổ sung / cập nhật căn cứ văn bản cho phần lịch sử phụ trách
  const [isBoSungCanCuOpen, setIsBoSungCanCuOpen] = useState(false);
  const [targetHistoryEntry, setTargetHistoryEntry] = useState<LichSuPhuTrachDiaBan | null>(null);
  const [canCuSoVanBan, setCanCuSoVanBan] = useState('');
  const [canCuNgayBanHanh, setCanCuNgayBanHanh] = useState('');
  const [canCuCoQuan, setCanCuCoQuan] = useState('Ủy ban Kiểm tra Đảng ủy');
  const [canCuTrichYeu, setCanCuTrichYeu] = useState('');
  const [canCuLyDo, setCanCuLyDo] = useState('');
  const [canCuTenFile, setCanCuTenFile] = useState('');
  const [canCuError, setCanCuError] = useState<string | null>(null);

  const canEdit = user.vai_tro === 'ADMIN' || user.vai_tro === 'BIEN_TAP';
  const isAdmin = user.vai_tro === 'ADMIN';

  // Modal xác nhận xóa hồ sơ địa bàn
  const [deleteTargetRecord, setDeleteTargetRecord] = useState<DiaBanRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  // Multi-select chọn nhiều hồ sơ địa bàn để xóa
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [batchDeleteRecords, setBatchDeleteRecords] = useState<DiaBanRecord[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const handleToggleSelectRecord = (id: string) => {
    const next = new Set(selectedRecordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRecordIds(next);
  };

  const handleConfirmDeleteRecord = async (target: DiaBanRecord) => {
    setIsDeletingRecord(true);
    try {
      // 1. Tự động xóa các tệp tài liệu của địa bàn trên Google Drive và Kho PDF
      const filesToDelete = files.filter((f) => f.don_vi_id === target.id);
      for (const f of filesToDelete) {
        const driveId = f.google_drive_id || extractGoogleDriveFileId(f.file_url || f.url);
        if (driveId) {
          try {
            await deleteFileFromGoogleDrive(driveId);
          } catch (e) {
            console.warn('Lỗi xóa tệp địa bàn trên Google Drive:', e);
          }
        }
        await api.deletePdf('hsdb-' + f.id).catch(() => {});
        await api.deletePdf(f.id).catch(() => {});
      }

      // Xóa các báo cáo tháng liên quan trên Google Drive và Kho PDF
      const bcsToDelete = baoCaoThangList.filter((b) => b.danh_sach_don_vi_ids?.includes(target.id));
      for (const b of bcsToDelete) {
        const bDriveId = (b as any).google_drive_id || extractGoogleDriveFileId(b.file_url);
        if (bDriveId) {
          try {
            await deleteFileFromGoogleDrive(bDriveId);
          } catch (e) {
            console.warn('Lỗi xóa tệp báo cáo trên Google Drive:', e);
          }
        }
        await api.deletePdf('bc-' + b.id).catch(() => {});
      }

      // 2. Lưu ID vào danh sách đã xóa để ngăn tự động nạp lại
      const deletedIds = getDeletedDiaBanIds();
      deletedIds.add(target.id);
      localStorage.setItem(STORAGE_DELETED_DIA_BAN_IDS, JSON.stringify(Array.from(deletedIds)));

      // Xóa đồng bộ trên Firestore Cloud bằng centralDataService (kèm tombstone)
      await centralDataService.deleteDoc('ho_so_dia_ban_records', target.id);
      const relatedFiles = files.filter((f) => f.don_vi_id === target.id);
      for (const f of relatedFiles) {
        await centralDataService.deleteDoc('ho_so_dia_ban_files', f.id).catch(() => {});
      }

      // 3. Xóa khỏi records
      setRecords((prev) => {
        const updated = prev.filter((r) => r.id !== target.id);
        localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(updated));
        return updated;
      });

      // 4. Xóa các tài liệu liên quan trong kho tài liệu địa bàn
      setFiles((prev) => {
        const updated = prev.filter((f) => f.don_vi_id !== target.id);
        localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(updated));
        return updated;
      });

      // 5. Cập nhật các báo cáo tháng
      setBaoCaoThangList((prev) => {
        const updated = prev.filter(
          (b) => !b.danh_sach_don_vi_ids?.includes(target.id)
        );
        localStorage.setItem(STORAGE_BAO_CAO_THANG, JSON.stringify(updated));
        return updated;
      });

      // 6. Nếu đang mở modal chi tiết hồ sơ này thì đóng lại
      if (selectedRecord?.id === target.id) {
        setSelectedRecord(null);
      }

      setDeleteTargetRecord(null);
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
    } catch (err) {
      console.error('Lỗi khi xóa hồ sơ địa bàn:', err);
    } finally {
      setIsDeletingRecord(false);
    }
  };

  const handleConfirmBatchDeleteRecords = async (targets: DiaBanRecord[]) => {
    if (!targets || targets.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const targetIds = new Set(targets.map((t) => t.id));

      // 1. Tự động xóa các tệp tài liệu của các địa bàn trên Google Drive và Kho PDF
      const filesToDelete = files.filter((f) => targetIds.has(f.don_vi_id));
      for (const f of filesToDelete) {
        const driveId = f.google_drive_id || extractGoogleDriveFileId(f.file_url || f.url);
        if (driveId) {
          try {
            await deleteFileFromGoogleDrive(driveId);
          } catch (e) {
            console.warn('Lỗi xóa tệp địa bàn trên Google Drive:', e);
          }
        }
        await api.deletePdf('hsdb-' + f.id).catch(() => {});
        await api.deletePdf(f.id).catch(() => {});
      }

      // Xóa các báo cáo tháng liên quan trên Google Drive và Kho PDF
      const bcsToDelete = baoCaoThangList.filter((b) =>
        b.danh_sach_don_vi_ids?.some((id) => targetIds.has(id))
      );
      for (const b of bcsToDelete) {
        const bDriveId = (b as any).google_drive_id || extractGoogleDriveFileId(b.file_url);
        if (bDriveId) {
          try {
            await deleteFileFromGoogleDrive(bDriveId);
          } catch (e) {
            console.warn('Lỗi xóa tệp báo cáo trên Google Drive:', e);
          }
        }
        await api.deletePdf('bc-' + b.id).catch(() => {});
      }

      // 2. Lưu các ID vào danh sách đã xóa để ngăn tự động nạp lại
      const deletedIds = getDeletedDiaBanIds();
      targets.forEach((t) => deletedIds.add(t.id));
      localStorage.setItem(STORAGE_DELETED_DIA_BAN_IDS, JSON.stringify(Array.from(deletedIds)));

      // Xóa đồng bộ trên Firestore Cloud bằng centralDataService (kèm tombstones)
      await centralDataService.batchDelete('ho_so_dia_ban_records', Array.from(targetIds));
      const relatedFiles = files.filter((f) => targetIds.has(f.don_vi_id || ''));
      for (const f of relatedFiles) {
        await centralDataService.deleteDoc('ho_so_dia_ban_files', f.id).catch(() => {});
      }

      // 3. Xóa khỏi records
      setRecords((prev) => {
        const updated = prev.filter((r) => !targetIds.has(r.id));
        localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(updated));
        return updated;
      });

      // 4. Xóa các tài liệu liên quan trong kho tài liệu địa bàn
      setFiles((prev) => {
        const updated = prev.filter((f) => !targetIds.has(f.don_vi_id));
        localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(updated));
        return updated;
      });

      // 5. Cập nhật các báo cáo tháng
      setBaoCaoThangList((prev) => {
        const updated = prev.filter(
          (b) => !b.danh_sach_don_vi_ids?.some((id) => targetIds.has(id))
        );
        localStorage.setItem(STORAGE_BAO_CAO_THANG, JSON.stringify(updated));
        return updated;
      });

      // 6. Nếu đang mở modal chi tiết của hồ sơ nằm trong danh sách xóa thì đóng lại
      if (selectedRecord && targetIds.has(selectedRecord.id)) {
        setSelectedRecord(null);
      }

      // 7. Xóa lựa chọn đã chọn & đóng modal
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
      setBatchDeleteRecords([]);

      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
    } catch (err) {
      console.error('Lỗi khi xóa nhiều hồ sơ địa bàn:', err);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Nạp danh sách đơn vị và người dùng (Tự động đồng bộ với các tài khoản được phân công quản trị)
  const syncUsersAndRecords = (usrs: User[]) => {
    setUsersList(usrs);
    setRecords((prev) => {
      const userMap = new Map(usrs.map((u) => [u.id, u]));
      let changed = false;
      const updated = prev.map((r) => {
        if (r.can_bo_phu_trach_id) {
          const u = userMap.get(r.can_bo_phu_trach_id);
          if (u) {
            const newTen = `Đ/c ${u.ho_ten}`;
            const newChucVu = u.chuc_danh || (u.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT');
            if (r.can_bo_phu_trach_ten !== newTen || r.can_bo_chuc_vu !== newChucVu) {
              changed = true;
              return { ...r, can_bo_phu_trach_ten: newTen, can_bo_chuc_vu: newChucVu };
            }
          }
        }
        return r;
      });
      if (changed) {
        localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  };

  useEffect(() => {
    Promise.all([
      api.getAllDonVi(),
      api.getAllUsers(),
      api.getDiaBanRecords().catch(() => []),
      api.getPhanCongDiaBan().catch(() => []),
    ])
      .then(([dvs, usrs, serverRecords, serverAssignments]) => {
        syncUsersAndRecords(usrs);

        setRecords((prev) => {
          const deletedIds = getDeletedDiaBanIds();
          const dvIdSet = new Set(dvs.map((d) => d.id));
          const dvMap = new Map(dvs.map((d) => [d.id, d]));

          // Ưu tiên nạp từ server nếu có
          const baseRecords = Array.isArray(serverRecords) && serverRecords.length > 0 ? serverRecords : prev;

          // Lọc bỏ các bản ghi đã xóa
          const validPrev = baseRecords.filter((r) => !deletedIds.has(r.id) && (dvs.length === 0 || dvIdSet.has(r.id)));
          const existingIds = new Set(validPrev.map((r) => r.id));
          const newRecords: DiaBanRecord[] = [];

          // 1. Cập nhật tên địa bàn mới nhất từ danh mục DonVi gốc cho các bản ghi hiện có
          const updatedPrev = validPrev.map((r) => {
            const org = dvMap.get(r.id);
            if (!org) return r;

            // Kiểm tra phân công từ serverAssignments nếu có
            let canBoId = r.can_bo_phu_trach_id;
            let canBoTen = r.can_bo_phu_trach_ten;
            let canBoChucVu = r.can_bo_chuc_vu;
            if (Array.isArray(serverAssignments) && serverAssignments.length > 0) {
              const assigned = serverAssignments.find((a) => a.don_vi_ids?.includes(r.id));
              if (assigned) {
                canBoId = assigned.user_id;
                canBoTen = assigned.user_name || r.can_bo_phu_trach_ten;
                const usr = usrs.find((u) => u.id === assigned.user_id);
                if (usr) {
                  canBoTen = `Đ/c ${usr.ho_ten}`;
                  canBoChucVu = usr.chuc_danh || canBoChucVu;
                }
              }
            }

            return {
              ...r,
              ten_dia_ban: org.ten, // Luôn đồng bộ tên mới nhất từ danh mục chung
              loai_to_chuc: org.loai,
              trang_thai_to_chuc: org.trang_thai,
              can_bo_phu_trach_id: canBoId,
              can_bo_phu_trach_ten: canBoTen,
              can_bo_chuc_vu: canBoChucVu,
            };
          });

          // 2. Tự động thêm hồ sơ địa bàn cho các đơn vị mới bổ sung trong danh mục chung
          dvs.forEach((dv) => {
            if (!existingIds.has(dv.id) && !deletedIds.has(dv.id)) {
              let canBoId: string | undefined;
              let canBoTen = 'Chưa phân công';
              let canBoChucVu = '';
              if (Array.isArray(serverAssignments) && serverAssignments.length > 0) {
                const assigned = serverAssignments.find((a) => a.don_vi_ids?.includes(dv.id));
                if (assigned) {
                  canBoId = assigned.user_id;
                  canBoTen = assigned.user_name || 'Chưa phân công';
                  const usr = usrs.find((u) => u.id === assigned.user_id);
                  if (usr) {
                    canBoTen = `Đ/c ${usr.ho_ten}`;
                    canBoChucVu = usr.chuc_danh || '';
                  }
                }
              }

              newRecords.push({
                id: dv.id,
                ten_dia_ban: dv.ten,
                loai_to_chuc: dv.loai,
                trang_thai_to_chuc: dv.trang_thai,
                can_bo_phu_trach_id: canBoId,
                can_bo_phu_trach_ten: canBoTen,
                can_bo_chuc_vu: canBoChucVu,
                thoi_gian_phan_cong: canBoId ? new Date().toLocaleDateString('vi-VN') : 'Chưa có',
                van_ban_phan_cong: canBoId ? 'Quyết định phân công' : 'Chưa ban hành',
                tinh_trang_bao_cao_thang: 'CHUA_NOP',
                thang_hien_tai: 'T10/2026',
                so_van_de_theo_doi: 0,
                danh_sach_van_de: [],
                so_chi_dao_chua_hoan_thanh: 0,
                danh_sach_chi_dao: [],
                thoi_diem_cap_nhat_gan_nhat: new Date().toLocaleDateString('vi-VN'),
                nguoi_cap_nhat_gan_nhat: 'Hệ thống',
                so_luong_tai_lieu: 0,
              });
            }
          });

          const combined = [...updatedPrev, ...newRecords];
          localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(combined));
          api.saveDiaBanRecords(combined).catch(() => {});
          return combined;
        });
      })
      .catch((err) => console.error('Lỗi nạp dữ liệu hồ sơ địa bàn:', err));
  }, []);

  // Lắng nghe sự kiện tài khoản quản trị cập nhật (từ Quản lý Tài khoản)
  useEffect(() => {
    const handleUsersUpdated = () => {
      api.getAllUsers()
        .then((usrs) => {
          syncUsersAndRecords(usrs);
        })
        .catch((err) => console.error('Lỗi đồng bộ danh sách người dùng:', err));
    };

    window.addEventListener('ubkt_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('ubkt_users_updated', handleUsersUpdated);
  }, []);

  // Lắng nghe sự kiện phân công quản lý cập nhật (từ Cơ cấu tổ chức / DonViManager)
  useEffect(() => {
    const handleAssignmentsUpdated = () => {
      try {
        const saved = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
        if (saved) {
          setRecords(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Lỗi nạp cập nhật phân công:', err);
      }
    };

    window.addEventListener('ubkt_assignments_updated', handleAssignmentsUpdated);
    return () => window.removeEventListener('ubkt_assignments_updated', handleAssignmentsUpdated);
  }, []);

  // Danh sách chương trình KT-GS & các văn bản thay đổi, bổ sung
  const [chuongTrinhList, setChuongTrinhList] = useState<ChuongTrinhKtGs[]>([]);

  const loadChuongTrinh = () => {
    api.getAllChuongTrinh()
      .then(setChuongTrinhList)
      .catch((err) => console.error('Lỗi nạp chương trình KT-GS:', err));
  };

  useEffect(() => {
    loadChuongTrinh();
  }, []);

  // Chuyển đổi chuỗi ngày DD/MM/YYYY hoặc YYYY-MM-DD sang timestamp để sắp xếp
  const parseDateVN = (dStr?: string): number => {
    if (!dStr) return 0;
    const parts = dStr.trim().split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
      } else {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
    }
    const t = Date.parse(dStr);
    return isNaN(t) ? 0 : t;
  };

  // Lắng nghe sự kiện cập nhật phân công và hồ sơ địa bàn từ Cơ cấu tổ chức / Phân công quản lý
  useEffect(() => {
    const handleSyncAssignments = () => {
      try {
        const saved = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecords(parsed);
            setSelectedRecord((curr) => {
              if (!curr) return null;
              return parsed.find((r: DiaBanRecord) => r.id === curr.id) || curr;
            });
          }
        }

        const rawFiles = localStorage.getItem(STORAGE_HO_SO_FILES);
        if (rawFiles) {
          try {
            setFiles(JSON.parse(rawFiles));
          } catch {}
        }

        const rawBc = localStorage.getItem(STORAGE_BAO_CAO_THANG);
        if (rawBc) {
          try {
            setBaoCaoThangList(JSON.parse(rawBc));
          } catch {}
        }
      } catch (err) {
        console.error('Lỗi đồng bộ hồ sơ địa bàn:', err);
      }
    };

    window.addEventListener('ubkt_assignments_updated', handleSyncAssignments);
    window.addEventListener('ubkt_diaban_records_updated', handleSyncAssignments);
    window.addEventListener('ubkt_kho_du_lieu_updated', handleSyncAssignments);
    return () => {
      window.removeEventListener('ubkt_assignments_updated', handleSyncAssignments);
      window.removeEventListener('ubkt_diaban_records_updated', handleSyncAssignments);
      window.removeEventListener('ubkt_kho_du_lieu_updated', handleSyncAssignments);
    };
  }, []);

  // Lắng nghe sự kiện điều hướng từ Bảng đối chiếu Thay đổi, Bổ sung sang Hồ sơ địa bàn
  useEffect(() => {
    const handleUbktNavigate = (e: any) => {
      const targetId = e?.detail?.donViId || localStorage.getItem('ubkt_target_dia_ban_id');
      const targetTen = e?.detail?.tenDonVi;
      if (targetId || targetTen) {
        setRecords((currentRecords) => {
          const match = currentRecords.find(
            (r) =>
              (targetId && r.id === targetId) ||
              (targetTen && r.ten_dia_ban.toLowerCase().includes(targetTen.toLowerCase()))
          );
          if (match) {
            setSelectedRecord(match);
            setModalTab('chuong_trinh_nhiem_ky');
            localStorage.removeItem('ubkt_target_dia_ban_id');
          }
          return currentRecords;
        });
      }
    };

    // Kiểm tra ngay khi mount nếu có target sẵn trong localStorage
    const pendingId = localStorage.getItem('ubkt_target_dia_ban_id');
    if (pendingId) {
      setRecords((currentRecords) => {
        const match = currentRecords.find((r) => r.id === pendingId);
        if (match) {
          setSelectedRecord(match);
          setModalTab('chuong_trinh_nhiem_ky');
          localStorage.removeItem('ubkt_target_dia_ban_id');
        }
        return currentRecords;
      });
    }

    window.addEventListener('ubkt_navigate', handleUbktNavigate as EventListener);
    return () => {
      window.removeEventListener('ubkt_navigate', handleUbktNavigate as EventListener);
    };
  }, []);

  // Lưu dữ liệu hồ sơ vào storage và đồng bộ Cloud
  const saveRecords = (newRecords: DiaBanRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(newRecords));
    api.saveDiaBanRecords(newRecords).catch(console.error);
    newRecords.forEach((r) => {
      centralDataService.saveDoc('ho_so_dia_ban_records', r.id, r).catch(() => {});
    });
  };

  // Lưu tài liệu vào storage và đồng bộ Cloud
  const saveFiles = (newFiles: HoSoDiaBanFile[]) => {
    setFiles(newFiles);
    localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(newFiles));
    newFiles.forEach((f) => {
      centralDataService.saveDoc('ho_so_dia_ban_files', f.id, f).catch(() => {});
    });
  };

  // Badge tình trạng nộp báo cáo tháng
  const renderBaoCaoStatusBadge = (status: BaoCaoThangStatus) => {
    switch (status) {
      case 'DA_NOP_DUNG_HAN':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã nộp (Đúng hạn)</span>
          </span>
        );
      case 'DA_NOP_MUON':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Đã nộp (Muộn)</span>
          </span>
        );
      case 'CHO_DUYET':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Chờ UBKT duyệt</span>
          </span>
        );
      case 'CHUA_NOP':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Chưa nộp báo cáo</span>
          </span>
        );
    }
  };

  // Badge trạng thái hoàn thành hồ sơ địa bàn
  const renderTrangThaiHoSoBadge = (status?: TrangThaiHoSoDiaBan) => {
    const isCompleted = status === 'DA_KET_THUC';
    if (isCompleted) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Đã kết thúc hồ sơ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
        <Clock className="w-3.5 h-3.5 text-blue-600" />
        <span>Đang theo dõi</span>
      </span>
    );
  };

  // Lọc danh sách địa bàn
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        r.ten_dia_ban.toLowerCase().includes(q) ||
        r.can_bo_phu_trach_ten?.toLowerCase().includes(q) ||
        r.van_ban_phan_cong?.toLowerCase().includes(q);

      let matchCanBo = true;
      if (filterCanBo === 'MINE') {
        matchCanBo = r.can_bo_phu_trach_id === user.id;
      } else if (filterCanBo === 'UNASSIGNED') {
        matchCanBo = !r.can_bo_phu_trach_id || r.can_bo_phu_trach_ten === 'Chưa phân công';
      } else if (filterCanBo !== 'ALL') {
        matchCanBo = r.can_bo_phu_trach_id === filterCanBo;
      }

      const matchBaoCao = filterBaoCao === 'ALL' || r.tinh_trang_bao_cao_thang === filterBaoCao;

      let matchVanDe = true;
      if (filterVanDe === 'HAS_ISSUE') {
        matchVanDe = r.so_van_de_theo_doi > 0;
      } else if (filterVanDe === 'HAS_DIRECTIVE') {
        matchVanDe = r.so_chi_dao_chua_hoan_thanh > 0;
      }

      let matchTrangThai = true;
      if (filterTrangThaiHoSo === 'DANG_THEO_DOI') {
        matchTrangThai = (r.trang_thai_ho_so || 'DANG_THEO_DOI') === 'DANG_THEO_DOI';
      } else if (filterTrangThaiHoSo === 'DA_KET_THUC') {
        matchTrangThai = r.trang_thai_ho_so === 'DA_KET_THUC';
      }

      return matchQuery && matchCanBo && matchBaoCao && matchVanDe && matchTrangThai;
    });
  }, [records, searchQuery, filterCanBo, filterBaoCao, filterVanDe, filterTrangThaiHoSo, user.id]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = records.length;
    const dangTheoDoi = records.filter(
      (r) => (r.trang_thai_ho_so || 'DANG_THEO_DOI') === 'DANG_THEO_DOI'
    ).length;
    const daKetThuc = records.filter((r) => r.trang_thai_ho_so === 'DA_KET_THUC').length;
    const daNop = records.filter(
      (r) => r.tinh_trang_bao_cao_thang === 'DA_NOP_DUNG_HAN' || r.tinh_trang_bao_cao_thang === 'DA_NOP_MUON'
    ).length;
    const chuaNop = records.filter((r) => r.tinh_trang_bao_cao_thang === 'CHUA_NOP').length;
    const tongVanDe = records.reduce((acc, cur) => acc + (cur.so_van_de_theo_doi || 0), 0);
    const tongChiDao = records.reduce((acc, cur) => acc + (cur.so_chi_dao_chua_hoan_thanh || 0), 0);
    const myCount = records.filter((r) => r.can_bo_phu_trach_id === user.id).length;
    return { total, dangTheoDoi, daKetThuc, daNop, chuaNop, tongVanDe, tongChiDao, myCount };
  }, [records, user.id]);

  // Các văn bản thay đổi, bổ sung liên quan đến địa bàn đang chọn
  const relatedThayDoiList = useMemo(() => {
    if (!selectedRecord) return [];
    const list: (ThayDoiBoSungKtGs & { ten_chuong_trinh?: string; khoa_nhiem_ky?: string })[] = [];
    chuongTrinhList.forEach((ct) => {
      (ct.danh_sach_thay_doi_bo_sung || []).forEach((td) => {
        const isMatchDonVi =
          td.don_vi_id === selectedRecord.id ||
          td.don_vi_id === 'all' ||
          (td.ten_don_vi && selectedRecord.ten_dia_ban.toLowerCase().includes(td.ten_don_vi.toLowerCase())) ||
          (td.ten_don_vi && td.ten_don_vi.toLowerCase().includes(selectedRecord.ten_dia_ban.toLowerCase()));
        if (isMatchDonVi) {
          list.push({
            ...td,
            ten_chuong_trinh: ct.noi_dung || ct.ten_chuong_trinh || 'Chương trình toàn khóa',
            khoa_nhiem_ky: ct.nhiem_ky || ct.khoa_nhiem_ky || '2025 - 2030',
          });
        }
      });
    });
    return list;
  }, [selectedRecord, chuongTrinhList]);

  // Chương trình nhiệm kỳ áp dụng cho toàn Đảng bộ / địa bàn
  const activeNhiemKyPrograms = useMemo(() => {
    return chuongTrinhList.filter((ct) => ct.loai_chuong_trinh === 'NHIEM_KY');
  }, [chuongTrinhList]);

  // Quyền nộp báo cáo: Chỉ người được phân công quản lý mới được nộp báo cáo của mình trừ admin
  const isUserAssignedToRecord = (record: DiaBanRecord): boolean => {
    if (!user) return false;
    if (user.vai_tro === 'ADMIN') return true;

    // 1. So khớp can_bo_phu_trach_id với user.id
    if (record.can_bo_phu_trach_id && record.can_bo_phu_trach_id === user.id) {
      return true;
    }

    // 2. So khớp theo tên hoặc tên đăng nhập
    const normUserTen = (user.ho_ten || '').toLowerCase().trim();
    const normUserNick = (user.ten_dang_nhap || '').toLowerCase().trim();
    const normRecordCb = (record.can_bo_phu_trach_ten || '')
      .toLowerCase()
      .replace(/^đ\/c\s*/i, '')
      .replace(/^đồng chí\s*/i, '')
      .trim();

    if (normRecordCb && normUserTen) {
      if (normRecordCb === normUserTen || normRecordCb.includes(normUserTen) || normUserTen.includes(normRecordCb)) {
        return true;
      }
    }

    if (normRecordCb && normUserNick) {
      if (normRecordCb.includes(normUserNick) || normUserNick.includes(normRecordCb)) {
        return true;
      }
    }

    return false;
  };

  const isOfficerOfGroup = (group: { can_bo_id?: string; can_bo_ten: string; records: DiaBanRecord[] }): boolean => {
    if (user.vai_tro === 'ADMIN') return true;
    if (group.can_bo_id && group.can_bo_id === user.id) return true;
    const normUserTen = (user.ho_ten || '').toLowerCase().trim();
    const normUserNick = (user.ten_dang_nhap || '').toLowerCase().trim();
    const normGroupTen = (group.can_bo_ten || '')
      .toLowerCase()
      .replace(/^đ\/c\s*/i, '')
      .replace(/^đồng chí\s*/i, '')
      .trim();
    if (normGroupTen && normUserTen && (normGroupTen.includes(normUserTen) || normUserTen.includes(normGroupTen))) return true;
    if (normGroupTen && normUserNick && (normGroupTen.includes(normUserNick) || normUserNick.includes(normGroupTen))) return true;
    return false;
  };

  // Quyền quản lý vấn đề / chỉ đạo / hoàn thành hồ sơ địa bàn: Quản trị viên, Ban biên tập hoặc Cán bộ phụ trách địa bàn (kế thừa đầy đủ hồ sơ)
  const canManageSelectedRecord = canEdit || (selectedRecord ? isUserAssignedToRecord(selectedRecord) : false);

  // ── XỬ LÝ ĐỔI CÁN BỘ PHỤ TRÁCH & BÀN GIAO ĐỊA BÀN (LƯU LỊCH SỬ KẾ THỪA HỒ SƠ) ──
  const handleOpenDoiCanBo = (record: DiaBanRecord) => {
    setDoiCanBoRecord(record);
    setDoiCanBoNewUserId('');
    setDoiCanBoVanBan(`QĐ số ${Math.floor(Math.random() * 20 + 10)}-QĐ/UBKT ngày ${new Date().toLocaleDateString('vi-VN')}`);
    setDoiCanBoNgay(new Date().toLocaleDateString('vi-VN'));
    setDoiCanBoLyDo('Luân chuyển cán bộ phụ trách địa bàn theo định kỳ');
    setDoiCanBoGhiChu('');
    setDoiCanBoXacNhan(true);
    setIsDoiCanBoOpen(true);
  };

  const handleSaveDoiCanBo = () => {
    if (!isAdmin) {
      alert('Từ chối thao tác: Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền phân công lại cán bộ phụ trách.');
      return;
    }
    if (!doiCanBoRecord || !doiCanBoNewUserId) {
      alert('Vui lòng chọn cán bộ phụ trách mới!');
      return;
    }
    const newUser = usersList.find((u) => u.id === doiCanBoNewUserId);
    if (!newUser) {
      alert('Không tìm thấy thông tin cán bộ được chọn!');
      return;
    }

    const todayStr = doiCanBoNgay || new Date().toLocaleDateString('vi-VN');
    const existingHistory: LichSuPhuTrachDiaBan[] = Array.isArray(doiCanBoRecord.lich_su_phu_trach)
      ? [...doiCanBoRecord.lich_su_phu_trach]
      : [];

    // Chốt thời gian kết thúc của cán bộ trước (nếu chưa có ngày kết thúc)
    const updatedHistory = existingHistory.map((item, idx) => {
      if (idx === existingHistory.length - 1 && !item.den_ngay) {
        return {
          ...item,
          den_ngay: todayStr,
        };
      }
      return item;
    });

    // Thêm bản ghi lịch sử của cán bộ mới được phân công
    const newHistoryEntry: LichSuPhuTrachDiaBan = {
      id: `ls-${Date.now()}`,
      can_bo_id: newUser.id,
      can_bo_ten: `Đ/c ${newUser.ho_ten}`,
      can_bo_chuc_vu:
        newUser.chuc_danh || (newUser.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT'),
      tu_ngay: todayStr,
      den_ngay: undefined,
      van_ban_phan_cong: doiCanBoVanBan.trim() || 'QĐ phân công địa bàn',
      ly_do_thay_doi: doiCanBoLyDo.trim() || 'Luân chuyển cán bộ phụ trách địa bàn',
      nguoi_thuc_hien: user.ho_ten,
      created_at: new Date().toISOString(),
    };

    const finalHistory = [...updatedHistory, newHistoryEntry];

    const updated = records.map((r) => {
      if (r.id === doiCanBoRecord.id) {
        return {
          ...r,
          can_bo_phu_trach_id: newUser.id,
          can_bo_phu_trach_ten: `Đ/c ${newUser.ho_ten}`,
          can_bo_chuc_vu:
            newUser.chuc_danh || (newUser.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT'),
          thoi_gian_phan_cong: todayStr,
          van_ban_phan_cong: doiCanBoVanBan.trim() || r.van_ban_phan_cong,
          lich_su_phu_trach: finalHistory,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updated);
    if (selectedRecord && selectedRecord.id === doiCanBoRecord.id) {
      setSelectedRecord(updated.find((r) => r.id === doiCanBoRecord.id) || null);
    }

    // Đồng bộ tức thì ngược lại phân hệ Cơ cấu tổ chức (ubkt_phan_cong_dia_ban)
    try {
      const rawAssign = localStorage.getItem('ubkt_phan_cong_dia_ban');
      let currentAssigns: any[] = rawAssign ? JSON.parse(rawAssign) : [];
      if (Array.isArray(currentAssigns)) {
        // Gỡ bỏ đơn vị này khỏi bất kỳ cán bộ nào khác (đảm bảo nghiêm ngặt 1 cán bộ / 1 đơn vị)
        currentAssigns = currentAssigns.map((a) => ({
          ...a,
          don_vi_ids: (a.don_vi_ids || []).filter((id: string) => id !== doiCanBoRecord.id),
        }));

        const userIdx = currentAssigns.findIndex((a) => a.user_id === newUser.id);
        if (userIdx !== -1) {
          currentAssigns[userIdx].don_vi_ids = [
            ...(currentAssigns[userIdx].don_vi_ids || []).filter((id: string) => id !== doiCanBoRecord.id),
            doiCanBoRecord.id,
          ];
        } else {
          currentAssigns.push({
            user_id: newUser.id,
            user_name: newUser.ho_ten,
            don_vi_ids: [doiCanBoRecord.id],
            updated_at: new Date().toISOString(),
          });
        }
        localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(currentAssigns));
        window.dispatchEvent(new CustomEvent('ubkt_assignments_updated', { detail: currentAssigns }));
        window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated', { detail: updated }));
      }
    } catch (e) {
      console.error('Lỗi đồng bộ phân công địa bàn:', e);
    }

    setIsDoiCanBoOpen(false);
    setDoiCanBoRecord(null);
  };

  // ── XỬ LÝ BỔ SUNG / CẬP NHẬT CĂN CỨ VĂN BẢN CHO PHẦN LỊCH SỬ PHỤ TRÁCH ──
  const handleOpenBoSungCanCu = (entry?: LichSuPhuTrachDiaBan | null) => {
    if (entry) {
      setTargetHistoryEntry(entry);
      setCanCuSoVanBan(entry.so_quyet_dinh || entry.van_ban_phan_cong || '');
      setCanCuNgayBanHanh(entry.ngay_ban_hanh_qd || '');
      setCanCuCoQuan(entry.co_quan_ban_hanh || 'Ủy ban Kiểm tra Đảng ủy');
      setCanCuTrichYeu(entry.can_cu_van_ban || '');
      setCanCuLyDo(entry.ly_do_thay_doi || '');
      setCanCuTenFile(entry.file_van_ban || '');
    } else {
      setTargetHistoryEntry(null);
      setCanCuSoVanBan(selectedRecord?.van_ban_phan_cong || '');
      setCanCuNgayBanHanh(new Date().toLocaleDateString('vi-VN'));
      setCanCuCoQuan('Ủy ban Kiểm tra Đảng ủy');
      setCanCuTrichYeu(`Quyết định phân công phụ trách ${selectedRecord?.ten_dia_ban || 'địa bàn'}`);
      setCanCuLyDo('');
      setCanCuTenFile('');
    }
    setCanCuError(null);
    setIsBoSungCanCuOpen(true);
  };

  const handleSaveBoSungCanCu = () => {
    if (!isAdmin) {
      alert('Từ chối thao tác: Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền bổ sung căn cứ văn bản phân công.');
      return;
    }
    if (!selectedRecord) return;
    if (!canCuSoVanBan.trim() && !canCuTrichYeu.trim()) {
      setCanCuError('Vui lòng nhập số hiệu văn bản hoặc trích yếu căn cứ.');
      return;
    }

    const formattedVb = canCuSoVanBan.trim()
      ? `${canCuSoVanBan.trim()}${canCuNgayBanHanh.trim() ? ` ngày ${canCuNgayBanHanh.trim()}` : ''}`
      : canCuTrichYeu.trim();

    const existingHistory = Array.isArray(selectedRecord.lich_su_phu_trach)
      ? [...selectedRecord.lich_su_phu_trach]
      : [];

    let updatedHistory: LichSuPhuTrachDiaBan[];

    if (targetHistoryEntry) {
      updatedHistory = existingHistory.map((h) => {
        if (h.id === targetHistoryEntry.id) {
          return {
            ...h,
            van_ban_phan_cong: formattedVb,
            so_quyet_dinh: canCuSoVanBan.trim(),
            ngay_ban_hanh_qd: canCuNgayBanHanh.trim(),
            co_quan_ban_hanh: canCuCoQuan.trim(),
            can_cu_van_ban: canCuTrichYeu.trim(),
            file_van_ban: canCuTenFile.trim() || h.file_van_ban,
            ly_do_thay_doi: canCuLyDo.trim() || h.ly_do_thay_doi,
          };
        }
        return h;
      });
    } else {
      const currentIdx = existingHistory.findIndex((h) => !h.den_ngay);
      if (currentIdx !== -1) {
        updatedHistory = [...existingHistory];
        updatedHistory[currentIdx] = {
          ...updatedHistory[currentIdx],
          van_ban_phan_cong: formattedVb,
          so_quyet_dinh: canCuSoVanBan.trim(),
          ngay_ban_hanh_qd: canCuNgayBanHanh.trim(),
          co_quan_ban_hanh: canCuCoQuan.trim(),
          can_cu_van_ban: canCuTrichYeu.trim(),
          file_van_ban: canCuTenFile.trim() || updatedHistory[currentIdx].file_van_ban,
          ly_do_thay_doi: canCuLyDo.trim() || updatedHistory[currentIdx].ly_do_thay_doi,
        };
      } else {
        updatedHistory = [
          ...existingHistory,
          {
            id: 'ls-' + Date.now(),
            can_bo_id: selectedRecord.can_bo_phu_trach_id,
            can_bo_ten: selectedRecord.can_bo_phu_trach_ten || 'Cán bộ phụ trách',
            can_bo_chuc_vu: selectedRecord.can_bo_chuc_vu || 'Ủy viên UBKT Đảng ủy',
            tu_ngay: selectedRecord.thoi_gian_phan_cong || new Date().toLocaleDateString('vi-VN'),
            den_ngay: undefined,
            van_ban_phan_cong: formattedVb,
            so_quyet_dinh: canCuSoVanBan.trim(),
            ngay_ban_hanh_qd: canCuNgayBanHanh.trim(),
            co_quan_ban_hanh: canCuCoQuan.trim(),
            can_cu_van_ban: canCuTrichYeu.trim(),
            file_van_ban: canCuTenFile.trim() || undefined,
            ly_do_thay_doi: canCuLyDo.trim() || 'Căn cứ quyết định phân công phụ trách',
            nguoi_thuc_hien: user.ho_ten,
            created_at: new Date().toISOString(),
          },
        ];
      }
    }

    // Tự động đồng bộ tệp văn bản căn cứ vào Kho tài liệu & hồ sơ địa bàn
    if (canCuTenFile.trim()) {
      const newFileItem: HoSoDiaBanFile = {
        id: 'file-cancu-' + Date.now(),
        don_vi_id: selectedRecord.id,
        ten_don_vi: selectedRecord.ten_dia_ban,
        the_loai_van_ban: 'Quyết định',
        so_van_ban: canCuSoVanBan.trim(),
        trich_yeu: canCuTrichYeu.trim() || `Quyết định phân công phụ trách địa bàn ${selectedRecord.ten_dia_ban}`,
        nguoi_ky: canCuCoQuan.trim(),
        ngay_ban_hanh: canCuNgayBanHanh.trim() || new Date().toLocaleDateString('vi-VN'),
        ten_file: canCuTenFile.trim(),
        loai_file: canCuTenFile.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx',
        dung_luong: 245000,
        loai_tai_lieu: '6. Quyết định phân công & Bàn giao hồ sơ',
        mo_ta: `Căn cứ văn bản phân công cán bộ: ${canCuTrichYeu.trim()}`,
        ngay_tao: new Date().toLocaleDateString('vi-VN'),
        nguoi_tao: user.ho_ten,
      };

      setFiles((prev) => {
        const next = [newFileItem, ...prev.filter((f) => f.ten_file !== canCuTenFile.trim())];
        localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(next));
        centralDataService.saveDoc('ho_so_dia_ban_files', newFileItem.id, newFileItem).catch(() => {});
        return next;
      });
    }

    const updatedRecords = records.map((r) => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          van_ban_phan_cong: formattedVb,
          lich_su_phu_trach: updatedHistory,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setSelectedRecord((curr) => {
      if (!curr) return null;
      return updatedRecords.find((r) => r.id === curr.id) || curr;
    });

    window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_assignments_updated'));
    window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));

    setIsBoSungCanCuOpen(false);
    setTargetHistoryEntry(null);
  };

  // ── XỬ LÝ KẾT THÚC HỒ SƠ ĐỊA BÀN KHI HOÀN THÀNH ĐỦ HỒ SƠ ──
  const handleOpenKetThucHoSo = (record: DiaBanRecord) => {
    setKetThucRecord(record);
    setKetThucNgay(new Date().toLocaleDateString('vi-VN'));
    setKetThucVanBan(`Báo cáo kết luận số ${Math.floor(Math.random() * 20 + 20)}-BC/UBKT hoàn thành hồ sơ`);
    setKetThucGhiChu(
      'Hồ sơ địa bàn đã thu thập đầy đủ 6 nhóm tài liệu, các báo cáo tháng đã tiếp nhận đầy đủ, không còn vấn đề phức tạp hoặc chỉ đạo tồn đọng.'
    );
    setIsKetThucModalOpen(true);
  };

  const handleSaveKetThucHoSo = () => {
    if (!ketThucRecord) return;
    const todayStr = ketThucNgay || new Date().toLocaleDateString('vi-VN');

    const updated = records.map((r) => {
      if (r.id === ketThucRecord.id) {
        return {
          ...r,
          trang_thai_ho_so: 'DA_KET_THUC' as TrangThaiHoSoDiaBan,
          ngay_ket_thuc_ho_so: todayStr,
          nguoi_ket_thuc: user.ho_ten,
          van_ban_ket_thuc: ketThucVanBan.trim() || 'Kết luận hoàn thành theo dõi',
          ghi_chu_ket_thuc: ketThucGhiChu.trim(),
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updated);
    if (selectedRecord && selectedRecord.id === ketThucRecord.id) {
      setSelectedRecord(updated.find((r) => r.id === ketThucRecord.id) || null);
    }

    setIsKetThucModalOpen(false);
    setKetThucRecord(null);
  };

  const handleReopenHoSo = (record: DiaBanRecord) => {
    if (!window.confirm(`Đồng chí có chắc chắn muốn mở lại theo dõi hồ sơ địa bàn: "${record.ten_dia_ban}"?`)) {
      return;
    }

    const updated = records.map((r) => {
      if (r.id === record.id) {
        return {
          ...r,
          trang_thai_ho_so: 'DANG_THEO_DOI' as TrangThaiHoSoDiaBan,
          ngay_ket_thuc_ho_so: null,
          nguoi_ket_thuc: null,
          van_ban_ket_thuc: null,
          ghi_chu_ket_thuc: null,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updated);
    if (selectedRecord && selectedRecord.id === record.id) {
      setSelectedRecord(updated.find((r) => r.id === record.id) || null);
    }
  };

  // ── XỬ LÝ VẤN ĐỀ THEO DÕI: THÊM / SỬA / XÓA / ĐÍNH KÈM TỆP / 6 NHÓM HỒ SƠ ──
  const handleOpenAddVanDe = () => {
    setEditingVanDe(null);
    setVanDeNoiDung('');
    setVanDeMucDo('THUONG');
    setVanDeTrangThai('DANG_THEO_DOI');
    setVanDeNhomHoSo('5. Đơn thư, kiến nghị & Phản ánh địa bàn');
    setVanDeFileTen('');
    setVanDeFileUrl(null);
    setVanDeFileLoai('docx');
    setIsAddVanDeOpen(true);
  };

  const handleOpenEditVanDe = (vd: VanDeTheoDoi) => {
    setEditingVanDe(vd);
    setVanDeNoiDung(vd.noi_dung);
    setVanDeMucDo(vd.muc_do);
    setVanDeTrangThai(vd.trang_thai || 'DANG_THEO_DOI');
    setVanDeNhomHoSo(vd.nhom_ho_so || '5. Đơn thư, kiến nghị & Phản ánh địa bàn');
    setVanDeFileTen(vd.file_ten || '');
    setVanDeFileUrl(vd.file_url || null);
    setVanDeFileLoai(vd.file_loai || 'docx');
    setIsAddVanDeOpen(true);
  };

  const handleSaveVanDe = () => {
    if (!selectedRecord || !vanDeNoiDung.trim()) return;

    let updatedList: VanDeTheoDoi[] = [];
    if (editingVanDe) {
      updatedList = (selectedRecord.danh_sach_van_de || []).map((vd) => {
        if (vd.id === editingVanDe.id) {
          return {
            ...vd,
            noi_dung: vanDeNoiDung.trim(),
            muc_do: vanDeMucDo,
            trang_thai: vanDeTrangThai,
            nhom_ho_so: vanDeNhomHoSo,
            file_ten: vanDeFileTen.trim() || undefined,
            file_url: vanDeFileUrl || undefined,
            file_loai: vanDeFileLoai || 'docx',
          };
        }
        return vd;
      });
    } else {
      const newVd: VanDeTheoDoi = {
        id: 'vd-' + Date.now(),
        noi_dung: vanDeNoiDung.trim(),
        muc_do: vanDeMucDo,
        trang_thai: vanDeTrangThai,
        ngay_ghi_nhan: new Date().toLocaleDateString('vi-VN'),
        nguoi_ghi_nhan: user.ho_ten,
        nhom_ho_so: vanDeNhomHoSo,
        file_ten: vanDeFileTen.trim() || undefined,
        file_url: vanDeFileUrl || undefined,
        file_loai: vanDeFileLoai || 'docx',
      };
      updatedList = [newVd, ...(selectedRecord.danh_sach_van_de || [])];
    }

    // Nếu có tệp đính kèm, cập nhật vào kho tài liệu địa bàn (6 Nhóm hồ sơ)
    if (vanDeFileTen.trim()) {
      const newFileItem: HoSoDiaBanFile = {
        id: 'f-vd-' + Date.now(),
        don_vi_id: selectedRecord.id,
        ten_don_vi: selectedRecord.ten_dia_ban,
        ten_file: vanDeFileTen.trim(),
        loai_file: (vanDeFileLoai as any) || 'docx',
        dung_luong: 320000,
        loai_tai_lieu: vanDeNhomHoSo,
        mo_ta: `Tài liệu đính kèm vấn đề theo dõi: ${vanDeNoiDung.trim()}`,
        ngay_tao: new Date().toLocaleDateString('vi-VN'),
        nguoi_tao: user.ho_ten,
        url: vanDeFileUrl || undefined,
        file_url: vanDeFileUrl || undefined,
      };
      setFiles((prevFiles) => {
        const nextFiles = [newFileItem, ...prevFiles.filter((f) => f.ten_file !== vanDeFileTen.trim())];
        localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(nextFiles));
        centralDataService.saveDoc('ho_so_dia_ban_files', newFileItem.id, newFileItem).catch(() => {});
        return nextFiles;
      });
    }

    const updatedRecords = records.map((r) => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          danh_sach_van_de: updatedList,
          so_van_de_theo_doi: updatedList.filter((v) => v.trang_thai !== 'DA_XU_LY').length,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setSelectedRecord(updatedRecords.find((r) => r.id === selectedRecord.id) || null);
    setIsAddVanDeOpen(false);
    setEditingVanDe(null);
  };

  const handleDeleteVanDe = (vdId: string) => {
    if (!selectedRecord) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa vấn đề theo dõi này?')) return;

    const updatedList = (selectedRecord.danh_sach_van_de || []).filter((vd) => vd.id !== vdId);
    const updatedRecords = records.map((r) => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          danh_sach_van_de: updatedList,
          so_van_de_theo_doi: updatedList.filter((v) => v.trang_thai !== 'DA_XU_LY').length,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setSelectedRecord(updatedRecords.find((r) => r.id === selectedRecord.id) || null);
  };

  // ── XỬ LÝ CHỈ ĐẠO CỦA CẤP TRÊN: THÊM / SỬA / XÓA / ĐÍNH KÈM TỆP / 6 NHÓM HỒ SƠ ──
  const handleOpenAddChiDao = () => {
    setEditingChiDao(null);
    setChiDaoNoiDung('');
    setChiDaoVanBan('');
    setChiDaoHan('');
    setChiDaoTrangThai('CHUA_HOAN_THANH');
    setChiDaoNhomHoSo('6. Kết luận kiểm tra & Văn bản chỉ đạo');
    setChiDaoFileTen('');
    setChiDaoFileUrl(null);
    setChiDaoFileLoai('pdf');
    setIsAddChiDaoOpen(true);
  };

  const handleOpenEditChiDao = (cd: ChiDaoNhiemVu) => {
    setEditingChiDao(cd);
    setChiDaoNoiDung(cd.noi_dung);
    setChiDaoVanBan(cd.van_ban_chi_dao || '');
    setChiDaoHan(cd.han_hoan_thanh || '');
    setChiDaoTrangThai(cd.trang_thai || 'CHUA_HOAN_THANH');
    setChiDaoNhomHoSo(cd.nhom_ho_so || '6. Kết luận kiểm tra & Văn bản chỉ đạo');
    setChiDaoFileTen(cd.file_ten || '');
    setChiDaoFileUrl(cd.file_url || null);
    setChiDaoFileLoai(cd.file_loai || 'pdf');
    setIsAddChiDaoOpen(true);
  };

  const handleSaveChiDao = () => {
    if (!selectedRecord || !chiDaoNoiDung.trim()) return;

    let updatedList: ChiDaoNhiemVu[] = [];
    if (editingChiDao) {
      updatedList = (selectedRecord.danh_sach_chi_dao || []).map((cd) => {
        if (cd.id === editingChiDao.id) {
          return {
            ...cd,
            noi_dung: chiDaoNoiDung.trim(),
            van_ban_chi_dao: chiDaoVanBan.trim() || undefined,
            han_hoan_thanh: chiDaoHan.trim() || undefined,
            trang_thai: chiDaoTrangThai,
            nhom_ho_so: chiDaoNhomHoSo,
            file_ten: chiDaoFileTen.trim() || undefined,
            file_url: chiDaoFileUrl || undefined,
            file_loai: chiDaoFileLoai || 'pdf',
          };
        }
        return cd;
      });
    } else {
      const newCd: ChiDaoNhiemVu = {
        id: 'cd-' + Date.now(),
        noi_dung: chiDaoNoiDung.trim(),
        van_ban_chi_dao: chiDaoVanBan.trim() || undefined,
        han_hoan_thanh: chiDaoHan.trim() || undefined,
        trang_thai: chiDaoTrangThai,
        nguoi_ghi_nhan: user.ho_ten,
        nhom_ho_so: chiDaoNhomHoSo,
        file_ten: chiDaoFileTen.trim() || undefined,
        file_url: chiDaoFileUrl || undefined,
        file_loai: chiDaoFileLoai || 'pdf',
      };
      updatedList = [newCd, ...(selectedRecord.danh_sach_chi_dao || [])];
    }

    if (chiDaoFileTen.trim()) {
      const newFileItem: HoSoDiaBanFile = {
        id: 'f-cd-' + Date.now(),
        don_vi_id: selectedRecord.id,
        ten_don_vi: selectedRecord.ten_dia_ban,
        ten_file: chiDaoFileTen.trim(),
        loai_file: (chiDaoFileLoai as any) || 'pdf',
        dung_luong: 320000,
        loai_tai_lieu: chiDaoNhomHoSo,
        mo_ta: `Tài liệu đính kèm chỉ đạo: ${chiDaoNoiDung.trim()}`,
        ngay_tao: new Date().toLocaleDateString('vi-VN'),
        nguoi_tao: user.ho_ten,
        url: chiDaoFileUrl || undefined,
        file_url: chiDaoFileUrl || undefined,
      };
      setFiles((prevFiles) => {
        const nextFiles = [newFileItem, ...prevFiles.filter((f) => f.ten_file !== chiDaoFileTen.trim())];
        localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(nextFiles));
        centralDataService.saveDoc('ho_so_dia_ban_files', newFileItem.id, newFileItem).catch(() => {});
        return nextFiles;
      });
    }

    const updatedRecords = records.map((r) => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          danh_sach_chi_dao: updatedList,
          so_chi_dao_chua_hoan_thanh: updatedList.filter((c) => c.trang_thai === 'CHUA_HOAN_THANH').length,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setSelectedRecord(updatedRecords.find((r) => r.id === selectedRecord.id) || null);
    setIsAddChiDaoOpen(false);
    setEditingChiDao(null);
  };

  const handleDeleteChiDao = (cdId: string) => {
    if (!selectedRecord) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa chỉ đạo này?')) return;

    const updatedList = (selectedRecord.danh_sach_chi_dao || []).filter((cd) => cd.id !== cdId);
    const updatedRecords = records.map((r) => {
      if (r.id === selectedRecord.id) {
        return {
          ...r,
          danh_sach_chi_dao: updatedList,
          so_chi_dao_chua_hoan_thanh: updatedList.filter((c) => c.trang_thai === 'CHUA_HOAN_THANH').length,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: user.ho_ten,
        };
      }
      return r;
    });

    saveRecords(updatedRecords);
    setSelectedRecord(updatedRecords.find((r) => r.id === selectedRecord.id) || null);
  };

  // ── XỬ LÝ THAY ĐỔI, BỔ SUNG CHƯƠNG TRÌNH & ĐỐI CHIẾU: THÊM / SỬA / XÓA / ĐÍNH KÈM TỆP ──
  const handleOpenAddThayDoi = () => {
    const defaultCt = activeNhiemKyPrograms[0] || chuongTrinhList[0];
    setEditingThayDoi(null);
    setThayDoiChuongTrinhId(defaultCt ? defaultCt.id : '');
    setThayDoiLan(relatedThayDoiList.length + 1);
    setThayDoiSoVanBan('');
    setThayDoiNgayBanHanh(new Date().toLocaleDateString('vi-VN'));
    setThayDoiNguoiKy('');
    setThayDoiNoiDungGoc('');
    setThayDoiNoiDungMoi('');
    setThayDoiGhiChu('');
    setThayDoiNhomHoSo('1. Hồ sơ pháp lý & Quyết định phân công');
    setThayDoiFileTen('');
    setThayDoiFileUrl(null);
    setIsThayDoiModalOpen(true);
  };

  const handleOpenEditThayDoi = (td: ThayDoiBoSungKtGs) => {
    setEditingThayDoi(td);
    setThayDoiChuongTrinhId(td.chuong_trinh_id || (activeNhiemKyPrograms[0]?.id || ''));
    setThayDoiLan(td.lan_dieu_chinh || 1);
    setThayDoiSoVanBan(td.so_van_ban || '');
    setThayDoiNgayBanHanh(td.ngay_ban_hanh || '');
    setThayDoiNguoiKy(td.nguoi_ky || '');
    setThayDoiNoiDungGoc(td.noi_dung_goc || '');
    setThayDoiNoiDungMoi(td.noi_dung_dieu_chinh || '');
    setThayDoiGhiChu(td.ghi_chu || '');
    setThayDoiNhomHoSo(td.nhom_ho_so || '1. Hồ sơ pháp lý & Quyết định phân công');
    setThayDoiFileTen(td.file_pdf_ten || '');
    setThayDoiFileUrl(td.file_pdf_url || null);
    setIsThayDoiModalOpen(true);
  };

  const handleSaveThayDoi = async () => {
    if (!selectedRecord || !thayDoiNoiDungMoi.trim()) {
      alert('Vui lòng nhập nội dung điều chỉnh, bổ sung.');
      return;
    }
    const ctId = thayDoiChuongTrinhId || activeNhiemKyPrograms[0]?.id || chuongTrinhList[0]?.id;
    if (!ctId) {
      alert('Chưa có chương trình kiểm tra, giám sát toàn khóa để đối chiếu.');
      return;
    }

    try {
      const payload: ThayDoiBoSungKtGs = {
        id: editingThayDoi ? editingThayDoi.id : 'td-' + Date.now(),
        chuong_trinh_id: ctId,
        don_vi_id: selectedRecord.id,
        ten_don_vi: selectedRecord.ten_dia_ban,
        so_van_ban: thayDoiSoVanBan.trim() || 'Chưa có số VB',
        ngay_ban_hanh: thayDoiNgayBanHanh.trim() || new Date().toISOString().split('T')[0],
        nguoi_ky: thayDoiNguoiKy.trim() || undefined,
        lan_dieu_chinh: thayDoiLan,
        noi_dung_goc: thayDoiNoiDungGoc.trim() || undefined,
        noi_dung_dieu_chinh: thayDoiNoiDungMoi.trim(),
        ghi_chu: thayDoiGhiChu.trim() || undefined,
        file_pdf_ten: thayDoiFileTen.trim() || undefined,
        file_pdf_url: thayDoiFileUrl || undefined,
        nhom_ho_so: thayDoiNhomHoSo,
        created_at: editingThayDoi ? editingThayDoi.created_at : new Date().toISOString(),
      };

      if (editingThayDoi) {
        await api.updateThayDoiBoSung(payload);
      } else {
        await api.addThayDoiBoSung(payload);
      }

      // Đưa file vào kho tài liệu hồ sơ địa bàn
      if (thayDoiFileTen.trim()) {
        const newFileItem: HoSoDiaBanFile = {
          id: 'f-td-' + Date.now(),
          don_vi_id: selectedRecord.id,
          ten_don_vi: selectedRecord.ten_dia_ban,
          ten_file: thayDoiFileTen.trim(),
          loai_file: 'pdf',
          dung_luong: 450000,
          loai_tai_lieu: thayDoiNhomHoSo,
          mo_ta: `Văn bản điều chỉnh, bổ sung: ${thayDoiSoVanBan || thayDoiNoiDungMoi.substring(0, 50)}`,
          ngay_tao: new Date().toLocaleDateString('vi-VN'),
          nguoi_tao: user.ho_ten,
          url: thayDoiFileUrl || undefined,
          file_url: thayDoiFileUrl || undefined,
        };
        setFiles((prevFiles) => {
          const nextFiles = [newFileItem, ...prevFiles.filter((f) => f.ten_file !== thayDoiFileTen.trim())];
          localStorage.setItem(STORAGE_HO_SO_FILES, JSON.stringify(nextFiles));
          centralDataService.saveDoc('ho_so_dia_ban_files', newFileItem.id, newFileItem).catch(() => {});
          return nextFiles;
        });
      }

      loadChuongTrinh();
      setIsThayDoiModalOpen(false);
      setEditingThayDoi(null);
    } catch (e: any) {
      alert('Lỗi lưu thay đổi bổ sung: ' + e.message);
    }
  };

  const handleDeleteThayDoi = async (td: ThayDoiBoSungKtGs) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa quyết định điều chỉnh, bổ sung này?')) return;
    try {
      await api.deleteThayDoiBoSung(td.chuong_trinh_id, td.id);
      loadChuongTrinh();
    } catch (e: any) {
      alert('Lỗi xóa điều chỉnh bổ sung: ' + e.message);
    }
  };

  // Lưu danh sách báo cáo tháng tích hợp và đồng bộ Cloud
  const saveBaoCaoThangList = (newList: BaoCaoThangItem[]) => {
    setBaoCaoThangList(newList);
    localStorage.setItem(STORAGE_BAO_CAO_THANG, JSON.stringify(newList));
    newList.forEach((b) => {
      centralDataService.saveDoc('bao_cao_thang', b.id, b).catch(() => {});
    });
  };

  // Nộp / Tiếp nhận báo cáo tháng (tích hợp 1 lần nhiều địa bàn)
  const handleSaveNopBaoCao = async () => {
    if (baoCaoSelectedDiaBanIds.length === 0) {
      alert('Vui lòng chọn ít nhất một địa bàn áp dụng cho báo cáo tháng này.');
      return;
    }

    // Kiểm tra phân quyền: Chỉ người được phân công quản lý mới được nộp báo cáo của mình trừ admin
    if (user.vai_tro !== 'ADMIN') {
      const unauthorizedUnits = records.filter(
        (r) => baoCaoSelectedDiaBanIds.includes(r.id) && !isUserAssignedToRecord(r)
      );
      if (unauthorizedUnits.length > 0) {
        alert(
          `Đồng chí không được phân công quản lý các địa bàn: ${unauthorizedUnits.map((u) => u.ten_dia_ban).join(', ')}. Theo quy định, chỉ người được phân công quản lý địa bàn mới được nộp báo cáo của mình (trừ Quản trị viên Admin).`
        );
        return;
      }
    }

    const selectedUnits = records.filter((r) => baoCaoSelectedDiaBanIds.includes(r.id));
    const selectedNames = selectedUnits.map((r) => r.ten_dia_ban);
    const canBoFinalTen = baoCaoCanBoTen.trim() || user.ho_ten;
    const reportTitleFinal =
      baoCaoTieuDe.trim() ||
      `Báo cáo công tác nắm tình hình tháng ${baoCaoThangNum}/${baoCaoNam} (${selectedNames.length > 2 ? `${selectedNames.slice(0, 2).join(', ')} và ${selectedNames.length - 2} địa bàn khác` : selectedNames.join(', ')})`;

    const reportFileFinalName =
      baoCaoFileTen.trim() ||
      `BC_Thang_${baoCaoThangNum}_${baoCaoNam}_${selectedNames[0]?.replace(/\s+/g, '_') || 'dia_ban'}.${baoCaoFileLoai}`;

    let finalBcUrl = baoCaoFileUrl;
    let bcDriveId: string | undefined = undefined;
    let bcPreviewUrl: string | undefined = undefined;
    let isBcDrive = false;

    if (baoCaoFileUrl && isGoogleDriveConfigured()) {
      try {
        const cfg = getGoogleDriveConfig();
        if (cfg.autoUpload) {
          const driveRes = await uploadBase64OrUrlToGoogleDrive(
            reportFileFinalName,
            baoCaoFileUrl,
            undefined,
            cfg.folderId
          );
          if (driveRes.success && driveRes.fileUrl) {
            finalBcUrl = driveRes.fileUrl;
            bcDriveId = driveRes.fileId;
            bcPreviewUrl = driveRes.previewUrl;
            isBcDrive = true;
          }
        }
      } catch (err) {
        console.warn('Lỗi tải tệp báo cáo tháng lên Google Drive:', err);
      }
    }

    const newReportItem: BaoCaoThangItem = {
      id: 'bc-' + Date.now(),
      tieu_de: reportTitleFinal,
      thang: baoCaoThangNum,
      nam: baoCaoNam,
      ngay_nop: new Date().toLocaleDateString('vi-VN'),
      can_bo_id: baoCaoCanBoId || user.id,
      can_bo_ten: canBoFinalTen,
      danh_sach_don_vi_ids: baoCaoSelectedDiaBanIds,
      danh_sach_ten_don_vi: selectedNames,
      tinh_trang: baoCaoTinhTrang,
      file_ten: reportFileFinalName,
      file_loai: baoCaoFileLoai,
      file_dung_luong: 320000,
      file_url: finalBcUrl,
      noi_dung_tom_tat: baoCaoNoiDung.trim() || 'Báo cáo định kỳ công tác kiểm tra, giám sát và nắm tình hình địa bàn.',
      ghi_chu: baoCaoGhiChu.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    (newReportItem as any).google_drive_id = bcDriveId;
    (newReportItem as any).google_drive_preview_url = bcPreviewUrl;
    (newReportItem as any).is_google_drive = isBcDrive;

    // 1. Cập nhật danh sách Báo cáo tháng
    const updatedBaoCaoList = [newReportItem, ...baoCaoThangList];
    saveBaoCaoThangList(updatedBaoCaoList);

    // 2. YÊU CẦU QUAN TRỌNG: Hồ sơ riêng mỗi địa bàn phải có báo cáo đó hiện trong tập tài liệu địa bàn
    const newDocFilesToAdd: HoSoDiaBanFile[] = [];
    const updatedRecords = records.map((r) => {
      if (baoCaoSelectedDiaBanIds.includes(r.id)) {
        // Tự động tạo một file tài liệu nạp vào tập tài liệu của địa bàn này
        const docItem: HoSoDiaBanFile = {
          id: `doc-bc-${Date.now()}-${r.id}`,
          don_vi_id: r.id,
          ten_don_vi: r.ten_dia_ban,
          ten_file: reportFileFinalName,
          loai_file: baoCaoFileLoai,
          dung_luong: 320000,
          url: finalBcUrl,
          file_url: finalBcUrl,
          google_drive_id: bcDriveId,
          google_drive_preview_url: bcPreviewUrl,
          is_google_drive: isBcDrive,
          loai_tai_lieu: '3. Báo cáo định kỳ (tháng, quý, năm)',
          mo_ta: `Báo cáo tháng ${baoCaoThangNum}/${baoCaoNam} tích hợp (${selectedNames.join(', ')}) do đ/c ${canBoFinalTen} nộp`,
          ngay_tao: new Date().toLocaleDateString('vi-VN'),
          nguoi_tao: canBoFinalTen,
        };
        newDocFilesToAdd.push(docItem);

        return {
          ...r,
          tinh_trang_bao_cao_thang: baoCaoTinhTrang,
          thang_hien_tai: `T${baoCaoThangNum}/${baoCaoNam}`,
          thoi_diem_cap_nhat_gan_nhat:
            new Date().toLocaleDateString('vi-VN') +
            ' ' +
            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          nguoi_cap_nhat_gan_nhat: canBoFinalTen,
          so_luong_tai_lieu: (r.so_luong_tai_lieu || 0) + 1,
        };
      }
      return r;
    });

    // Lưu records và files
    saveRecords(updatedRecords);
    const updatedFiles = [...newDocFilesToAdd, ...files];
    saveFiles(updatedFiles);

    // Đồng bộ sang kho PDF
    api
      .createOrAttachPdf({
        ten_file: reportFileFinalName,
        dung_luong: 320000,
        url: finalBcUrl,
        file_url: finalBcUrl,
        google_drive_id: bcDriveId,
        google_drive_preview_url: bcPreviewUrl,
        is_google_drive: isBcDrive,
        nguoi_tai_len: canBoFinalTen,
        ghi_chu: `Báo cáo tháng ${baoCaoThangNum}/${baoCaoNam} tích hợp địa bàn: ${selectedNames.join(', ')}`,
        nguon_goc: 'HO_SO_DIA_BAN',
        don_vi_id: baoCaoSelectedDiaBanIds[0],
        ten_don_vi: selectedNames.join(', '),
      })
      .catch((err) => console.error('Lỗi đồng bộ PDF báo cáo tháng sang kho PDF:', err));

    // Cập nhật selectedRecord nếu đang mở modal
    if (selectedRecord) {
      const refreshed = updatedRecords.find((r) => r.id === selectedRecord.id);
      if (refreshed) setSelectedRecord(refreshed);
    }

    setIsNopBaoCaoOpen(false);
  };

  // Xóa tài liệu khỏi hồ sơ địa bàn, Kho PDF và Google Drive (Xóa 2 chiều)
  const handleDeleteDocument = async (fileItem: HoSoDiaBanFile) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa tài liệu "${fileItem.ten_file}"?\nThao tác này sẽ đồng thời xóa tệp trên Kho dữ liệu và đưa tệp vào Thùng rác Google Drive (nếu có).`
      )
    ) {
      return;
    }

    try {
      const driveId =
        fileItem.google_drive_id ||
        extractGoogleDriveFileId(fileItem.file_url || fileItem.url);
      if (driveId) {
        try {
          await deleteFileFromGoogleDrive(driveId);
        } catch (err) {
          console.warn('Lỗi xóa tệp địa bàn trên Google Drive:', err);
        }
      }

      await api.deletePdf('hsdb-' + fileItem.id).catch(() => {});
      await api.deletePdf(fileItem.id).catch(() => {});

      const nextFiles = files.filter(
        (f) => f.id !== fileItem.id && f.ten_file !== fileItem.ten_file
      );
      saveFiles(nextFiles);
      await centralDataService.deleteDoc('ho_so_dia_ban_files', fileItem.id);

      if (fileItem.don_vi_id) {
        const updatedRecords = records.map((r) =>
          r.id === fileItem.don_vi_id
            ? { ...r, so_luong_tai_lieu: Math.max(0, (r.so_luong_tai_lieu || 1) - 1) }
            : r
        );
        saveRecords(updatedRecords);
        if (selectedRecord && selectedRecord.id === fileItem.don_vi_id) {
          setSelectedRecord((prev) =>
            prev ? { ...prev, so_luong_tai_lieu: Math.max(0, (prev.so_luong_tai_lieu || 1) - 1) } : null
          );
        }
      }

      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
    } catch (err: any) {
      alert('Lỗi khi xóa tài liệu: ' + (err.message || String(err)));
    }
  };

  // Xóa báo cáo tháng khỏi hồ sơ địa bàn, Kho PDF và Google Drive (Xóa 2 chiều)
  const handleDeleteBaoCao = async (bcItem: BaoCaoThangItem) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa báo cáo "${bcItem.tieu_de}"?\nThao tác này sẽ đồng thời xóa tệp đính kèm trên Kho dữ liệu và đưa tệp vào Thùng rác Google Drive (nếu có).`
      )
    ) {
      return;
    }

    try {
      const driveId =
        (bcItem as any).google_drive_id ||
        extractGoogleDriveFileId(bcItem.file_url);
      if (driveId) {
        try {
          await deleteFileFromGoogleDrive(driveId);
        } catch (err) {
          console.warn('Lỗi xóa tệp báo cáo trên Google Drive:', err);
        }
      }

      await api.deletePdf('bc-' + bcItem.id).catch(() => {});

      const updatedBc = baoCaoThangList.filter((b) => b.id !== bcItem.id);
      saveBaoCaoThangList(updatedBc);
      await centralDataService.deleteDoc('bao_cao_thang', bcItem.id);

      if (bcItem.file_ten) {
        const nextFiles = files.filter(
          (f) => f.ten_file !== bcItem.file_ten && !f.id.includes(bcItem.id)
        );
        saveFiles(nextFiles);
      }

      window.dispatchEvent(new CustomEvent('ubkt_kho_du_lieu_updated'));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated'));
    } catch (err: any) {
      alert('Lỗi khi xóa báo cáo tháng: ' + (err.message || String(err)));
    }
  };

  // Mở modal nộp báo cáo tháng cho 1 địa bàn cụ thể
  const handleOpenNopBaoCaoForRecord = (record: DiaBanRecord) => {
    if (!isUserAssignedToRecord(record)) {
      alert(`Đồng chí không được phân công quản lý địa bàn "${record.ten_dia_ban}". Chỉ cán bộ phụ trách (${record.can_bo_phu_trach_ten || 'được phân công'}) hoặc Quản trị viên (Admin) mới có quyền nộp báo cáo.`);
      return;
    }
    setSelectedRecord(record);
    setBaoCaoSelectedDiaBanIds([record.id]);
    setBaoCaoTieuDe(`Báo cáo công tác nắm tình hình tháng 10/2026 (${record.ten_dia_ban})`);
    setBaoCaoThangNum(10);
    setBaoCaoNam(2026);
    setBaoCaoTinhTrang(record.tinh_trang_bao_cao_thang === 'CHUA_NOP' ? 'DA_NOP_DUNG_HAN' : record.tinh_trang_bao_cao_thang);
    setBaoCaoCanBoId(record.can_bo_phu_trach_id || user.id);
    setBaoCaoCanBoTen(record.can_bo_phu_trach_ten && record.can_bo_phu_trach_ten !== 'Chưa phân công' ? record.can_bo_phu_trach_ten : user.ho_ten);
    setBaoCaoFileTen(`Bao_cao_thang_10_2026_${record.ten_dia_ban.replace(/\s+/g, '_')}.docx`);
    setBaoCaoFileLoai('docx');
    setBaoCaoFileUrl(null);
    setBaoCaoNoiDung('');
    setBaoCaoGhiChu('');
    setIsNopBaoCaoOpen(true);
  };

  // Mở modal nộp báo cáo tháng tích hợp cho một cán bộ phụ trách
  const handleOpenNopBaoCaoForGroup = (group: { can_bo_id?: string; can_bo_ten: string; records: DiaBanRecord[] }) => {
    if (!isOfficerOfGroup(group)) {
      alert(`Đồng chí không phụ trách nhóm địa bàn của ${group.can_bo_ten}. Chỉ cán bộ được phân công quản lý hoặc Quản trị viên (Admin) mới có quyền nộp báo cáo.`);
      return;
    }
    const ids = group.records.map((r) => r.id);
    setBaoCaoSelectedDiaBanIds(ids);
    setBaoCaoTieuDe(`Báo cáo tổng hợp tình hình các địa bàn phụ trách tháng 10/2026`);
    setBaoCaoThangNum(10);
    setBaoCaoNam(2026);
    setBaoCaoTinhTrang('DA_NOP_DUNG_HAN');
    setBaoCaoCanBoId(group.can_bo_id || user.id);
    setBaoCaoCanBoTen(group.can_bo_ten);
    setBaoCaoFileTen(`Bao_cao_tong_hop_dia_ban_T10_2026_${group.can_bo_ten.replace(/\s+/g, '_')}.docx`);
    setBaoCaoFileLoai('docx');
    setBaoCaoFileUrl(null);
    setBaoCaoNoiDung('');
    setBaoCaoGhiChu('');
    setIsNopBaoCaoOpen(true);
  };

  // Mở modal nộp báo cáo tháng chung từ tab Báo cáo theo tháng
  const handleOpenNewBaoCaoThang = () => {
    const myDiaBanIds = records.filter(r => isUserAssignedToRecord(r)).map(r => r.id);
    if (user.vai_tro !== 'ADMIN' && myDiaBanIds.length === 0) {
      alert('Đồng chí hiện chưa được phân công quản lý địa bàn nào để nộp báo cáo.');
      return;
    }
    setBaoCaoSelectedDiaBanIds(myDiaBanIds.length > 0 ? myDiaBanIds : (records.length > 0 ? [records[0].id] : []));
    setBaoCaoTieuDe(`Báo cáo công tác nắm tình hình địa bàn tháng 10/2026`);
    setBaoCaoThangNum(10);
    setBaoCaoNam(2026);
    setBaoCaoTinhTrang('DA_NOP_DUNG_HAN');
    setBaoCaoCanBoId(user.id);
    setBaoCaoCanBoTen(user.ho_ten);
    setBaoCaoFileTen(`Bao_cao_dia_ban_T10_2026.docx`);
    setBaoCaoFileLoai('docx');
    setBaoCaoFileUrl(null);
    setBaoCaoNoiDung('');
    setBaoCaoGhiChu('');
    setIsNopBaoCaoOpen(true);
  };

  // Xử lý chọn tệp đính kèm khi nộp báo cáo tháng
  const handleBaoCaoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc' || ext === 'pdf') {
      setBaoCaoFileTen(file.name);
      setBaoCaoFileLoai(ext === 'pdf' ? 'pdf' : 'docx');
      const reader = new FileReader();
      reader.onload = () => {
        setBaoCaoFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Chỉ hỗ trợ tệp định dạng .docx, .doc hoặc .pdf');
    }
  };

  // Xử lý chọn tệp đính kèm khi tải lên tài liệu
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc' || ext === 'pdf' || ext === 'xlsx' || ext === 'xls') {
      setDocTenFile(file.name);
      setDocLoaiFile(ext === 'pdf' ? 'pdf' : 'docx');
      setDocFileSize(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        setDocFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Chỉ hỗ trợ tệp định dạng .docx, .doc, .pdf hoặc .xlsx');
    }
  };

  // Tải lên tài liệu cho địa bàn đang chọn hoặc từ Kho tài liệu
  const handleUploadDoc = async () => {
    const targetId = uploadTargetDonViId || selectedRecord?.id;
    if (!targetId || !docTenFile.trim()) {
      alert('Vui lòng chọn địa bàn và nhập tên tệp tài liệu.');
      return;
    }
    const targetUnit = records.find((r) => r.id === targetId);
    const tenDonVi = targetUnit ? targetUnit.ten_dia_ban : 'Địa bàn cơ sở';

    let finalDocUrl = docFileUrl;
    let driveFileId: string | undefined = undefined;
    let drivePreviewUrl: string | undefined = undefined;
    let isDrive = false;

    if (docFileUrl && isGoogleDriveConfigured()) {
      try {
        const cfg = getGoogleDriveConfig();
        if (cfg.autoUpload) {
          const driveRes = await uploadBase64OrUrlToGoogleDrive(
            docTenFile.trim(),
            docFileUrl,
            undefined,
            cfg.folderId
          );
          if (driveRes.success && driveRes.fileUrl) {
            finalDocUrl = driveRes.fileUrl;
            driveFileId = driveRes.fileId;
            drivePreviewUrl = driveRes.previewUrl;
            isDrive = true;
          }
        }
      } catch (err) {
        console.warn('Lỗi tải tệp địa bàn lên Google Drive:', err);
      }
    }

    const newDoc: HoSoDiaBanFile = {
      id: 'doc-' + Date.now(),
      don_vi_id: targetId,
      ten_don_vi: tenDonVi,
      the_loai_van_ban: docTheLoai,
      so_van_ban: docSoVanBan.trim() || undefined,
      trich_yeu: docTrichYeu.trim() || docMoTa.trim() || docTenFile.trim(),
      nguoi_ky: docNguoiKy.trim() || user.ho_ten,
      ngay_ban_hanh: docNgayBanHanh.trim() || new Date().toLocaleDateString('vi-VN'),
      ten_file: docTenFile.trim(),
      loai_file: docLoaiFile,
      dung_luong: docFileSize || 320000,
      url: finalDocUrl,
      file_url: finalDocUrl,
      google_drive_id: driveFileId,
      google_drive_preview_url: drivePreviewUrl,
      is_google_drive: isDrive,
      loai_tai_lieu: docNhom,
      mo_ta: docMoTa.trim() || docTrichYeu.trim() || undefined,
      ngay_tao: new Date().toLocaleDateString('vi-VN'),
      nguoi_tao: user.ho_ten,
    };

    const newFiles = [newDoc, ...files];
    saveFiles(newFiles);

    // Cập nhật số lượng tài liệu
    const updated = records.map((r) => {
      if (r.id === targetId) {
        return {
          ...r,
          so_luong_tai_lieu: (r.so_luong_tai_lieu || 0) + 1,
        };
      }
      return r;
    });
    saveRecords(updated);

    // Tự động tổng hợp vào Kho PDF
    try {
      await api.createOrAttachPdf({
        ten_file: newDoc.ten_file,
        dung_luong: newDoc.dung_luong,
        url: finalDocUrl,
        file_url: finalDocUrl,
        google_drive_id: driveFileId,
        google_drive_preview_url: drivePreviewUrl,
        is_google_drive: isDrive,
        nguoi_tai_len: user.ho_ten,
        ghi_chu: `Tài liệu từ Hồ sơ địa bàn: ${tenDonVi} (${docNhom})`,
        nguon_goc: 'HO_SO_DIA_BAN',
        don_vi_id: targetId,
        ten_don_vi: tenDonVi,
      });
    } catch (err) {
      console.error('Lỗi đồng bộ PDF địa bàn sang kho PDF:', err);
    }

    setIsUploadDocOpen(false);
    setDocTheLoai('Báo cáo');
    setDocSoVanBan('');
    setDocTrichYeu('');
    setDocNguoiKy('');
    setDocNgayBanHanh(new Date().toLocaleDateString('vi-VN'));
    setDocTenFile('');
    setDocFileUrl(null);
    setDocMoTa('');
    setUploadTargetDonViId('');
  };

  // Tải về tệp
  const handleDownloadFile = (fileName: string) => {
    const dummy = `TÀI LIỆU HỒ SƠ ĐỊA BÀN - ỦY BAN KIỂM TRA ĐẢNG ỦY\nTên tệp: ${fileName}\nNgày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    const blob = new Blob([dummy], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Nhóm địa bàn theo cán bộ phụ trách (Căn cứ phân công)
  const officerGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        can_bo_id?: string;
        can_bo_ten: string;
        can_bo_chuc_vu?: string;
        van_ban_phan_cong?: string;
        thoi_gian_phan_cong?: string;
        records: DiaBanRecord[];
      }
    >();

    filteredRecords.forEach((r) => {
      const isAssigned = Boolean(
        r.can_bo_phu_trach_id && r.can_bo_phu_trach_ten && r.can_bo_phu_trach_ten !== 'Chưa phân công'
      );
      const key = isAssigned ? r.can_bo_phu_trach_id! : 'UNASSIGNED';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          can_bo_id: isAssigned ? r.can_bo_phu_trach_id : undefined,
          can_bo_ten: isAssigned ? r.can_bo_phu_trach_ten! : 'Địa bàn chưa phân công cán bộ phụ trách',
          can_bo_chuc_vu: isAssigned ? r.can_bo_chuc_vu : '',
          van_ban_phan_cong: isAssigned ? r.van_ban_phan_cong : 'Chưa ban hành quyết định phân công',
          thoi_gian_phan_cong: isAssigned ? r.thoi_gian_phan_cong : '',
          records: [],
        });
      }
      groupsMap.get(key)!.records.push(r);
    });

    const assignedList = Array.from(groupsMap.values()).filter((g) => g.can_bo_id !== undefined);
    const unassigned = Array.from(groupsMap.values()).find((g) => g.can_bo_id === undefined);

    assignedList.sort((a, b) => a.can_bo_ten.localeCompare(b.can_bo_ten, 'vi'));

    if (unassigned && unassigned.records.length > 0) {
      assignedList.push(unassigned);
    }

    return assignedList;
  }, [filteredRecords]);

  // Bộ lọc cho Kho tài liệu địa bàn (sắp xếp giảm dần theo ngày ban hành)
  const filteredKhoFiles = useMemo(() => {
    const q = searchKhoQuery.toLowerCase().trim();
    return files
      .filter((f) => {
        if (filterKhoNhom !== 'ALL' && f.loai_tai_lieu !== filterKhoNhom) return false;
        if (filterKhoDiaBan !== 'ALL' && f.don_vi_id !== filterKhoDiaBan) return false;
        if (filterKhoLoaiFile !== 'ALL' && f.loai_file !== filterKhoLoaiFile) return false;
        if (q) {
          const matchName = f.ten_file.toLowerCase().includes(q);
          const matchDesc = Boolean((f.trich_yeu || f.mo_ta) && (f.trich_yeu || f.mo_ta)!.toLowerCase().includes(q));
          const matchUnit = Boolean(f.ten_don_vi && f.ten_don_vi.toLowerCase().includes(q));
          const matchSigner = Boolean(f.nguoi_ky && f.nguoi_ky.toLowerCase().includes(q));
          const matchCreator = Boolean(f.nguoi_tao && f.nguoi_tao.toLowerCase().includes(q));
          const matchType = Boolean(f.the_loai_van_ban && f.the_loai_van_ban.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchUnit && !matchSigner && !matchCreator && !matchType) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = parseDateVN(a.ngay_ban_hanh || a.ngay_tao);
        const timeB = parseDateVN(b.ngay_ban_hanh || b.ngay_tao);
        return timeB - timeA;
      });
  }, [files, filterKhoNhom, filterKhoDiaBan, filterKhoLoaiFile, searchKhoQuery]);

  // Số lượng tài liệu trong từng nhóm hồ sơ
  const nhomCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    NHOM_HO_SO.forEach((nhom) => {
      counts[nhom.ten] = files.filter((f) => f.loai_tai_lieu === nhom.ten).length;
    });
    return counts;
  }, [files]);

  // Bộ lọc danh sách báo cáo tháng đã tiếp nhận
  const filteredBaoCaoThangList = useMemo(() => {
    return baoCaoThangList.filter((bc) => {
      if (filterBaoCaoThangMonth !== 0 && bc.thang !== filterBaoCaoThangMonth) return false;
      if (filterBaoCaoThangYear !== 0 && bc.nam !== filterBaoCaoThangYear) return false;
      if (filterBaoCaoCanBo !== 'ALL' && bc.can_bo_id !== filterBaoCaoCanBo) return false;
      return true;
    });
  }, [baoCaoThangList, filterBaoCaoThangMonth, filterBaoCaoThangYear, filterBaoCaoCanBo]);

  return (
    <div className="space-y-5 pb-12">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER CARD (THEO ĐÚNG MẪU ẢNH NGƯỜI DÙNG CUNG CẤP)                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER BANNER (THEO ĐÚNG MẪU ẢNH NGƯỜI DÙNG CUNG CẤP)                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 flex items-center space-x-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#133863] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            HỒ SƠ ĐỊA BÀN UBKT
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý theo địa bàn · Cán bộ phụ trách · Báo cáo định kỳ · Văn bản và tài liệu
          </p>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. CÁC THẺ ĐIỀU HƯỚNG PHÂN HỆ (3 THẺ NGANG THEO ĐÚNG ẢNH CHỤP)          */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Thẻ 1: Tổng quan địa bàn */}
        <div
          onClick={() => setSubTab('tong_quan')}
          className={`p-4 rounded-xl transition cursor-pointer flex flex-col justify-between ${
            subTab === 'tong_quan'
              ? 'bg-white border border-slate-200/80 shadow-md relative before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1.5 before:bg-[#133863] before:rounded-r'
              : 'bg-[#edf1f5] hover:bg-[#e4e9f0] border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <Layers className={`w-5 h-5 ${subTab === 'tong_quan' ? 'text-[#133863]' : 'text-slate-600'}`} />
              <h3 className="text-sm font-bold text-slate-800">Tổng quan địa bàn</h3>
            </div>
            {subTab === 'tong_quan' && (
              <span className="text-[11px] font-bold text-[#133863] px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
                Đang xem
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Các địa bàn đang theo dõi, báo cáo tháng, nhiệm vụ còn tồn và tài liệu mới cập nhật.
          </p>
        </div>

        {/* Thẻ 2: Phân công địa bàn */}
        <div
          onClick={() => setSubTab('danh_sach')}
          className={`p-4 rounded-xl transition cursor-pointer flex flex-col justify-between ${
            subTab === 'danh_sach'
              ? 'bg-white border border-slate-200/80 shadow-md relative before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1.5 before:bg-[#133863] before:rounded-r'
              : 'bg-[#edf1f5] hover:bg-[#e4e9f0] border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Users className={`w-5 h-5 ${subTab === 'danh_sach' ? 'text-[#133863]' : 'text-slate-600'}`} />
              <h3 className="text-sm font-bold text-slate-800">Phân công địa bàn</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#133863] text-white">
                {records.length}
              </span>
            </div>
            {subTab === 'danh_sach' && (
              <span className="text-[11px] font-bold text-[#133863] px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
                Đang xem
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Hiển thị theo căn cứ cán bộ được phân công phụ trách, quyết định phân công và tiến độ báo cáo.
          </p>
        </div>

        {/* Thẻ 3: Kho tài liệu địa bàn */}
        <div
          onClick={() => setSubTab('kho_tai_lieu')}
          className={`p-4 rounded-xl transition cursor-pointer flex flex-col justify-between ${
            subTab === 'kho_tai_lieu'
              ? 'bg-white border border-slate-200/80 shadow-md relative before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1.5 before:bg-[#133863] before:rounded-r'
              : 'bg-[#edf1f5] hover:bg-[#e4e9f0] border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <Folder className={`w-5 h-5 ${subTab === 'kho_tai_lieu' ? 'text-[#133863]' : 'text-slate-600'}`} />
              <h3 className="text-sm font-bold text-slate-800">Kho tài liệu địa bàn</h3>
            </div>
            {subTab === 'kho_tai_lieu' && (
              <span className="text-[11px] font-bold text-[#133863] px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
                Đang xem
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
            Tra cứu sáu nhóm hồ sơ theo nội dung nghiệp vụ, thời gian, nguồn và mức độ truy cập.
          </p>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. NỘI DUNG TỪNG PHÂN HỆ                                                 */}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* PHÂN HỆ 1: TỔNG QUAN ĐỊA BÀN */}
      {subTab === 'tong_quan' && (
        <div className="space-y-4">
          <TongQuanExecutiveDashboard
            onSelectAction={(actionKey) => {
              if (actionKey === 'nhiem_vu_qua_han') {
                setSubTab('danh_sach');
              } else if (actionKey === 'kien_nghi_chua_khac_phuc') {
                setSubTab('danh_sach');
              } else if (actionKey === 'don_thu_dang_giai_quyet') {
                setSubTab('danh_sach');
              } else if (actionKey === 'du_lieu_bao_cao_con_thieu') {
                setSubTab('danh_sach');
              } else {
                setSubTab('danh_sach');
              }
            }}
          />

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Địa bàn cần lưu ý theo dõi trong tháng 10/2026</span>
            </h4>
            <div className="divide-y divide-slate-100">
              {records
                .filter((r) => r.tinh_trang_bao_cao_thang === 'CHUA_NOP' || r.so_van_de_theo_doi > 0 || r.so_chi_dao_chua_hoan_thanh > 0)
                .slice(0, 5)
                .map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{r.ten_dia_ban}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cán bộ phụ trách: <strong>{r.can_bo_phu_trach_ten}</strong> · {r.van_ban_phan_cong}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {renderBaoCaoStatusBadge(r.tinh_trang_bao_cao_thang)}
                      {r.so_van_de_theo_doi > 0 && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {r.so_van_de_theo_doi} vấn đề
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSelectedRecord(r);
                          setSubTab('danh_sach');
                        }}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PHÂN HỆ 2: PHÂN CÔNG ĐỊA BÀN (HIỂN THỊ THEO CĂN CỨ CÁN BỘ ĐƯỢC PHÂN CÔNG) */}
      {subTab === 'danh_sach' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          {/* Header Toolbar: Chế độ hiển thị & Tìm kiếm, Bộ lọc */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#133863]" />
                  <span>Phân công địa bàn phụ trách theo cán bộ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị theo căn cứ quyết định phân công của UBKT Đảng ủy và tiến độ báo cáo tháng của từng cán bộ.
                </p>
              </div>

              {/* Chế độ xem: Căn cứ cán bộ phân công (Mặc định) vs Bảng tổng hợp chi tiết */}
              <div className="flex items-center space-x-1.5 bg-slate-200/70 p-1 rounded-lg border border-slate-300/60 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setViewModePhanCong('CAN_BO')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                    viewModePhanCong === 'CAN_BO'
                      ? 'bg-white text-[#133863] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Căn cứ cán bộ phân công (Mặc định)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewModePhanCong('BANG_PHANG')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                    viewModePhanCong === 'BANG_PHANG'
                      ? 'bg-white text-[#133863] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Bảng tổng hợp chi tiết ({filteredRecords.length})</span>
                </button>
              </div>
            </div>

            {/* Thanh tìm kiếm & bộ lọc */}
            <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-4xl">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên địa bàn, cán bộ, căn cứ văn bản..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  />
                </div>

                {/* Lọc theo cán bộ phụ trách */}
                <select
                  value={filterCanBo}
                  onChange={(e) => setFilterCanBo(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Tất cả cán bộ --</option>
                  <option value="MINE">★ Địa bàn tôi phụ trách ({stats.myCount})</option>
                  <option value="UNASSIGNED">Chưa phân công</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.ho_ten}
                    </option>
                  ))}
                </select>

                {/* Lọc theo trạng thái hồ sơ */}
                <select
                  value={filterTrangThaiHoSo}
                  onChange={(e) => setFilterTrangThaiHoSo(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Trạng thái hồ sơ --</option>
                  <option value="DANG_THEO_DOI">● Đang theo dõi ({stats.dangTheoDoi})</option>
                  <option value="DA_KET_THUC">✓ Đã kết thúc hồ sơ ({stats.daKetThuc})</option>
                </select>

                {/* Lọc theo tình trạng báo cáo */}
                <select
                  value={filterBaoCao}
                  onChange={(e) => setFilterBaoCao(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Tình trạng báo cáo --</option>
                  <option value="DA_NOP_DUNG_HAN">Đã nộp đúng hạn</option>
                  <option value="DA_NOP_MUON">Đã nộp muộn</option>
                  <option value="CHUA_NOP">Chưa nộp báo cáo</option>
                  <option value="CHO_DUYET">Chờ UBKT duyệt</option>
                </select>

                {/* Lọc theo vấn đề/chỉ đạo */}
                <select
                  value={filterVanDe}
                  onChange={(e) => setFilterVanDe(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Vấn đề / Chỉ đạo --</option>
                  <option value="HAS_ISSUE">Có vấn đề đang theo dõi</option>
                  <option value="HAS_DIRECTIVE">Có chỉ đạo chưa xong</option>
                </select>
              </div>

              <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Tổng số: <strong>{filteredRecords.length}</strong> / {records.length} địa bàn
              </div>
            </div>

            {/* ── THANH THAO TÁC HÀNG LOẠT KHI CHỌN NHIỀU HỒ SƠ ĐỊA BÀN ── */}
            {selectedRecordIds.size > 0 && (
              <div className="mt-2.5 p-3 bg-gradient-to-r from-blue-50 to-indigo-50/90 border border-blue-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    Đã chọn <strong className="text-blue-700 font-mono text-xs px-2 py-0.5 bg-white rounded-md border border-blue-300 font-bold shadow-2xs">{selectedRecordIds.size}</strong> hồ sơ địa bàn
                  </span>

                  <span className="text-slate-300">|</span>

                  <button
                    type="button"
                    onClick={() => setSelectedRecordIds(new Set())}
                    className="text-slate-600 hover:text-slate-900 underline text-[11px] font-medium cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>

                  {selectedRecordIds.size < filteredRecords.length && (
                    <button
                      type="button"
                      onClick={() => setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)))}
                      className="text-blue-700 hover:text-blue-900 underline text-[11px] font-semibold cursor-pointer"
                    >
                      Chọn tất cả {filteredRecords.length} địa bàn
                    </button>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const selected = records.filter((r) => selectedRecordIds.has(r.id));
                        setBatchDeleteRecords(selected);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm transition hover:shadow-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa {selectedRecordIds.size} hồ sơ địa bàn đã chọn</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* VIEW 1: HIỂN THỊ THEO CĂN CỨ CÁN BỘ ĐƯỢC PHÂN CÔNG (MẶC ĐỊNH) */}
          {viewModePhanCong === 'CAN_BO' && (
            <div className="p-4 space-y-5 bg-slate-50/40">
              {officerGroups.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  Không tìm thấy địa bàn nào phù hợp với bộ lọc tìm kiếm.
                </div>
              ) : (
                officerGroups.map((group, gIdx) => {
                  const daNopCount = group.records.filter(
                    (r) => r.tinh_trang_bao_cao_thang === 'DA_NOP_DUNG_HAN' || r.tinh_trang_bao_cao_thang === 'DA_NOP_MUON'
                  ).length;
                  const chuaNopCount = group.records.filter((r) => r.tinh_trang_bao_cao_thang === 'CHUA_NOP').length;
                  const isUnassigned = !group.can_bo_id;

                  return (
                    <div
                      key={group.can_bo_id || `unassigned-${gIdx}`}
                      className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition hover:shadow-xs"
                    >
                      {/* Tiêu đề Khối Cán bộ: Thông tin cán bộ + Căn cứ phân công + Tiến độ + Nút lập BC chung */}
                      <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isUnassigned ? 'bg-amber-50/70 border-amber-200' : 'bg-gradient-to-r from-blue-50/70 via-slate-50 to-white border-slate-200'
                      }`}>
                        <div className="flex items-start sm:items-center space-x-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-2xs flex-shrink-0 ${
                            isUnassigned ? 'bg-amber-200 text-amber-900' : 'bg-[#133863] text-white'
                          }`}>
                            {isUnassigned ? <AlertCircle className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-slate-900">
                                {group.can_bo_ten}
                              </h4>
                              {group.can_bo_chuc_vu && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-[#133863]">
                                  {group.can_bo_chuc_vu}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                                Phụ trách: {group.records.length} địa bàn
                              </span>
                            </div>

                            {/* Căn cứ phân công */}
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                              <span className="flex items-center space-x-1 font-medium">
                                <BookmarkCheck className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                                <span><strong>Căn cứ:</strong> {group.van_ban_phan_cong || 'QĐ số 08-QĐ/UBKT'}</span>
                              </span>
                              {group.thoi_gian_phan_cong && (
                                <span className="flex items-center space-x-1 text-slate-500">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Thời gian: {group.thoi_gian_phan_cong}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tình trạng báo cáo tháng & Thao tác nộp BC tích hợp */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                          {/* Badge tiến độ */}
                          {!isUnassigned && (
                            <div className="flex items-center space-x-2 mr-1">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                chuaNopCount === 0
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                BC T10: {daNopCount}/{group.records.length} đã nộp
                              </span>
                            </div>
                          )}

                          {/* Nút nộp báo cáo tháng tích hợp cho nhóm địa bàn của cán bộ */}
                          {!isUnassigned && isOfficerOfGroup(group) && (
                            <button
                              type="button"
                              onClick={() => handleOpenNopBaoCaoForGroup(group)}
                              className="px-3 py-1.5 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center space-x-1.5 transition cursor-pointer"
                              title="Lập 1 báo cáo tích hợp cho tất cả địa bàn của cán bộ này"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Nộp BC tháng tích hợp</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Danh sách địa bàn thuộc cán bộ phụ trách */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <th className="py-2.5 px-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={
                                    group.records.length > 0 &&
                                    group.records.every((r) => selectedRecordIds.has(r.id))
                                  }
                                  onChange={(e) => {
                                    const next = new Set(selectedRecordIds);
                                    if (e.target.checked) {
                                      group.records.forEach((r) => next.add(r.id));
                                    } else {
                                      group.records.forEach((r) => next.delete(r.id));
                                    }
                                    setSelectedRecordIds(next);
                                  }}
                                  className="rounded border-slate-300 text-[#133863] focus:ring-[#133863] cursor-pointer"
                                  title="Chọn / Bỏ chọn tất cả địa bàn của cán bộ này"
                                />
                              </th>
                              <th className="py-2.5 px-3 w-12 text-center">STT</th>
                              <th className="py-2.5 px-3.5 min-w-[220px]">Địa bàn / Tổ chức Đảng</th>
                              <th className="py-2.5 px-3.5 min-w-[150px] text-center">Báo cáo tháng (T10)</th>
                              <th className="py-2.5 px-3.5 min-w-[130px] text-center">Vấn đề theo dõi</th>
                              <th className="py-2.5 px-3.5 min-w-[130px] text-center">Chỉ đạo chưa xong</th>
                              <th className="py-2.5 px-3.5 min-w-[150px]">Cập nhật gần nhất</th>
                              <th className="py-2.5 px-3.5 w-32 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {group.records.map((item, idx) => {
                              const isChecked = selectedRecordIds.has(item.id);
                              return (
                              <tr
                                key={item.id}
                                className={`transition group ${isChecked ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/70'}`}
                              >
                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleSelectRecord(item.id)}
                                    className="rounded border-slate-300 text-[#133863] focus:ring-[#133863] cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3.5 text-center font-semibold text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="flex items-start space-x-2">
                                    <Building2 className="w-4 h-4 text-[#133863] flex-shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold text-slate-900 block text-sm">
                                        {item.ten_dia_ban}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                          {item.loai_to_chuc === 'DANG_BO' ? 'ĐẢNG BỘ' : 'CHI BỘ'}
                                        </span>
                                        {renderTrangThaiHoSoBadge(item.trang_thai_ho_so)}
                                        {item.lich_su_phu_trach && item.lich_su_phu_trach.length > 1 && (
                                          <span
                                            className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-0.5"
                                            title="Đã qua luân chuyển cán bộ phụ trách"
                                          >
                                            <History className="w-2.5 h-2.5" />
                                            <span>{item.lich_su_phu_trach.length} đời cán bộ</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3.5 text-center">
                                  {renderBaoCaoStatusBadge(item.tinh_trang_bao_cao_thang)}
                                </td>
                                <td className="py-2.5 px-3.5 text-center">
                                  {item.so_van_de_theo_doi > 0 ? (
                                    <button
                                      onClick={() => {
                                        setSelectedRecord(item);
                                        setModalTab('van_de');
                                      }}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition cursor-pointer"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                                      <span>{item.so_van_de_theo_doi} vấn đề</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">0 vấn đề</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 text-center">
                                  {item.so_chi_dao_chua_hoan_thanh > 0 ? (
                                    <button
                                      onClick={() => {
                                        setSelectedRecord(item);
                                        setModalTab('chi_dao');
                                      }}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 hover:bg-red-200 transition cursor-pointer"
                                    >
                                      <Clock className="w-3 h-3 text-red-700" />
                                      <span>{item.so_chi_dao_chua_hoan_thanh} chỉ đạo</span>
                                    </button>
                                  ) : (
                                    <span className="text-emerald-600 font-medium flex items-center justify-center space-x-1">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Đã xong</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <span className="text-slate-700 font-medium block">
                                    {item.thoi_diem_cap_nhat_gan_nhat}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    bởi {item.nguoi_cap_nhat_gan_nhat || 'Cán bộ'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRecord(item);
                                        setModalTab('thong_tin');
                                      }}
                                      className="px-2.5 py-1 text-[#133863] bg-blue-50 hover:bg-blue-100 rounded text-xs font-bold flex items-center space-x-1 transition cursor-pointer border border-blue-200"
                                      title="Xem chi tiết hồ sơ địa bàn"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Hồ sơ</span>
                                    </button>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => setDeleteTargetRecord(item)}
                                        className="px-2 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 rounded text-xs font-semibold flex items-center space-x-1 transition cursor-pointer border border-rose-200"
                                        title="Xóa hồ sơ địa bàn này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Xóa</span>
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
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 2: BẢNG TỔNG HỢP CHI TIẾT (ĐẦY ĐỦ 7 TRƯỜNG THÔNG TIN) */}
          {viewModePhanCong === 'BANG_PHANG' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredRecords.length > 0 &&
                          filteredRecords.every((r) => selectedRecordIds.has(r.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds(new Set(filteredRecords.map((r) => r.id)));
                          } else {
                            setSelectedRecordIds(new Set());
                          }
                        }}
                        className="rounded border-slate-300 text-[#133863] focus:ring-[#133863] cursor-pointer"
                        title="Chọn / Bỏ chọn tất cả"
                      />
                    </th>
                    <th className="py-3 px-3.5 w-12 text-center">STT</th>
                    <th className="py-3 px-3.5 min-w-[200px]">1. Địa bàn / Tổ chức Đảng</th>
                    <th className="py-3 px-3.5 min-w-[170px]">2. Cán bộ phụ trách hiện tại</th>
                    <th className="py-3 px-3.5 min-w-[190px]">3. Thời gian & Căn cứ phân công</th>
                    <th className="py-3 px-3.5 min-w-[140px] text-center">4. Báo cáo tháng (T10)</th>
                    <th className="py-3 px-3.5 min-w-[130px] text-center">5. Vấn đề theo dõi</th>
                    <th className="py-3 px-3.5 min-w-[130px] text-center">6. Chỉ đạo chưa xong</th>
                    <th className="py-3 px-3.5 min-w-[140px]">7. Cập nhật gần nhất</th>
                    <th className="py-3 px-3.5 w-24 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        Không tìm thấy địa bàn nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item, index) => {
                      const isChecked = selectedRecordIds.has(item.id);
                      return (
                      <tr
                        key={item.id}
                        className={`transition group ${isChecked ? 'bg-blue-50/50 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRecord(item.id)}
                            className="rounded border-slate-300 text-[#133863] focus:ring-[#133863] cursor-pointer"
                          />
                        </td>
                        {/* STT */}
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* 1. Tên địa bàn hoặc tổ chức Đảng */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-start space-x-2">
                            <Building2 className="w-4 h-4 text-[#133863] flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">
                                {item.ten_dia_ban}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {item.loai_to_chuc === 'DANG_BO' ? 'ĐẢNG BỘ' : 'CHI BỘ'}
                                </span>
                                {renderTrangThaiHoSoBadge(item.trang_thai_ho_so)}
                                {item.lich_su_phu_trach && item.lich_su_phu_trach.length > 1 && (
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-0.5"
                                    title="Đã qua luân chuyển cán bộ phụ trách"
                                  >
                                    <History className="w-2.5 h-2.5" />
                                    <span>{item.lich_su_phu_trach.length} đời cán bộ</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Cán bộ phụ trách hiện tại */}
                        <td className="py-3 px-3.5">
                          {item.can_bo_phu_trach_id ? (
                            <div>
                              <span className="font-bold text-slate-800 block flex items-center space-x-1">
                                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{item.can_bo_phu_trach_ten}</span>
                              </span>
                              <span className="text-[11px] text-slate-500">{item.can_bo_chuc_vu}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-slate-400 italic">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Chưa phân công</span>
                            </span>
                          )}
                        </td>

                        {/* 3. Thời gian phân công và văn bản phân công */}
                        <td className="py-3 px-3.5">
                          <span className="font-medium text-slate-800 block">
                            {item.van_ban_phan_cong || 'Chưa ban hành QĐ'}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Từ: {item.thoi_gian_phan_cong || '---'}</span>
                          </span>
                        </td>

                        {/* 4. Tình trạng nộp báo cáo tháng */}
                        <td className="py-3 px-3.5 text-center">
                          {renderBaoCaoStatusBadge(item.tinh_trang_bao_cao_thang)}
                        </td>

                        {/* 5. Số vấn đề cần tiếp tục theo dõi */}
                        <td className="py-3 px-3.5 text-center">
                          {item.so_van_de_theo_doi > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedRecord(item);
                                setModalTab('van_de');
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition cursor-pointer"
                              title="Bấm để xem các vấn đề cần theo dõi"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>{item.so_van_de_theo_doi} vấn đề</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">0 vấn đề</span>
                          )}
                        </td>

                        {/* 6. Số chỉ đạo chưa hoàn thành */}
                        <td className="py-3 px-3.5 text-center">
                          {item.so_chi_dao_chua_hoan_thanh > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedRecord(item);
                                setModalTab('chi_dao');
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 hover:bg-red-200 transition cursor-pointer"
                              title="Bấm để xem chỉ đạo chưa hoàn thành"
                            >
                              <Clock className="w-3 h-3 text-red-700" />
                              <span>{item.so_chi_dao_chua_hoan_thanh} chỉ đạo</span>
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-medium text-xs flex items-center justify-center space-x-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã xong</span>
                            </span>
                          )}
                        </td>

                        {/* 7. Thời điểm cập nhật hồ sơ gần nhất */}
                        <td className="py-3 px-3.5">
                          <span className="text-slate-700 font-medium block">
                            {item.thoi_diem_cap_nhat_gan_nhat}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            bởi {item.nguoi_cap_nhat_gan_nhat || 'Cán bộ'}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecord(item);
                                setModalTab('thong_tin');
                              }}
                              className="px-2.5 py-1 text-[#133863] bg-blue-50 hover:bg-blue-100 rounded text-xs font-bold flex items-center space-x-1 transition cursor-pointer border border-blue-200"
                              title="Xem chi tiết hồ sơ địa bàn"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Hồ sơ</span>
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetRecord(item)}
                                className="px-2 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 rounded text-xs font-semibold flex items-center space-x-1 transition cursor-pointer border border-rose-200"
                                title="Xóa hồ sơ địa bàn này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Xóa</span>
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
          )}
        </div>
      )}

      {/* PHÂN HỆ 3: BÁO CÁO THEO THÁNG (Đã gộp vào từng hồ sơ địa bàn) */}
      {false && (
        <div className="space-y-4">
          {/* 4 Thẻ thống kê tình hình báo cáo tháng */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-slate-500 uppercase">Tổng số báo cáo đã nhận</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{baoCaoThangList.length}</p>
              <p className="text-xs text-slate-400 mt-1">Báo cáo tháng định kỳ</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-emerald-700 uppercase">Địa bàn hoàn thành T10</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">
                {stats.daNop} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
              </p>
              <p className="text-xs text-emerald-600 mt-1">Đạt {((stats.daNop / (stats.total || 1)) * 100).toFixed(0)}% địa bàn</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-[#133863] uppercase">Báo cáo tích hợp</p>
              <p className="text-2xl font-bold text-[#133863] mt-1">
                {baoCaoThangList.filter((b) => b.danh_sach_don_vi_ids && b.danh_sach_don_vi_ids.length > 1).length}
              </p>
              <p className="text-xs text-blue-600 mt-1">Bao gồm từ 2 địa bàn trở lên</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold text-red-700 uppercase">Chưa nộp báo cáo T10</p>
              <p className="text-2xl font-bold text-red-800 mt-1">{stats.chuaNop}</p>
              <p className="text-xs text-red-600 mt-1">Cần đôn đốc cán bộ phụ trách</p>
            </div>
          </div>

          {/* Bảng điều khiển chính của phân hệ Báo cáo theo tháng */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Toolbar trên cùng: Bộ lọc tháng/năm/cán bộ + Chuyển view + Nút lập BC */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-[#133863]" />
                    <span>Quản lý Báo cáo công tác nắm tình hình địa bàn theo tháng</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hỗ trợ cán bộ nộp báo cáo tích hợp 1 lần cho nhiều địa bàn phụ trách; tự động đồng bộ tài liệu về từng hồ sơ địa bàn riêng biệt.
                  </p>
                </div>

                {/* Nút Lập / Tiếp nhận báo cáo tích hợp */}
                <button
                  type="button"
                  onClick={handleOpenNewBaoCaoThang}
                  className="px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2 transition cursor-pointer self-start lg:self-auto"
                >
                  <Upload className="w-4 h-4" />
                  <span>+ Tiếp nhận báo cáo tháng (Tích hợp nhiều địa bàn)</span>
                </button>
              </div>

              {/* Thanh bộ lọc & chuyển tab con */}
              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Chuyển đổi chế độ xem */}
                  <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-lg border border-slate-300/60">
                    <button
                      type="button"
                      onClick={() => setBaoCaoSubView('DANH_SACH_BC')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        baoCaoSubView === 'DANH_SACH_BC'
                          ? 'bg-white text-[#133863] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Danh sách báo cáo đã tiếp nhận ({filteredBaoCaoThangList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaoCaoSubView('TIEN_DO_DIA_BAN')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                        baoCaoSubView === 'TIEN_DO_DIA_BAN'
                          ? 'bg-white text-[#133863] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Theo dõi tiến độ từng địa bàn ({records.length})</span>
                    </button>
                  </div>

                  {/* Lọc tháng */}
                  <select
                    value={filterBaoCaoThangMonth}
                    onChange={(e) => setFilterBaoCaoThangMonth(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  >
                    <option value={0}>-- Tất cả các tháng --</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>

                  {/* Lọc năm */}
                  <select
                    value={filterBaoCaoThangYear}
                    onChange={(e) => setFilterBaoCaoThangYear(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  >
                    <option value={2026}>Năm 2026</option>
                    <option value={2025}>Năm 2025</option>
                    <option value={0}>Tất cả các năm</option>
                  </select>

                  {/* Lọc cán bộ nộp */}
                  <select
                    value={filterBaoCaoCanBo}
                    onChange={(e) => setFilterBaoCaoCanBo(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  >
                    <option value="ALL">-- Tất cả cán bộ nộp --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ho_ten}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* VIEW 1: DANH SÁCH BÁO CÁO ĐÃ TIẾP NHẬN (CÓ HIỂN THỊ CÁC ĐỊA BÀN ĐƯỢC TÍCH HỢP) */}
            {baoCaoSubView === 'DANH_SACH_BC' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <th className="py-3 px-3.5 w-12 text-center">STT</th>
                      <th className="py-3 px-3.5 min-w-[260px]">Tiêu đề báo cáo & Kỳ báo cáo</th>
                      <th className="py-3 px-3.5 min-w-[260px]">
                        Địa bàn áp dụng (Tích hợp nhiều địa bàn)
                      </th>
                      <th className="py-3 px-3.5 min-w-[170px]">Cán bộ nộp & Thời điểm</th>
                      <th className="py-3 px-3.5 min-w-[140px] text-center">Tình trạng nộp</th>
                      <th className="py-3 px-3.5 min-w-[200px]">Tệp đính kèm</th>
                      <th className="py-3 px-3.5 w-24 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredBaoCaoThangList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Chưa có báo cáo tháng nào phù hợp với bộ lọc đã chọn.
                        </td>
                      </tr>
                    ) : (
                      filteredBaoCaoThangList.map((bc, idx) => (
                        <tr key={bc.id} className="hover:bg-slate-50/80 transition group">
                          {/* STT */}
                          <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Tiêu đề & Kỳ báo cáo */}
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-900 block text-sm leading-snug">
                              {bc.tieu_de}
                            </span>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#133863] text-white">
                                Tháng {bc.thang}/{bc.nam}
                              </span>
                              {bc.noi_dung_tom_tat && (
                                <span className="text-[11px] text-slate-500 truncate max-w-xs" title={bc.noi_dung_tom_tat}>
                                  {bc.noi_dung_tom_tat}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Địa bàn áp dụng - TÍCH HỢP NHIỀU ĐỊA BÀN */}
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {bc.danh_sach_ten_don_vi.map((ten, dIdx) => {
                                const targetUnitId = bc.danh_sach_don_vi_ids[dIdx];
                                return (
                                  <button
                                    key={dIdx}
                                    type="button"
                                    onClick={() => {
                                      const matchedRec = records.find((r) => r.id === targetUnitId);
                                      if (matchedRec) {
                                        setSelectedRecord(matchedRec);
                                        setModalTab('bao_cao');
                                      }
                                    }}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-[#133863] border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                                    title="Nhấn để mở xem hồ sơ của địa bàn này"
                                  >
                                    <Building2 className="w-3 h-3 text-[#133863]" />
                                    <span>{ten}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {bc.danh_sach_don_vi_ids.length > 1 && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.2 inline-block mt-1">
                                ✓ Tích hợp {bc.danh_sach_don_vi_ids.length} địa bàn
                              </span>
                            )}
                          </td>

                          {/* Cán bộ nộp & Thời điểm */}
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-800 block flex items-center space-x-1">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{bc.can_bo_ten}</span>
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Nộp: {bc.ngay_nop}</span>
                            </span>
                          </td>

                          {/* Tình trạng */}
                          <td className="py-3 px-3.5 text-center">
                            {renderBaoCaoStatusBadge(bc.tinh_trang)}
                          </td>

                          {/* Tệp đính kèm */}
                          <td className="py-3 px-3.5">
                            {bc.file_ten ? (
                              <div className="flex items-center space-x-2">
                                <FileText
                                  className={`w-4 h-4 flex-shrink-0 ${
                                    bc.file_loai === 'pdf' ? 'text-red-600' : 'text-blue-600'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 block text-xs truncate max-w-[180px]" title={bc.file_ten}>
                                    {bc.file_ten}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {bc.file_dung_luong ? `${((bc.file_dung_luong || 0) / 1024).toFixed(0)} KB` : 'Tài liệu Word'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa đính kèm</span>
                            )}
                          </td>

                          {/* Thao tác (Tải về / Xem trên Drive / Xóa 2 chiều) */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              {bc.file_ten && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(bc.file_ten!)}
                                  className="p-1.5 text-[#133863] hover:bg-blue-50 rounded-md transition cursor-pointer font-bold flex items-center space-x-1"
                                  title="Tải tệp báo cáo về máy"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>Tải về</span>
                                </button>
                              )}
                              {((bc as any).google_drive_preview_url || (bc as any).is_google_drive || (bc as any).file_url?.includes('drive.google.com')) && (
                                <a
                                  href={(bc as any).google_drive_preview_url || (bc as any).file_url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer font-bold flex items-center space-x-1"
                                  title="Mở xem trên Google Drive"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Drive</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteBaoCao(bc)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer font-bold flex items-center space-x-1"
                                title="Xóa báo cáo tháng (đồng thời xóa tệp trên Kho dữ liệu và Google Drive)"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Xóa</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 2: THEO DÕI TIẾN ĐỘ TỪNG ĐỊA BÀN */}
            {baoCaoSubView === 'TIEN_DO_DIA_BAN' && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-[#133863] flex-shrink-0" />
                            <span className="font-bold text-slate-900 text-sm">{r.ten_dia_ban}</span>
                          </div>
                          {renderBaoCaoStatusBadge(r.tinh_trang_bao_cao_thang)}
                        </div>

                        <p className="text-xs text-slate-600 mt-2">
                          Cán bộ phụ trách: <strong>{r.can_bo_phu_trach_ten}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Căn cứ: {r.van_ban_phan_cong || 'QĐ số 08-QĐ/UBKT'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Tháng: {r.thang_hien_tai}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecord(r);
                              setModalTab('bao_cao');
                            }}
                            className="text-slate-600 hover:text-[#133863] font-bold"
                          >
                            Xem hồ sơ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenNopBaoCaoForRecord(r)}
                            className="px-2.5 py-1 bg-[#133863] text-white rounded-md font-bold hover:bg-blue-900 transition cursor-pointer"
                          >
                            Cập nhật BC
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHÂN HỆ 4: KHO TÀI LIỆU ĐỊA BÀN (6 NHÓM HỒ SƠ - TRA CỨU & PHÂN BỔ BÁO CÁO THÁNG) */}
      {subTab === 'kho_tai_lieu' && (
        <div className="space-y-4">
          {/* Header Card của Kho tài liệu */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Folder className="w-5 h-5 text-[#133863]" />
                  <span>Kho tài liệu nghiệp vụ hồ sơ địa bàn (6 Nhóm hồ sơ)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lưu trữ tập trung toàn bộ văn bản quy chế, quyết định, biên bản và các báo cáo định kỳ theo từng địa bàn cơ sở.
                </p>
              </div>

              {/* Nút Tải lên tài liệu mới */}
              <button
                type="button"
                onClick={() => {
                  setUploadTargetDonViId('');
                  setIsUploadDocOpen(true);
                }}
                className="px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2 transition cursor-pointer self-start md:self-auto"
              >
                <Upload className="w-4 h-4" />
                <span>+ Tải lên tài liệu mới</span>
              </button>
            </div>

            {/* 6 Khối tương tác nhanh theo 6 Nhóm hồ sơ chuẩn nghiệp vụ */}
            <div className="pt-4 space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Chọn nhóm hồ sơ nghiệp vụ để lọc tài liệu:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Lựa chọn tất cả */}
                <button
                  type="button"
                  onClick={() => setFilterKhoNhom('ALL')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                    filterKhoNhom === 'ALL'
                      ? 'bg-[#133863] text-white border-[#133863] shadow-xs'
                      : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Layers className={`w-5 h-5 ${filterKhoNhom === 'ALL' ? 'text-amber-300' : 'text-[#133863]'}`} />
                    <span className="font-bold text-xs">Tất cả 6 nhóm hồ sơ</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    filterKhoNhom === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {files.length}
                  </span>
                </button>

                {/* 6 Nhóm hồ sơ */}
                {NHOM_HO_SO.map((nhom) => {
                  const isActive = filterKhoNhom === nhom.ten;
                  const count = nhomCounts[nhom.ten] || 0;
                  return (
                    <button
                      key={nhom.id}
                      type="button"
                      onClick={() => setFilterKhoNhom(nhom.ten)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start justify-between ${
                        isActive
                          ? 'bg-[#133863] text-white border-[#133863] shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5 min-w-0 pr-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#133863]'
                        }`}>
                          {nhom.id}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{nhom.ten}</p>
                          <p className={`text-[10px] mt-0.5 line-clamp-1 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                            {nhom.mo_ta}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bảng Danh sách Tài liệu & Bộ lọc chi tiết */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Toolbar lọc: Tên tệp + Địa bàn + Loại file */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-3xl">
                {/* Tìm kiếm */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchKhoQuery}
                    onChange={(e) => setSearchKhoQuery(e.target.value)}
                    placeholder="Tìm tên tài liệu, địa bàn, người tải lên..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  />
                </div>

                {/* Lọc theo địa bàn */}
                <select
                  value={filterKhoDiaBan}
                  onChange={(e) => setFilterKhoDiaBan(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Tất cả địa bàn --</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.ten_dia_ban}
                    </option>
                  ))}
                </select>

                {/* Lọc theo loại file */}
                <select
                  value={filterKhoLoaiFile}
                  onChange={(e) => setFilterKhoLoaiFile(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="ALL">-- Tất cả định dạng --</option>
                  <option value="docx">Tài liệu Word (.docx, .doc)</option>
                  <option value="pdf">Tệp PDF (.pdf)</option>
                </select>
              </div>

              <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Hiển thị: <strong>{filteredKhoFiles.length}</strong> / {files.length} tài liệu
              </div>
            </div>

            {/* Bảng dữ liệu tài liệu */}
            {/* Bảng dữ liệu tài liệu dạng bảng theo yêu cầu (STT, Thể loại, Trích yếu, Địa bàn, Người ký, Ngày ban hành, File) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 w-12 text-center">STT</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Thể loại văn bản</th>
                    <th className="py-3 px-3.5 min-w-[280px]">Trích yếu nội dung</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Thuộc địa bàn / Đơn vị</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Người ký</th>
                    <th className="py-3 px-3.5 min-w-[120px] text-center">Ngày ban hành</th>
                    <th className="py-3 px-3.5 min-w-[170px] text-right">File văn bản</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredKhoFiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Không tìm thấy tài liệu nào phù hợp với điều kiện tra cứu.
                      </td>
                    </tr>
                  ) : (
                    filteredKhoFiles.map((file, idx) => (
                      <tr key={file.id} className="hover:bg-slate-50/80 transition group">
                        {/* 1. STT */}
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. Thể loại văn bản */}
                        <td className="py-3 px-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              file.the_loai_van_ban === 'Quyết định'
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : file.the_loai_van_ban === 'Kế hoạch'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : file.the_loai_van_ban === 'Kết luận'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : file.the_loai_van_ban === 'Báo cáo'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {file.the_loai_van_ban || 'Văn bản'}
                          </span>
                          {file.loai_tai_lieu && (
                            <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={file.loai_tai_lieu}>
                              {file.loai_tai_lieu.replace(/^\d+\.\s*/, '')}
                            </span>
                          )}
                        </td>

                        {/* 3. Trích yếu nội dung */}
                        <td className="py-3 px-3.5">
                          <div className="space-y-0.5">
                            {file.so_van_ban && (
                              <span className="text-[11px] font-bold text-[#133863] font-mono mr-1.5">
                                [{file.so_van_ban}]
                              </span>
                            )}
                            <span className="font-semibold text-slate-800 leading-snug">
                              {file.trich_yeu || file.mo_ta || file.ten_file}
                            </span>
                          </div>
                        </td>

                        {/* 4. Địa bàn */}
                        <td className="py-3 px-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              const rec = records.find((r) => r.id === file.don_vi_id);
                              if (rec) {
                                setSelectedRecord(rec);
                                setModalTab('tai_lieu');
                              }
                            }}
                            className="text-[#133863] font-bold hover:underline flex items-center space-x-1 cursor-pointer text-left"
                            title="Bấm để xem toàn bộ hồ sơ của địa bàn này"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{file.ten_don_vi || 'Địa bàn cơ sở'}</span>
                          </button>
                        </td>

                        {/* 5. Người ký */}
                        <td className="py-3 px-3.5">
                          <span className="font-medium text-slate-700 block">
                            {file.nguoi_ky || file.nguoi_tao || '---'}
                          </span>
                        </td>

                        {/* 6. Ngày ban hành (đã sắp xếp giảm dần) */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                            {file.ngay_ban_hanh || file.ngay_tao || '---'}
                          </span>
                        </td>

                        {/* 7. File văn bản / Thao tác */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file.ten_file)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-[#133863] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                            title={`Tải về: ${file.ten_file}`}
                          >
                            <FileText className={`w-3.5 h-3.5 ${file.loai_file === 'pdf' ? 'text-red-600' : 'text-blue-600'}`} />
                            <span className="truncate max-w-[130px] text-left">{file.ten_file}</span>
                            <Download className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 3. MODAL XEM CHI TIẾT HỒ SƠ ĐỊA BÀN                                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="bg-[#133863] px-6 py-4 text-white flex items-center justify-between border-b-2 border-amber-500 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <Building2 className="w-6 h-6 text-amber-300 flex-shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold uppercase tracking-tight">
                      HỒ SƠ ĐỊA BÀN: {selectedRecord.ten_dia_ban}
                    </h3>
                    {renderTrangThaiHoSoBadge(selectedRecord.trang_thai_ho_so)}
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Phụ trách: {selectedRecord.can_bo_phu_trach_ten} · {selectedRecord.van_ban_phan_cong}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetRecord(selectedRecord)}
                    className="text-rose-200 hover:text-white hover:bg-rose-600/40 px-2.5 py-1 rounded-md transition flex items-center space-x-1.5 text-xs font-semibold cursor-pointer border border-rose-400/30"
                    title="Xóa hồ sơ địa bàn này"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                    <span className="hidden sm:inline">Xóa hồ sơ</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-white/70 hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Sub-tabs trong modal */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 text-xs font-bold text-slate-600 flex-shrink-0 overflow-x-auto">
              <button
                onClick={() => setModalTab('thong_tin')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  modalTab === 'thong_tin' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Thông tin & Kết thúc
              </button>
              <button
                onClick={() => setModalTab('lich_su')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  modalTab === 'lich_su' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử phụ trách ({selectedRecord.lich_su_phu_trach?.length || 1})</span>
              </button>
              <button
                onClick={() => setModalTab('van_de')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer ${
                  modalTab === 'van_de' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Vấn đề theo dõi ({selectedRecord.so_van_de_theo_doi})
              </button>
              <button
                onClick={() => setModalTab('chi_dao')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer ${
                  modalTab === 'chi_dao' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Chỉ đạo chưa xong ({selectedRecord.so_chi_dao_chua_hoan_thanh})
              </button>
              <button
                onClick={() => setModalTab('bao_cao')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer ${
                  modalTab === 'bao_cao' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Báo cáo tháng
              </button>
              <button
                onClick={() => setModalTab('tai_lieu')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer ${
                  modalTab === 'tai_lieu' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Tài liệu & Hồ sơ
              </button>
              <button
                onClick={() => setModalTab('chuong_trinh_nhiem_ky')}
                className={`py-3 px-3 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                  modalTab === 'chuong_trinh_nhiem_ky' ? 'border-[#133863] text-[#133863]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🏛️ Chương trình & Bảng đối chiếu</span>
                {relatedThayDoiList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                    {relatedThayDoiList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tổng hợp 6 nhóm hồ sơ nghiệp vụ địa bàn */}
            <div className="bg-slate-100/90 px-6 py-2.5 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-[#133863]" />
                  <span>Tổng hợp 6 nhóm hồ sơ nghiệp vụ: {selectedRecord.ten_dia_ban}</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Tổng tài liệu: <strong>{files.filter((f) => f.don_vi_id === selectedRecord.id).length}</strong> tệp
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {NHOM_HO_SO.map((nhom) => {
                  const count = files.filter((f) => f.don_vi_id === selectedRecord.id && f.loai_tai_lieu === nhom.ten).length;
                  return (
                    <button
                      key={nhom.id}
                      type="button"
                      onClick={() => {
                        setDocNhom(nhom.ten);
                        setModalTab('tai_lieu');
                      }}
                      className="p-2 rounded-lg border border-slate-200/90 bg-white hover:border-[#133863] text-left transition cursor-pointer flex flex-col justify-between shadow-2xs"
                      title={nhom.mo_ta}
                    >
                      <div className="flex items-center space-x-1 mb-1">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-[#133863] font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {nhom.id}
                        </span>
                        <span className="text-[10px] font-bold text-slate-800 line-clamp-1">{nhom.ten.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400">Lưu:</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${count > 0 ? 'bg-blue-100 text-[#133863]' : 'bg-slate-100 text-slate-400'}`}>
                          {count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body modal cuộn được */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Tab Thông tin chung & Kết thúc hồ sơ */}
              {modalTab === 'thong_tin' && (
                <div className="space-y-4">
                  {/* Banner cam kết kế thừa hồ sơ */}
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex items-start space-x-3 text-xs text-blue-900">
                    <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Kế thừa và bảo toàn dữ liệu hồ sơ địa bàn: </span>
                      <span>
                        Khi có quyết định thay đổi cán bộ phụ trách, cán bộ nhận bàn giao mới (
                        <strong>{selectedRecord.can_bo_phu_trach_ten}</strong>) được toàn quyền tra cứu, xem và kế thừa đầy đủ mọi nội dung hồ sơ, báo cáo định kỳ, các vấn đề cơ sở và tài liệu đính kèm trước thời điểm mình phụ trách đơn vị mới.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Khối 1: Thông tin tổ chức Đảng */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">1. Thông tin tổ chức Đảng</p>
                      <p className="text-sm font-bold text-slate-900">{selectedRecord.ten_dia_ban}</p>
                      <p className="text-xs text-slate-600">Loại hình: {selectedRecord.loai_to_chuc === 'DANG_BO' ? 'Đảng bộ cơ sở' : 'Chi bộ trực thuộc'}</p>
                      <p className="text-xs text-slate-600">Ghi chú: {selectedRecord.ghi_chu || 'Không có'}</p>
                      <div className="pt-2 border-t border-slate-200 flex items-center space-x-2 text-xs">
                        <span className="text-slate-500">Trạng thái hồ sơ:</span>
                        {renderTrangThaiHoSoBadge(selectedRecord.trang_thai_ho_so)}
                      </div>
                    </div>

                    {/* Khối 2: Phân công cán bộ & Bàn giao */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-500 uppercase">2. Cán bộ phụ trách hiện tại</p>
                          {selectedRecord.lich_su_phu_trach && selectedRecord.lich_su_phu_trach.length > 1 && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                              {selectedRecord.lich_su_phu_trach.length} thời kỳ phụ trách
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900">{selectedRecord.can_bo_phu_trach_ten}</p>
                        <p className="text-xs text-slate-600">Chức vụ: {selectedRecord.can_bo_chuc_vu || 'Chuyên viên UBKT'}</p>
                        <p className="text-xs text-slate-600">Văn bản phân công: {selectedRecord.van_ban_phan_cong}</p>
                        <p className="text-xs text-slate-600">Thời gian nhận nhiệm vụ: {selectedRecord.thoi_gian_phan_cong}</p>
                      </div>

                      {isAdmin && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Luân chuyển cán bộ:</span>
                          <button
                            type="button"
                            onClick={() => handleOpenDoiCanBo(selectedRecord)}
                            className="px-2.5 py-1 text-xs font-bold text-[#133863] bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 flex items-center space-x-1 transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Đổi cán bộ / Bàn giao</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Khối 3: Trạng thái & Kết thúc hồ sơ địa bàn khi hoàn thành đủ hồ sơ */}
                    <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                            <Archive className="w-4 h-4 text-[#133863]" />
                            <span>Trạng thái hoàn thành & Kết thúc hồ sơ địa bàn</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Kết thúc hồ sơ địa bàn khi đơn vị đã thu thập đủ tài liệu và giải quyết dứt điểm các nhiệm vụ được giao.
                          </p>
                        </div>

                        <div>
                          {selectedRecord.trang_thai_ho_so === 'DA_KET_THUC' ? (
                            canManageSelectedRecord && (
                              <button
                                type="button"
                                onClick={() => handleReopenHoSo(selectedRecord)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1 transition cursor-pointer border border-slate-300"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Mở lại theo dõi hồ sơ</span>
                              </button>
                            )
                          ) : (
                            canManageSelectedRecord && (
                              <button
                                type="button"
                                onClick={() => handleOpenKetThucHoSo(selectedRecord)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center space-x-1 transition cursor-pointer shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>✓ Kết thúc hồ sơ địa bàn</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {selectedRecord.trang_thai_ho_so === 'DA_KET_THUC' ? (
                        <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                          <div className="flex items-center space-x-2 font-bold text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>HỒ SƠ ĐỊA BÀN ĐÃ HOÀN THÀNH & KẾT THÚC THEO DÕI</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-800">
                            <p>Ngày kết thúc: <strong>{selectedRecord.ngay_ket_thuc_ho_so || 'Đã hoàn thành'}</strong></p>
                            <p>Người xác nhận: <strong>{selectedRecord.nguoi_ket_thuc || 'Lãnh đạo UBKT'}</strong></p>
                            <p className="sm:col-span-2">Căn cứ văn bản: <strong>{selectedRecord.van_ban_ket_thuc || 'Báo cáo kết luận giám sát'}</strong></p>
                          </div>
                          {selectedRecord.ghi_chu_ket_thuc && (
                            <p className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded border border-emerald-200/60 mt-1 italic">
                              "{selectedRecord.ghi_chu_ket_thuc}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            <p className="text-slate-500 text-[11px]">Báo cáo tháng {selectedRecord.thang_hien_tai}</p>
                            <p className="font-bold text-slate-800 mt-1">
                              {selectedRecord.tinh_trang_bao_cao_thang === 'CHUA_NOP' ? 'Chưa nộp' : 'Đã nộp'}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            <p className="text-slate-500 text-[11px]">Vấn đề cơ sở</p>
                            <p className="font-bold text-slate-800 mt-1">
                              {selectedRecord.so_van_de_theo_doi === 0 ? '✓ Đã giải quyết hết' : `${selectedRecord.so_van_de_theo_doi} vấn đề`}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            <p className="text-slate-500 text-[11px]">Chỉ đạo cấp trên</p>
                            <p className="font-bold text-slate-800 mt-1">
                              {selectedRecord.so_chi_dao_chua_hoan_thanh === 0 ? '✓ Đã hoàn thành' : `${selectedRecord.so_chi_dao_chua_hoan_thanh} chưa xong`}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                            <p className="text-slate-500 text-[11px]">Tài liệu lưu trữ</p>
                            <p className="font-bold text-slate-800 mt-1">
                              {files.filter((f) => f.don_vi_id === selectedRecord.id).length} tệp hồ sơ
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Lịch sử phụ trách & Bàn giao hồ sơ */}
              {modalTab === 'lich_su' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1.5">
                        <History className="w-4 h-4 text-[#133863]" />
                        <span>Lịch sử luân chuyển & Phân công cán bộ phụ trách địa bàn</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Theo dõi quá trình bàn giao, tiếp quản và bảo đảm tính kế thừa hồ sơ qua các thời kỳ cán bộ.
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBoSungCanCu(null)}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg flex items-center space-x-1.5 hover:bg-amber-700 transition cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>+ Bổ sung căn cứ văn bản</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDoiCanBo(selectedRecord)}
                          className="px-3 py-1.5 text-xs font-bold bg-[#133863] text-white rounded-lg flex items-center space-x-1.5 hover:bg-blue-900 transition cursor-pointer shadow-2xs"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>+ Đổi cán bộ / Bàn giao</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Banner cam kết kế thừa hồ sơ */}
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/80 flex items-start space-x-3 text-xs text-blue-900">
                    <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Chính sách bảo toàn và kế thừa hồ sơ nghiệp vụ địa bàn:</p>
                      <p className="mt-0.5 text-blue-800 leading-relaxed">
                        Khi thay đổi cán bộ phụ trách, cán bộ nhận bàn giao mới (<strong>{selectedRecord.can_bo_phu_trach_ten}</strong>) được cấp quyền xem toàn bộ nội dung hồ sơ, báo cáo các tháng trước, vấn đề cơ sở và tài liệu đính kèm được lập trước thời điểm mình phụ trách đơn vị mới.
                      </p>
                    </div>
                  </div>

                  {/* Danh sách các thời kỳ phụ trách (Timeline) */}
                  <div className="space-y-3 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {(selectedRecord.lich_su_phu_trach && selectedRecord.lich_su_phu_trach.length > 0
                      ? selectedRecord.lich_su_phu_trach
                      : [
                          {
                            id: 'ls-init',
                            can_bo_id: selectedRecord.can_bo_phu_trach_id || '',
                            can_bo_ten: selectedRecord.can_bo_phu_trach_ten || 'Cán bộ phụ trách',
                            can_bo_chuc_vu: selectedRecord.can_bo_chuc_vu || 'Ủy viên UBKT Đảng ủy',
                            tu_ngay: selectedRecord.thoi_gian_phan_cong || '15/01/2026',
                            den_ngay: undefined,
                            van_ban_phan_cong: selectedRecord.van_ban_phan_cong || 'QĐ số 08-QĐ/UBKT',
                            so_quyet_dinh: selectedRecord.van_ban_phan_cong || 'QĐ số 08-QĐ/UBKT',
                            ngay_ban_hanh_qd: '15/01/2026',
                            co_quan_ban_hanh: 'Ủy ban Kiểm tra Đảng ủy',
                            can_cu_van_ban: 'Quyết định về việc phân công cán bộ theo dõi, phụ trách các tổ chức Đảng trực thuộc',
                            ly_do_thay_doi: 'Phân công phụ trách ban đầu',
                            nguoi_thuc_hien: 'Thường trực Đảng ủy',
                            created_at: new Date().toISOString(),
                          },
                        ]
                    )
                      .slice()
                      .reverse()
                      .map((entry, eIdx) => {
                        const isCurrent = !entry.den_ngay;
                        return (
                          <div
                            key={entry.id || eIdx}
                            className={`relative pl-12 transition ${
                              isCurrent ? 'opacity-100' : 'opacity-90'
                            }`}
                          >
                            {/* Timeline marker */}
                            <div
                              className={`absolute left-3 top-4 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-[#133863] border-white shadow-xs text-white'
                                  : 'bg-slate-300 border-white text-slate-600'
                              }`}
                            >
                              {isCurrent ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                              )}
                            </div>

                            {/* Card nội dung */}
                            <div
                              className={`p-4 rounded-xl border ${
                                isCurrent
                                  ? 'border-blue-300 bg-white shadow-xs ring-1 ring-blue-100'
                                  : 'border-slate-200 bg-slate-50/70'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-bold text-slate-900">{entry.can_bo_ten}</span>
                                  <span className="text-xs text-slate-500">({entry.can_bo_chuc_vu || 'Cán bộ UBKT'})</span>
                                </div>
                                <div>
                                  {isCurrent ? (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Đang phụ trách hiện tại</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">
                                      <span>Thời kỳ trước (Đã bàn giao)</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 mb-2">
                                <div>
                                  <span className="text-slate-400">Thời gian phụ trách: </span>
                                  <strong className="text-slate-800">
                                    Từ {entry.tu_ngay} {entry.den_ngay ? `đến ${entry.den_ngay}` : 'đến nay'}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Căn cứ văn bản: </span>
                                  <strong className="text-slate-800">
                                    {entry.so_quyet_dinh || entry.van_ban_phan_cong || 'QĐ phân công'}
                                    {entry.ngay_ban_hanh_qd && <span className="font-normal text-slate-500"> (ngày {entry.ngay_ban_hanh_qd})</span>}
                                  </strong>
                                </div>
                              </div>

                              {entry.co_quan_ban_hanh && (
                                <p className="text-xs text-slate-600 mb-1.5">
                                  <span className="text-slate-400">Cơ quan / Thẩm quyền ban hành: </span>
                                  <strong className="text-slate-800">{entry.co_quan_ban_hanh}</strong>
                                </p>
                              )}

                              {entry.can_cu_van_ban && (
                                <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200/60 text-xs text-blue-950 mb-2">
                                  <span className="font-bold text-[#133863] block mb-0.5">Trích yếu nội dung căn cứ phân công:</span>
                                  <p className="leading-relaxed">{entry.can_cu_van_ban}</p>
                                </div>
                              )}

                              {entry.file_van_ban && (
                                <div className="mb-2 flex items-center space-x-2 text-xs">
                                  <span className="text-slate-400">Tệp văn bản phân công:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(entry.file_van_ban!)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-[#133863] font-bold rounded border border-slate-300 flex items-center space-x-1 cursor-pointer transition"
                                  >
                                    <Paperclip className="w-3 h-3 text-[#133863]" />
                                    <span>{entry.file_van_ban}</span>
                                    <Download className="w-3 h-3 text-slate-400" />
                                  </button>
                                </div>
                              )}

                              {entry.ly_do_thay_doi && (
                                <p className="text-xs text-slate-700 bg-slate-100/80 p-2.5 rounded-lg border border-slate-200/80 mt-2">
                                  <span className="font-semibold text-slate-800">Lý do & Nội dung chuyển giao: </span>
                                  {entry.ly_do_thay_doi}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
                                <span>Người thực hiện: <strong>{entry.nguoi_thuc_hien || 'UBKT Đảng ủy'}</strong></span>
                                <div className="flex items-center space-x-2">
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenBoSungCanCu(entry)}
                                      className="px-2.5 py-1 text-xs text-[#133863] hover:bg-blue-50 rounded-md border border-blue-200 flex items-center space-x-1 font-semibold transition cursor-pointer"
                                      title="Bổ sung hoặc sửa đổi căn cứ văn bản cho thời kỳ này"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Bổ sung căn cứ văn bản</span>
                                    </button>
                                  )}
                                  {isCurrent && (
                                    <span className="text-blue-700 font-semibold flex items-center space-x-1">
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Được toàn quyền kế thừa hồ sơ cũ</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tab Vấn đề theo dõi */}
              {modalTab === 'van_de' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase">
                        Danh sách vấn đề cần theo dõi ({selectedRecord.danh_sach_van_de?.length || 0})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Theo dõi vấn đề cơ sở, đính kèm tài liệu và phân loại theo 6 nhóm hồ sơ
                      </p>
                    </div>
                    {canManageSelectedRecord && (
                      <button
                        type="button"
                        onClick={handleOpenAddVanDe}
                        className="px-2.5 py-1 text-xs font-bold bg-[#133863] text-white rounded-md flex items-center space-x-1 hover:bg-blue-900 transition cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm vấn đề</span>
                      </button>
                    )}
                  </div>

                  {(!selectedRecord.danh_sach_van_de || selectedRecord.danh_sach_van_de.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">Không có vấn đề phức tạp nào đang theo dõi</p>
                  ) : (
                    selectedRecord.danh_sach_van_de.map((vd) => (
                      <div key={vd.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  vd.muc_do === 'PHUC_TAP'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : vd.muc_do === 'QUAN_TRONG'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {vd.muc_do === 'PHUC_TAP' ? 'Phức tạp' : vd.muc_do === 'QUAN_TRONG' ? 'Quan trọng' : 'Thường'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  vd.trang_thai === 'DA_XU_LY'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-200 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {vd.trang_thai === 'DA_XU_LY' ? '✓ Đã xử lý' : '● Đang theo dõi'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Ghi nhận: {vd.ngay_ghi_nhan}
                                {vd.nguoi_ghi_nhan && ` (${vd.nguoi_ghi_nhan})`}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 mt-1.5 leading-relaxed">{vd.noi_dung}</p>
                          </div>

                          {/* Nút Sửa / Xóa */}
                          {canManageSelectedRecord && (
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditVanDe(vd)}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition cursor-pointer"
                                title="Chỉnh sửa vấn đề & bổ sung tệp đính kèm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVanDe(vd.id)}
                                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition cursor-pointer"
                                title="Xóa vấn đề theo dõi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Nhóm hồ sơ & Tệp đính kèm */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            <Folder className="w-3 h-3 text-[#133863]" />
                            <span>Nhóm hồ sơ: {vd.nhom_ho_so || '5. Đơn thư, kiến nghị & Phản ánh địa bàn'}</span>
                          </span>

                          {vd.file_ten ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(vd.file_ten || 'Tai_lieu_van_de.docx')}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                            >
                              <FileText className="w-3 h-3 text-red-600" />
                              <span className="truncate max-w-[200px]">{vd.file_ten}</span>
                              <Download className="w-3 h-3 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Chưa đính kèm tệp</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab Chỉ đạo chưa xong */}
              {modalTab === 'chi_dao' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase">
                        Danh sách chỉ đạo / nhiệm vụ giao ({selectedRecord.danh_sach_chi_dao?.length || 0})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Chỉ đạo của Đảng ủy, UBKT Đảng ủy giao địa bàn thực hiện; đính kèm văn bản và liên kết 6 nhóm hồ sơ
                      </p>
                    </div>
                    {canManageSelectedRecord && (
                      <button
                        type="button"
                        onClick={handleOpenAddChiDao}
                        className="px-2.5 py-1 text-xs font-bold bg-[#133863] text-white rounded-md flex items-center space-x-1 hover:bg-blue-900 transition cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm chỉ đạo</span>
                      </button>
                    )}
                  </div>

                  {(!selectedRecord.danh_sach_chi_dao || selectedRecord.danh_sach_chi_dao.length === 0) ? (
                    <p className="text-xs text-emerald-600 font-medium py-6 text-center flex items-center justify-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Tất cả các chỉ đạo của cấp trên đã được hoàn thành đầy đủ</span>
                    </p>
                  ) : (
                    selectedRecord.danh_sach_chi_dao.map((cd) => (
                      <div key={cd.id} className="p-3.5 rounded-xl border border-red-200/80 bg-red-50/30 hover:bg-red-50/50 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  cd.trang_thai === 'DA_HOAN_THANH'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}
                              >
                                {cd.trang_thai === 'DA_HOAN_THANH' ? '✓ Đã hoàn thành' : '⚠ Chưa hoàn thành'}
                              </span>
                              {cd.han_hoan_thanh && (
                                <span className="text-[11px] text-red-700 font-semibold">
                                  Hạn: {cd.han_hoan_thanh}
                                </span>
                              )}
                              {cd.nguoi_ghi_nhan && (
                                <span className="text-[11px] text-slate-400">
                                  • Ghi nhận: {cd.nguoi_ghi_nhan}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-900 mt-1.5 leading-relaxed">{cd.noi_dung}</p>
                            {cd.van_ban_chi_dao && (
                              <p className="text-[11px] text-slate-500 mt-1">
                                Văn bản chỉ đạo: <strong>{cd.van_ban_chi_dao}</strong>
                              </p>
                            )}
                          </div>

                          {/* Nút Sửa / Xóa */}
                          {canManageSelectedRecord && (
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditChiDao(cd)}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition cursor-pointer"
                                title="Chỉnh sửa chỉ đạo & bổ sung tệp đính kèm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChiDao(cd.id)}
                                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition cursor-pointer"
                                title="Xóa chỉ đạo này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Nhóm hồ sơ & Tệp đính kèm */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-red-100 text-xs">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            <Folder className="w-3 h-3 text-[#133863]" />
                            <span>Nhóm hồ sơ: {cd.nhom_ho_so || '6. Kết luận kiểm tra & Văn bản chỉ đạo'}</span>
                          </span>

                          {cd.file_ten ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(cd.file_ten || 'Chi_dao.pdf')}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                            >
                              <FileText className="w-3 h-3 text-red-600" />
                              <span className="truncate max-w-[200px]">{cd.file_ten}</span>
                              <Download className="w-3 h-3 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Chưa đính kèm tệp</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab Báo cáo tháng */}
              {modalTab === 'bao_cao' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase">
                        Tình hình nộp báo cáo định kỳ theo tháng
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Theo dõi các báo cáo tháng đã nộp (bao gồm cả báo cáo nộp tích hợp cùng các địa bàn khác)
                      </p>
                    </div>
                    {isUserAssignedToRecord(selectedRecord) ? (
                      <button
                        type="button"
                        onClick={() => handleOpenNopBaoCaoForRecord(selectedRecord)}
                        className="px-3 py-1.5 text-xs font-bold bg-[#133863] text-white rounded-lg flex items-center space-x-1 hover:bg-blue-900 transition cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>+ Nộp / Cập nhật báo cáo tháng</span>
                      </button>
                    ) : (
                      <span className="text-xs text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 font-medium">
                        Chỉ cán bộ phụ trách ({selectedRecord.can_bo_phu_trach_ten || 'được phân công'}) hoặc Admin mới có quyền nộp báo cáo
                      </span>
                    )}
                  </div>

                  {/* Thẻ trạng thái hiện hành */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">Báo cáo tháng {selectedRecord.thang_hien_tai}</span>
                        {renderBaoCaoStatusBadge(selectedRecord.tinh_trang_bao_cao_thang)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Cán bộ phụ trách theo dõi: <strong>{selectedRecord.can_bo_phu_trach_ten}</strong> · Căn cứ: {selectedRecord.van_ban_phan_cong}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(`Bao_cao_thang_${selectedRecord.ten_dia_ban}.docx`)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Tải mẫu BC</span>
                    </button>
                  </div>

                  {/* Danh sách các báo cáo tháng áp dụng cho địa bàn này */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Các báo cáo tháng đã tiếp nhận liên quan đến địa bàn:
                    </p>
                    {baoCaoThangList.filter((b) => b.danh_sach_don_vi_ids && b.danh_sach_don_vi_ids.includes(selectedRecord.id)).length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        Chưa có báo cáo tháng nào được tiếp nhận cho địa bàn này. Nhấn "Nộp / Cập nhật báo cáo tháng" ở trên để bổ sung.
                      </div>
                    ) : (
                      baoCaoThangList
                        .filter((b) => b.danh_sach_don_vi_ids && b.danh_sach_don_vi_ids.includes(selectedRecord.id))
                        .map((bc) => (
                          <div
                            key={bc.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{bc.tieu_de}</span>
                                {renderBaoCaoStatusBadge(bc.tinh_trang)}
                                {bc.danh_sach_don_vi_ids.length > 1 && (
                                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Tích hợp {bc.danh_sach_don_vi_ids.length} địa bàn
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Cán bộ lập: <strong>{bc.can_bo_ten}</strong> · Ngày nộp: {bc.ngay_nop} · Kỳ: Tháng {bc.thang}/{bc.nam}
                              </p>
                              {bc.noi_dung_tom_tat && (
                                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1 italic">
                                  {bc.noi_dung_tom_tat}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
                              {bc.file_ten && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(bc.file_ten!)}
                                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-[#133863] border border-blue-200 rounded-md hover:bg-blue-100 flex items-center space-x-1 cursor-pointer"
                                  title="Tải tệp báo cáo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>{bc.file_ten}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab Tài liệu & Hồ sơ (Dạng bảng STT, Thể loại, Trích yếu, Người ký, Ngày ban hành, File) */}
              {modalTab === 'tai_lieu' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1.5">
                        <Folder className="w-4 h-4 text-[#133863]" />
                        <span>Danh mục tài liệu & Hồ sơ: {selectedRecord.ten_dia_ban} ({files.filter((f) => f.don_vi_id === selectedRecord.id).length})</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Thể hiện dạng bảng chi tiết, thứ tự được sắp xếp giảm dần theo ngày ban hành
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTargetDonViId(selectedRecord.id);
                        setIsUploadDocOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-[#133863] text-white rounded-lg flex items-center space-x-1 hover:bg-blue-900 transition cursor-pointer shadow-2xs self-start sm:self-auto"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ Tải lên tài liệu mới</span>
                    </button>
                  </div>

                  {/* Bảng danh mục tài liệu theo đúng cấu trúc yêu cầu */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3 w-12 text-center">STT</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Thể loại văn bản</th>
                          <th className="py-2.5 px-3 min-w-[280px]">Trích yếu nội dung</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Người ký</th>
                          <th className="py-2.5 px-3 min-w-[120px] text-center">Ngày ban hành</th>
                          <th className="py-2.5 px-3 min-w-[170px] text-left">File văn bản</th>
                          <th className="py-2.5 px-3 w-28 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const recordFiles = files
                            .filter((f) => f.don_vi_id === selectedRecord.id)
                            .sort((a, b) => {
                              const timeA = parseDateVN(a.ngay_ban_hanh || a.ngay_tao);
                              const timeB = parseDateVN(b.ngay_ban_hanh || b.ngay_tao);
                              return timeB - timeA;
                            });

                          if (recordFiles.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                  Chưa có tài liệu tải lên cho địa bàn này. Bấm "+ Tải lên tài liệu mới" để thêm tài liệu.
                                </td>
                              </tr>
                            );
                          }

                          return recordFiles.map((file, idx) => (
                            <tr key={file.id} className="hover:bg-slate-50/80 transition">
                              {/* 1. STT */}
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              {/* 2. Thể loại văn bản */}
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                    file.the_loai_van_ban === 'Quyết định'
                                      ? 'bg-red-50 text-red-800 border border-red-200'
                                      : file.the_loai_van_ban === 'Kế hoạch'
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                      : file.the_loai_van_ban === 'Kết luận'
                                      ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                      : file.the_loai_van_ban === 'Báo cáo'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {file.the_loai_van_ban || 'Văn bản'}
                                </span>
                                {file.loai_tai_lieu && (
                                  <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={file.loai_tai_lieu}>
                                    {file.loai_tai_lieu.replace(/^\d+\.\s*/, '')}
                                  </span>
                                )}
                              </td>

                              {/* 3. Trích yếu nội dung */}
                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5">
                                  {file.so_van_ban && (
                                    <span className="text-[11px] font-bold text-[#133863] font-mono mr-1.5">
                                      [{file.so_van_ban}]
                                    </span>
                                  )}
                                  <span className="font-semibold text-slate-800 leading-snug">
                                    {file.trich_yeu || file.mo_ta || file.ten_file}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Người ký */}
                              <td className="py-2.5 px-3">
                                <span className="font-medium text-slate-700 block">
                                  {file.nguoi_ky || file.nguoi_tao || '---'}
                                </span>
                              </td>

                              {/* 5. Ngày ban hành (sắp xếp giảm dần) */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                                  {file.ngay_ban_hanh || file.ngay_tao || '---'}
                                </span>
                              </td>

                              {/* 6. File văn bản & xem Drive */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(file.ten_file)}
                                    className="inline-flex items-center space-x-1.5 px-2 py-1 text-xs font-semibold text-[#133863] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                                    title={`Tải về: ${file.ten_file}`}
                                  >
                                    <FileText className={`w-3.5 h-3.5 ${file.loai_file === 'pdf' ? 'text-red-600' : 'text-blue-600'}`} />
                                    <span className="truncate max-w-[130px] text-left">{file.ten_file}</span>
                                    <Download className="w-3 h-3 text-slate-400" />
                                  </button>
                                  {(file.is_google_drive || file.google_drive_preview_url || file.url?.includes('drive.google.com')) && (
                                    <a
                                      href={file.google_drive_preview_url || file.file_url || file.url || '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer flex items-center space-x-1 text-[11px] font-bold"
                                      title="Mở xem trên Google Drive"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Drive</span>
                                    </a>
                                  )}
                                </div>
                              </td>

                              {/* 7. Thao tác xóa 2 chiều */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(file)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                                  title="Xóa tài liệu (đồng thời xóa trên Kho dữ liệu và Google Drive)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab Chương trình nhiệm kỳ & Bảng đối chiếu thay đổi bổ sung */}
              {modalTab === 'chuong_trinh_nhiem_ky' && (
                <div className="space-y-5">
                  {/* Banner giải thích tính năng liên kết & đối chiếu */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-start space-x-3">
                    <BookmarkCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <p className="font-bold text-blue-900 text-sm mb-1">
                        Hồ sơ Chương trình nhiệm kỳ & Bảng đối chiếu điều chỉnh, bổ sung
                      </p>
                      <p>
                        Đây là dữ liệu chương trình kiểm tra, giám sát toàn khóa áp dụng cho <strong>{selectedRecord.ten_dia_ban}</strong>.
                        Mọi quyết định thay đổi, bổ sung từ phân hệ <em>Chương trình kiểm tra, giám sát</em> được tự động liên kết, tổng hợp bảng đối chiếu và lưu trữ tập trung tại đây.
                      </p>
                    </div>
                  </div>

                  {/* 1. Thông tin chương trình nhiệm kỳ hiện hành */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 bg-blue-100 text-[#133863] rounded-lg">
                          <Layers className="w-4 h-4" />
                        </span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Chương trình kiểm tra, giám sát toàn khóa
                        </h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đang thực hiện
                      </span>
                    </div>

                    {activeNhiemKyPrograms.length > 0 ? (
                      activeNhiemKyPrograms.map((nk) => (
                        <div key={nk.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Tên chương trình / Khóa:</span>
                            <span className="font-bold text-slate-800">{nk.noi_dung || nk.ten_chuong_trinh || 'Chương trình toàn khóa'}</span>
                            <span className="inline-block ml-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[10px]">
                              {nk.nhiem_ky || nk.khoa_nhiem_ky || '2025 - 2030'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Văn bản ban hành:</span>
                            <span className="font-semibold text-slate-700">
                              {nk.so_van_ban ? `Số ${nk.so_van_ban}` : 'Nghị quyết Đảng ủy'}
                              {nk.ngay_ban_hanh ? ` · Ngày ${nk.ngay_ban_hanh}` : ''}
                            </span>
                            <span className="text-slate-500 block text-[11px]">Chủ thể: {nk.chu_the}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Tệp PDF ban hành gốc:</span>
                            {nk.file_pdf_ten ? (
                              <button
                                onClick={() => handleDownloadFile(nk.file_pdf_ten || 'Chuong_trinh_nhiem_ky.pdf')}
                                className="inline-flex items-center space-x-1 text-blue-700 font-semibold hover:underline mt-0.5 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-red-600" />
                                <span className="truncate max-w-[150px]">{nk.file_pdf_ten}</span>
                                <Download className="w-3 h-3 ml-0.5 text-slate-400" />
                              </button>
                            ) : (
                              <span className="text-slate-400 italic">Chưa đính kèm PDF</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                        Chưa có chương trình nhiệm kỳ nào được ban hành trên hệ thống.
                      </div>
                    )}
                  </div>

                  {/* 2. BẢNG ĐỐI CHIẾU THAY ĐỔI, BỔ SUNG */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Bảng đối chiếu thay đổi, bổ sung đối với {selectedRecord.ten_dia_ban}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            So sánh chi tiết kế hoạch gốc ban đầu và các nội dung đã được điều chỉnh, bổ sung qua các quyết định
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {relatedThayDoiList.length} lần điều chỉnh
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={handleOpenAddThayDoi}
                            className="px-2.5 py-1 text-xs font-bold bg-[#133863] text-white rounded-md flex items-center space-x-1 hover:bg-blue-900 transition cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Thêm điều chỉnh</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {relatedThayDoiList.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">
                          Chưa có quyết định thay đổi, bổ sung nào đối với {selectedRecord.ten_dia_ban}
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                          Đơn vị hiện đang thực hiện đúng theo kế hoạch ban đầu của chương trình toàn khóa. Khi có điều chỉnh từ Đảng ủy/UBKT, bảng đối chiếu sẽ tự động hiển thị tại đây.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {relatedThayDoiList.map((td, idx) => (
                          <div
                            key={td.id || idx}
                            className="border border-amber-200/80 rounded-xl bg-amber-50/20 overflow-hidden shadow-2xs"
                          >
                            {/* Header của đợt điều chỉnh */}
                            <div className="bg-amber-100/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[11px]">
                                  Lần {td.lan_dieu_chinh || idx + 1}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {td.so_van_ban ? `Quyết định số ${td.so_van_ban}` : 'Quyết định điều chỉnh, bổ sung'}
                                </span>
                                {td.ngay_ban_hanh && (
                                  <span className="text-slate-500">({td.ngay_ban_hanh})</span>
                                )}
                                {td.nguoi_ky && (
                                  <span className="text-slate-600 italic">· Người ký: {td.nguoi_ky}</span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-white text-slate-700 border border-amber-200 text-[10px] font-semibold">
                                  📁 {td.nhom_ho_so || '1. Hồ sơ pháp lý & Quyết định phân công'}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                {/* Tệp PDF đính kèm đối chiếu */}
                                {td.file_pdf_ten ? (
                                  <button
                                    onClick={() => handleDownloadFile(td.file_pdf_ten || 'Van_ban_dieu_chinh.pdf')}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-amber-300 rounded-md text-amber-900 font-semibold text-[11px] hover:bg-amber-50 shadow-2xs cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-red-600" />
                                    <span className="truncate max-w-[140px]">{td.file_pdf_ten}</span>
                                    <Download className="w-3 h-3 text-slate-400" />
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Không có PDF đính kèm</span>
                                )}

                                {/* Sửa / Xóa */}
                                {canEdit && (
                                  <div className="flex items-center space-x-1 border-l border-amber-300 pl-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditThayDoi(td)}
                                      className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-white rounded transition cursor-pointer"
                                      title="Chỉnh sửa quyết định điều chỉnh & bổ sung tệp"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteThayDoi(td)}
                                      className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-white rounded transition cursor-pointer"
                                      title="Xóa quyết định điều chỉnh này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Bảng đối chiếu 2 cột: Gốc vs Điều chỉnh */}
                            <div className="p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {/* Cột Kế hoạch Gốc */}
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                                  <div className="flex items-center space-x-1.5 text-slate-600 font-bold uppercase text-[11px] pb-1 border-b border-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    <span>Nội dung kế hoạch ban đầu (Gốc)</span>
                                  </div>
                                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed pt-1 min-h-[50px]">
                                    {td.noi_dung_goc || 'Không ghi nhận nội dung gốc cụ thể'}
                                  </div>
                                </div>

                                {/* Cột Điều chỉnh / Bổ sung */}
                                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-300 space-y-1">
                                  <div className="flex items-center space-x-1.5 text-amber-900 font-bold uppercase text-[11px] pb-1 border-b border-amber-200">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>Nội dung điều chỉnh, bổ sung mới</span>
                                  </div>
                                  <div className="text-amber-950 font-medium whitespace-pre-wrap leading-relaxed pt-1 min-h-[50px]">
                                    {td.noi_dung_dieu_chinh || 'Chưa cập nhật chi tiết nội dung điều chỉnh'}
                                  </div>
                                </div>
                              </div>

                              {/* Lý do / Ghi chú */}
                              {td.ghi_chu && (
                                <div className="mt-2.5 pt-2 border-t border-amber-100 flex items-start space-x-2 text-[11px] text-slate-500">
                                  <strong className="text-slate-700 flex-shrink-0">Lý do điều chỉnh:</strong>
                                  <span>{td.ghi_chu}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetRecord(selectedRecord)}
                    className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 hover:text-rose-900 flex items-center space-x-1.5 transition cursor-pointer"
                    title="Xóa hồ sơ địa bàn này khỏi hệ thống"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xóa hồ sơ này</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 4. MODAL ĐỔI CÁN BỘ PHỤ TRÁCH & BÀN GIAO ĐỊA BÀN                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isDoiCanBoOpen && doiCanBoRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#133863] px-5 py-4 text-white flex items-center justify-between border-b-2 border-amber-500">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold uppercase">Đổi cán bộ phụ trách & Bàn giao địa bàn</h3>
              </div>
              <button
                onClick={() => {
                  setIsDoiCanBoOpen(false);
                  setDoiCanBoRecord(null);
                }}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {/* Thông tin địa bàn & cán bộ hiện tại */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Địa bàn / Đơn vị:</span>
                  <span className="font-bold text-[#133863] text-sm">{doiCanBoRecord.ten_dia_ban}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Cán bộ đang phụ trách:</span>
                  <span className="font-semibold text-slate-800">
                    {doiCanBoRecord.can_bo_phu_trach_ten || 'Chưa phân công'} ({doiCanBoRecord.thoi_gian_phan_cong || 'Hiện tại'})
                  </span>
                </div>
              </div>

              {/* Chọn cán bộ phụ trách mới */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Cán bộ phụ trách mới (Nhận bàn giao địa bàn) *:
                </label>
                <select
                  value={doiCanBoNewUserId}
                  onChange={(e) => setDoiCanBoNewUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#133863]"
                >
                  <option value="">-- Chọn 01 đồng chí cán bộ phụ trách mới --</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.ho_ten} - {u.chuc_danh || (u.vai_tro === 'ADMIN' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT')} ({u.ten_dang_nhap})
                    </option>
                  ))}
                </select>
              </div>

              {/* Căn cứ phân công & Ngày bắt đầu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quyết định / Văn bản phân công mới *:</label>
                  <input
                    type="text"
                    value={doiCanBoVanBan}
                    onChange={(e) => setDoiCanBoVanBan(e.target.value)}
                    placeholder="Ví dụ: QĐ số 15-QĐ/UBKT ngày..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày bắt đầu phụ trách mới:</label>
                  <input
                    type="text"
                    value={doiCanBoNgay}
                    onChange={(e) => setDoiCanBoNgay(e.target.value)}
                    placeholder="Ví dụ: 20/10/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Lý do thay đổi / bàn giao */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do thay đổi cán bộ / Bàn giao *:</label>
                <select
                  value={doiCanBoLyDo}
                  onChange={(e) => setDoiCanBoLyDo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-1.5"
                >
                  <option value="Luân chuyển cán bộ phụ trách địa bàn theo định kỳ">Luân chuyển cán bộ phụ trách địa bàn theo định kỳ</option>
                  <option value="Phân công lại địa bàn theo Quyết định của Thường trực Đảng ủy/UBKT">Phân công lại địa bàn theo Quyết định của Thường trực Đảng ủy/UBKT</option>
                  <option value="Cán bộ chuyển công tác / nhận nhiệm vụ mới">Cán bộ chuyển công tác / nhận nhiệm vụ mới</option>
                  <option value="Tăng cường kiện toàn cán bộ cho địa bàn trọng điểm">Tăng cường kiện toàn cán bộ cho địa bàn trọng điểm</option>
                  <option value="Khác">Lý do khác...</option>
                </select>
                {doiCanBoLyDo === 'Khác' && (
                  <input
                    type="text"
                    placeholder="Nhập lý do thay đổi cụ thể..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    onChange={(e) => setDoiCanBoLyDo(e.target.value)}
                  />
                )}
              </div>

              {/* Ghi chú bàn giao */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú & Nội dung bàn giao:</label>
                <textarea
                  rows={2}
                  value={doiCanBoGhiChu}
                  onChange={(e) => setDoiCanBoGhiChu(e.target.value)}
                  placeholder="Ghi chú về các vấn đề còn dở dang, số lượng tài liệu đã bàn giao..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Hộp cam kết kế thừa hồ sơ */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span>Quy định kế thừa hồ sơ địa bàn:</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Khi thực hiện đổi cán bộ, cán bộ mới nhận phụ trách sẽ <strong>xem và kế thừa đầy đủ mọi nội dung hồ sơ</strong> trước thời điểm mình phụ trách (báo cáo các tháng, các vấn đề cơ sở, văn bản chỉ đạo và kho tài liệu lưu trữ).
                </p>
                <label className="flex items-center space-x-2 pt-1 font-semibold cursor-pointer text-xs text-[#133863]">
                  <input
                    type="checkbox"
                    checked={doiCanBoXacNhan}
                    onChange={(e) => setDoiCanBoXacNhan(e.target.checked)}
                    className="rounded text-[#133863] focus:ring-[#133863]"
                  />
                  <span>Xác nhận hoàn thành thủ tục đổi cán bộ & chuyển giao hồ sơ</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDoiCanBoOpen(false);
                    setDoiCanBoRecord(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!doiCanBoNewUserId || !doiCanBoXacNhan}
                  onClick={handleSaveDoiCanBo}
                  className="px-4 py-1.5 bg-[#133863] text-white rounded-lg font-bold hover:bg-blue-900 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Lưu & Bàn giao</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 4b. MODAL KẾT THÚC HỒ SƠ ĐỊA BÀN                                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isKetThucModalOpen && ketThucRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#133863] px-5 py-4 text-white flex items-center justify-between border-b-2 border-emerald-500">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase">Kết thúc hồ sơ địa bàn</h3>
              </div>
              <button
                onClick={() => {
                  setIsKetThucModalOpen(false);
                  setKetThucRecord(null);
                }}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Tổ chức Đảng:</span>
                  <span className="font-bold text-[#133863] text-sm">{ketThucRecord.ten_dia_ban}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Cán bộ phụ trách:</span>
                  <span className="font-semibold text-slate-800">{ketThucRecord.can_bo_phu_trach_ten}</span>
                </div>
              </div>

              {/* Đánh giá mức độ hoàn thành đủ hồ sơ */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-2 text-emerald-900">
                <span className="font-bold block uppercase text-[11px] tracking-wide text-emerald-800">
                  Kiểm tra điều kiện hoàn thành hồ sơ:
                </span>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Báo cáo tháng: {ketThucRecord.tinh_trang_bao_cao_thang === 'CHUA_NOP' ? 'Chưa nộp (Cần hoàn tất)' : 'Đã nộp đầy đủ'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Vấn đề theo dõi: {ketThucRecord.so_van_de_theo_doi === 0 ? 'Không còn vấn đề tồn đọng' : `${ketThucRecord.so_van_de_theo_doi} vấn đề đã ghi nhận`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Chỉ đạo cấp trên: {ketThucRecord.so_chi_dao_chua_hoan_thanh === 0 ? 'Đã hoàn thành 100%' : `${ketThucRecord.so_chi_dao_chua_hoan_thanh} chỉ đạo`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Hồ sơ nghiệp vụ: Đã lưu trữ {files.filter((f) => f.don_vi_id === ketThucRecord.id).length} tệp tài liệu</span>
                  </div>
                </div>
              </div>

              {/* Ngày kết thúc & Căn cứ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày kết thúc hồ sơ *:</label>
                  <input
                    type="text"
                    value={ketThucNgay}
                    onChange={(e) => setKetThucNgay(e.target.value)}
                    placeholder="Ví dụ: 20/10/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Căn cứ văn bản / Kết luận *:</label>
                  <input
                    type="text"
                    value={ketThucVanBan}
                    onChange={(e) => setKetThucVanBan(e.target.value)}
                    placeholder="Ví dụ: Báo cáo số 45-BC/UBKT..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Ghi chú kết luận */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung đánh giá & Kết luận kết thúc hồ sơ:</label>
                <textarea
                  rows={3}
                  value={ketThucGhiChu}
                  onChange={(e) => setKetThucGhiChu(e.target.value)}
                  placeholder="Ghi chú tóm tắt kết quả theo dõi, đánh giá chấp hành kỷ luật của Đảng bộ/Chi bộ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsKetThucModalOpen(false);
                    setKetThucRecord(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveKetThucHoSo}
                  className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition cursor-pointer flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác nhận kết thúc hồ sơ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 5. MODAL THÊM VẤN ĐỀ CẦN THEO DÕI                                        */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 5. MODAL THÊM / SỬA VẤN ĐỀ CẦN THEO DÕI (ĐÍNH KÈM TỆP & 6 NHÓM HỒ SƠ)    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isAddVanDeOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-amber-800 px-5 py-4 text-white flex items-center justify-between border-b-2 border-amber-600">
              <h3 className="text-sm font-bold uppercase">
                {editingVanDe ? 'Chỉnh sửa vấn đề theo dõi' : 'Thêm vấn đề cần theo dõi'} - {selectedRecord.ten_dia_ban}
              </h3>
              <button onClick={() => setIsAddVanDeOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung vấn đề cần lưu ý *:</label>
                <textarea
                  rows={3}
                  value={vanDeNoiDung}
                  onChange={(e) => setVanDeNoiDung(e.target.value)}
                  placeholder="Ghi nhận tình hình tư tưởng, đơn thư, đảng phí, sinh hoạt chi bộ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mức độ phức tạp:</label>
                  <select
                    value={vanDeMucDo}
                    onChange={(e) => setVanDeMucDo(e.target.value as 'THUONG' | 'QUAN_TRONG' | 'PHUC_TAP')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="THUONG">Mức độ bình thường</option>
                    <option value="QUAN_TRONG">Quan trọng - Cần lưu ý</option>
                    <option value="PHUC_TAP">Phức tạp - Báo cáo thường trực</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Trạng thái theo dõi:</label>
                  <select
                    value={vanDeTrangThai}
                    onChange={(e) => setVanDeTrangThai(e.target.value as 'DANG_THEO_DOI' | 'DA_XU_LY')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="DANG_THEO_DOI">● Đang theo dõi</option>
                    <option value="DA_XU_LY">✓ Đã xử lý / Kết luận</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Phân loại vào 6 nhóm hồ sơ nghiệp vụ địa bàn:
                </label>
                <select
                  value={vanDeNhomHoSo}
                  onChange={(e) => setVanDeNhomHoSo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  {NHOM_HO_SO.map((n) => (
                    <option key={n.id} value={n.ten}>
                      {n.ten}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tệp đính kèm bổ sung */}
              <div className="pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-amber-800" />
                  <span>Tài liệu / Tệp văn bản đính kèm:</span>
                </label>
                <input
                  type="file"
                  ref={vanDeFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setVanDeFileTen(f.name);
                      const ext = f.name.split('.').pop()?.toLowerCase();
                      if (ext) setVanDeFileLoai(ext);
                    }
                  }}
                  className="hidden"
                />
                {vanDeFileTen ? (
                  <div className="flex items-center justify-between p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{vanDeFileTen}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVanDeFileTen('');
                        setVanDeFileUrl(null);
                        if (vanDeFileInputRef.current) vanDeFileInputRef.current.value = '';
                      }}
                      className="text-red-600 hover:text-red-800 text-xs font-bold ml-2 cursor-pointer"
                    >
                      Xóa tệp
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => vanDeFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-amber-800 rounded-lg text-slate-600 hover:text-amber-800 text-xs font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer bg-slate-50 hover:bg-amber-50/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn tệp đính kèm (PDF, DOCX, DOC)</span>
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddVanDeOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveVanDe}
                  className="px-4 py-1.5 bg-amber-800 text-white rounded-lg font-bold hover:bg-amber-900 transition cursor-pointer"
                >
                  {editingVanDe ? 'Cập nhật vấn đề' : 'Lưu vấn đề'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 6. MODAL THÊM / SỬA CHỈ ĐẠO CỦA CẤP TRÊN (ĐÍNH KÈM TỆP & 6 NHÓM HỒ SƠ)    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isAddChiDaoOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-red-800 px-5 py-4 text-white flex items-center justify-between border-b-2 border-red-600">
              <h3 className="text-sm font-bold uppercase">
                {editingChiDao ? 'Chỉnh sửa chỉ đạo / nhiệm vụ' : 'Thêm chỉ đạo / nhiệm vụ giao cơ sở'} - {selectedRecord.ten_dia_ban}
              </h3>
              <button onClick={() => setIsAddChiDaoOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung chỉ đạo *:</label>
                <textarea
                  rows={3}
                  value={chiDaoNoiDung}
                  onChange={(e) => setChiDaoNoiDung(e.target.value)}
                  placeholder="Nội dung chỉ đạo của Đảng ủy, UBKT Đảng ủy..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Văn bản chỉ đạo (nếu có):</label>
                  <input
                    type="text"
                    value={chiDaoVanBan}
                    onChange={(e) => setChiDaoVanBan(e.target.value)}
                    placeholder="Ví dụ: Kết luận số 14-KL/ĐU, Thông báo số 05-TB/UBKT"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Hạn hoàn thành:</label>
                  <input
                    type="text"
                    value={chiDaoHan}
                    onChange={(e) => setChiDaoHan(e.target.value)}
                    placeholder="Ví dụ: 25/10/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Trạng thái hoàn thành:</label>
                  <select
                    value={chiDaoTrangThai}
                    onChange={(e) => setChiDaoTrangThai(e.target.value as 'CHUA_HOAN_THANH' | 'DA_HOAN_THANH')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="CHUA_HOAN_THANH">⚠ Chưa hoàn thành</option>
                    <option value="DA_HOAN_THANH">✓ Đã hoàn thành</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Phân loại 6 nhóm hồ sơ:
                  </label>
                  <select
                    value={chiDaoNhomHoSo}
                    onChange={(e) => setChiDaoNhomHoSo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    {NHOM_HO_SO.map((n) => (
                      <option key={n.id} value={n.ten}>
                        {n.ten}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tệp đính kèm bổ sung */}
              <div className="pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-red-800" />
                  <span>Văn bản / Tệp chỉ đạo đính kèm:</span>
                </label>
                <input
                  type="file"
                  ref={chiDaoFileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setChiDaoFileTen(f.name);
                      const ext = f.name.split('.').pop()?.toLowerCase();
                      if (ext) setChiDaoFileLoai(ext);
                    }
                  }}
                  className="hidden"
                />
                {chiDaoFileTen ? (
                  <div className="flex items-center justify-between p-2.5 bg-red-50/70 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{chiDaoFileTen}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChiDaoFileTen('');
                        setChiDaoFileUrl(null);
                        if (chiDaoFileInputRef.current) chiDaoFileInputRef.current.value = '';
                      }}
                      className="text-red-600 hover:text-red-800 text-xs font-bold ml-2 cursor-pointer"
                    >
                      Xóa tệp
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => chiDaoFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-red-800 rounded-lg text-slate-600 hover:text-red-800 text-xs font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer bg-slate-50 hover:bg-red-50/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn tệp văn bản chỉ đạo (PDF, DOCX, DOC)</span>
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddChiDaoOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveChiDao}
                  className="px-4 py-1.5 bg-red-800 text-white rounded-lg font-bold hover:bg-red-900 transition cursor-pointer"
                >
                  {editingChiDao ? 'Cập nhật chỉ đạo' : 'Lưu chỉ đạo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 6.1 MODAL THÊM / SỬA ĐIỀU CHỈNH, BỔ SUNG CHƯƠNG TRÌNH & ĐỐI CHIẾU       */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isThayDoiModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#133863] px-5 py-4 text-white flex items-center justify-between border-b-2 border-amber-500">
              <h3 className="text-sm font-bold uppercase">
                {editingThayDoi ? 'Chỉnh sửa quyết định điều chỉnh, bổ sung' : 'Thêm quyết định điều chỉnh, bổ sung'} - {selectedRecord.ten_dia_ban}
              </h3>
              <button onClick={() => setIsThayDoiModalOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Áp dụng chương trình KT-GS toàn khóa:</label>
                <select
                  value={thayDoiChuongTrinhId}
                  onChange={(e) => setThayDoiChuongTrinhId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {activeNhiemKyPrograms.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.noi_dung || ct.ten_chuong_trinh || 'Chương trình toàn khóa'} ({ct.nhiem_ky || '2025 - 2030'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lần điều chỉnh:</label>
                  <input
                    type="number"
                    min={1}
                    value={thayDoiLan}
                    onChange={(e) => setThayDoiLan(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số quyết định:</label>
                  <input
                    type="text"
                    value={thayDoiSoVanBan}
                    onChange={(e) => setThayDoiSoVanBan(e.target.value)}
                    placeholder="Ví dụ: 12-QĐ/ĐU"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày ban hành:</label>
                  <input
                    type="text"
                    value={thayDoiNgayBanHanh}
                    onChange={(e) => setThayDoiNgayBanHanh(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Người ký ban hành:</label>
                <input
                  type="text"
                  value={thayDoiNguoiKy}
                  onChange={(e) => setThayDoiNguoiKy(e.target.value)}
                  placeholder="Ví dụ: Bí thư Đảng ủy, Chủ nhiệm UBKT..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung kế hoạch ban đầu (Gốc):</label>
                <textarea
                  rows={2}
                  value={thayDoiNoiDungGoc}
                  onChange={(e) => setThayDoiNoiDungGoc(e.target.value)}
                  placeholder="Nội dung theo kế hoạch ban đầu trước khi điều chỉnh..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nội dung điều chỉnh, bổ sung mới *:</label>
                <textarea
                  rows={3}
                  value={thayDoiNoiDungMoi}
                  onChange={(e) => setThayDoiNoiDungMoi(e.target.value)}
                  placeholder="Chi tiết nội dung điều chỉnh thời gian, đối tượng, nội dung KT-GS..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#133863]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lý do điều chỉnh:</label>
                  <input
                    type="text"
                    value={thayDoiGhiChu}
                    onChange={(e) => setThayDoiGhiChu(e.target.value)}
                    placeholder="Do sáp nhập, thay đổi nhân sự..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phân loại 6 nhóm hồ sơ:</label>
                  <select
                    value={thayDoiNhomHoSo}
                    onChange={(e) => setThayDoiNhomHoSo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    {NHOM_HO_SO.map((n) => (
                      <option key={n.id} value={n.ten}>
                        {n.ten}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tệp PDF đính kèm */}
              <div className="pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block mb-1 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-[#133863]" />
                  <span>Tệp PDF quyết định điều chỉnh đính kèm:</span>
                </label>
                <input
                  type="file"
                  ref={thayDoiFileInputRef}
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setThayDoiFileTen(f.name);
                  }}
                  className="hidden"
                />
                {thayDoiFileTen ? (
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{thayDoiFileTen}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setThayDoiFileTen('');
                        setThayDoiFileUrl(null);
                        if (thayDoiFileInputRef.current) thayDoiFileInputRef.current.value = '';
                      }}
                      className="text-red-600 hover:text-red-800 text-xs font-bold ml-2 cursor-pointer"
                    >
                      Xóa tệp
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => thayDoiFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-[#133863] rounded-lg text-slate-600 hover:text-[#133863] text-xs font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer bg-slate-50 hover:bg-blue-50/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn tệp văn bản quyết định (PDF, Word)</span>
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsThayDoiModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveThayDoi}
                  className="px-4 py-1.5 bg-[#133863] text-white rounded-lg font-bold hover:bg-blue-900 transition cursor-pointer"
                >
                  {editingThayDoi ? 'Cập nhật điều chỉnh' : 'Lưu điều chỉnh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 7. MODAL NỘP / TIẾP NHẬN BÁO CÁO THÁNG (TÍCH HỢP 1 LẦN NHIỀU ĐỊA BÀN)    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isNopBaoCaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="bg-[#133863] px-6 py-4 text-white flex items-center justify-between border-b-2 border-amber-500 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <Calendar className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="text-base font-bold uppercase tracking-tight">
                    Tiếp nhận / Lập báo cáo tháng (Tích hợp nhiều địa bàn)
                  </h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Báo cáo tháng có thể áp dụng đồng thời cho nhiều địa bàn và tự động đồng bộ vào tập tài liệu của từng địa bàn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNopBaoCaoOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-md"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body modal cuộn được */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Mục 1: Chọn các địa bàn áp dụng báo cáo */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-[#133863]" />
                    <span>1. Địa bàn áp dụng báo cáo này (Đã chọn: {baoCaoSelectedDiaBanIds.length}/{records.length}):</span>
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const myIds = records.filter((r) => isUserAssignedToRecord(r)).map((r) => r.id);
                        setBaoCaoSelectedDiaBanIds(myIds);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-[#133863] border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                    >
                      ★ Địa bàn của tôi
                    </button>
                    {user.vai_tro === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => setBaoCaoSelectedDiaBanIds(records.map((r) => r.id))}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Chọn tất cả
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setBaoCaoSelectedDiaBanIds([])}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Danh sách địa bàn dạng ô tích chọn */}
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {records.map((r) => {
                    const isSelected = baoCaoSelectedDiaBanIds.includes(r.id);
                    const canReport = isUserAssignedToRecord(r);

                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          if (!canReport) return;
                          if (isSelected) {
                            setBaoCaoSelectedDiaBanIds(baoCaoSelectedDiaBanIds.filter((id) => id !== r.id));
                          } else {
                            setBaoCaoSelectedDiaBanIds([...baoCaoSelectedDiaBanIds, r.id]);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between transition ${
                          !canReport
                            ? 'bg-slate-100/60 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-50 border-blue-300 text-slate-900 font-bold shadow-2xs cursor-pointer'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70 cursor-pointer'
                        }`}
                        title={!canReport ? `Địa bàn do ${r.can_bo_phu_trach_ten || 'cán bộ khác'} phụ trách (Chỉ cán bộ được phân công hoặc Admin mới có quyền nộp)` : undefined}
                      >
                        <div className="flex items-center space-x-2 min-w-0 pr-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canReport}
                            onChange={() => {}} // Đã xử lý ở onClick cấp div
                            className="w-3.5 h-3.5 text-[#133863] rounded border-slate-300 pointer-events-none"
                          />
                          <span className="truncate">{r.ten_dia_ban}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal truncate max-w-[100px]">
                          {canReport ? r.can_bo_phu_trach_ten : `(Không phụ trách)`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mục 2: Thông tin báo cáo */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tiêu đề báo cáo tháng:</label>
                  <input
                    type="text"
                    value={baoCaoTieuDe}
                    onChange={(e) => setBaoCaoTieuDe(e.target.value)}
                    placeholder="Ví dụ: Báo cáo công tác nắm tình hình các chi bộ phụ trách tháng 10/2026..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Kỳ báo cáo:</label>
                    <select
                      value={baoCaoThangNum}
                      onChange={(e) => setBaoCaoThangNum(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Năm:</label>
                    <input
                      type="number"
                      value={baoCaoNam}
                      onChange={(e) => setBaoCaoNam(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tình trạng nộp:</label>
                    <select
                      value={baoCaoTinhTrang}
                      onChange={(e) => setBaoCaoTinhTrang(e.target.value as BaoCaoThangStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800"
                    >
                      <option value="DA_NOP_DUNG_HAN">Đã nộp đúng hạn</option>
                      <option value="DA_NOP_MUON">Đã nộp (Muộn)</option>
                      <option value="CHO_DUYET">Chờ UBKT duyệt</option>
                      <option value="CHUA_NOP">Chưa nộp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cán bộ nộp báo cáo:</label>
                  <select
                    value={baoCaoCanBoId || user.id}
                    onChange={(e) => {
                      const sel = usersList.find((u) => u.id === e.target.value);
                      setBaoCaoCanBoId(e.target.value);
                      if (sel) setBaoCaoCanBoTen(sel.ho_ten);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ho_ten} ({u.vai_tro === 'ADMIN' ? 'Chủ nhiệm/Phó CN' : 'Cán bộ UBKT'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tệp báo cáo đính kèm */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">Tệp báo cáo đính kèm (.docx, .pdf):</label>
                    <input
                      type="file"
                      ref={baoCaoFileInputRef}
                      accept=".docx,.doc,.pdf"
                      onChange={handleBaoCaoFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => baoCaoFileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center space-x-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#133863]" />
                      <span>Chọn tệp từ máy...</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={baoCaoFileTen}
                    onChange={(e) => setBaoCaoFileTen(e.target.value)}
                    placeholder="Tên tệp báo cáo (Ví dụ: Bao_cao_thang_10_2026.docx)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tóm tắt tình hình các địa bàn:</label>
                  <textarea
                    rows={2}
                    value={baoCaoNoiDung}
                    onChange={(e) => setBaoCaoNoiDung(e.target.value)}
                    placeholder="Tóm tắt tình hình chính trị, tư tưởng, các cuộc KT-GS và vụ việc nổi cộm..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ghi chú tiếp nhận:</label>
                  <input
                    type="text"
                    value={baoCaoGhiChu}
                    onChange={(e) => setBaoCaoGhiChu(e.target.value)}
                    placeholder="Ghi chú về tiến độ nộp hoặc đánh giá chất lượng..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Thông báo phân bổ tự động */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-blue-900 leading-relaxed">
                <BookmarkCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Cơ chế phân bổ tự động vào tập tài liệu địa bàn:</p>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Sau khi lưu, tệp báo cáo này sẽ được tự động phân bổ vào mục <strong>"3. Báo cáo định kỳ (tháng, quý, năm)"</strong> trong tập tài liệu của <strong>tất cả {baoCaoSelectedDiaBanIds.length} địa bàn</strong> đã được tích chọn ở trên.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsNopBaoCaoOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveNopBaoCao}
                className="px-5 py-2 bg-[#133863] text-white rounded-lg text-xs font-bold hover:bg-blue-900 transition cursor-pointer shadow-xs"
              >
                Xác nhận lưu & Phân bổ vào hồ sơ địa bàn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 8. MODAL TẢI LÊN TÀI LIỆU HỒ SƠ ĐỊA BÀN                                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isUploadDocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#133863] px-5 py-4 text-white flex items-center justify-between border-b-2 border-amber-500">
              <h3 className="text-sm font-bold uppercase">Tải lên tài liệu & văn bản hồ sơ địa bàn</h3>
              <button
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Thể loại văn bản */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Thể loại văn bản *:</label>
                  <select
                    value={docTheLoai}
                    onChange={(e) => setDocTheLoai(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="Báo cáo">Báo cáo</option>
                    <option value="Quyết định">Quyết định</option>
                    <option value="Kế hoạch">Kế hoạch</option>
                    <option value="Kết luận">Kết luận</option>
                    <option value="Quy chế">Quy chế</option>
                    <option value="Nghị quyết">Nghị quyết</option>
                    <option value="Thông báo">Thông báo</option>
                    <option value="Công văn">Công văn</option>
                    <option value="Tờ trình">Tờ trình</option>
                    <option value="Khác">Văn bản khác</option>
                  </select>
                </div>

                {/* 2. Số ký hiệu văn bản */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số / Ký hiệu văn bản:</label>
                  <input
                    type="text"
                    value={docSoVanBan}
                    onChange={(e) => setDocSoVanBan(e.target.value)}
                    placeholder="Ví dụ: 15-QĐ/UBKT, 02-BC/CB..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* 3. Trích yếu nội dung văn bản */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Trích yếu nội dung văn bản *:</label>
                <textarea
                  rows={2}
                  value={docTrichYeu}
                  onChange={(e) => setDocTrichYeu(e.target.value)}
                  placeholder="Trích yếu tóm tắt nội dung chính của văn bản..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 4. Người ký */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Người ký (Họ tên, chức danh):</label>
                  <input
                    type="text"
                    value={docNguoiKy}
                    onChange={(e) => setDocNguoiKy(e.target.value)}
                    placeholder="Ví dụ: Bí thư Đảng ủy, Chủ nhiệm UBKT..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* 5. Ngày ban hành */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày ban hành (DD/MM/YYYY) *:</label>
                  <input
                    type="text"
                    value={docNgayBanHanh}
                    onChange={(e) => setDocNgayBanHanh(e.target.value)}
                    placeholder="Ví dụ: 20/10/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* 6. Thuộc nhóm hồ sơ nghiệp vụ */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Thuộc nhóm hồ sơ nghiệp vụ:</label>
                <select
                  value={docNhom}
                  onChange={(e) => setDocNhom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {NHOM_HO_SO.map((n) => (
                    <option key={n.id} value={n.ten}>
                      {n.ten}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. File đính kèm */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">Tệp đính kèm (.docx, .doc, .pdf):</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".docx,.doc,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center space-x-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#133863]" />
                    <span>Duyệt tệp từ máy...</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={docTenFile}
                  onChange={(e) => setDocTenFile(e.target.value)}
                  placeholder="Tên tệp hiển thị (Ví dụ: Quy_che_lam_viec_2026.docx)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUploadDocOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleUploadDoc}
                  className="px-4 py-1.5 bg-[#133863] text-white rounded-lg font-bold hover:bg-blue-900 transition cursor-pointer shadow-xs"
                >
                  Lưu vào hồ sơ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 6. MODAL BỔ SUNG / CẬP NHẬT CĂN CỨ VĂN BẢN CHO PHẦN LỊCH SỬ PHỤ TRÁCH   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isBoSungCanCuOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#133863] text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-500">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    BỔ SUNG CĂN CỨ VĂN BẢN PHÂN CÔNG PHỤ TRÁCH
                  </h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    Địa bàn: <strong>{selectedRecord.ten_dia_ban}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBoSungCanCuOpen(false);
                  setTargetHistoryEntry(null);
                }}
                className="text-white/70 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              {canCuError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{canCuError}</span>
                </div>
              )}

              {/* Thông tin cán bộ áp dụng */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Thời kỳ áp dụng:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {targetHistoryEntry
                    ? `${targetHistoryEntry.can_bo_ten} (${targetHistoryEntry.tu_ngay} đến ${targetHistoryEntry.den_ngay || 'nay'})`
                    : `${selectedRecord.can_bo_phu_trach_ten} (Đang phụ trách hiện tại)`}
                </p>
              </div>

              {/* Số hiệu văn bản & Ngày ban hành */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số ký hiệu QĐ / Văn bản <span className="text-red-600">*</span>:
                  </label>
                  <input
                    type="text"
                    value={canCuSoVanBan}
                    onChange={(e) => setCanCuSoVanBan(e.target.value)}
                    placeholder="Ví dụ: 15-QĐ/UBKT hoặc 08-QĐ/ĐU"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày ban hành (DD/MM/YYYY):</label>
                  <input
                    type="text"
                    value={canCuNgayBanHanh}
                    onChange={(e) => setCanCuNgayBanHanh(e.target.value)}
                    placeholder="Ví dụ: 15/01/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
                  />
                </div>
              </div>

              {/* Cơ quan ban hành */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Cơ quan / Thẩm quyền ban hành:</label>
                <input
                  type="text"
                  value={canCuCoQuan}
                  onChange={(e) => setCanCuCoQuan(e.target.value)}
                  placeholder="Ví dụ: Ủy ban Kiểm tra Đảng ủy, Ban Thường vụ Đảng ủy..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
                />
              </div>

              {/* Trích yếu nội dung căn cứ */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Trích yếu căn cứ văn bản <span className="text-red-600">*</span>:
                </label>
                <textarea
                  rows={2}
                  value={canCuTrichYeu}
                  onChange={(e) => setCanCuTrichYeu(e.target.value)}
                  placeholder="Ví dụ: Căn cứ Quyết định về việc phân công cán bộ Ủy ban Kiểm tra phụ trách, theo dõi các tổ chức Đảng trực thuộc Đảng bộ nhiệm kỳ 2025-2030..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
                />
              </div>

              {/* Lý do / Ghi chú */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do thay đổi / Ghi chú chuyển giao:</label>
                <input
                  type="text"
                  value={canCuLyDo}
                  onChange={(e) => setCanCuLyDo(e.target.value)}
                  placeholder="Ví dụ: Phân công nhiệm vụ định kỳ; kiện toàn cán bộ phụ trách chi bộ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
                />
              </div>

              {/* Đính kèm tệp văn bản căn cứ */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Tệp văn bản đính kèm (Word/PDF):</label>
                  <input
                    type="file"
                    ref={canCuFileInputRef}
                    accept=".docx,.doc,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCanCuTenFile(f.name);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => canCuFileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center space-x-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#133863]" />
                    <span>Duyệt tệp từ máy...</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={canCuTenFile}
                  onChange={(e) => setCanCuTenFile(e.target.value)}
                  placeholder="Tên tệp quyết định (Ví dụ: QD_15_UBKT_Phan_cong_phu_trach.pdf)"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * Tệp này sẽ tự động lưu vào Kho tài liệu địa bàn và đồng bộ sang Kho dữ liệu dùng chung.
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBoSungCanCuOpen(false);
                    setTargetHistoryEntry(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveBoSungCanCu}
                  className="px-4 py-1.5 bg-[#133863] text-white rounded-lg font-bold hover:bg-blue-900 transition cursor-pointer shadow-xs"
                >
                  Lưu căn cứ văn bản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL XÁC NHẬN XÓA HỒ SƠ ĐỊA BÀN                                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {deleteTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-rose-700 px-5 py-4 text-white flex items-center justify-between border-b-2 border-rose-900">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
                <h3 className="text-base font-bold uppercase tracking-tight">XÓA HỒ SƠ ĐỊA BÀN</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetRecord(null)}
                className="text-white/80 hover:text-white p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung */}
            <div className="p-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 space-y-1">
                <p className="font-bold text-sm text-rose-900 flex items-center space-x-1.5">
                  <span>Cảnh báo: Hành động này không thể hoàn tác!</span>
                </p>
                <p>
                  Bạn có chắc chắn muốn xóa toàn bộ hồ sơ theo dõi của địa bàn này khỏi hệ thống?
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <span className="text-slate-500 font-medium">Địa bàn / Tổ chức:</span>
                  <span className="font-bold text-slate-900 text-right">{deleteTargetRecord.ten_dia_ban}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Loại hình tổ chức:</span>
                  <span className="font-semibold text-slate-700">
                    {deleteTargetRecord.loai_to_chuc === 'DANG_BO' ? 'Đảng bộ cơ sở' : 'Chi bộ cơ sở'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Cán bộ phụ trách:</span>
                  <span className="font-semibold text-slate-700">
                    {deleteTargetRecord.can_bo_phu_trach_ten || 'Chưa phân công'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Tài liệu hồ sơ đính kèm:</span>
                  <span className="font-semibold text-slate-700">
                    {files.filter((f) => f.don_vi_id === deleteTargetRecord.id).length} tài liệu
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Vấn đề đang theo dõi:</span>
                  <span className="font-semibold text-slate-700">
                    {deleteTargetRecord.so_van_de_theo_doi || 0} vấn đề
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Chỉ đạo chưa hoàn thành:</span>
                  <span className="font-semibold text-slate-700">
                    {deleteTargetRecord.so_chi_dao_chua_hoan_thanh || 0} chỉ đạo
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Thao tác này sẽ gỡ bỏ địa bàn khỏi danh mục theo dõi của UBKT, đồng thời dọn sạch các vấn đề, chỉ đạo và tài liệu gắn với hồ sơ địa bàn này.
              </p>

              {/* Nút thao tác */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isDeletingRecord}
                  onClick={() => setDeleteTargetRecord(null)}
                  className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeletingRecord}
                  onClick={() => handleConfirmDeleteRecord(deleteTargetRecord)}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingRecord ? 'Đang xóa...' : 'Xác nhận xóa hồ sơ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL XÁC NHẬN XÓA HÀNG LOẠT HỒ SƠ ĐỊA BÀN                                */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {batchDeleteRecords.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-700 to-red-800 px-5 py-4 text-white flex items-center justify-between border-b-2 border-rose-900 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-inner">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold uppercase tracking-tight">XÓA HÀNG LOẠT HỒ SƠ ĐỊA BÀN</h3>
                  <p className="text-xs text-rose-100/80">Xác nhận gỡ bỏ {batchDeleteRecords.length} hồ sơ địa bàn</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setBatchDeleteRecords([])}
                className="text-white/80 hover:text-white p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 space-y-1">
                <p className="font-bold text-sm text-rose-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cảnh báo: Thao tác này không thể hoàn tác!</span>
                </p>
                <p>
                  Bạn có chắc chắn muốn xóa toàn bộ <strong>{batchDeleteRecords.length} hồ sơ địa bàn</strong> đã chọn khỏi danh mục theo dõi của UBKT?
                </p>
              </div>

              {/* Danh sách địa bàn sẽ xóa */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Danh sách hồ sơ địa bàn sẽ xóa ({batchDeleteRecords.length}):</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                  {batchDeleteRecords.map((r, i) => {
                    const fileCount = files.filter((f) => f.don_vi_id === r.id).length;
                    return (
                      <div
                        key={r.id}
                        className="p-3 text-xs flex items-center justify-between bg-white hover:bg-slate-50"
                      >
                        <div className="flex items-start space-x-2.5 truncate flex-1 pr-2">
                          <span className="text-slate-400 font-mono text-[11px] w-5 text-right mt-0.5">
                            {i + 1}.
                          </span>
                          <Building2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <span className="font-bold text-slate-900 block truncate" title={r.ten_dia_ban}>
                              {r.ten_dia_ban}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Phụ trách: <strong>{r.can_bo_phu_trach_ten || 'Chưa phân công'}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {fileCount} tệp
                          </span>
                          {r.so_van_de_theo_doi > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {r.so_van_de_theo_doi} vấn đề
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                * Thao tác xóa sẽ dọn sạch tài liệu đính kèm, vấn đề theo dõi và chỉ đạo gắn với các hồ sơ địa bàn này trên hệ thống.
              </p>
            </div>

            {/* Nút thao tác */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setBatchDeleteRecords([])}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => handleConfirmBatchDeleteRecords(batchDeleteRecords)}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {isBatchDeleting ? 'Đang xóa...' : `Xác nhận xóa ${batchDeleteRecords.length} hồ sơ`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
