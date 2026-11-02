import type { User } from '../../types';
import { centralDataService } from '../centralDataService';
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
    const { req } = args as { req: { ten_dang_nhap: string; mat_khau: string } };
    const normalizedU = (req.ten_dang_nhap || '').trim().toLowerCase();
    if (!normalizedU || !req.mat_khau) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
    }
    return undefined;
  },

  delete_user: async (db, args) => {
    const { user_id } = args as { user_id: string };
    db.users = db.users.filter((u) => u.id !== user_id);
    saveMockDb(db);
    await centralDataService.deleteDoc('users', user_id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ubkt_users_updated'));
    }
    return undefined;
  },
});

export const authApi = {
  login: (req: { ten_dang_nhap: string; mat_khau: string }) =>
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

