import React, { useState, useRef } from 'react';
import type { ChuongTrinhKtGs } from '../../types';
import {
  downloadChuongTrinhImportTemplate,
  parseAndValidateChuongTrinhFile,
  getTrangThaiLabel,
  formatDateVn,
  type ImportRowData,
} from '../../services/chuongTrinhExcelService';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Layers,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

interface ChuongTrinhImportExcelModalProps {
  isOpen: boolean;
  existingList: ChuongTrinhKtGs[];
  onClose: () => void;
  onImportSuccess: (result: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }) => void;
  onBatchImport: (
    items: any[],
    duplicateAction: 'OVERWRITE' | 'SKIP' | 'CREATE_NEW',
  ) => Promise<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
    errors: string[];
  }>;
}

export const ChuongTrinhImportExcelModal: React.FC<ChuongTrinhImportExcelModalProps> = ({
  isOpen,
  existingList,
  onClose,
  onImportSuccess,
  onBatchImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRowData[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateAction, setDuplicateAction] = useState<'OVERWRITE' | 'SKIP' | 'CREATE_NEW'>('OVERWRITE');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'VALID' | 'DUPLICATE' | 'ERROR'>('ALL');
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsParsing(true);
    setErrorMessage(null);
    setImportResult(null);

    try {
      const result = await parseAndValidateChuongTrinhFile(selected, existingList);
      setRows(result.rows);
      setValidCount(result.validRows.length);
      setInvalidCount(result.invalidRows.length);
      setDuplicateCount(result.duplicateCount);
      if (result.rows.length === 0) {
        setErrorMessage('Tệp không chứa dòng dữ liệu nào hoặc định dạng không đúng mẫu.');
      }
    } catch (err) {
      console.error('Lỗi đọc tệp Excel:', err);
      setErrorMessage(
        'Không thể phân tích tệp Excel/CSV. Vui lòng đảm bảo tệp đúng định dạng mẫu (.xlsx hoặc .csv).',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
        setErrorMessage('Chỉ chấp nhận tệp định dạng .xlsx, .xls hoặc .csv');
        return;
      }
      setFile(droppedFile);
      setIsParsing(true);
      setErrorMessage(null);
      setImportResult(null);

      try {
        const result = await parseAndValidateChuongTrinhFile(droppedFile, existingList);
        setRows(result.rows);
        setValidCount(result.validRows.length);
        setInvalidCount(result.invalidRows.length);
        setDuplicateCount(result.duplicateCount);
        if (result.rows.length === 0) {
          setErrorMessage('Tệp không chứa dòng dữ liệu nào hoặc định dạng không đúng mẫu.');
        }
      } catch (err) {
        console.error('Lỗi kéo thả tệp:', err);
        setErrorMessage('Không thể đọc tệp. Vui lòng thử lại với tệp mẫu chuẩn.');
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleExecuteImport = async () => {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Không có bản ghi hợp lệ nào để nhập.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const itemsToImport = validRows.map((r) => r.rawPayload);
      const res = await onBatchImport(itemsToImport, duplicateAction);

      if (res && res.success) {
        const summary = {
          createdCount: res.createdCount || 0,
          updatedCount: res.updatedCount || 0,
          skippedCount: res.skippedCount || 0,
        };
        setImportResult(summary);
        onImportSuccess(summary);
      } else {
        setErrorMessage(
          res?.errors?.join('\n') || 'Quá trình nhập dữ liệu gặp lỗi. Vui lòng thử lại.',
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi nhập dữ liệu vào hệ thống.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRows([]);
    setValidCount(0);
    setInvalidCount(0);
    setDuplicateCount(0);
    setErrorMessage(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Lọc hiển thị trong bảng xem trước
  const displayRows = rows.filter((r) => {
    if (filterTab === 'VALID') return r.isValid && !r.isDuplicate;
    if (filterTab === 'DUPLICATE') return r.isValid && r.isDuplicate;
    if (filterTab === 'ERROR') return !r.isValid;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Nhập Chương Trình KT-GS Năm Hàng Loạt Bằng Excel
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Hỗ trợ tệp định dạng .xlsx chuẩn và .csv (UTF-8 BOM) • Tự động kiểm tra trùng lặp & dữ liệu hợp lệ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Thông báo kết quả nhập thành công nếu vừa nhập xong */}
          {importResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-fadeIn">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-900">
                    Nhập chương trình kiểm tra, giám sát thành công!
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-emerald-800">
                    <span>
                      • Thêm mới: <strong>{importResult.createdCount}</strong> chương trình
                    </span>
                    <span>
                      • Cập nhật / Ghi đè: <strong>{importResult.updatedCount}</strong> chương trình
                    </span>
                    <span>
                      • Bỏ qua (trùng lặp): <strong>{importResult.skippedCount}</strong> chương trình
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition"
                >
                  Đóng hộp thoại
                </button>
              </div>
            </div>
          )}

          {/* Hướng dẫn & Tải file mẫu tinh gọn */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-emerald-950 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Cấu trúc tệp Excel chuẩn: Lĩnh vực & Thời gian (Từ ngày - Đến ngày)</span>
              </div>
              <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>Bắt buộc duy nhất:</strong> Cột <strong>Nội dung (*)</strong>.
                </li>
                <li>
                  <strong>Lĩnh vực kiểm tra, giám sát:</strong> Điền lĩnh vực chuyên môn (<em>Công tác xây dựng Đảng</em>, <em>Quản lý đất đai, trật tự xây dựng</em>, <em>Tài chính, ngân sách</em>...). Nếu để trống, hệ thống tự động nhận diện theo nội dung.
                </li>
                <li>
                  <strong>Thời gian Từ ngày - Đến ngày:</strong> Có thể nhập ngày chuẩn <code>01/03/2026</code> đến <code>25/03/2026</code> hoặc nhập nhanh <code>Tháng 4</code>, <code>Quý II</code> hoặc để trống.
                </li>
              </ul>
            </div>

            {/* Khối nút tải file mẫu */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Tải tệp mẫu chuẩn:</span>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  Đã điền sẵn tiêu đề cột & 4 dòng ví dụ nghiệp vụ kiểm tra, giám sát.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => downloadChuongTrinhImportTemplate('xlsx')}
                  className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                  title="Tải tệp Excel Microsoft (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải mẫu .XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadChuongTrinhImportTemplate('csv')}
                  className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                  title="Tải tệp CSV UTF-8 mở trực tiếp trong Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                  <span>Mẫu .CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Vùng kéo thả & Chọn tệp */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-emerald-100 rounded-full text-emerald-700">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Nhấp để chọn tệp hoặc kéo & thả tệp Excel vào đây
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Hỗ trợ định dạng: <strong>.xlsx, .xls, .csv</strong> (tối đa 10MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl gap-3">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 break-all">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB • {rows.length} dòng dữ liệu được phân tích
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
                >
                  Chọn tệp khác
                </button>
              </div>
            </div>
          )}

          {/* Tùy chọn xử lý khi trùng lặp dữ liệu */}
          {rows.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Quy tắc xử lý khi phát hiện chương trình đã tồn tại (Trùng lặp):</span>
                {duplicateCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                    Phát hiện {duplicateCount} dòng trùng
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label
                  className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    duplicateAction === 'OVERWRITE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="OVERWRITE"
                    checked={duplicateAction === 'OVERWRITE'}
                    onChange={() => setDuplicateAction('OVERWRITE')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold block">1. Cập nhật / Ghi đè</span>
                    <span className="text-[11px] text-slate-500">
                      Ghi đè thông tin mới vào bản ghi đã có nếu trùng số VB hoặc đối tượng & nội dung.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    duplicateAction === 'SKIP'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="SKIP"
                    checked={duplicateAction === 'SKIP'}
                    onChange={() => setDuplicateAction('SKIP')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold block">2. Bỏ qua dòng trùng</span>
                    <span className="text-[11px] text-slate-500">
                      Giữ nguyên dữ liệu cũ, chỉ nhập các chương trình mới chưa tồn tại.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition ${
                    duplicateAction === 'CREATE_NEW'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="CREATE_NEW"
                    checked={duplicateAction === 'CREATE_NEW'}
                    onChange={() => setDuplicateAction('CREATE_NEW')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold block">3. Thêm mới toàn bộ</span>
                    <span className="text-[11px] text-slate-500">
                      Không ghi đè, tạo thêm bản ghi mới độc lập (cho phép trùng lặp).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Lỗi tổng quát */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="whitespace-pre-line">{errorMessage}</span>
            </div>
          )}

          {/* Bảng xem trước dữ liệu (Preview) */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-bold text-slate-700">Xem trước dữ liệu ({rows.length} dòng):</span>
                </div>

                {/* Các nút lọc tab */}
                <div className="flex items-center space-x-1.5 text-xs bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterTab('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filterTab === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('VALID')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filterTab === 'VALID'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Hợp lệ ({validCount - duplicateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('DUPLICATE')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filterTab === 'DUPLICATE'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Trùng lặp ({duplicateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('ERROR')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      filterTab === 'ERROR'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Lỗi ({invalidCount})
                  </button>
                </div>
              </div>

              {/* Bảng Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Dòng</th>
                      <th className="py-2.5 px-3 w-24">Kiểm tra</th>
                      <th className="py-2.5 px-3 w-14 text-center">Năm</th>
                      <th className="py-2.5 px-3 w-20">Số VB</th>
                      <th className="py-2.5 px-3 w-28">Cơ quan</th>
                      <th className="py-2.5 px-3 w-20 text-center">Loại</th>
                      <th className="py-2.5 px-3 w-32">Lĩnh vực</th>
                      <th className="py-2.5 px-3 w-28">Đối tượng</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Nội dung kiểm tra, giám sát</th>
                      <th className="py-2.5 px-3 w-24 whitespace-nowrap">Từ ngày</th>
                      <th className="py-2.5 px-3 w-24 whitespace-nowrap">Đến ngày</th>
                      <th className="py-2.5 px-3 w-24">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {displayRows.map((r) => {
                      const rowBg = !r.isValid
                        ? 'bg-rose-50/60 hover:bg-rose-100/60'
                        : r.isDuplicate
                        ? 'bg-amber-50/60 hover:bg-amber-100/60'
                        : 'hover:bg-slate-50';

                      return (
                        <tr key={r.rowNumber} className={rowBg}>
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {r.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            {!r.isValid ? (
                              <div className="inline-flex items-center space-x-1 text-rose-700 font-bold text-[11px]" title={r.errors.join('; ')}>
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Lỗi ({r.errors.length})</span>
                              </div>
                            ) : r.isDuplicate ? (
                              <div className="inline-flex items-center space-x-1 text-amber-700 font-bold text-[11px]" title={r.duplicateReason}>
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Trùng lặp</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Hợp lệ</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-bold font-mono">{r.nam || '---'}</td>
                          <td className="py-2 px-3 font-semibold text-slate-600 font-mono text-[11px]">
                            {r.so_van_ban || '---'}
                          </td>
                          <td className="py-2 px-3 truncate max-w-[130px]" title={r.co_quan_ban_hanh}>
                            {r.co_quan_ban_hanh}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.loai_hinh === 'KIEM_TRA'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {r.loai_hinh === 'KIEM_TRA' ? 'Kiểm tra' : 'Giám sát'}
                            </span>
                          </td>
                          <td className="py-2 px-3 truncate max-w-[140px] text-slate-700 text-[11px]" title={r.linh_vuc}>
                            {r.linh_vuc || '---'}
                          </td>
                          <td className="py-2 px-3 font-semibold truncate max-w-[130px]" title={r.doi_tuong}>
                            {r.doi_tuong}
                          </td>
                          <td className="py-2 px-3">
                            <p className="line-clamp-2" title={r.noi_dung}>
                              {r.noi_dung}
                            </p>
                            {!r.isValid && r.errors.length > 0 && (
                              <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                                • {r.errors.join(', ')}
                              </p>
                            )}
                            {r.isDuplicate && (
                              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                                • {r.duplicateReason}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700 text-[11px]">
                            {formatDateVn(r.ngay_bat_dau) || '---'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-700 text-[11px]">
                            {formatDateVn(r.ngay_ket_thuc) || '---'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[11px] text-slate-600 font-medium">
                              {getTrangThaiLabel(r.trang_thai)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-600">
            {rows.length > 0 ? (
              <span>
                Sẵn sàng nhập <strong>{validCount}</strong> bản ghi hợp lệ{' '}
                {duplicateCount > 0 && `(trong đó ${duplicateCount} dòng sẽ theo quy tắc xử lý trùng)`}
              </span>
            ) : (
              <span>Vui lòng chọn tệp Excel hoặc CSV để bắt đầu</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={validCount === 0 || isImporting || isParsing}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang nhập dữ liệu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận nhập ({validCount} dòng)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
