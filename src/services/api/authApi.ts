import type { User, PhanCongDiaBan, DiaBanRecord, NhatKy } from '../../types';
import { centralDataService } from '../centralDataService';
import { deriveAllOfficerFields } from '../../utils/diaBanSync';
import {
  auth,
  db as firestoreDb,
  functions,
  IS_CLOUD_FUNCTIONS_ENABLED,
  getSecondaryAuth,
  usernameToAuthEmail,
} from '../firebase';
import { httpsCallable } from 'firebase/functions';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  verifyPasswordClient,
  INITIAL_SEED_ADMIN_HASH,
  sanitizeUserForCloud,
  stripSecretsFromUser,
  validatePasswordPolicy,
} from '../../utils/passwordCrypto';
import { mockInvoke, registerMockCommands, requestApi, saveMockDb } from './core';

registerMockCommands({
  login: async (db, args) => {
    const { req } = args as { req: { ten_dang_nhap: string; mat_khau: string; ghi_nho?: boolean } };
    const normalizedU = (req.ten_dang_nhap || '').trim().toLowerCase();
    if (!normalizedU || !req.mat_khau) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (typeof window !== 'undefined') {
      try {
        const persistence = req.ghi_nho ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
      } catch (pErr) {
        console.warn('[Auth] Không thể thiết lập persistence cho Firebase Auth:', pErr);
      }
    }

    const authEmail = usernameToAuthEmail(normalizedU);
    const legacyUser = db.users.find(
      (u) => u.ten_dang_nhap.toLowerCase() === normalizedU
    ) as (User & { mat_khau?: string; mat_khau_hash?: string }) | undefined;

    if (legacyUser && legacyUser.trang_thai === 0) {
      throw new Error('Tài khoản đang bị tạm khóa. Vui lòng liên hệ Quản trị viên');
    }

    let firebaseUser = null;

    try {
      const cred = await signInWithEmailAndPassword(auth, authEmail, req.mat_khau);
      firebaseUser = cred.user;
    } catch (authErr: any) {
      const code = authErr?.code || '';
      const isNotFoundOrInvalid =
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials';

      if (isNotFoundOrInvalid && legacyUser) {
        let isLegacyValid = false;
        if (legacyUser.mat_khau_hash) {
          isLegacyValid = await verifyPasswordClient(req.mat_khau, legacyUser.mat_khau_hash);
        }
        if (!isLegacyValid && legacyUser.mat_khau) {
          const legacyVal = String(legacyUser.mat_khau);
          if (
            legacyVal.startsWith('$2a$') ||
            legacyVal.startsWith('$2b$') ||
            legacyVal.startsWith('$2y$') ||
            legacyVal.startsWith('pbkdf2$')
          ) {
            isLegacyValid = await verifyPasswordClient(req.mat_khau, legacyVal);
          } else if (legacyVal === req.mat_khau) {
            isLegacyValid = true;
          }
        }
        if (
          !isLegacyValid &&
          legacyUser.ten_dang_nhap.toLowerCase() === 'admin' &&
          legacyUser.must_change_password &&
          !legacyUser.mat_khau_hash &&
          !legacyUser.mat_khau
        ) {
          isLegacyValid = await verifyPasswordClient(req.mat_khau, INITIAL_SEED_ADMIN_HASH);
        }

        if (isLegacyValid) {
          try {
            const createdCred = await createUserWithEmailAndPassword(
              auth,
              authEmail,
              req.mat_khau
            );
            firebaseUser = createdCred.user;
          } catch {
            throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
          }
        }
      }

      if (!firebaseUser) {
        if (code === 'auth/too-many-requests') {
          throw new Error(
            'Tài khoản này đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.'
          );
        }
        throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
      }
    }

    const uid = firebaseUser.uid;
    const now = new Date().toISOString();

    let userProfile: User | null = null;
    try {
      const userDocSnap = await getDoc(doc(firestoreDb, 'users', uid));
      if (userDocSnap.exists()) {
        userProfile = sanitizeUserForCloud({
          ...(userDocSnap.data() as User),
          id: uid,
        }) as User;
      }
    } catch (readErr) {
      console.warn('[Auth] Không thể đọc trực tiếp users/{uid}, kiểm tra dữ liệu di trú:', readErr);
    }

    if (!userProfile) {
      const oldId = legacyUser?.id;
      userProfile = {
        id: uid,
        ten_dang_nhap: legacyUser?.ten_dang_nhap || normalizedU,
        ho_ten:
          legacyUser?.ho_ten ||
          (normalizedU === 'admin' ? 'Quản trị viên Hệ thống' : normalizedU),
        vai_tro: legacyUser?.vai_tro || (normalizedU === 'admin' ? 'ADMIN' : 'BIEN_TAP'),
        chuc_danh:
          legacyUser?.chuc_danh ||
          (normalizedU === 'admin' ? 'Chủ nhiệm UBKT' : 'Chuyên viên UBKT'),
        trang_thai: legacyUser?.trang_thai ?? 1,
        must_change_password: legacyUser?.must_change_password ?? false,
        created_at: legacyUser?.created_at || now,
        updated_at: now,
      };

      try {
        await setDoc(doc(firestoreDb, 'users', uid), sanitizeUserForCloud(userProfile));
        if (oldId && oldId !== uid) {
          const oldPcSnap = await getDoc(doc(firestoreDb, 'phan_cong_dia_ban', oldId)).catch(
            () => null
          );
          if (oldPcSnap && oldPcSnap.exists()) {
            const pcData = oldPcSnap.data();
            await setDoc(doc(firestoreDb, 'phan_cong_dia_ban', uid), {
              ...pcData,
              id: uid,
              user_id: uid,
              updated_at: now,
            }).catch(() => {});
            await deleteDoc(doc(firestoreDb, 'phan_cong_dia_ban', oldId)).catch(() => {});
          }
          await deleteDoc(doc(firestoreDb, 'users', oldId)).catch(() => {});
        }
      } catch (migErr) {
        console.warn('[Auth] Lưu hồ sơ di trú users/{uid}:', migErr);
      }
    }

    if (userProfile.trang_thai === 0) {
      await signOut(auth).catch(() => {});
      throw new Error('Tài khoản đang bị tạm khóa. Vui lòng liên hệ Quản trị viên');
    }

    const cleanProfile = stripSecretsFromUser(userProfile) as User;
    const existingIdx = db.users.findIndex(
      (u) => u.id === uid || u.ten_dang_nhap.toLowerCase() === normalizedU
    );
    if (existingIdx !== -1) {
      db.users[existingIdx] = cleanProfile;
    } else {
      db.users.push(cleanProfile);
    }
    saveMockDb(db);

    const idToken = await firebaseUser.getIdToken();

    return {
      user: cleanProfile,
      token: idToken,
    };
  },

  change_password: async (db, args) => {
    const { req } = args as { req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string } };
    const policyError = validatePasswordPolicy(req.mat_khau_moi);
    if (policyError) {
      throw new Error(policyError);
    }

    const currentAuthUser = auth.currentUser;
    if (!currentAuthUser || !currentAuthUser.email) {
      throw new Error('Phiên đăng nhập Firebase Auth không hợp lệ. Vui lòng đăng nhập lại.');
    }

    try {
      const credential = EmailAuthProvider.credential(currentAuthUser.email, req.mat_khau_cu);
      await reauthenticateWithCredential(currentAuthUser, credential);
    } catch {
      throw new Error('Mật khẩu hiện tại không chính xác');
    }

    await updatePassword(currentAuthUser, req.mat_khau_moi);

    const targetUid = currentAuthUser.uid;
    const user = db.users.find((u) => u.id === targetUid || u.id === req.user_id);
    if (user) {
      delete (user as any).mat_khau;
      delete (user as any).mat_khau_hash;
      user.must_change_password = false;
      user.updated_at = new Date().toISOString();
      saveMockDb(db);
      await centralDataService
        .saveDoc('users', user.id, sanitizeUserForCloud(user))
        .catch(() => {});
    }
    return undefined;
  },

  get_current_user: async (db) => {
    return stripSecretsFromUser(db.users[0]);
  },

  get_all_users: async (db) => {
    return db.users.map((u) => stripSecretsFromUser(u));
  },

  create_user: async (db, args) => {
    const { req } = args as {
      req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string };
    };
    const createPolicyErr = validatePasswordPolicy(req.mat_khau);
    if (createPolicyErr) {
      throw new Error(createPolicyErr);
    }
    const normalizedU = req.ten_dang_nhap.trim().toLowerCase();
    const exists = db.users.some((u) => u.ten_dang_nhap.toLowerCase() === normalizedU);
    if (exists) throw new Error('Tên đăng nhập đã tồn tại');

    if (IS_CLOUD_FUNCTIONS_ENABLED) {
      try {
        const createFn = httpsCallable<typeof req, { success: boolean; user: User }>(
          functions,
          'adminCreateUser'
        );
        const res = await createFn({
          ...req,
          ten_dang_nhap: normalizedU,
        });
        const createdUser = stripSecretsFromUser(res.data.user);
        db.users.push(createdUser);
        saveMockDb(db);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ubkt_users_updated', { detail: createdUser }));
        }
        return createdUser;
      } catch (fnErr: any) {
        throw new Error(fnErr?.message || 'Lỗi khi gọi Cloud Function adminCreateUser.');
      }
    }

    const secondaryAuth = getSecondaryAuth();
    const authEmail = usernameToAuthEmail(normalizedU);
    let newUid = '';
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, req.mat_khau);
      newUid = cred.user.uid;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('Tên đăng nhập này đã tồn tại trên Firebase Authentication.');
      }
      throw new Error(err?.message || 'Lỗi khi tạo tài khoản trên Firebase Authentication');
    } finally {
      await signOut(secondaryAuth).catch(() => {});
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: newUid,
      ten_dang_nhap: req.ten_dang_nhap.trim(),
      ho_ten: req.ho_ten.trim(),
      vai_tro: req.vai_tro as User['vai_tro'],
      chuc_danh: req.chuc_danh || 'Chuyên viên UBKT',
      trang_thai: 1,
      must_change_password: true,
      created_at: now,
      updated_at: now,
    };
    db.users.push(newUser);
    saveMockDb(db);
    await centralDataService.saveDoc('users', newUser.id, sanitizeUserForCloud(newUser));
    const cleanUser = stripSecretsFromUser(newUser);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_users_updated', { detail: cleanUser }));
    }
    return cleanUser;
  },

  reset_user_password: async (db, args) => {
    const { req } = args as { req: { user_id: string; mat_khau_moi: string } };
    const resetPolicyErr = validatePasswordPolicy(req.mat_khau_moi);
    if (resetPolicyErr) {
      throw new Error(resetPolicyErr);
    }
    const user = db.users.find((u) => u.id === req.user_id) as
      | (User & { mat_khau?: string; mat_khau_hash?: string })
      | undefined;
    if (!user) throw new Error('Người dùng không tồn tại');

    if (!IS_CLOUD_FUNCTIONS_ENABLED) {
      throw new Error(
        'Dự án đang dùng gói Firebase Spark (miễn phí) nên chưa triển khai Cloud Functions (adminResetPassword). Vui lòng thực hiện đổi/đặt lại mật khẩu trực tiếp trong Firebase Console -> Authentication -> Users.'
      );
    }

    try {
      const resetPasswordFn = httpsCallable<
        { uid: string; password: string },
        { success: boolean; uid: string; must_change_password: boolean; updated_at: string }
      >(functions, 'adminResetPassword');

      const result = await resetPasswordFn({
        uid: req.user_id,
        password: req.mat_khau_moi,
      });

      if (!result.data?.success) {
        throw new Error('Cloud Function adminResetPassword không trả về trạng thái thành công.');
      }
    } catch (fnErr: any) {
      const detail = fnErr?.message || String(fnErr);
      throw new Error(
        `Không thể đặt lại mật khẩu trên Firebase Authentication (adminResetPassword): ${detail}`
      );
    }

    user.must_change_password = true;
    delete user.mat_khau;
    delete user.mat_khau_hash;
    user.updated_at = new Date().toISOString();
    saveMockDb(db);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
    }
    return undefined;
  },

  update_user: async (db, args) => {
    const { req } = args as {
      req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string };
    };
    const user = db.users.find((u) => u.id === req.user_id) as
      | (User & { mat_khau?: string; mat_khau_hash?: string })
      | undefined;
    if (!user) throw new Error('Người dùng không tồn tại');
    user.ho_ten = req.ho_ten;
    user.vai_tro = req.vai_tro as User['vai_tro'];
    user.trang_thai = req.trang_thai;
    if (req.chuc_danh !== undefined) {
      user.chuc_danh = req.chuc_danh;
    }
    delete user.mat_khau;
    user.updated_at = new Date().toISOString();
    saveMockDb(db);
    await centralDataService.saveDoc('users', user.id, sanitizeUserForCloud(user));

    // Nếu tài khoản bị khóa (trang_thai === 0), đồng bộ hồ sơ địa bàn đưa các đơn vị về "Chưa phân công"
    if (req.trang_thai === 0) {
      const rawPc = typeof localStorage !== 'undefined' ? localStorage.getItem('ubkt_phan_cong_dia_ban') : null;
      const pcList: PhanCongDiaBan[] = rawPc ? JSON.parse(rawPc) : (db.phanCongDiaBan || []);
      const rawRecords = typeof localStorage !== 'undefined' ? localStorage.getItem('ubkt_ho_so_dia_ban_records') : null;
      const records: DiaBanRecord[] = rawRecords
        ? JSON.parse(rawRecords)
        : centralDataService.getHoSoDiaBanRecords();
      const updatedRecords = deriveAllOfficerFields(records, pcList, db.users, {
        usersComplete: true,
      });
      if (updatedRecords !== records) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(updatedRecords));
        }
        for (const r of updatedRecords) {
          const oldR = records.find((x) => x.id === r.id);
          if (oldR !== r) {
            await centralDataService.saveBackgroundDiaBanRecord(r.id, r, [
              'can_bo_phu_trach_id',
              'can_bo_phu_trach_ids',
              'can_bo_phu_trach_ten',
              'can_bo_chuc_vu',
              'thoi_gian_phan_cong',
              'lich_su_phu_trach',
            ]);
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated', { detail: updatedRecords }));
          window.dispatchEvent(new CustomEvent('ubkt_assignments_updated', { detail: pcList }));
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
    }
    return undefined;
  },

  delete_user: async (db, args) => {
    const { user_id, actor_id, actor_name } = args as {
      user_id: string;
      actor_id?: string;
      actor_name?: string;
    };
    const deletedUser = db.users.find((u) => u.id === user_id);
    db.users = db.users.filter((u) => u.id !== user_id);
    saveMockDb(db);
    await centralDataService.deleteDoc('users', user_id, actor_name);

    // 1. Xóa bản phân công của người đó (cả localStorage và Firestore)
    const rawPc = typeof localStorage !== 'undefined' ? localStorage.getItem('ubkt_phan_cong_dia_ban') : null;
    let pcList: PhanCongDiaBan[] = rawPc ? JSON.parse(rawPc) : (db.phanCongDiaBan || []);
    const userAssignment = pcList.find((p) => p.user_id === user_id);
    const affectedUnitIds = userAssignment?.don_vi_ids || [];

    pcList = pcList.filter((p) => p.user_id !== user_id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ubkt_phan_cong_dia_ban', JSON.stringify(pcList));
    }
    db.phanCongDiaBan = pcList;
    await centralDataService.deleteDoc('phan_cong_dia_ban', user_id, actor_name);

    // 2. Cập nhật hồ sơ địa bàn bằng deriveAllOfficerFields rồi lưu những hồ sơ thay đổi
    const rawRecords = typeof localStorage !== 'undefined' ? localStorage.getItem('ubkt_ho_so_dia_ban_records') : null;
    let records: DiaBanRecord[] = rawRecords
      ? JSON.parse(rawRecords)
      : centralDataService.getHoSoDiaBanRecords();
    const updatedRecords = deriveAllOfficerFields(records, pcList, db.users, {
      usersComplete: true,
    });
    if (updatedRecords !== records) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ubkt_ho_so_dia_ban_records', JSON.stringify(updatedRecords));
      }
      for (const r of updatedRecords) {
        const oldR = records.find((x) => x.id === r.id);
        if (oldR !== r) {
          await centralDataService.saveBackgroundDiaBanRecord(r.id, r, [
            'can_bo_phu_trach_id',
            'can_bo_phu_trach_ids',
            'can_bo_phu_trach_ten',
            'can_bo_chuc_vu',
            'thoi_gian_phan_cong',
            'lich_su_phu_trach',
          ]);
        }
      }
    }

    // 3. Ghi audit log
    const affectedUnitNames = affectedUnitIds
      .map((id) => (db.donViList || []).find((d) => d.id === id)?.ten || id)
      .join(', ');
    const logItem: NhatKy = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nguoi_dung_id: actor_id || null,
      ten_nguoi_dung: actor_name || 'Quản trị viên',
      hanh_dong: `Xóa tài khoản cán bộ "${deletedUser?.ho_ten || user_id}" (@${deletedUser?.ten_dang_nhap || ''}). ${
        affectedUnitIds.length > 0
          ? `Đã xóa phân công và chuyển ${affectedUnitIds.length} đơn vị về Chưa phân công: ${affectedUnitNames}`
          : 'Cán bộ không có đơn vị phân công'
      }`,
      bang_anh_huong: 'users',
      ban_ghi_id: user_id,
      du_lieu_cu: deletedUser ? JSON.stringify(deletedUser) : null,
      du_lieu_moi: null,
      thoi_gian: new Date().toISOString(),
    };
    db.auditLogs = db.auditLogs || [];
    db.auditLogs.unshift(logItem);
    saveMockDb(db);
    centralDataService.saveDoc('audit_logs', logItem.id, logItem).catch(() => {});

    // 4. Bắn các sự kiện đồng bộ
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_assignments_updated', { detail: pcList }));
      window.dispatchEvent(new CustomEvent('ubkt_diaban_records_updated', { detail: updatedRecords }));
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
    }
    return undefined;
  },
});

export const authApi = {
  login: (req: { ten_dang_nhap: string; mat_khau: string; ghi_nho?: boolean }) =>
    mockInvoke<{ user: User; token: string }>('login', { req }),

  logout: async () => {
    await signOut(auth).catch(() => {});
  },

  changePassword: (req: { user_id: string; mat_khau_cu: string; mat_khau_moi: string }) =>
    mockInvoke<void>('change_password', { req }),

  getCurrentUser: (user_id: string) =>
    requestApi<User>(`/api/current-user/${user_id}`, 'GET', undefined, 'get_current_user', {
      user_id,
    }),

  getAllUsers: () => mockInvoke<User[]>('get_all_users'),

  createUser: (
    req: { ten_dang_nhap: string; ho_ten: string; mat_khau: string; vai_tro: string; chuc_danh?: string },
    actor_id: string,
    actor_name: string
  ) => mockInvoke<User>('create_user', { req, actor_id, actor_name }),

  resetUserPassword: (
    req: { user_id: string; mat_khau_moi: string },
    actor_id: string,
    actor_name: string
  ) => mockInvoke<void>('reset_user_password', { req, actor_id, actor_name }),

  updateUser: (
    req: { user_id: string; ho_ten: string; vai_tro: string; trang_thai: number; chuc_danh?: string },
    actor_id: string,
    actor_name: string
  ) => mockInvoke<void>('update_user', { req, actor_id, actor_name }),

  deleteUser: (user_id: string, actor_id: string, actor_name: string) =>
    mockInvoke<void>('delete_user', { user_id, actor_id, actor_name }),
};

