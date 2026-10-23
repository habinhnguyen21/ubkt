/**
 * Dịch vụ kết nối Google Drive qua Google Apps Script Web App
 * Dành cho Hệ thống Giám sát & Quản lý UBKT Đảng ủy
 */

export interface GoogleDriveConfig {
  scriptUrl: string;
  folderId?: string;
  autoUpload: boolean;
}

export interface GoogleDriveUploadResponse {
  success: boolean;
  fileId?: string;
  filename?: string;
  fileUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  folderName?: string;
  error?: string;
}

const STORAGE_GDRIVE_CONFIG = 'ubkt_gdrive_config';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ UBKT ĐẢNG ỦY
 * Hỗ trợ nhận tệp từ website, lưu trữ và tự động xóa tệp trên Google Drive
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── 1. CHỨC NĂNG TỰ ĐỘNG XÓA TỆP TRÊN GOOGLE DRIVE ──────────────
    if (data.action === 'delete') {
      var targetFileId = data.fileId;
      if (!targetFileId || targetFileId.trim() === '') {
        throw new Error('Thiếu ID tệp Google Drive để xóa');
      }

      try {
        var fileToDelete = DriveApp.getFileById(targetFileId.trim());
        // Chuyển tệp vào Thùng rác (Trash) trên Google Drive an toàn
        fileToDelete.setTrashed(true);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          action: 'delete',
          fileId: targetFileId,
          message: 'Đã đưa tệp vào Thùng rác trên Google Drive thành công'
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (delErr) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          action: 'delete',
          error: 'Không tìm thấy tệp hoặc lỗi khi xóa: ' + delErr.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── 2. CHỨC NĂNG TẢI TỆP LÊN GOOGLE DRIVE ───────────────────────
    var filename = data.filename || ('tai_lieu_ubkt_' + new Date().getTime());
    var mimeType = data.mimeType || 'application/octet-stream';
    var base64Data = data.base64Data;
    var folderId = data.folderId;

    if (!base64Data) {
      throw new Error('Dữ liệu tệp tải lên bị rỗng');
    }

    // Tìm hoặc tạo thư mục trên Google Drive
    var folder;
    if (folderId && folderId.trim() !== '') {
      try {
        folder = DriveApp.getFolderById(folderId.trim());
      } catch (err) {
        folder = null;
      }
    }

    if (!folder) {
      var folderName = 'KHO_DU_LIEU_UBKT';
      var folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    }

    // Tách base64 data nếu có tiền tố data:...;base64,
    var cleanBase64 = base64Data;
    if (base64Data.indexOf('base64,') !== -1) {
      cleanBase64 = base64Data.split('base64,')[1];
    }

    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);
    var file = folder.createFile(blob);

    // Bật quyền xem với người có liên kết để xem trước trực tiếp trên web
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Bỏ qua nếu tài khoản tổ chức hạn chế chia sẻ công khai
    }

    var fileId = file.getId();
    var fileUrl = file.getUrl();
    var previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

    var output = {
      success: true,
      fileId: fileId,
      filename: filename,
      fileUrl: fileUrl,
      previewUrl: previewUrl,
      downloadUrl: downloadUrl,
      folderName: folder.getName()
    };

    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    var errorOutput = {
      success: false,
      error: error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorOutput))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Hỗ trợ kiểm tra kết nối từ website
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'connected',
    service: 'UBKT Google Drive Bridge (Hỗ trợ Tải lên & Xóa tự động)'
  })).setMimeType(ContentService.MimeType.JSON);
}
`;

export const getGoogleDriveConfig = (): GoogleDriveConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_GDRIVE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        scriptUrl: parsed.scriptUrl || '',
        folderId: parsed.folderId || '',
        autoUpload: parsed.autoUpload ?? true,
      };
    }
  } catch {
    // ignore
  }
  return {
    scriptUrl: '',
    folderId: '',
    autoUpload: true,
  };
};

export const saveGoogleDriveConfig = (config: GoogleDriveConfig) => {
  localStorage.setItem(STORAGE_GDRIVE_CONFIG, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('ubkt_gdrive_config_updated', { detail: config }));
};

export const isGoogleDriveConfigured = (): boolean => {
  const cfg = getGoogleDriveConfig();
  return Boolean(cfg.scriptUrl && cfg.scriptUrl.startsWith('https://script.google.com'));
};

/**
 * Tải tệp lên Google Drive qua Apps Script Web App
 */
export const uploadFileToGoogleDrive = async (
  file: File,
  folderIdOverride?: string
): Promise<GoogleDriveUploadResponse> => {
  const config = getGoogleDriveConfig();
  if (!config.scriptUrl) {
    throw new Error('Chưa cấu hình URL Google Apps Script Web App');
  }

  // Đọc file sang Base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
  reader.readAsDataURL(file);
  const base64Data = await base64Promise;

  const payload = {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data,
    folderId: folderIdOverride || config.folderId || '',
  };

  const response = await fetch(config.scriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script trả về mã lỗi HTTP: ${response.status}`);
  }

  const result: GoogleDriveUploadResponse = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Có lỗi xảy ra khi lưu tệp vào Google Drive');
  }

  return result;
};

/**
 * Kiểm tra kết nối tới URL Google Apps Script
 */
export const testGoogleDriveConnection = async (url: string): Promise<boolean> => {
  if (!url || !url.startsWith('https://script.google.com')) {
    throw new Error('URL Google Apps Script phải bắt đầu bằng https://script.google.com');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Không thể kết nối tới Google Apps Script Web App`);
  }

  const data = await response.json();
  return Boolean(data.success || data.status === 'connected');
};

/**
 * Trích xuất Google Drive File ID từ nhiều định dạng URL khác nhau
 */
export const extractGoogleDriveFileId = (url?: string | null): string | null => {
  if (!url) return null;
  const str = url.trim();

  // Dạng /file/d/{id}/...
  const matchFileD = str.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  // Dạng ?id={id} hoặc &id={id}
  const matchIdParam = str.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchIdParam && matchIdParam[1]) return matchIdParam[1];

  // Nếu chính là fileId (chuỗi không chứa slash hay dấu chấm và độ dài >= 25)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str)) {
    return str;
  }

  return null;
};

export interface GoogleDriveDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Gửi lệnh tự động xóa tệp (đưa vào thùng rác) trên Google Drive
 */
export const deleteFileFromGoogleDrive = async (
  fileIdOrUrl: string
): Promise<GoogleDriveDeleteResponse> => {
  const config = getGoogleDriveConfig();
  if (!config.scriptUrl) {
    return { success: false, error: 'Chưa cấu hình Google Apps Script' };
  }

  const targetFileId = extractGoogleDriveFileId(fileIdOrUrl) || fileIdOrUrl;
  if (!targetFileId) {
    return { success: false, error: 'Không xác định được ID tệp Google Drive' };
  }

  try {
    const payload = {
      action: 'delete',
      fileId: targetFileId,
    };

    const response = await fetch(config.scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Máy chủ Google trả về mã lỗi HTTP: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: Boolean(result.success),
      message: result.message || 'Đã đưa tệp vào thùng rác Google Drive',
      error: result.error,
    };
  } catch (err: any) {
    console.warn('Lỗi khi gửi yêu cầu xóa tệp lên Google Drive:', err);
    return {
      success: false,
      error: err.message || String(err),
    };
  }
};

