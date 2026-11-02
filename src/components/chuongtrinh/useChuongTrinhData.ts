import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { reconcileById, captureActiveInput, restoreActiveInput } from '../../utils/syncUtils';
import type {
  ChuongTrinhKtGs,
  User,
  PhanCongDiaBan,
  DiaBanRecord,
} from '../../types';

export function useChuongTrinhData(isAdmin: boolean) {
  const [list, setList] = useState<ChuongTrinhKtGs[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<PhanCongDiaBan[]>(() => {
    try {
      const saved = localStorage.getItem('ubkt_phan_cong_dia_ban');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [usersList, setUsersList] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('ubkt_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [diaBanRecords, setDiaBanRecords] = useState<DiaBanRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ubkt_dia_ban_records');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const hasInitialLoadedRef = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    const showSpinner = !silent && !hasInitialLoadedRef.current;
    if (showSpinner) {
      setLoading(true);
    }
    const activeInputSnap = captureActiveInput();

    try {
      const res = await api.getAllChuongTrinh();
      const safePrograms = Array.isArray(res) ? res : [];
      setList((prev) => reconcileById(prev, safePrograms, (p) => p.id));

      if (isAdmin) {
        const [savedAssignments, savedUsers, savedDiaBan] = await Promise.all([
          api.getPhanCongDiaBan().catch(() => null),
          api.getAllUsers().catch(() => null),
          api.getDiaBanRecords().catch(() => null),
        ]);
        if (Array.isArray(savedAssignments)) {
          setAssignments((prev) => reconcileById(prev, savedAssignments, (a) => a.user_id));
        }
        if (Array.isArray(savedUsers)) {
          setUsersList((prev) => reconcileById(prev, savedUsers, (u) => u.id));
        }
        if (Array.isArray(savedDiaBan)) {
          setDiaBanRecords((prev) => reconcileById(prev, savedDiaBan, (r) => r.id));
        }
      }
      hasInitialLoadedRef.current = true;
      restoreActiveInput(activeInputSnap);
    } catch (err) {
      console.warn('Lỗi tải danh sách chương trình (giữ nguyên dữ liệu cũ):', err);
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData(false);
    const handleUpdate = () => loadData(true);

    const handleAssignmentsChanged = (e: Event) => {
      const ce = e as CustomEvent<PhanCongDiaBan[]>;
      if (ce.detail && Array.isArray(ce.detail)) {
        setAssignments((prev) => reconcileById(prev, ce.detail, (a) => a.user_id));
      } else {
        try {
          const saved = localStorage.getItem('ubkt_phan_cong_dia_ban');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setAssignments((prev) => reconcileById(prev, parsed, (a) => a.user_id));
            }
          }
        } catch {}
      }
    };

    const handleDiaBanChanged = (e: Event) => {
      const ce = e as CustomEvent<DiaBanRecord[]>;
      if (ce.detail && Array.isArray(ce.detail)) {
        setDiaBanRecords((prev) => reconcileById(prev, ce.detail, (r) => r.id));
      } else {
        try {
          const saved = localStorage.getItem('ubkt_dia_ban_records');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setDiaBanRecords((prev) => reconcileById(prev, parsed, (r) => r.id));
            }
          }
        } catch {}
      }
    };

    const handleUsersChanged = () => {
      api.getAllUsers().then((usrs) => {
        if (Array.isArray(usrs)) {
          setUsersList((prev) => reconcileById(prev, usrs, (u) => u.id));
        }
      }).catch(() => {});
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ubkt_phan_cong_dia_ban' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setAssignments((prev) => reconcileById(prev, parsed, (a) => a.user_id));
        } catch {}
      } else if (e.key === 'ubkt_dia_ban_records' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setDiaBanRecords((prev) => reconcileById(prev, parsed, (r) => r.id));
        } catch {}
      } else if (e.key === 'ubkt_users' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setUsersList((prev) => reconcileById(prev, parsed, (u) => u.id));
        } catch {}
      }
    };

    window.addEventListener('ubkt_chuong_trinh_updated', handleUpdate);
    window.addEventListener('ubkt_kho_du_lieu_updated', handleUpdate);
    window.addEventListener('ubkt_assignments_updated', handleAssignmentsChanged);
    window.addEventListener('ubkt_diaban_records_updated', handleDiaBanChanged);
    window.addEventListener('ubkt_users_updated', handleUsersChanged);
    window.addEventListener('ubkt_data_synced', handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('ubkt_chuong_trinh_updated', handleUpdate);
      window.removeEventListener('ubkt_kho_du_lieu_updated', handleUpdate);
      window.removeEventListener('ubkt_assignments_updated', handleAssignmentsChanged);
      window.removeEventListener('ubkt_diaban_records_updated', handleDiaBanChanged);
      window.removeEventListener('ubkt_users_updated', handleUsersChanged);
      window.removeEventListener('ubkt_data_synced', handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadData]);

  return {
    list,
    setList,
    loading,
    assignments,
    usersList,
    diaBanRecords,
    loadData,
  };
}
