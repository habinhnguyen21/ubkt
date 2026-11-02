export {
  STORAGE_DELETED_DON_VI_IDS,
  STORAGE_DELETED_CHUONG_TRINH_IDS,
  STORAGE_DELETED_DIABAN_IDS,
  STORAGE_DELETED_PDF_IDS,
  STORAGE_DELETED_PDF_NAMES,
  getDeletedDonViIds,
  saveDeletedDonViId,
  getDeletedDiaBanIds,
  saveDeletedDiaBanId,
  getDeletedChuongTrinhIds,
  saveDeletedChuongTrinhId,
  getDeletedPdfIds,
  saveDeletedPdfId,
  getDeletedPdfNames,
  saveDeletedPdfName,
  ensureFirestoreSynced,
} from './api/core';

import { authApi } from './api/authApi';
import { donviApi } from './api/donviApi';
import { chuongtrinhApi } from './api/chuongtrinhApi';
import { diabanApi } from './api/diabanApi';
import { pdfApi } from './api/pdfApi';
import { donthuApi } from './api/donthuApi';

export const api = {
  ...authApi,
  ...donviApi,
  ...chuongtrinhApi,
  ...pdfApi,
  ...diabanApi,
  ...donthuApi,
};
