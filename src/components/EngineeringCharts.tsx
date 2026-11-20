"use client";

import React, { useState } from "react";
import { SegmentKey } from "@/lib/engineering";
import {
  TrendingUp,
  Layers,
  HardDrive,
  Clock,
  Sparkles,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

export interface LinePoint {
  label: string;
  periodDate: string;
  autocad: number;
  revit: number;
  om: number;
  totalOutput: number;
  hoursLogged: number;
  efficiencyRate: number;
}

export interface BarItem {
  key: SegmentKey;
  label: string;
  shortLabel: string;
  inProgress: number;
  completed: number;
  review: number;
  total: number;
  hours: number;
}

export interface DonutSlice {
  key: string;
  label: string;
  extensions: string;
  color: string;
  segmentLink: SegmentKey;
  count: number;
  sizeBytes: number;
  sizeFormatted: string;
  percentage: number;
}

const PILL_GRADIENTS = [
  { id: "pillIce", top: "#F8F6F1", bottom: "#CFCAC2" },
  { id: "pillAqua", top: "#A9EED6", bottom: "#5FC7A3" },
  { id: "pillSky", top: "#84DFC2", bottom: "#43AE8B" },
  { id: "pillDeepTeal", top: "#35B98E", bottom: "#14775C" },
  { id: "pillSteel", top: "#BDE9D8", bottom: "#74BBA2" },
  { id: "pillBlue", top: "#FFE49A", bottom: "#D8AE57" },
  { id: "pillViolet", top: "#FFC3C7", bottom: "#E18491" },
];

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(
      1
    )} ${p1.y.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number
): string {
  if (points.length === 0) return "";
  const line = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(
    1
  )} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export function OutputTrendLineChart({
  data,
  activeSegment,
}: {
  data: LinePoint[];
  activeSegment: SegmentKey;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartStyle, setChartStyle] = useState<"pills" | "line">("pills");
  const [metricMode, setMetricMode] = useState<"disciplines" | "hours">(
    "disciplines"
  );

  const width = 620;
  const height = 248;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baselineY = padTop + plotH;

  const safeData =
    data.length > 0
      ? data
      : [
          {
            label: "الحالي",
            periodDate: "",
            autocad: 12,
            revit: 9,
            om: 7,
            totalOutput: 28,
            hoursLogged: 60,
            efficiencyRate: 96,
          },
        ];

  // For the 3D Pill Columns view (matching the reference image's 7 rounded columns)
  const pillData = safeData.slice(-7);

  const maxVal = Math.max(
    10,
    ...safeData.map((d) =>
      metricMode === "hours"
        ? d.hoursLogged
        : chartStyle === "pills"
        ? d.totalOutput || d.autocad + d.revit + d.om
        : Math.max(d.autocad, d.revit, d.om, 5)
    )
  );
  const yCeiling = Math.ceil(maxVal * 1.15);

  const getX = (idx: number, total = safeData.length) => {
    if (total <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (total - 1)) * plotW;
  };

  const getY = (val: number) => {
    return baselineY - (val / yCeiling) * plotH;
  };

  const cadPoints = safeData.map((d, i) => ({ x: getX(i), y: getY(d.autocad) }));
  const rvtPoints = safeData.map((d, i) => ({ x: getX(i), y: getY(d.revit) }));
  const omPoints = safeData.map((d, i) => ({ x: getX(i), y: getY(d.om) }));
  const hrsPoints = safeData.map((d, i) => ({
    x: getX(i),
    y: getY(d.hoursLogged),
  }));

  const showCad =
    metricMode === "disciplines" &&
    (activeSegment === "all" ||
      activeSegment === "autocad" ||
      activeSegment === "parallel");
  const showRvt =
    metricMode === "disciplines" &&
    (activeSegment === "all" ||
      activeSegment === "revit" ||
      activeSegment === "parallel");
  const showOm =
    metricMode === "disciplines" &&
    (activeSegment === "all" ||
      activeSegment === "om" ||
      activeSegment === "parallel");

  const yTicks = [0, 0.33, 0.66, 1].map((t) => ({
    val: Math.round(yCeiling * t),
    y: baselineY - t * plotH,
  }));

  const activeList = chartStyle === "pills" ? pillData : safeData;
  const activePoint =
    hoveredIdx !== null && activeList[hoveredIdx]
      ? activeList[hoveredIdx]
      : null;

  return (
    <div className="clay-card relative p-5 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            مؤشر الإنتاجية واللوحات
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            إنتاج لوحات AutoCAD ونماذج Revit ومهام التشغيل عبر الزمن
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setChartStyle((s) => (s === "pills" ? "line" : "pills"))
            }
            className="clay-pill px-3 py-1.5 text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
            title="تبديل بين أعمدة 3D ومنحنى خطي"
          >
            {chartStyle === "pills" ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" />
                منحنى خطي
              </>
            ) : (
              <>
                <BarChart3 className="w-3.5 h-3.5" />
                أعمدة 3D
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setMetricMode((m) =>
                m === "disciplines" ? "hours" : "disciplines"
              )
            }
            className="clay-pill px-3 py-1.5 text-[11px] inline-flex items-center gap-1 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            {metricMode === "disciplines" ? "اللوحات ▾" : "الساعات ▾"}
          </button>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none my-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <filter id="clayBarShadow" x="-20%" y="-10%" width="140%" height="130%">
              <feDropShadow dx="2" dy="6" stdDeviation="5" floodColor="#182c3d" floodOpacity="0.28" />
            </filter>
            {PILL_GRADIENTS.map((g) => (
              <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={g.top} />
                <stop offset="100%" stopColor={g.bottom} />
              </linearGradient>
            ))}
            <linearGradient id="gradCad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22B98C" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22B98C" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradRvt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E18491" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#E18491" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradOm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D8AE57" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#D8AE57" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Subtle Gridlines & Y Labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={width - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-slate-600/15 dark:text-slate-300/10"
                strokeDasharray={i === 0 ? undefined : "4 4"}
                strokeWidth={1}
              />
              <text
                x={padLeft - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-700/80 dark:fill-slate-300/80 text-[11px] font-bold font-mono tabular-nums"
              >
                {metricMode === "hours" ? `${tick.val}h` : tick.val}
              </text>
            </g>
          ))}

          {chartStyle === "pills" ? (
            /* 3D Sculpted Pill Columns (matching the reference image's Listening Overview) */
            pillData.map((pt, idx) => {
              const slotW = plotW / pillData.length;
              const centerX = padLeft + idx * slotW + slotW / 2;
              const barW = Math.min(36, Math.max(22, slotW * 0.48));
              const rawVal =
                metricMode === "hours"
                  ? pt.hoursLogged
                  : pt.totalOutput || pt.autocad + pt.revit + pt.om;
              const barH = Math.max(24, (rawVal / yCeiling) * plotH);
              const barY = baselineY - barH;
              const grad = PILL_GRADIENTS[idx % PILL_GRADIENTS.length];
              const isHovered = hoveredIdx === idx;

              return (
                <g
                  key={pt.label + idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                >
                  {/* 3D Pill Bar */}
                  <rect
                    x={centerX - barW / 2}
                    y={isHovered ? barY - 4 : barY}
                    width={barW}
                    height={isHovered ? barH + 4 : barH}
                    rx={barW / 2}
                    fill={`url(#${grad.id})`}
                    filter="url(#clayBarShadow)"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={1.5}
                    className="chart-transition"
                  />
                  {/* Inner 3D Specular Highlight Strip */}
                  <rect
                    x={centerX - barW / 2 + 4}
                    y={(isHovered ? barY - 4 : barY) + 5}
                    width={5}
                    height={Math.max(8, barH - 14)}
                    rx={2.5}
                    fill="rgba(255,255,255,0.38)"
                    className="pointer-events-none chart-transition"
                  />
                  {/* X Label */}
                  <text
                    x={centerX}
                    y={height - 10}
                    textAnchor="middle"
                    className={`text-[11px] font-bold ${
                      isHovered
                        ? "fill-slate-950 dark:fill-white"
                        : "fill-slate-800 dark:fill-slate-300"
                    }`}
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })
          ) : metricMode === "hours" ? (
            <>
              <path
                d={buildAreaPath(hrsPoints, baselineY)}
                fill="url(#gradRvt)"
                className="chart-transition"
              />
              <path
                d={buildSmoothPath(hrsPoints)}
                fill="none"
                stroke="#D97888"
                strokeWidth={3.2}
                strokeLinecap="round"
                className="chart-transition"
              />
              {hrsPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === idx ? 6 : 3.5}
                  className="fill-[#D97888] stroke-white dark:stroke-slate-900 transition-all duration-150"
                  strokeWidth={2}
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              ))}
            </>
          ) : (
            <>
              {showOm && (
                <>
                  <path
                    d={buildAreaPath(omPoints, baselineY)}
                    fill="url(#gradOm)"
                    className="chart-transition"
                  />
                  <path
                    d={buildSmoothPath(omPoints)}
                    fill="none"
                    stroke="#C99B3F"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    className="chart-transition"
                  />
                </>
              )}
              {showRvt && (
                <>
                  <path
                    d={buildAreaPath(rvtPoints, baselineY)}
                    fill="url(#gradRvt)"
                    className="chart-transition"
                  />
                  <path
                    d={buildSmoothPath(rvtPoints)}
                    fill="none"
                    stroke="#D97888"
                    strokeWidth={2.75}
                    strokeLinecap="round"
                    className="chart-transition"
                  />
                </>
              )}
              {showCad && (
                <>
                  <path
                    d={buildAreaPath(cadPoints, baselineY)}
                    fill="url(#gradCad)"
                    className="chart-transition"
                  />
                  <path
                    d={buildSmoothPath(cadPoints)}
                    fill="none"
                    stroke="#14775C"
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    className="chart-transition"
                  />
                </>
              )}
              {safeData.map((pt, idx) => (
                <g key={idx} onMouseEnter={() => setHoveredIdx(idx)}>
                  {showCad && (
                    <circle
                      cx={cadPoints[idx].x}
                      cy={cadPoints[idx].y}
                      r={hoveredIdx === idx ? 5.5 : 3}
                      className="fill-[#14775C] stroke-white"
                      strokeWidth={2}
                    />
                  )}
                  {(idx % 2 === 0 || idx === safeData.length - 1) && (
                    <text
                      x={getX(idx)}
                      y={height - 10}
                      textAnchor="middle"
                      className="text-[11px] font-bold fill-slate-700 dark:fill-slate-300"
                    >
                      {pt.label}
                    </text>
                  )}
                  <rect
                    x={getX(idx) - plotW / (safeData.length * 2)}
                    y={padTop}
                    width={plotW / safeData.length}
                    height={plotH}
                    fill="transparent"
                  />
                </g>
              ))}
            </>
          )}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && hoveredIdx !== null && (
          <div className="pointer-events-none absolute top-2 left-3 z-20 min-w-[195px] rounded-2xl border border-white/60 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 shadow-xl text-xs">
            <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                {activePoint.label}
              </span>
              <span className="font-mono text-[11px] text-teal-700 dark:text-teal-400 font-bold">
                كفاءة {activePoint.efficiencyRate}%
              </span>
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">لوحات AutoCAD:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activePoint.autocad}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">نماذج Revit:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activePoint.revit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">مهام التشغيل O&M:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activePoint.om}</span>
              </div>
              <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">ساعات العمل:</span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {activePoint.hoursLogged}h
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkloadBarChart({
  data,
  activeSegment,
  onSelectSegment,
}: {
  data: BarItem[];
  activeSegment: SegmentKey;
  onSelectSegment: (seg: SegmentKey) => void;
}) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const width = 540;
  const height = 250;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 24;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baselineY = padTop + plotH;

  const maxTotal = Math.max(4, ...data.map((d) => d.total));
  const yCeiling = Math.ceil(maxTotal * 1.2);

  const groupWidth = data.length > 0 ? plotW / data.length : plotW;
  const barWidth = Math.min(36, Math.max(20, groupWidth * 0.44));

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: Math.round(yCeiling * t),
    y: baselineY - t * plotH,
  }));

  const hoveredItem =
    hoveredBar !== null && data[hoveredBar] ? data[hoveredBar] : null;

  return (
    <div className="clay-card relative p-5 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="clay-icon-tile inline-flex h-8 w-8 items-center justify-center bg-[#989ec3] text-slate-900">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              توزيع المهام الجارية والمكتملة حسب المسار
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            اضغط على أي عمود لتصفية الداشبورد والجدول حسب التخصص
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs mb-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-[#159a73]" />
          قيد التنفيذ
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-[#86dcbc]" />
          مكتمل ومسلّم
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e78d98]" />
          مراجعة / اعتماد
        </span>
      </div>

      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoveredBar(null)}
        >
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={width - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-slate-700/15 dark:text-slate-300/10"
                strokeDasharray={idx === 0 ? undefined : "4 4"}
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-700 dark:fill-slate-400 text-[11px] font-mono font-bold tabular-nums"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {data.map((item, idx) => {
            const centerX = padLeft + idx * groupWidth + groupWidth / 2;
            const x = centerX - barWidth / 2;

            const hCompleted = (item.completed / yCeiling) * plotH;
            const hInProgress = (item.inProgress / yCeiling) * plotH;
            const hReview = (item.review / yCeiling) * plotH;

            const yCompleted = baselineY - hCompleted;
            const yInProgress = yCompleted - hInProgress;
            const yReview = yInProgress - hReview;

            const isSelected = activeSegment === item.key;
            const isDimmed =
              activeSegment !== "all" && activeSegment !== item.key;

            return (
              <g
                key={item.key}
                className={`cursor-pointer transition-opacity duration-300 ${
                  isDimmed ? "opacity-45 hover:opacity-85" : "opacity-100"
                }`}
                onMouseEnter={() => setHoveredBar(idx)}
                onClick={() =>
                  onSelectSegment(
                    activeSegment === item.key ? "all" : item.key
                  )
                }
              >
                {hCompleted > 0 && (
                  <rect
                    x={x}
                    y={yCompleted}
                    width={barWidth}
                    height={Math.max(4, hCompleted)}
                    rx={10}
                    fill="#86DCBC"
                    className="chart-transition"
                  />
                )}
                {hInProgress > 0 && (
                  <rect
                    x={x}
                    y={yInProgress}
                    width={barWidth}
                    height={Math.max(4, hInProgress)}
                    rx={10}
                    fill="#159A73"
                    className="chart-transition"
                  />
                )}
                {hReview > 0 && (
                  <rect
                    x={x}
                    y={yReview}
                    width={barWidth}
                    height={Math.max(4, hReview)}
                    rx={10}
                    fill="#E78D98"
                    className="chart-transition"
                  />
                )}

                <text
                  x={centerX}
                  y={Math.min(yReview, yInProgress, yCompleted) - 7}
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-slate-100 text-[11px] font-mono font-extrabold tabular-nums"
                >
                  {item.total}
                </text>

                <text
                  x={centerX}
                  y={height - 12}
                  textAnchor="middle"
                  className={`text-[11px] font-extrabold ${
                    isSelected || hoveredBar === idx
                      ? "fill-[#0f7a5c] dark:fill-emerald-300"
                      : "fill-slate-800 dark:fill-slate-300"
                  }`}
                >
                  {item.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredItem && hoveredBar !== null && (
          <div className="pointer-events-none absolute top-2 left-3 z-20 min-w-[190px] rounded-2xl border border-white/60 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 shadow-xl text-xs">
            <div className="font-extrabold text-slate-900 dark:text-slate-100 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">
              {hoveredItem.label}
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-teal-800 dark:text-teal-300">قيد التنفيذ:</span>
                <span className="font-bold">{hoveredItem.inProgress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-700 dark:text-sky-300">مكتمل ومسلّم:</span>
                <span className="font-bold">{hoveredItem.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-700 dark:text-indigo-300">مراجعة واعتماد:</span>
                <span className="font-bold">{hoveredItem.review}</span>
              </div>
              <div className="flex justify-between pt-1 mt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">ساعات المسار:</span>
                <span className="font-mono font-bold">{hoveredItem.hours}h</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CLAY_DONUT_COLORS = [
  "#28B98D", // Styleguide mint primary
  "#8ADDBF", // Soft mint
  "#E78D98", // Blush pink
  "#C9C5BC", // Warm stone grey
  "#F2CF7E", // Butter yellow
];

export function VaultFormatDonutChart({
  data,
  barSeries,
  totalFiles,
  totalSizeFormatted,
  activeSegment,
  onSelectSegment,
}: {
  data: DonutSlice[];
  barSeries?: BarItem[];
  totalFiles: number;
  totalSizeFormatted: string;
  activeSegment: SegmentKey;
  onSelectSegment: (seg: SegmentKey) => void;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [donutMode, setDonutMode] = useState<"disciplines" | "files">(
    "disciplines"
  );

  const size = 200;
  const strokeWidth = 34;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Build rich multi-slice distribution from disciplines or files so it always
  // looks full and sculpted like "Top Genres" in the reference artwork.
  const disciplineSlices: DonutSlice[] =
    barSeries && barSeries.length > 0
      ? (() => {
          const sum = Math.max(
            1,
            barSeries.reduce((acc, b) => acc + Math.max(1, b.total), 0)
          );
          return barSeries.map((b, i) => {
            const c = Math.max(1, b.total);
            return {
              key: b.key,
              label: b.shortLabel,
              extensions: `${b.hours} ساعة عمل`,
              color: CLAY_DONUT_COLORS[i % CLAY_DONUT_COLORS.length],
              segmentLink: b.key,
              count: c,
              sizeBytes: b.hours,
              sizeFormatted: `${b.total} مهام`,
              percentage: Math.round((c / sum) * 100),
            };
          });
        })()
      : data;

  const activeSource =
    donutMode === "disciplines" ? disciplineSlices : data.map((d, i) => ({
      ...d,
      color: CLAY_DONUT_COLORS[i % CLAY_DONUT_COLORS.length],
    }));

  const totalCount = Math.max(
    1,
    activeSource.reduce((acc, item) => acc + Math.max(0.2, item.count), 0)
  );

  const slices = activeSource.map((item, index) => {
    const val = Math.max(0.2, item.count);
    const dashLength = (val / totalCount) * circumference;
    const offset = activeSource
      .slice(0, index)
      .reduce(
        (sum, previous) =>
          sum + (Math.max(0.2, previous.count) / totalCount) * circumference,
        0
      );
    return { ...item, dashLength, offset };
  });

  const activeHover =
    hoveredSlice !== null && slices[hoveredSlice] ? slices[hoveredSlice] : null;

  return (
    <div className="clay-card relative p-5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            توزيع التخصصات والملفات
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            نسب الأعمال الهندسية وخزنة الملفات المفتوحة
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setDonutMode((m) => (m === "disciplines" ? "files" : "disciplines"))
          }
          className="clay-pill px-3 py-1 text-[11px] inline-flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          {donutMode === "disciplines" ? "التخصصات ▾" : `الملفات (${totalFiles}) ▾`}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 my-auto">
        {/* 3D Beveled Donut SVG */}
        <div className="sm:col-span-6 relative flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90 overflow-visible"
            onMouseLeave={() => setHoveredSlice(null)}
          >
            <defs>
              <filter id="clayDonutShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="6" stdDeviation="5" floodColor="#162938" floodOpacity="0.32" />
              </filter>
            </defs>

            {/* Recessed outer track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(30, 52, 70, 0.14)"
              strokeWidth={strokeWidth + 4}
            />

            {slices.map((slice, idx) => {
              const isHovered = hoveredSlice === idx;
              return (
                <circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                  strokeDasharray={`${Math.max(1, slice.dashLength - 2)} ${circumference}`}
                  strokeDashoffset={-slice.offset}
                  strokeLinecap="butt"
                  filter="url(#clayDonutShadow)"
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredSlice(idx)}
                  onClick={() =>
                    onSelectSegment(
                      activeSegment === slice.segmentLink
                        ? "all"
                        : slice.segmentLink
                    )
                  }
                />
              );
            })}

            {/* Inner 3D Bevel Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius - strokeWidth / 2}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={2}
            />
          </svg>

          {/* Center Readout */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            {activeHover ? (
              <>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {activeHover.label}
                </span>
                <span className="text-lg font-extrabold font-mono text-slate-950 dark:text-white tabular-nums">
                  {activeHover.percentage}%
                </span>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  {activeHover.sizeFormatted}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {donutMode === "disciplines" ? "إجمالي المسارات" : "الخزنة"}
                </span>
                <span className="text-base font-extrabold font-mono text-slate-950 dark:text-white tabular-nums">
                  {donutMode === "disciplines" ? "100%" : totalSizeFormatted}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Clean 3D Colored Dot + Label + Percentage List (matching "Top Genres") */}
        <div className="sm:col-span-6 space-y-2">
          {slices.map((slice, idx) => {
            const isHovered = hoveredSlice === idx;
            return (
              <button
                key={slice.key}
                type="button"
                onMouseEnter={() => setHoveredSlice(idx)}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() =>
                  onSelectSegment(
                    activeSegment === slice.segmentLink
                      ? "all"
                      : slice.segmentLink
                  )
                }
                className={`w-full text-right px-3 py-2 rounded-2xl transition-all flex items-center justify-between gap-2 ${
                  isHovered
                    ? "clay-list-row scale-[1.01]"
                    : "hover:bg-white/25 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/60"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), ${slice.color})`,
                    }}
                  />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {slice.label}
                  </span>
                </div>
                <span className="text-xs font-extrabold font-mono text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                  {slice.percentage}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/30 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-400">
        <span className="flex items-center gap-1 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
          يدعم DWG, RVT, IFC, PDF, PNG, XLSX, ZIP
        </span>
        <span className="font-mono font-bold text-teal-800 dark:text-teal-300">
          Free 100%
        </span>
      </div>
    </div>
  );
}
