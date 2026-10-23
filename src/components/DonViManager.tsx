import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type {
  DonVi,
  DonViTreeItem,
  User,
  PhanCongDiaBan,
  DiaBanRecord,
  LichSuPhuTrachDiaBan,
  LoaiHinhToChuc,
  TrangThaiDonVi,
} from '../types';
import {
  DEFAULT_LOAI_HINH_LIST,
  exportUnitsToCsv,
} from '../services/donViService';
import {
  Building2,
  FolderTree,
  Plus,
  Search,
  ShieldAlert,
  CheckCircle2,
  X,
  Users,
  Briefcase,
  AlertCircle,
  UserPlus,
  RotateCw,
  History,
  ShieldCheck,
  Check,
  FileText,
  Download,
  Upload,
  Power,
} from 'lucide-react';

import { OrgStatsCards } from './donvi/OrgStatsCards';
import { OrgTreePanel } from './donvi/OrgTreePanel';
import { OrgTablePanel } from './donvi/OrgTablePanel';
import { OrgDetailDrawer } from './donvi/OrgDetailDrawer';
import { OrgFormModal } from './donvi/OrgFormModal';
import { OrgChangeParentModal } from './donvi/OrgChangeParentModal';
import { OrgImportExcelModal } from './donvi/OrgImportExcelModal';
import { OrgAuditHistoryModal } from './donvi/OrgAuditHistoryModal';
import { OrgDeleteModal } from './donvi/OrgDeleteModal';

interface DonViManagerProps {
  user: User;
  onDataChanged?: () => void;
}

// Storage keys
const STORAGE_PHAN_CONG = 'ubkt_phan_cong_dia_ban';
const STORAGE_DIA_BAN_RECORDS = 'ubkt_ho_so_dia_ban_records';
const STORAGE_LOAI_HINH = 'ubkt_loai_hinh_to_chuc';

// Đảm bảo nguyên tắc nghiêm ngặt: Mỗi tổ chức Đảng / Chi bộ chỉ giao duy nhất 1 cán bộ phụ trách
export const sanitizeStrictAssignments = (rawList: PhanCongDiaBan[]): PhanCongDiaBan[] => {
  if (!Array.isArray(rawList)) return [];

  // Ưu tiên danh sách giao số lượng cụ thể trước, rồi đến danh sách nhận hàng loạt
  const sorted = [...rawList].sort((a, b) => {
    const lenA = a.don_vi_ids?.length || 0;
    const lenB = b.don_vi_ids?.length || 0;
    return lenA - lenB;
  });

  const unitAssignedTo = new Map<string, string>(); // unitId -> userId
  sorted.forEach((item) => {
    (item.don_vi_ids || []).forEach((uId) => {
      if (!unitAssignedTo.has(uId)) {
        unitAssignedTo.set(uId, item.user_id);
      }
    });
  });

  return rawList.map((item) => {
    const validUnits = (item.don_vi_ids || []).filter(
      (uId) => unitAssignedTo.get(uId) === item.user_id,
    );
    return {
      ...item,
      don_vi_ids: validUnits,
    };
  });
};

export const DonViManager: React.FC<DonViManagerProps> = ({ user, onDataChanged }) => {
  // Tabs: 'to_chuc' | 'phan_cong'
  const [activeTab, setActiveTab] = useState<'to_chuc' | 'phan_cong'>('to_chuc');

  // Dữ liệu đơn vị
  const [treeData, setTreeData] = useState<DonViTreeItem[]>([]);
  const [allDonVi, setAllDonVi] = useState<DonVi[]>([]);
  const [loading, setLoading] = useState(false);

  // Danh mục Loại hình tổ chức
  const [loaiHinhList] = useState<LoaiHinhToChuc[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOAI_HINH);
      if (saved) return JSON.parse(saved);
      return DEFAULT_LOAI_HINH_LIST;
    } catch {
      return DEFAULT_LOAI_HINH_LIST;
    }
  });

  // State quản lý chọn đơn vị & Drawer chi tiết
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [detailUnit, setDetailUnit] = useState<DonVi | null>(null);

  // State các Modal phân hệ Cơ cấu tổ chức
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formEditingUnit, setFormEditingUnit] = useState<DonVi | null>(null);
  const [formDefaultParentId, setFormDefaultParentId] = useState<string | null>(null);

  const [isChangeParentModalOpen, setIsChangeParentModalOpen] = useState(false);
  const [changeParentUnit, setChangeParentUnit] = useState<DonVi | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);
  const [auditTargetUnit, setAuditTargetUnit] = useState<DonVi | null>(null);

  // Modal xác nhận xóa tổ chức
  const [deleteTargetUnit, setDeleteTargetUnit] = useState<DonVi | null>(null);

  // Modal cập nhật trạng thái hoạt động (Đang hoạt động / Tạm ngừng / Đã chấm dứt)
  const [toggleStatusTarget, setToggleStatusTarget] = useState<DonVi | null>(null);
  const [toggleTargetStatus, setToggleTargetStatus] = useState<TrangThaiDonVi>('TAM_NGUNG');
  const [toggleStatusReason, setToggleStatusReason] = useState('');
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Filter Key khi click các thẻ Thống kê Area B
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  // ──────────────────────────────────────────────────────────────────────────
  // Dữ liệu Phân công quản lý (Tab 2)
  // ──────────────────────────────────────────────────────────────────────────
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string>('');
  const [assignSearchUnit, setAssignSearchUnit] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const [assignments, setAssignments] = useState<PhanCongDiaBan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PHAN_CONG);
      if (saved) {
        return sanitizeStrictAssignments(JSON.parse(saved));
      }
      return [];
    } catch {
      return [];
    }
  });

  const [diaBanRecords, setDiaBanRecords] = useState<DiaBanRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });

  const [historyTargetUnit, setHistoryTargetUnit] = useState<{
    id: string;
    ten: string;
    record?: DiaBanRecord;
  } | null>(null);

  const [editingCanCuEntry, setEditingCanCuEntry] = useState<LichSuPhuTrachDiaBan | null>(null);
  const [canCuSoQd, setCanCuSoQd] = useState('');
  const [canCuNgayQd, setCanCuNgayQd] = useState('');
  const [canCuCoQuan, setCanCuCoQuan] = useState('Ủy ban Kiểm tra Đảng ủy');
  const [canCuTrichYeu, setCanCuTrichYeu] = useState('');
  const [canCuLyDo, setCanCuLyDo] = useState('');
  const [canCuFileTen, setCanCuFileTen] = useState('');
  const [canCuError, setCanCuError] = useState<string | null>(null);

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newTenDangNhap, setNewTenDangNhap] = useState('');
  const [newHoTen, setNewHoTen] = useState('');
  const [newMatKhau, setNewMatKhau] = useState('12345678');
  const [newVaiTro, setNewVaiTro] = useState<'ADMIN' | 'BIEN_TAP' | 'XEM'>('BIEN_TAP');
  const [userError, setUserError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Quyền thao tác
  const canEdit = user.vai_tro === 'ADMIN' || user.vai_tro === 'BIEN_TAP';

  // ──────────────────────────────────────────────────────────────────────────
  // Nạp dữ liệu
  // ──────────────────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [tree, flat, users] = await Promise.all([
        api.getDonViTree(),
        api.getAllDonVi(),
        api.getAllUsers().catch(() => []),
      ]);
      setTreeData(tree);
      setAllDonVi(flat);
      setUsersList(users);

      // Nếu chưa chọn đơn vị nào, chọn đơn vị đầu tiên
      if (!selectedUnitId && flat.length > 0) {
        setSelectedUnitId(flat[0].id);
      }

      // Nếu đang mở detailUnit, cập nhật lại thông tin mới nhất
      if (detailUnit) {
        const refreshed = flat.find((u) => u.id === detailUnit.id);
        if (refreshed) setDetailUnit(refreshed);
      }

      // Tab phân công: nếu chưa chọn user nào, chọn user đầu tiên
      if (users.length > 0 && !selectedAssignUserId) {
        setSelectedAssignUserId(users[0].id);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách đơn vị:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tải lại danh sách cán bộ khi chuyển tab phân công
  const reloadUsers = async (selectNewId?: string) => {
    try {
      const users = await api.getAllUsers();
      setUsersList(users);
      if (selectNewId) {
        setSelectedAssignUserId(selectNewId);
      } else if (users.length > 0 && !selectedAssignUserId) {
        setSelectedAssignUserId(users[0].id);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách tài khoản:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'phan_cong') {
      reloadUsers();
    }
  }, [activeTab]);

  // Lắng nghe sự kiện tài khoản được tạo/cập nhật
  useEffect(() => {
    const handleUsersUpdated = (e?: Event) => {
      const customEvent = e as CustomEvent<User>;
      const newId = customEvent?.detail?.id;
      reloadUsers(newId);
    };
    window.addEventListener('ubkt_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('ubkt_users_updated', handleUsersUpdated);
  }, []);

  // Lắng nghe sự kiện phân công & hồ sơ địa bàn
  useEffect(() => {
    const handleAssignmentsUpdated = (e?: Event) => {
      const customEvent = e as CustomEvent<PhanCongDiaBan[]>;
      if (customEvent?.detail && Array.isArray(customEvent.detail)) {
        setAssignments(sanitizeStrictAssignments(customEvent.detail));
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_PHAN_CONG);
          if (saved) setAssignments(sanitizeStrictAssignments(JSON.parse(saved)));
        } catch {}
      }
    };

    const handleDiaBanRecordsUpdated = (e?: Event) => {
      const customEvent = e as CustomEvent<DiaBanRecord[]>;
      if (customEvent?.detail && Array.isArray(customEvent.detail)) {
        setDiaBanRecords(customEvent.detail);
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
          if (saved) setDiaBanRecords(JSON.parse(saved));
        } catch {}
      }
    };

    window.addEventListener('ubkt_assignments_updated', handleAssignmentsUpdated);
    window.addEventListener('ubkt_diaban_records_updated', handleDiaBanRecordsUpdated);
    return () => {
      window.removeEventListener('ubkt_assignments_updated', handleAssignmentsUpdated);
      window.removeEventListener('ubkt_diaban_records_updated', handleDiaBanRecordsUpdated);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Xử lý các thao tác Cơ cấu tổ chức
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Thêm mới tổ chức
  const handleOpenAdd = (parentId: string | null = null) => {
    setFormEditingUnit(null);
    setFormDefaultParentId(parentId || selectedUnitId);
    setIsFormModalOpen(true);
  };

  // 2. Chỉnh sửa tổ chức
  const handleOpenEdit = (target: DonVi) => {
    setFormEditingUnit(target);
    setFormDefaultParentId(target.don_vi_cha_id);
    setIsFormModalOpen(true);
  };

  // 3. Đổi cấp trên trực tiếp
  const handleOpenChangeParent = (target: DonVi) => {
    setChangeParentUnit(target);
    setIsChangeParentModalOpen(true);
  };

  // 4. Mở lịch sử thay đổi
  const handleOpenHistory = (target?: DonVi | null) => {
    setAuditTargetUnit(target || null);
    setIsAuditHistoryOpen(true);
  };

  // 5. Lưu form thêm / sửa tổ chức
  const handleSaveForm = async (data: {
    ten: string;
    don_vi_cha_id: string | null;
    trang_thai: TrangThaiDonVi;
    ghi_chu?: string | null;
  }) => {
    if (formEditingUnit) {
      await api.updateDonVi(
        {
          id: formEditingUnit.id,
          ten: data.ten,
          loai: formEditingUnit.loai || 'CHI_BO',
          don_vi_cha_id: data.don_vi_cha_id,
          trang_thai: data.trang_thai,
          ghi_chu: data.ghi_chu,
          nguoi_cap_nhat_ten: user.ho_ten,
          nguoi_cap_nhat_id: user.id,
        },
        user.id,
      );
    } else {
      await api.createDonVi(
        {
          ten: data.ten,
          loai: 'CHI_BO',
          don_vi_cha_id: data.don_vi_cha_id,
          trang_thai: data.trang_thai,
          ghi_chu: data.ghi_chu,
          nguoi_tao_ten: user.ho_ten,
          nguoi_tao_id: user.id,
        },
        user.id,
      );
    }

    await loadData();
    onDataChanged?.();
  };

  // 6. Xác nhận đổi cấp trên
  const handleConfirmChangeParent = async (
    unitId: string,
    newParentId: string | null,
    lyDo: string,
  ) => {
    const target = allDonVi.find((u) => u.id === unitId);
    if (!target) return;

    await api.updateDonVi(
      {
        id: target.id,
        ten: target.ten,
        loai: target.loai,
        don_vi_cha_id: newParentId,
        ma: target.ma,
        ghi_chu: target.ghi_chu ? `${target.ghi_chu}\n[Đổi cấp trên: ${lyDo}]` : `[Đổi cấp trên: ${lyDo}]`,
        nguoi_cap_nhat_ten: user.ho_ten,
        nguoi_cap_nhat_id: user.id,
      },
      user.id,
    );

    await loadData();
    onDataChanged?.();
  };

  // 7. Mở dialog chuyển đổi trạng thái hoạt động (Đang hoạt động / Tạm ngừng / Đã chấm dứt)
  const handlePromptToggleStatus = (target: DonVi) => {
    setToggleStatusTarget(target);
    setToggleStatusReason('');
    const currentStatus = target.trang_thai || 'DANG_HOAT_DONG';
    if (currentStatus === 'DANG_HOAT_DONG') {
      setToggleTargetStatus('TAM_NGUNG');
    } else {
      setToggleTargetStatus('DANG_HOAT_DONG');
    }
  };

  // Xác nhận cập nhật trạng thái
  const handleConfirmToggleStatus = async () => {
    if (!toggleStatusTarget) return;

    const targetId = toggleStatusTarget.id;
    const newStatus = toggleTargetStatus;
    const reason = toggleStatusReason.trim() || undefined;

    // 1. Optimistic update ngay lập tức: bảng, cây và drawer cập nhật tức thời
    setAllDonVi((prev) =>
      prev.map((u) => (u.id === targetId ? { ...u, trang_thai: newStatus } : u))
    );
    setTreeData((prev) => {
      const updateNode = (nodes: DonViTreeItem[]): DonViTreeItem[] =>
        nodes.map((n) => ({
          ...n,
          trang_thai: n.id === targetId ? newStatus : n.trang_thai,
          children: n.children ? updateNode(n.children) : [],
        }));
      return updateNode(prev);
    });
    if (detailUnit && detailUnit.id === targetId) {
      setDetailUnit({
        ...detailUnit,
        trang_thai: newStatus,
      });
    }

    setIsTogglingStatus(true);
    try {
      await api.toggleDonViStatus(
        targetId,
        newStatus,
        reason,
        user.ho_ten,
        user.id,
      );
      setToggleStatusTarget(null);
      await loadData();
      onDataChanged?.();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi khi cập nhật trạng thái tổ chức');
      await loadData();
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // 8. Xóa tổ chức Đảng
  const handleConfirmDelete = async (unitId: string) => {
    await api.deleteDonVi(unitId, user.id, user.ho_ten);
    if (selectedUnitId === unitId) setSelectedUnitId(null);
    if (detailUnit?.id === unitId) setDetailUnit(null);
    await loadData();
    onDataChanged?.();
  };

  // 9. Xuất danh sách Excel / CSV
  const handleExportCsv = () => {
    exportUnitsToCsv(allDonVi);
  };



  // ──────────────────────────────────────────────────────────────────────────
  // Xử lý Phân công quản lý (Tab 2)
  // ──────────────────────────────────────────────────────────────────────────
  const handleQuickCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    if (!newTenDangNhap.trim()) return setUserError('Tên đăng nhập không được để trống');
    if (!newHoTen.trim()) return setUserError('Họ tên cán bộ không được để trống');
    if (newMatKhau.length < 6) return setUserError('Mật khẩu phải từ 6 ký tự trở lên');

    setIsCreatingUser(true);
    try {
      const created = await api.createUser(
        {
          ten_dang_nhap: newTenDangNhap.trim(),
          ho_ten: newHoTen.trim(),
          mat_khau: newMatKhau,
          vai_tro: newVaiTro,
        },
        user.id,
        user.ho_ten,
      );

      setIsCreateUserModalOpen(false);
      setNewTenDangNhap('');
      setNewHoTen('');
      setNewMatKhau('12345678');
      await reloadUsers(created.id);
      setAssignSuccess(
        `Đã tạo tài khoản "${created.ho_ten}" thành công! Có thể chọn đơn vị phân công ngay.`,
      );
      setTimeout(() => setAssignSuccess(''), 4000);
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const saveAssignmentsToStorage = (newAssignments: PhanCongDiaBan[]) => {
    const sanitized = sanitizeStrictAssignments(newAssignments);
    setAssignments(sanitized);
    localStorage.setItem(STORAGE_PHAN_CONG, JSON.stringify(sanitized));

    // Đồng bộ sang Hồ sơ địa bàn
    try {
      const rawRecords = localStorage.getItem(STORAGE_DIA_BAN_RECORDS);
      if (rawRecords) {
        const records: DiaBanRecord[] = JSON.parse(rawRecords);
        if (Array.isArray(records)) {
          const todayStr = new Date().toLocaleDateString('vi-VN');
          const updated = records.map((r) => {
            const assignItem = sanitized.find((a) => a.don_vi_ids?.includes(r.id));
            const existingHistory: LichSuPhuTrachDiaBan[] = Array.isArray(r.lich_su_phu_trach)
              ? r.lich_su_phu_trach
              : [];

            if (assignItem) {
              const userObj = usersList.find((u) => u.id === assignItem.user_id);
              const newTen = userObj ? userObj.ho_ten : assignItem.user_name || 'Cán bộ cơ quan';
              const newChucVu = userObj?.chuc_danh || 'Ủy viên UBKT Đảng ủy';

              if (r.can_bo_phu_trach_id !== assignItem.user_id) {
                const updatedHistory = existingHistory.map((item, idx) => {
                  if (idx === existingHistory.length - 1 && !item.den_ngay) {
                    return { ...item, den_ngay: todayStr };
                  }
                  return item;
                });

                const newEntry: LichSuPhuTrachDiaBan = {
                  id: 'ls-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                  can_bo_id: assignItem.user_id,
                  can_bo_ten: newTen,
                  can_bo_chuc_vu: newChucVu,
                  tu_ngay: todayStr,
                  den_ngay: undefined,
                  van_ban_phan_cong: `Phân công theo dõi địa bàn (${todayStr})`,
                  created_at: new Date().toISOString(),
                };

                return {
                  ...r,
                  can_bo_phu_trach_id: assignItem.user_id,
                  can_bo_phu_trach_ten: newTen,
                  can_bo_chuc_vu: newChucVu,
                  thoi_gian_phan_cong: todayStr,
                  lich_su_phu_trach: [...updatedHistory, newEntry],
                  thoi_diem_cap_nhat_gan_nhat:
                    new Date().toLocaleDateString('vi-VN') +
                    ' ' +
                    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  nguoi_cap_nhat_gan_nhat: user.ho_ten,
                };
              }

              return {
                ...r,
                can_bo_phu_trach_id: assignItem.user_id,
                can_bo_phu_trach_ten: newTen,
                can_bo_chuc_vu: newChucVu,
              };
            } else {
              // Bị gỡ phân công
              if (r.can_bo_phu_trach_id) {
                const updatedHistory = existingHistory.map((item, idx) => {
                  if (idx === existingHistory.length - 1 && !item.den_ngay) {
                    return { ...item, den_ngay: todayStr };
                  }
                  return item;
                });
                return {
                  ...r,
                  can_bo_phu_trach_id: undefined,
                  can_bo_phu_trach_ten: 'Chưa phân công',
                  can_bo_chuc_vu: '',
                  lich_su_phu_trach: updatedHistory,
                  thoi_diem_cap_nhat_gan_nhat:
                    new Date().toLocaleDateString('vi-VN') +
                    ' ' +
                    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  nguoi_cap_nhat_gan_nhat: user.ho_ten,
                };
              }
              return r;
            }
          });
          localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(updated));
          setDiaBanRecords(updated);
          window.dispatchEvent(
            new CustomEvent('ubkt_diaban_records_updated', { detail: updated }),
          );
        }
      }
    } catch (e) {
      console.error('Lỗi đồng bộ hồ sơ địa bàn:', e);
    }

    window.dispatchEvent(new CustomEvent('ubkt_assignments_updated', { detail: sanitized }));
  };

  const handleToggleAssignUnit = (unitId: string) => {
    if (!selectedAssignUserId) return;

    const selectedUserObj = usersList.find((u) => u.id === selectedAssignUserId);
    const userName = selectedUserObj ? selectedUserObj.ho_ten : 'Cán bộ';

    const currentAssign = assignments.find((a) => a.user_id === selectedAssignUserId);
    const isCurrentlyMine = Boolean(currentAssign?.don_vi_ids?.includes(unitId));

    let updatedAssignments: PhanCongDiaBan[];

    if (isCurrentlyMine) {
      updatedAssignments = assignments.map((a) => {
        if (a.user_id === selectedAssignUserId) {
          return {
            ...a,
            don_vi_ids: (a.don_vi_ids || []).filter((id) => id !== unitId),
            updated_at: new Date().toISOString(),
          };
        }
        return a;
      });
      setAssignSuccess(`Đã bỏ phân công đơn vị khỏi ${userName}`);
    } else {
      let foundUserRecord = false;
      updatedAssignments = assignments.map((a) => {
        if (a.user_id === selectedAssignUserId) {
          foundUserRecord = true;
          const currentUnits = (a.don_vi_ids || []).filter((id) => id !== unitId);
          return {
            ...a,
            user_name: userName,
            don_vi_ids: [...currentUnits, unitId],
            updated_at: new Date().toISOString(),
          };
        } else {
          return {
            ...a,
            don_vi_ids: (a.don_vi_ids || []).filter((id) => id !== unitId),
          };
        }
      });

      if (!foundUserRecord) {
        updatedAssignments.push({
          user_id: selectedAssignUserId,
          user_name: userName,
          don_vi_ids: [unitId],
          updated_at: new Date().toISOString(),
        });
      }

      setAssignSuccess(
        `Đã chuyển giao đơn vị cho ${userName} (đảm bảo duy nhất 1 cán bộ phụ trách)`,
      );
    }

    saveAssignmentsToStorage(updatedAssignments);
    setTimeout(() => setAssignSuccess(''), 3000);
  };

  const handleOpenEditCanCuInDonVi = (entry?: LichSuPhuTrachDiaBan | null) => {
    if (entry) {
      setEditingCanCuEntry(entry);
      setCanCuSoQd(entry.so_quyet_dinh || entry.van_ban_phan_cong || '');
      setCanCuNgayQd(entry.ngay_ban_hanh_qd || '');
      setCanCuCoQuan(entry.co_quan_ban_hanh || 'Ủy ban Kiểm tra Đảng ủy');
      setCanCuTrichYeu(entry.can_cu_van_ban || '');
      setCanCuLyDo(entry.ly_do_thay_doi || '');
      setCanCuFileTen(entry.file_van_ban || '');
    } else {
      setEditingCanCuEntry(null);
      setCanCuSoQd(historyTargetUnit?.record?.van_ban_phan_cong || '');
      setCanCuNgayQd(new Date().toLocaleDateString('vi-VN'));
      setCanCuCoQuan('Ủy ban Kiểm tra Đảng ủy');
      setCanCuTrichYeu(`Quyết định phân công phụ trách ${historyTargetUnit?.ten || 'đơn vị'}`);
      setCanCuLyDo('');
      setCanCuFileTen('');
    }
    setCanCuError(null);
  };

  const handleSaveCanCuInDonVi = () => {
    if (!historyTargetUnit) return;
    if (!canCuSoQd.trim() && !canCuTrichYeu.trim()) {
      setCanCuError('Vui lòng nhập số hiệu văn bản hoặc trích yếu căn cứ.');
      return;
    }

    const formattedVb = canCuSoQd.trim()
      ? `${canCuSoQd.trim()}${canCuNgayQd.trim() ? ` ngày ${canCuNgayQd.trim()}` : ''}`
      : canCuTrichYeu.trim();

    const targetRec = diaBanRecords.find((r) => r.id === historyTargetUnit.id);
    if (!targetRec) return;

    const existingHistory = Array.isArray(targetRec.lich_su_phu_trach)
      ? [...targetRec.lich_su_phu_trach]
      : [];
    let updatedHistory: LichSuPhuTrachDiaBan[];

    if (editingCanCuEntry) {
      updatedHistory = existingHistory.map((h) => {
        if (h.id === editingCanCuEntry.id) {
          return {
            ...h,
            van_ban_phan_cong: formattedVb,
            so_quyet_dinh: canCuSoQd.trim(),
            ngay_ban_hanh_qd: canCuNgayQd.trim(),
            co_quan_ban_hanh: canCuCoQuan.trim(),
            can_cu_van_ban: canCuTrichYeu.trim(),
            file_van_ban: canCuFileTen.trim() || h.file_van_ban,
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
          so_quyet_dinh: canCuSoQd.trim(),
          ngay_ban_hanh_qd: canCuNgayQd.trim(),
          co_quan_ban_hanh: canCuCoQuan.trim(),
          can_cu_van_ban: canCuTrichYeu.trim(),
          file_van_ban: canCuFileTen.trim() || updatedHistory[currentIdx].file_van_ban,
          ly_do_thay_doi: canCuLyDo.trim() || updatedHistory[currentIdx].ly_do_thay_doi,
        };
      } else {
        const newEntry: LichSuPhuTrachDiaBan = {
          id: 'ls-' + Date.now(),
          can_bo_id: targetRec.can_bo_phu_trach_id,
          can_bo_ten: targetRec.can_bo_phu_trach_ten || 'Cán bộ phụ trách',
          can_bo_chuc_vu: targetRec.can_bo_chuc_vu || 'Ủy viên UBKT Đảng ủy',
          tu_ngay: targetRec.thoi_gian_phan_cong || new Date().toLocaleDateString('vi-VN'),
          den_ngay: undefined,
          van_ban_phan_cong: formattedVb,
          so_quyet_dinh: canCuSoQd.trim(),
          ngay_ban_hanh_qd: canCuNgayQd.trim(),
          co_quan_ban_hanh: canCuCoQuan.trim(),
          can_cu_van_ban: canCuTrichYeu.trim(),
          file_van_ban: canCuFileTen.trim() || undefined,
          ly_do_thay_doi: canCuLyDo.trim() || undefined,
          created_at: new Date().toISOString(),
        };
        updatedHistory = [...existingHistory, newEntry];
      }
    }

    const updatedRecords = diaBanRecords.map((r) =>
      r.id === targetRec.id
        ? {
            ...r,
            lich_su_phu_trach: updatedHistory,
            van_ban_phan_cong: formattedVb,
          }
        : r,
    );

    setDiaBanRecords(updatedRecords);
    localStorage.setItem(STORAGE_DIA_BAN_RECORDS, JSON.stringify(updatedRecords));
    window.dispatchEvent(
      new CustomEvent('ubkt_diaban_records_updated', { detail: updatedRecords }),
    );
    setHistoryTargetUnit({ ...historyTargetUnit, record: updatedRecords.find((r) => r.id === targetRec.id) });
    setEditingCanCuEntry(null);
  };

  const selectedUnit = allDonVi.find((u) => u.id === selectedUnitId) || null;

  return (
    <div className="space-y-5 pb-12">
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* KHU VỰC A: THANH TIÊU ĐỀ VÀ THAO TÁC CHÍNH                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cơ cấu tổ chức</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý danh mục tổ chức đảng, cơ quan và các đơn vị trực thuộc trong phạm vi được
                phân quyền
              </p>
            </div>
          </div>
        </div>

        {/* Nút điều hướng 2 Tabs chính */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('to_chuc')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'to_chuc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>Cơ cấu tổ chức ({allDonVi.filter((u) => !u.deleted_at).length})</span>
            </button>

            <button
              onClick={() => setActiveTab('phan_cong')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'phan_cong'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Phân công quản lý</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PHÂN HỆ CƠ CẤU TỔ CHỨC ĐA CẤP (5 KHU VỰC CHUẨN ĐẶC TẢ)           */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'to_chuc' && (
        <div className="space-y-5">
          {/* Action Toolbar riêng của Phân hệ Cơ cấu tổ chức */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  {/* + Thêm tổ chức */}
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(null)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Thêm tổ chức</span>
                  </button>

                  {/* Thêm cấp dưới */}
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(selectedUnitId)}
                    disabled={!selectedUnitId}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    title={
                      selectedUnit
                        ? `Thêm đơn vị trực thuộc của "${selectedUnit.ten}"`
                        : 'Chọn một tổ chức để thêm cấp dưới'
                    }
                  >
                    <FolderTree className="w-4 h-4 text-emerald-600" />
                    <span>Thêm cấp dưới</span>
                  </button>

                  {/* Nhập danh sách */}
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-purple-600" />
                    <span>Nhập danh sách (Excel)</span>
                  </button>
                </>
              )}

              {/* Xuất danh sách */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Xuất danh sách</span>
              </button>

              {/* Lịch sử thay đổi */}
              <button
                type="button"
                onClick={() => handleOpenHistory(null)}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <History className="w-4 h-4 text-amber-600" />
                <span>Lịch sử thay đổi</span>
              </button>


            </div>

            <button
              type="button"
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Làm mới dữ liệu từ máy chủ"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* ──────────────────────────────────────────────────────────────────── */}
          {/* KHU VỰC B: CÁC THẺ THỐNG KÊ CƠ CẤU TỔ CHỨC (5 CHỈ TIÊU TỰ ĐỘNG)     */}
          {/* ──────────────────────────────────────────────────────────────────── */}
          <OrgStatsCards
            units={allDonVi}
            selectedFilter={selectedFilter}
            onFilterChange={(filterKey) => {
              setSelectedFilter(filterKey);
            }}
          />

          {/* ──────────────────────────────────────────────────────────────────── */}
          {/* KHU VỰC C & D: BỐ CỤC 2 CỘT (CÂY CƠ CẤU BÊN TRÁI & BẢNG DANH SÁCH)   */}
          {/* ──────────────────────────────────────────────────────────────────── */}
          {(() => {
            const findTreeItem = (nodes: DonViTreeItem[], id: string | null): DonViTreeItem | null => {
              if (!id) return null;
              for (const node of nodes) {
                if (node.id === id) return node;
                const found = findTreeItem(node.children, id);
                if (found) return found;
              }
              return null;
            };
            const selectedTreeItem = findTreeItem(treeData, selectedUnitId);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* CỘT TRÁI (Khu vực C: Cây cơ cấu tổ chức) */}
                <div className="lg:col-span-5 xl:col-span-4 sticky top-4">
                  <OrgTreePanel
                    treeData={treeData}
                    selectedUnitId={selectedUnitId}
                    canEdit={canEdit}
                    onSelectUnit={(node) => {
                      setSelectedUnitId(node.id);
                    }}
                    onViewUnit={(node) => {
                      const match = allDonVi.find((u) => u.id === node.id);
                      if (match) setDetailUnit(match);
                    }}
                    onAddChild={(node) => {
                      handleOpenAdd(node.id);
                    }}
                    onEditUnit={(node) => {
                      const match = allDonVi.find((u) => u.id === node.id);
                      if (match) handleOpenEdit(match);
                    }}
                    onChangeParent={(node) => {
                      const match = allDonVi.find((u) => u.id === node.id);
                      if (match) handleOpenChangeParent(match);
                    }}
                    onToggleStatus={(node) => {
                      const match = allDonVi.find((u) => u.id === node.id);
                      if (match) handlePromptToggleStatus(match);
                    }}
                    onDeleteUnit={(node) => {
                      const match = allDonVi.find((u) => u.id === node.id);
                      if (match) setDeleteTargetUnit(match);
                    }}
                  />
                </div>

                {/* CỘT PHẢI (Khu vực D: Bảng danh sách tổ chức) */}
                <div className="lg:col-span-7 xl:col-span-8">
                  <OrgTablePanel
                    units={allDonVi}
                    selectedUnit={selectedTreeItem}
                    canEdit={canEdit}
                    filterPreset={selectedFilter}
                    onSelectUnit={(unit) => {
                      setSelectedUnitId(unit.id);
                    }}
                    onViewUnit={(unit) => {
                      setDetailUnit(unit);
                    }}
                    onEditUnit={(unit) => {
                      handleOpenEdit(unit);
                    }}
                    onAddChild={(unit) => {
                      handleOpenAdd(unit.id);
                    }}
                    onChangeParent={(unit) => {
                      handleOpenChangeParent(unit);
                    }}
                    onToggleStatus={(unit) => {
                      handlePromptToggleStatus(unit);
                    }}
                    onDeleteUnit={(unit) => {
                      setDeleteTargetUnit(unit);
                    }}
                    onBatchToggleStatus={async (batchUnits, newStatus) => {
                      for (const u of batchUnits) {
                        await api.toggleDonViStatus(
                          u.id,
                          newStatus as TrangThaiDonVi,
                          'Thao tác hàng loạt từ bảng danh mục',
                          user.ho_ten,
                          user.id,
                        );
                      }
                      await loadData();
                      onDataChanged?.();
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* ──────────────────────────────────────────────────────────────────── */}
          {/* KHU VỰC E: BẢNG THÔNG TIN CHI TIẾT TỔ CHỨC (DRAWER TRƯỢT TỪ PHẢI)    */}
          {/* ──────────────────────────────────────────────────────────────────── */}
          {detailUnit && (
            <div
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-2xs transition-opacity flex justify-end cursor-pointer"
              onClick={() => setDetailUnit(null)}
            >
              <div
                className="w-full max-w-lg h-full cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <OrgDetailDrawer
                  unit={detailUnit}
                  allUnits={allDonVi}
                  currentUser={user}
                  onClose={() => setDetailUnit(null)}
                  onEdit={(u) => {
                    setDetailUnit(null);
                    handleOpenEdit(u);
                  }}
                  onAddChild={(u) => {
                    setDetailUnit(null);
                    handleOpenAdd(u.id);
                  }}
                  onChangeParent={(u) => {
                    setDetailUnit(null);
                    handleOpenChangeParent(u);
                  }}
                  onToggleStatus={(u) => {
                    handlePromptToggleStatus(u);
                  }}
                  onViewHistory={(u) => {
                    handleOpenHistory(u);
                  }}
                  onSelectUnit={(u) => {
                    setSelectedUnitId(u.id);
                    setDetailUnit(u);
                  }}
                  onDelete={(u) => {
                    setDetailUnit(null);
                    setDeleteTargetUnit(u);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: PHÂN CÔNG QUẢN LÝ (BẢO TOÀN NGUYÊN BẢN CÁC CHỨC NĂNG)             */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'phan_cong' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-5 h-5 text-blue-700" />
              <span>Phân công Phụ trách & Quản lý Chi, Đảng bộ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân chia quyền theo dõi, kiểm tra, giám sát và quản lý hồ sơ địa bàn của từng chi,
              đảng bộ cho cán bộ cơ quan theo nhiệm vụ được phân công
            </p>
          </div>

          {assignSuccess && (
            <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{assignSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-[480px]">
            {/* Cột trái: Danh sách cán bộ */}
            <div className="md:col-span-4 p-4 bg-slate-50/40 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Cán bộ / Tài khoản ({usersList.length})
                </p>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => reloadUsers()}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition cursor-pointer"
                    title="Làm mới danh sách cán bộ"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTenDangNhap('');
                        setNewHoTen('');
                        setNewMatKhau('12345678');
                        setUserError(null);
                        setIsCreateUserModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition flex items-center space-x-1 cursor-pointer shadow-xs"
                      title="Tạo tài khoản cán bộ mới để phân công"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Thêm cán bộ</span>
                    </button>
                  )}
                </div>
              </div>

              {usersList.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs">Chưa có tài khoản nào</p>
                </div>
              ) : (
                usersList.map((usr) => {
                  const assign = assignments.find((a) => a.user_id === usr.id);
                  const count = assign?.don_vi_ids?.length || 0;
                  const isSelected = selectedAssignUserId === usr.id;

                  return (
                    <div
                      key={usr.id}
                      onClick={() => setSelectedAssignUserId(usr.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            isSelected ? 'text-blue-900' : 'text-slate-800'
                          }`}
                        >
                          {usr.ho_ten}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">@{usr.ten_dang_nhap}</p>
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          {usr.chuc_danh && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {usr.chuc_danh}
                            </span>
                          )}
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {usr.vai_tro === 'ADMIN'
                              ? 'Quản trị viên'
                              : usr.vai_tro === 'BIEN_TAP'
                              ? 'Biên tập viên'
                              : 'Chỉ xem'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                            count > 0
                              ? 'bg-blue-600 text-white'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {count > 0 ? `${count} đơn vị` : 'Chưa giao'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cột phải: Chọn đơn vị phân công */}
            <div className="md:col-span-8 p-4 flex flex-col justify-between">
              <div>
                {(() => {
                  const curUser = usersList.find((u) => u.id === selectedAssignUserId);
                  const curAssign = assignments.find((a) => a.user_id === selectedAssignUserId);
                  const curCount = curAssign?.don_vi_ids?.length || 0;

                  return (
                    <div className="mb-4 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 flex items-center flex-wrap gap-2">
                          <span>Phân công cho:</span>
                          <span className="text-blue-700">{curUser?.ho_ten || 'Chọn cán bộ'}</span>
                          {curUser?.chuc_danh && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {curUser.chuc_danh}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tích chọn các tổ chức Đảng trực tiếp theo dõi, hướng dẫn và quản lý hồ sơ
                        </p>
                      </div>

                      <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 font-bold text-xs border border-blue-200 shrink-0">
                        Đang phụ trách: {curCount} đơn vị
                      </span>
                    </div>
                  );
                })()}

                {/* Banner quy định 1 cán bộ phụ trách 1 đơn vị */}
                <div className="mb-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Quy định phân công:</strong> Mỗi tổ chức Đảng / Chi bộ chỉ giao cho{' '}
                    <strong>duy nhất 01 đồng chí cán bộ phụ trách</strong>. Khi tích chọn đơn vị
                    đang do cán bộ khác quản lý, hệ thống sẽ tự động chuyển giao về cho cán bộ đang
                    chọn.
                  </div>
                </div>

                {/* Tìm kiếm */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={assignSearchUnit}
                    onChange={(e) => setAssignSearchUnit(e.target.value)}
                    placeholder="Tìm chi bộ / đảng bộ để phân công..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Danh sách checkbox đơn vị */}
                <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                  {allDonVi
                    .filter((d) => !d.deleted_at)
                    .filter(
                      (d) =>
                        !assignSearchUnit ||
                        d.ten.toLowerCase().includes(assignSearchUnit.toLowerCase()),
                    )
                    .map((d) => {
                      const curAssign = assignments.find((a) => a.user_id === selectedAssignUserId);
                      const isChecked = Boolean(curAssign?.don_vi_ids?.includes(d.id));
                      const otherAssign = assignments.find(
                        (a) => a.user_id !== selectedAssignUserId && a.don_vi_ids?.includes(d.id),
                      );

                      return (
                        <label
                          key={d.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/60 border-blue-300'
                              : otherAssign
                              ? 'bg-amber-50/30 border-amber-200 hover:bg-amber-50/60'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAssignUnit(d.id)}
                              disabled={!canEdit}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 cursor-pointer"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800">{d.ten}</span>
                              <div className="flex items-center space-x-2 mt-0.5">
                                {d.ma && (
                                  <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                    {d.ma}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-500 font-mono">
                                  #{d.thu_tu}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {(() => {
                              const matchRec = diaBanRecords.find((rec) => rec.id === d.id);
                              const historyCount = matchRec?.lich_su_phu_trach?.length || 0;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setHistoryTargetUnit({
                                      id: d.id,
                                      ten: d.ten,
                                      record: matchRec,
                                    });
                                  }}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                                  title="Xem lịch sử các thời kỳ cán bộ phụ trách đơn vị này"
                                >
                                  <History className="w-3 h-3 text-indigo-600" />
                                  <span>{historyCount > 1 ? `${historyCount} đời cán bộ` : 'Lịch sử'}</span>
                                </button>
                              );
                            })()}

                            {otherAssign && !isChecked && (
                              <span
                                className="text-[11px] font-medium text-amber-800 bg-amber-100/70 hover:bg-amber-200/80 px-2.5 py-1 rounded-md border border-amber-300 flex items-center space-x-1 transition"
                                title="Bấm vào để chuyển giao đơn vị này cho cán bộ đang chọn"
                              >
                                <span>
                                  Đang giao: <strong>{otherAssign.user_name}</strong>
                                </span>
                                <span className="text-[10px] text-amber-700 font-normal italic ml-1">
                                  (Chọn để chuyển)
                                </span>
                              </span>
                            )}
                            {isChecked && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đang phụ trách</span>
                              </span>
                            )}
                            {!isChecked && !otherAssign && (
                              <span className="text-[11px] text-slate-400 italic">
                                Chưa phân công
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* CÁC MODAL HỆ THỐNG CỦA PHÂN HỆ CƠ CẤU TỔ CHỨC                            */}
      {/* ──────────────────────────────────────────────────────────────────────── */}

      {/* Modal 1: Thêm mới / Sửa thông tin tổ chức (Section 3) */}
      <OrgFormModal
        isOpen={isFormModalOpen}
        editingUnit={formEditingUnit}
        defaultParentId={formDefaultParentId}
        allUnits={allDonVi}
        currentUser={user}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveForm}
      />

      {/* Modal 2: Chuyển đổi tổ chức cấp trên an toàn (Section 5) */}
      <OrgChangeParentModal
        isOpen={isChangeParentModalOpen}
        unit={changeParentUnit}
        allUnits={allDonVi}
        currentUser={user}
        onClose={() => setIsChangeParentModalOpen(false)}
        onConfirm={handleConfirmChangeParent}
      />

      {/* Modal 3: Nhập danh sách từ Excel/CSV (Section 6) */}
      <OrgImportExcelModal
        isOpen={isImportModalOpen}
        allUnits={allDonVi}
        loaiHinhList={loaiHinhList}
        currentUser={user}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={async () => {
          await loadData();
          onDataChanged?.();
        }}
        onBatchImport={async (items) => {
          return await api.batchImportDonVi(items, user.ho_ten, user.id);
        }}
      />

      {/* Modal 4: Lịch sử thay đổi cơ cấu tổ chức (Area A/E) */}
      <OrgAuditHistoryModal
        isOpen={isAuditHistoryOpen}
        targetUnit={auditTargetUnit}
        onClose={() => setIsAuditHistoryOpen(false)}
      />

      {/* Modal: Xác nhận xóa tổ chức Đảng */}
      <OrgDeleteModal
        isOpen={Boolean(deleteTargetUnit)}
        unit={deleteTargetUnit}
        allUnits={allDonVi}
        onClose={() => setDeleteTargetUnit(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal 5: Thay đổi trạng thái hoạt động (Đang hoạt động / Tạm ngừng / Đã chấm dứt) */}
      {toggleStatusTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setToggleStatusTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Power className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Cập nhật trạng thái hoạt động
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setToggleStatusTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Thông tin tổ chức */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Tổ chức được chọn
                </div>
                <div className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{toggleStatusTarget.ten}</span>
                </div>
                <div className="mt-1 flex items-center space-x-2 text-xs text-slate-600">
                  <span>Trạng thái hiện tại:</span>
                  {toggleStatusTarget.trang_thai === 'TAM_NGUNG' ? (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold text-[11px]">
                      Tạm ngừng
                    </span>
                  ) : toggleStatusTarget.trang_thai === 'CHAM_DUT' ? (
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold text-[11px]">
                      Đã chấm dứt
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[11px]">
                      Đang hoạt động
                    </span>
                  )}
                </div>
              </div>

              {/* Lựa chọn trạng thái mới */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Chọn trạng thái mới:
                </label>
                <div className="space-y-2">
                  {/* Option 1: Đang hoạt động */}
                  <div
                    role="button"
                    onClick={() => setToggleTargetStatus('DANG_HOAT_DONG')}
                    className={`flex items-start p-3 rounded-xl border-2 transition cursor-pointer select-none ${
                      toggleTargetStatus === 'DANG_HOAT_DONG'
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetStatus"
                      value="DANG_HOAT_DONG"
                      checked={toggleTargetStatus === 'DANG_HOAT_DONG'}
                      readOnly
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                    />
                    <div className="ml-3">
                      <div className="text-xs font-bold text-emerald-800 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Đang hoạt động</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Tổ chức duy trì sinh hoạt, triển khai các nhiệm vụ kiểm tra, giám sát bình thường.
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Tạm ngừng */}
                  <div
                    role="button"
                    onClick={() => setToggleTargetStatus('TAM_NGUNG')}
                    className={`flex items-start p-3 rounded-xl border-2 transition cursor-pointer select-none ${
                      toggleTargetStatus === 'TAM_NGUNG'
                        ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-1 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetStatus"
                      value="TAM_NGUNG"
                      checked={toggleTargetStatus === 'TAM_NGUNG'}
                      readOnly
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div className="ml-3">
                      <div className="text-xs font-bold text-amber-800 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Tạm ngừng hoạt động</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Tạm hoãn các hoạt động kiểm tra, giám sát. Toàn bộ hồ sơ lịch sử được bảo toàn 100%.
                      </div>
                    </div>
                  </div>

                  {/* Option 3: Chấm dứt */}
                  <div
                    role="button"
                    onClick={() => setToggleTargetStatus('CHAM_DUT')}
                    className={`flex items-start p-3 rounded-xl border-2 transition cursor-pointer select-none ${
                      toggleTargetStatus === 'CHAM_DUT'
                        ? 'border-rose-500 bg-rose-50/60 shadow-xs ring-1 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetStatus"
                      value="CHAM_DUT"
                      checked={toggleTargetStatus === 'CHAM_DUT'}
                      readOnly
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 pointer-events-none"
                    />
                    <div className="ml-3">
                      <div className="text-xs font-bold text-rose-800 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span>Đã chấm dứt hoạt động</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Giải thể, sáp nhập hoặc kết thúc hoạt động. Mọi hồ sơ, tài liệu KT-GS được lưu trữ nguyên vẹn để tra cứu.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lý do */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lý do / Căn cứ thay đổi:
                </label>
                <textarea
                  rows={2}
                  value={toggleStatusReason}
                  onChange={(e) => setToggleStatusReason(e.target.value)}
                  placeholder="VD: Theo Quyết định sáp nhập / kiện toàn số 15-QĐ/ĐU..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Bảo toàn dữ liệu cam kết */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start space-x-2 text-[11px] text-blue-800">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Nguyên tắc bảo toàn dữ liệu:</strong> Thao tác thay đổi trạng thái không làm mất dữ liệu. Toàn bộ chương trình kiểm tra, giám sát và đơn thư liên quan đều được giữ nguyên vẹn 100%.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setToggleStatusTarget(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isTogglingStatus}
                  onClick={handleConfirmToggleStatus}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isTogglingStatus ? 'Đang cập nhật...' : 'Xác nhận thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Tạo nhanh tài khoản cán bộ để phân công (Tab 2) */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">THÊM TÀI KHOẢN CÁN BỘ PHỤ TRÁCH</h3>
              </div>
              <button
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateUser} className="p-6 space-y-4">
              {userError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                  <span>{userError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Họ và tên cán bộ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newHoTen}
                  onChange={(e) => setNewHoTen(e.target.value)}
                  placeholder="Ví dụ: Đ/c Nguyễn Văn An, Đ/c Trần Thị Bình..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tên đăng nhập <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTenDangNhap}
                  onChange={(e) => setNewTenDangNhap(e.target.value.toLowerCase().trim())}
                  placeholder="Ví dụ: nguyen_van_a, chuyen_vien_1..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Vai trò
                  </label>
                  <select
                    value={newVaiTro}
                    onChange={(e) => setNewVaiTro(e.target.value as 'ADMIN' | 'BIEN_TAP' | 'XEM')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="BIEN_TAP">Biên tập viên</option>
                    <option value="ADMIN">Quản trị viên</option>
                    <option value="XEM">Chỉ xem</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Mật khẩu khởi tạo
                  </label>
                  <input
                    type="text"
                    required
                    value={newMatKhau}
                    onChange={(e) => setNewMatKhau(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isCreatingUser ? 'Đang tạo...' : 'Tạo tài khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 8: Xem lịch sử phân công phụ trách địa bàn (Tab 2) */}
      {historyTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b-2 border-amber-500 shrink-0">
              <div className="flex items-center space-x-2.5">
                <History className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    LỊCH SỬ PHÂN CÔNG PHỤ TRÁCH: {historyTargetUnit.ten}
                  </h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    Đồng bộ thời gian thực với phân hệ Hồ sơ địa bàn & bảo toàn dữ liệu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTargetUnit(null)}
                className="text-white/70 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-start space-x-2.5 text-xs text-blue-900 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Chính sách bảo toàn hồ sơ: </span>
                  <span>
                    Khi chuyển phân công đơn vị, cán bộ tiếp quản mới được toàn quyền tra cứu, xem
                    và kế thừa đầy đủ mọi báo cáo tháng, tài liệu, vấn đề cơ sở được lập trước thời
                    điểm nhận bàn giao.
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">
                    Cán bộ phụ trách hiện tại:
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {historyTargetUnit.record?.can_bo_phu_trach_ten || 'Chưa phân công'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {historyTargetUnit.record?.can_bo_chuc_vu || 'Cán bộ UBKT'} • Từ:{' '}
                    {historyTargetUnit.record?.thoi_gian_phan_cong || '---'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đang theo dõi</span>
                </span>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Dòng thời gian các thời kỳ cán bộ phụ trách:
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditCanCuInDonVi(null)}
                      className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 flex items-center space-x-1 transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>+ Bổ sung căn cứ</span>
                    </button>
                  )}
                </div>

                {editingCanCuEntry !== null && (
                  <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                      <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-amber-700" />
                        <span>Bổ sung / Cập nhật căn cứ văn bản phân công</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingCanCuEntry(null)}
                        className="text-amber-800 hover:text-amber-950 font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    {canCuError && <p className="text-red-600 font-semibold">{canCuError}</p>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">
                          Số hiệu QĐ / Văn bản *:
                        </label>
                        <input
                          type="text"
                          value={canCuSoQd}
                          onChange={(e) => setCanCuSoQd(e.target.value)}
                          placeholder="Ví dụ: 15-QĐ/UBKT"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">
                          Ngày ban hành:
                        </label>
                        <input
                          type="text"
                          value={canCuNgayQd}
                          onChange={(e) => setCanCuNgayQd(e.target.value)}
                          placeholder="Ví dụ: 15/01/2026"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-0.5">
                        Trích yếu căn cứ phân công *:
                      </label>
                      <textarea
                        rows={2}
                        value={canCuTrichYeu}
                        onChange={(e) => setCanCuTrichYeu(e.target.value)}
                        placeholder="Căn cứ quyết định về việc phân công cán bộ theo dõi địa bàn..."
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-amber-200">
                      <button
                        type="button"
                        onClick={() => setEditingCanCuEntry(null)}
                        className="px-3 py-1 border border-slate-300 bg-white rounded text-slate-700 font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCanCuInDonVi}
                        className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold"
                      >
                        Lưu căn cứ
                      </button>
                    </div>
                  </div>
                )}

                {!historyTargetUnit.record?.lich_su_phu_trach ||
                historyTargetUnit.record.lich_su_phu_trach.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Chưa ghi nhận lịch sử chuyển giao cán bộ cho đơn vị này.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {historyTargetUnit.record.lich_su_phu_trach
                      .slice()
                      .reverse()
                      .map((entry, eIdx) => {
                        const isCurrent = !entry.den_ngay;
                        return (
                          <div key={entry.id || eIdx} className="relative pl-10">
                            <div
                              className={`absolute left-2.5 top-3 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isCurrent
                                  ? 'bg-blue-600 border-white shadow-xs text-white'
                                  : 'bg-slate-300 border-white text-slate-500'
                              }`}
                            >
                              {isCurrent ? (
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              )}
                            </div>

                            <div
                              className={`p-3.5 rounded-xl border ${
                                isCurrent
                                  ? 'border-blue-300 bg-blue-50/30 ring-1 ring-blue-100'
                                  : 'border-slate-200 bg-slate-50/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-bold text-slate-900">
                                  {entry.can_bo_ten}
                                </span>
                                {isCurrent ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Hiện tại
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                    Thời kỳ trước
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 space-y-1">
                                <p>
                                  <span className="text-slate-400">Thời gian: </span>
                                  <strong>
                                    Từ {entry.tu_ngay}{' '}
                                    {entry.den_ngay ? `đến ${entry.den_ngay}` : 'đến nay'}
                                  </strong>
                                </p>
                                <p>
                                  <span className="text-slate-400">Căn cứ: </span>
                                  <strong className="text-slate-800">
                                    {entry.so_quyet_dinh ||
                                      entry.van_ban_phan_cong ||
                                      'QĐ phân công địa bàn'}
                                    {entry.ngay_ban_hanh_qd && (
                                      <span className="font-normal text-slate-500">
                                        {' '}
                                        (ngày {entry.ngay_ban_hanh_qd})
                                      </span>
                                    )}
                                  </strong>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setHistoryTargetUnit(null)}
                className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition cursor-pointer"
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
