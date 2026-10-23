import React from 'react';

interface RemediationGaugeChartProps {
  percent: number;
  daHoanThanh: number;
  conPhaiThucHien: number;
  daQuaHan: number;
  tongKienNghi: number;
  hasData: boolean;
}

export const RemediationGaugeChart: React.FC<RemediationGaugeChartProps> = ({
  percent,
  daHoanThanh,
  conPhaiThucHien,
  daQuaHan,
  tongKienNghi,
  hasData,
}) => {
  const gaugeR = 48;
  const gaugeCircumference = 2 * Math.PI * gaugeR;
  const safePercent = Math.min(100, Math.max(0, isNaN(percent) ? 0 : percent));
  const khacPhucOffset = gaugeCircumference * (1 - safePercent / 100);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4.5 flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
          KẾT QUẢ KHẮC PHỤC KIẾN NGHỊ
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5 font-normal">
          Tiến độ thực hiện kết luận & khắc phục tồn tại
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 my-2">
        {/* Progress Ring Gauge */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width="130" height="130" viewBox="0 0 130 130">
            {/* Background ring */}
            <circle
              cx="65"
              cy="65"
              r={gaugeR}
              stroke="#e2e8f0"
              strokeWidth="11"
              fill="none"
            />
            {/* Active arc */}
            <circle
              cx="65"
              cy="65"
              r={gaugeR}
              stroke="#10b981"
              strokeWidth="11"
              fill="none"
              strokeDasharray={gaugeCircumference}
              strokeDashoffset={khacPhucOffset}
              strokeLinecap="round"
              transform="rotate(-90 65 65)"
              className="transition-all duration-500 ease-out"
            />
            {/* Center text */}
            <text
              x="65"
              y="59"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="21"
              fontWeight="800"
              fill="#0f172a"
            >
              {safePercent}%
            </text>
            <text
              x="65"
              y="77"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="500"
              fill="#64748b"
            >
              Hoàn thành
            </text>
          </svg>
        </div>

        {/* Legend details */}
        <div className="space-y-2 text-xs flex-1 pl-2">
          <div>
            <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
              <span>Đã hoàn thành</span>
            </div>
            <p className="text-slate-900 font-bold text-xs pl-3.5 mt-0.5">
              • {daHoanThanh} nội dung
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <span>Còn phải thực hiện</span>
            </div>
            <p className="text-slate-900 font-bold text-xs pl-3.5 mt-0.5">
              • {conPhaiThucHien} nội dung
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-red-500 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span>Đã quá hạn</span>
            </div>
            <p className="text-red-600 font-bold text-xs pl-3.5 mt-0.5">
              • {daQuaHan} nội dung
            </p>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-[10.5px] text-slate-400 leading-relaxed font-normal pt-2 border-t border-slate-50">
        {!hasData
          ? 'Chưa phát sinh kiến nghị hoặc điều chỉnh trong kỳ này.'
          : `Tổng số ${tongKienNghi} nội dung kiến nghị, điều chỉnh cần theo dõi.`}
      </p>
    </div>
  );
};
