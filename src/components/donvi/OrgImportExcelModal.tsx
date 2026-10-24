import React, { useState, useRef } from 'react';
import type { DonVi, LoaiHinhToChuc, User } from '../../types';
import {
  downloadUnitImportTemplate,
  parseAndValidateUnitCsv,
} from '../../services/donViService';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

interface OrgImportExcelModalProps {
  isOpen: boolean;
  allUnits: DonVi[];
  loaiHinhList: LoaiHinhToChuc[];
  currentUser: User;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
  onBatchImport: (
    items: any[],
  ) => Promise<{ success: boolean; importedCount: number; errorCount: number; errors: string[] }>;
}

export const OrgImportExcelModal: React.FC<OrgImportExcelModalProps> = ({
  isOpen,
  allUnits,
  currentUser,
  onClose,
  onImportSuccess,
  onBatchImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsParsing(true);
    setErrorMessage(null);

    try {
      const text = await selected.text();
      const result = parseAndValidateUnitCsv(text, allUnits);
      const rows: any[] = [];
      result.validItems.forEach((item, idx) => {
        rows.push({
          rowNumber: idx + 2,
          ma: item.ma,
          ten: item.ten,
          loai: item.loai,
          ma_cha: item.ma_cap_tren,
          isValid: true,
          errors: [],
          raw: item,
        });
      });
      result.errors.forEach((err) => {
        rows.push({
          rowNumber: err.line,
          ma: '',
          ten: '',
          loai: '',
          ma_cha: '',
          isValid: false,
          errors: [err.message],
        });
      });
      rows.sort((a, b) => a.rowNumber - b.rowNumber);
      setPreviewRows(rows);
      setValidCount(result.validItems.length);
      setInvalidCount(result.errors.length);
    } catch {
      setErrorMessage('Không thể đọc tệp. Vui lòng kiểm tra định dạng CSV UTF-8 hoặc tệp mẫu.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadErrors = () => {
    const errors = previewRows.filter((r) => !r.isValid);
    if (errors.length === 0) return;

    const csvContent =
      '\uFEFFDòng,Mã tổ chức,Tên tổ chức,Loại hình,Mã cấp trên,Lỗi chi tiết\r\n' +
      errors
        .map(
          (e) =>
            `${e.rowNumber},"${e.ma}","${e.ten}","${e.loai}","${e.ma_cha || ''}","${e.errors.join('; ')}"`,
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_sach_loi_nhap_lieu_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = async () => {
    const validItems = previewRows.filter((r) => r.isValid).map((r) => r.raw);
    if (validItems.length === 0) {
      setErrorMessage('Không có bản ghi hợp lệ nào để nhập.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    try {
      const res = await onBatchImport(validItems);
      if (res.success) {
        onImportSuccess(res.importedCount);
        onClose();
      } else {
        setErrorMessage(
          `Nhập hoàn tất với lỗi: ${res.errors.slice(0, 3).join(', ')}${
            res.errors.length > 3 ? '...' : ''
          }`,
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Có lỗi khi nhập dữ liệu');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/80 flex items-center justify-center text-white font-bold shadow-md">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                NHẬP DANH SÁCH TỔ CHỨC TỪ EXCEL / CSV
              </h3>
              <p className="text-xs text-emerald-200/80">
                Thêm hàng loạt tổ chức đảng trực thuộc theo mẫu chuẩn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1 & Step 2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Tải tệp mẫu Excel / CSV chuẩn
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Tệp mẫu đã bao gồm các cột định dạng chuẩn: Mã tổ chức, Tên tổ chức, Loại hình,
                  Mã cấp trên, Ngày thành lập và Ghi chú.
                </p>
              </div>

              <button
                type="button"
                onClick={downloadUnitImportTemplate}
                className="w-full py-2 px-3 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-slate-800 hover:text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Tải tệp mẫu chuẩn (.csv)</span>
              </button>
            </div>

            {/* Step 2: Upload File */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Chọn tệp dữ liệu đã điền
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Hệ thống sẽ tự động quét, kiểm tra trùng lặp mã và xác minh tính hợp lệ của quan
                  hệ phân cấp trước khi lưu.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv, text/csv, .txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isParsing
                      ? 'Đang đọc và kiểm tra tệp...'
                      : file
                      ? `Đã chọn: ${file.name}`
                      : 'Chọn tệp CSV từ máy tính...'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Khối hướng dẫn Mã cấp trên */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-2">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <span>💡</span>
              <span>Cột "Mã cấp trên" trong tệp Excel lấy ở đâu?</span>
            </div>
            <div className="text-slate-700 leading-relaxed text-[11px] space-y-1">
              <p>
                • <strong>Nếu là Tổ chức Đảng cấp cao nhất (Đảng bộ/Đảng ủy gốc):</strong> <u>Để trống</u> cột <em>Mã cấp trên</em>.
              </p>
              <p>
                • <strong>Nếu là Chi bộ trực thuộc cấp dưới:</strong> Điền <strong>Mã tổ chức</strong> (hoặc điền đúng <strong>Tên tổ chức</strong>) của cấp trên trực tiếp.
              </p>
            </div>
            {allUnits && allUnits.length > 0 && (
              <div className="pt-2 border-t border-blue-200/60">
                <span className="font-semibold text-blue-950 text-[11px]">Danh sách mã các tổ chức hiện có trên hệ thống để sao chép vào file Excel:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {allUnits.filter(u => !u.deleted_at).map(u => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-300 rounded-md text-[11px] text-slate-800 shadow-2xs"
                    >
                      <strong className="text-blue-700 font-mono">{u.ma || 'DU-01'}</strong>
                      <span className="text-slate-600">({u.ten})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Preview and Validation Stats */}
          {previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-slate-100 rounded-xl">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-bold text-slate-800">Kết quả kiểm tra trước khi nhập:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{validCount} hợp lệ</span>
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{invalidCount} lỗi</span>
                    </span>
                  )}
                </div>

                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải danh sách lỗi để sửa</span>
                  </button>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center">Dòng</th>
                      <th className="p-2.5 w-24">Mã</th>
                      <th className="p-2.5">Tên tổ chức</th>
                      <th className="p-2.5 w-24">Loại hình</th>
                      <th className="p-2.5 w-28">Mã cấp trên</th>
                      <th className="p-2.5">Trạng thái / Lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((r, idx) => (
                      <tr
                        key={idx}
                        className={r.isValid ? 'hover:bg-slate-50' : 'bg-red-50/40 hover:bg-red-50/70'}
                      >
                        <td className="p-2.5 text-center font-mono text-slate-500">{r.rowNumber}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{r.ma || '---'}</td>
                        <td className="p-2.5 font-medium text-slate-900">{r.ten}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.loai}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.ma_cha || '-- Gốc --'}</td>
                        <td className="p-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hợp lệ</span>
                            </span>
                          ) : (
                            <span
                              className="text-red-600 font-semibold flex items-center space-x-1"
                              title={r.errors.join('; ')}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]">{r.errors.join('; ')}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Người thực hiện: <strong>{currentUser.ho_ten}</strong>
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isImporting}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isImporting ? 'Đang nhập...' : `Xác nhận nhập ${validCount} tổ chức`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
