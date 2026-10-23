import React from 'react';
import type { StatusSlice } from '../../services/dashboardStats';

interface TaskStatusDonutChartProps {
  total: number;
  slices: StatusSlice[];
  onSliceClick?: (sliceKey: string) => void;
}

export const TaskStatusDonutChart: React.FC<TaskStatusDonutChartProps> = ({
  total,
  slices,
  onSliceClick,
}) => {
  const cx = 80;
  const cy = 80;
  const rIn = 48;
  const rOut = 70;
  const rMid = (rIn + rOut) / 2;

  // Xử lý góc xoay và cung tròn
  let currentAngle = -40;
  const renderedSlices = slices
    .filter((s) => s.percent > 0)
    .map((slice) => {
      const sweepAngle = (slice.percent / 100) * 360;
      const gap = slices.filter((s) => s.percent > 0).length > 1 ? 1.8 : 0;
      const a1 = ((currentAngle + gap / 2) * Math.PI) / 180;
      const a2 = ((currentAngle + sweepAngle - gap / 2) * Math.PI) / 180;
      const aMid = ((currentAngle + sweepAngle / 2) * Math.PI) / 180;

      const xOut1 = cx + rOut * Math.cos(a1);
      const yOut1 = cy + rOut * Math.sin(a1);
      const xOut2 = cx + rOut * Math.cos(a2);
      const yOut2 = cy + rOut * Math.sin(a2);

      const xIn1 = cx + rIn * Math.cos(a1);
      const yIn1 = cy + rIn * Math.sin(a1);
      const xIn2 = cx + rIn * Math.cos(a2);
      const yIn2 = cy + rIn * Math.sin(a2);

      const largeArc = sweepAngle > 180 ? 1 : 0;
      const pathData = `M ${xOut1} ${yOut1} A ${rOut} ${rOut} 0 ${largeArc} 1 ${xOut2} ${yOut2} L ${xIn2} ${yIn2} A ${rIn} ${rIn} 0 ${largeArc} 0 ${xIn1} ${yIn1} Z`;

      const labelX = cx + rMid * Math.cos(aMid);
      const labelY = cy + rMid * Math.sin(aMid);

      currentAngle += sweepAngle;

      return {
        ...slice,
        pathData,
        labelX,
        labelY,
      };
    });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4.5 flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
          TÌNH HÌNH THỰC HIỆN NHIỆM VỤ
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5 font-normal">
          Phân bố theo trạng thái thực tế tại thời điểm xem
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 my-2">
        {/* SVG Donut */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width="154" height="154" viewBox="0 0 160 160" className="overflow-visible">
            {total === 0 ? (
              <circle cx="80" cy="80" r={rOut} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="2" />
            ) : (
              renderedSlices.map((slice) => (
                <g
                  key={slice.key}
                  className={onSliceClick ? 'cursor-pointer hover:opacity-90' : ''}
                  onClick={() => onSliceClick?.(slice.key)}
                >
                  <path d={slice.pathData} fill={slice.color} className="transition-all duration-300" />
                  {slice.percent >= 6 && (
                    <text
                      x={slice.labelX}
                      y={slice.labelY}
                      fill="#ffffff"
                      fontSize="9.5"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {slice.percent}%
                    </text>
                  )}
                </g>
              ))
            )}
            {/* Center Hole */}
            <circle cx="80" cy="80" r="46" fill="#ffffff" />
            <text
              x="80"
              y="74"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
              fontWeight="800"
              fill="#0f172a"
            >
              {total}
            </text>
            <text
              x="80"
              y="92"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="500"
              fill="#64748b"
            >
              nhiệm vụ
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="space-y-2 text-xs flex-1 pl-1">
          {slices.map((slice) => (
            <div
              key={slice.key}
              onClick={() => onSliceClick?.(slice.key)}
              className={`flex items-center justify-between gap-1 p-1 rounded transition ${
                onSliceClick ? 'hover:bg-slate-50 cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                <span className="text-slate-700 text-[11px] truncate">{slice.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-slate-900 text-xs mr-1">{slice.count}</span>
                <span className="text-slate-400 text-[11px]">({slice.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-50 text-[10.5px] text-slate-400">
        {total === 0 ? 'Chưa phát sinh nhiệm vụ trong kỳ lọc đã chọn' : `Tổng hợp ${total} cuộc kiểm tra, giám sát`}
      </div>
    </div>
  );
};
