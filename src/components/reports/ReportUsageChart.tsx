import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Inbox
} from 'lucide-react';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  differenceInCalendarDays,
  addDays
} from 'date-fns';
import { ExportRecord } from '../../hooks/useReportData';
import { BagReport } from '../../utils/reportExport';
import { cn } from '../Layout';

export interface ReportUsageChartProps {
  filterType: string;
  customStartDate: string;
  customEndDate: string;
  exports: ExportRecord[];
  reportData: BagReport[];
  conversionRate: number;
  loading: boolean;
}

export interface BagConfig {
  id: string;
  shortLabel: string;
  fullName: string;
  color: string;
  bgClass: string;
  lightBgClass: string;
}

export const BAG_CONFIGS: BagConfig[] = [
  { id: 'BAO15', shortLabel: '16', fullName: 'Túi 16', color: '#8b5cf6', bgClass: 'bg-purple-500', lightBgClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' },
  { id: 'BAO20', shortLabel: '20', fullName: 'Túi 20', color: '#10b981', bgClass: 'bg-emerald-500', lightBgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
  { id: 'BAO25', shortLabel: '25', fullName: 'Túi 25', color: '#3b82f6', bgClass: 'bg-blue-500', lightBgClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' },
  { id: 'BAO30', shortLabel: '30', fullName: 'Túi 30', color: '#f59e0b', bgClass: 'bg-amber-500', lightBgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
  { id: 'BAO37', shortLabel: '37', fullName: 'Túi 37', color: '#f43f5e', bgClass: 'bg-rose-500', lightBgClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
];

export const ReportUsageChart: React.FC<ReportUsageChartProps> = React.memo(({
  filterType,
  customStartDate,
  customEndDate,
  exports,
  reportData,
  conversionRate,
  loading
}) => {
  const [chartMode, setChartMode] = useState<'trend' | 'total'>('trend');
  const [activeBags, setActiveBags] = useState<Record<string, boolean>>({
    BAO15: true,
    BAO20: true,
    BAO25: true,
    BAO30: true,
    BAO37: true,
  });

  const toggleBag = (bagId: string) => {
    setActiveBags(prev => {
      // Check if this is the only active one and user clicks it: allow toggling but at least keep click responsive
      const newActive = { ...prev, [bagId]: !prev[bagId] };
      const hasAtLeastOne = Object.values(newActive).some(Boolean);
      // If toggling off would result in zero bags, we still allow it (shows empty chart)
      return newActive;
    });
  };

  // Helper to extract bag exports count in bao
  const getQtyInBao = (bagTypeId: string, rawQty: number, docRate?: number) => {
    const rate = docRate && docRate > 0 ? docRate : conversionRate;
    if (bagTypeId === 'BAO15') {
      return rate > 0 ? rawQty / rate : 0;
    }
    return rawQty;
  };

  // 1. Calculate Line Chart Data based on time granularity
  const { lineChartData, totalPeriodUsage } = useMemo(() => {
    const now = new Date();
    let buckets: Array<{
      time: string;
      fullDate: string;
      rangeStart: number;
      rangeEnd: number;
      BAO15: number;
      BAO20: number;
      BAO25: number;
      BAO30: number;
      BAO37: number;
    }> = [];

    if (filterType === 'TODAY') {
      // Divide day into 2-hour slots from 06:00 to 22:00 + edge slots
      const dayStart = startOfDay(now).getTime();
      const slots = [
        { label: '06:00', startHour: 0, endHour: 7 },
        { label: '08:00', startHour: 7, endHour: 9 },
        { label: '10:00', startHour: 9, endHour: 11 },
        { label: '12:00', startHour: 11, endHour: 13 },
        { label: '14:00', startHour: 13, endHour: 15 },
        { label: '16:00', startHour: 15, endHour: 17 },
        { label: '18:00', startHour: 17, endHour: 19 },
        { label: '20:00', startHour: 19, endHour: 21 },
        { label: '22:00', startHour: 21, endHour: 24 },
      ];

      const todayStr = format(now, 'dd/MM/yyyy');
      buckets = slots.map(slot => {
        const s = new Date(now);
        s.setHours(slot.startHour, 0, 0, 0);
        const e = new Date(now);
        e.setHours(slot.endHour - 1, 59, 59, 999);
        return {
          time: slot.label,
          fullDate: `${todayStr} (${slot.label})`,
          rangeStart: s.getTime(),
          rangeEnd: e.getTime(),
          BAO15: 0,
          BAO20: 0,
          BAO25: 0,
          BAO30: 0,
          BAO37: 0,
        };
      });

    } else if (filterType === 'WEEK') {
      // 7 days of the week: T2, T3, T4, T5, T6, T7, CN
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

      buckets = days.map((dayDate, idx) => {
        return {
          time: dayLabels[idx] || format(dayDate, 'dd/MM'),
          fullDate: `${format(dayDate, 'dd/MM/yyyy')} (${dayLabels[idx]})`,
          rangeStart: startOfDay(dayDate).getTime(),
          rangeEnd: endOfDay(dayDate).getTime(),
          BAO15: 0,
          BAO20: 0,
          BAO25: 0,
          BAO30: 0,
          BAO37: 0,
        };
      });

    } else if (filterType === 'MONTH') {
      // All days of current month: 1, 2, 3, ... N
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      buckets = days.map(dayDate => {
        return {
          time: format(dayDate, 'd'),
          fullDate: format(dayDate, 'dd/MM/yyyy'),
          rangeStart: startOfDay(dayDate).getTime(),
          rangeEnd: endOfDay(dayDate).getTime(),
          BAO15: 0,
          BAO20: 0,
          BAO25: 0,
          BAO30: 0,
          BAO37: 0,
        };
      });

    } else if (filterType === 'YEAR') {
      // 12 months: T1, T2, ... T12
      const year = now.getFullYear();
      buckets = Array.from({ length: 12 }, (_, m) => {
        const mStart = new Date(year, m, 1, 0, 0, 0, 0);
        const mEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);
        return {
          time: `T${m + 1}`,
          fullDate: `Tháng ${m + 1}/${year}`,
          rangeStart: mStart.getTime(),
          rangeEnd: mEnd.getTime(),
          BAO15: 0,
          BAO20: 0,
          BAO25: 0,
          BAO30: 0,
          BAO37: 0,
        };
      });

    } else if (filterType === 'CUSTOM') {
      const sDate = customStartDate ? new Date(customStartDate) : startOfMonth(now);
      const eDate = customEndDate ? new Date(customEndDate) : endOfMonth(now);
      const validS = isNaN(sDate.getTime()) ? startOfMonth(now) : sDate;
      const validE = isNaN(eDate.getTime()) ? endOfMonth(now) : eDate;
      const totalDays = Math.max(1, differenceInCalendarDays(validE, validS) + 1);

      if (totalDays <= 31) {
        // Group by day
        const days = eachDayOfInterval({ start: validS, end: validE });
        buckets = days.map(dayDate => ({
          time: format(dayDate, 'dd/MM'),
          fullDate: format(dayDate, 'dd/MM/yyyy'),
          rangeStart: startOfDay(dayDate).getTime(),
          rangeEnd: endOfDay(dayDate).getTime(),
          BAO15: 0,
          BAO20: 0,
          BAO25: 0,
          BAO30: 0,
          BAO37: 0,
        }));
      } else if (totalDays <= 180) {
        // Group by 7-day chunks (weeks)
        let cur = startOfDay(validS);
        const endMs = endOfDay(validE).getTime();
        let weekNum = 1;
        while (cur.getTime() <= endMs) {
          const wEnd = endOfDay(addDays(cur, 6));
          const actualEnd = wEnd.getTime() > endMs ? endOfDay(validE) : wEnd;
          buckets.push({
            time: `Tuần ${weekNum}`,
            fullDate: `${format(cur, 'dd/MM/yyyy')} - ${format(actualEnd, 'dd/MM/yyyy')}`,
            rangeStart: cur.getTime(),
            rangeEnd: actualEnd.getTime(),
            BAO15: 0,
            BAO20: 0,
            BAO25: 0,
            BAO30: 0,
            BAO37: 0,
          });
          cur = addDays(cur, 7);
          weekNum++;
        }
      } else {
        // Group by month
        let cur = new Date(validS.getFullYear(), validS.getMonth(), 1);
        const endMs = endOfDay(validE).getTime();
        while (cur.getTime() <= endMs) {
          const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
          buckets.push({
            time: format(cur, 'MM/yy'),
            fullDate: `Tháng ${format(cur, 'MM/yyyy')}`,
            rangeStart: cur.getTime(),
            rangeEnd: mEnd.getTime(),
            BAO15: 0,
            BAO20: 0,
            BAO25: 0,
            BAO30: 0,
            BAO37: 0,
          });
          cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        }
      }
    }

    // Distribute export records into buckets
    let totalUsageSum = 0;
    exports.forEach(record => {
      const ts = record.timestamp;
      const targetBucket = buckets.find(b => ts >= b.rangeStart && ts <= b.rangeEnd);
      if (!targetBucket) return;

      if (record.items && Array.isArray(record.items)) {
        record.items.forEach(sub => {
          if (sub.bagTypeId && (targetBucket as any)[sub.bagTypeId] !== undefined) {
            const qtyBao = getQtyInBao(sub.bagTypeId, Number(sub.quantity || 0), record.conversionRateAtTime);
            (targetBucket as any)[sub.bagTypeId] += qtyBao;
            totalUsageSum += qtyBao;
          }
        });
      } else if (record.bagTypeId && (targetBucket as any)[record.bagTypeId] !== undefined) {
        const qtyBao = getQtyInBao(record.bagTypeId, Number(record.quantity || 0), record.conversionRateAtTime);
        (targetBucket as any)[record.bagTypeId] += qtyBao;
        totalUsageSum += qtyBao;
      }
    });

    // Round values for display clarity
    const formattedBuckets = buckets.map(b => ({
      ...b,
      BAO15: Math.round(b.BAO15 * 10) / 10,
      BAO20: Math.round(b.BAO20 * 10) / 10,
      BAO25: Math.round(b.BAO25 * 10) / 10,
      BAO30: Math.round(b.BAO30 * 10) / 10,
      BAO37: Math.round(b.BAO37 * 10) / 10,
    }));

    return {
      lineChartData: formattedBuckets,
      totalPeriodUsage: totalUsageSum
    };
  }, [filterType, customStartDate, customEndDate, exports, conversionRate]);

  // 2. Calculate Bar Chart Data (Total Usage per Bag Type)
  const barChartData = useMemo(() => {
    return BAG_CONFIGS.map(bag => {
      const rep = reportData.find(r => r.bagTypeId === bag.id);
      const total = rep ? rep.totalUsage : 0;
      return {
        bagId: bag.id,
        name: bag.shortLabel,
        fullName: bag.fullName,
        total: Math.round(total * 10) / 10,
        fill: bag.color,
        bgClass: bag.bgClass,
        lightBgClass: bag.lightBgClass,
      };
    });
  }, [reportData]);

  // Filtered bar data based on active bags toggle
  const filteredBarData = useMemo(() => {
    return barChartData.filter(item => activeBags[item.bagId]);
  }, [barChartData, activeBags]);

  // Check if all data is 0 for empty state
  const isDataEmpty = useMemo(() => {
    if (exports.length === 0 && reportData.every(r => r.totalUsage === 0)) return true;
    if (chartMode === 'trend') {
      return lineChartData.every(
        b => b.BAO15 === 0 && b.BAO20 === 0 && b.BAO25 === 0 && b.BAO30 === 0 && b.BAO37 === 0
      );
    } else {
      return filteredBarData.every(b => b.total === 0);
    }
  }, [exports, reportData, lineChartData, filteredBarData, chartMode]);

  // Determine interval for X-Axis to prevent text collision
  const xAxisInterval = useMemo(() => {
    if (filterType === 'MONTH') {
      return 2; // Show 1, 4, 7, 10, 13, 16...
    }
    if (lineChartData.length > 20) {
      return 'preserveStartEnd';
    }
    return 0;
  }, [filterType, lineChartData.length]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Xu hướng sử dụng túi
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Thống kê chi tiết lượng túi đã xuất sử dụng theo thời gian
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div className="flex items-center self-start sm:self-auto bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <button
            type="button"
            onClick={() => setChartMode('trend')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5",
              chartMode === 'trend'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Xu hướng
          </button>
          <button
            type="button"
            onClick={() => setChartMode('total')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5",
              chartMode === 'total'
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Tổng sử dụng
          </button>
        </div>
      </div>

      {/* Legend & Toggle Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            Loại túi:
          </span>
          {BAG_CONFIGS.map((bag) => {
            const isActive = activeBags[bag.id];
            return (
              <button
                key={bag.id}
                type="button"
                onClick={() => toggleBag(bag.id)}
                title={`${isActive ? 'Bấm để ẩn' : 'Bấm để hiện'} ${bag.fullName}`}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer border select-none active:scale-95",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs"
                    : "bg-slate-100/80 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-700 opacity-50 hover:opacity-80"
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: bag.color }}
                />
                <span>{bag.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
          Đơn vị: <span className="text-slate-700 dark:text-slate-300 font-black">Bao</span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full mt-2 pt-2">
        {loading ? (
          <div className="w-full h-64 sm:h-80 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-400">Đang tổng hợp dữ liệu biểu đồ...</span>
          </div>
        ) : isDataEmpty ? (
          <div className="w-full h-64 sm:h-80 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 dark:text-indigo-400 mb-2 shadow-xs">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
              Chưa có dữ liệu trong khoảng thời gian này
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Không có giao dịch xuất kho hoặc sử dụng túi nào được ghi nhận trong khoảng thời gian đã chọn.
            </p>
          </div>
        ) : chartMode === 'trend' ? (
          <div className="w-full h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={lineChartData}
                margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.12} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1', opacity: 0.3 }}
                  tickLine={false}
                  dy={6}
                  interval={xAxisInterval}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={(props: any) => (
                    <CustomLineTooltip
                      {...props}
                      activeBags={activeBags}
                      conversionRate={conversionRate}
                    />
                  )}
                />
                {BAG_CONFIGS.map((bag) => {
                  if (!activeBags[bag.id]) return null;
                  return (
                    <Line
                      key={bag.id}
                      type="monotone"
                      dataKey={bag.id}
                      name={bag.fullName}
                      stroke={bag.color}
                      strokeWidth={2.5}
                      dot={lineChartData.length > 25 ? false : { r: 3, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 2, fill: bag.color }}
                      isAnimationActive={true}
                      animationDuration={400}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredBarData}
                margin={{ top: 25, right: 15, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.12} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: '#64748b', fontWeight: 800 }}
                  axisLine={{ stroke: '#cbd5e1', opacity: 0.3 }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={(props: any) => <CustomBarTooltip {...props} />}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                />
                <Bar
                  dataKey="total"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={56}
                  isAnimationActive={true}
                  animationDuration={400}
                >
                  {filteredBarData.map((entry) => (
                    <Cell key={entry.bagId} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(val: number) => (val > 0 ? `${val}` : '')}
                    style={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
});

ReportUsageChart.displayName = 'ReportUsageChart';

// Custom Line Tooltip
interface CustomLineTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  activeBags: Record<string, boolean>;
  conversionRate: number;
}

const CustomLineTooltip: React.FC<CustomLineTooltipProps> = ({
  active,
  payload,
  label,
  activeBags,
}) => {
  if (!active || !payload || !payload.length) return null;

  const fullDate = payload[0]?.payload?.fullDate || label;

  // Filter payload to only include bag types currently active
  const visiblePayload = payload.filter((entry) => activeBags[entry.dataKey]);

  if (visiblePayload.length === 0) return null;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-800/95 border border-slate-700/80 text-white p-3 rounded-2xl shadow-xl backdrop-blur-md text-xs min-w-[155px] space-y-2 animate-in fade-in zoom-in-95 duration-100">
      <div className="font-extrabold text-slate-300 border-b border-slate-700/70 pb-1.5 flex items-center justify-between gap-3">
        <span>{fullDate}</span>
      </div>
      <div className="space-y-1.5">
        {visiblePayload.map((entry: any) => {
          const bagCfg = BAG_CONFIGS.find((b) => b.id === entry.dataKey);
          if (!bagCfg) return null;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4 font-medium">
              <span className="flex items-center gap-1.5 text-slate-200">
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: entry.color }}
                />
                {bagCfg.fullName}:
              </span>
              <span className="font-black text-white">
                {entry.value}{' '}
                <span className="text-[10px] font-normal text-slate-400">bao</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Custom Bar Tooltip
interface CustomBarTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomBarTooltip: React.FC<CustomBarTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-800/95 border border-slate-700/80 text-white p-3 rounded-2xl shadow-xl backdrop-blur-md text-xs min-w-[145px] space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
      <div className="font-extrabold text-slate-300 border-b border-slate-700/70 pb-1 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
        <span>{item.fullName}</span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <span className="text-slate-300">Tổng sử dụng:</span>
        <span className="font-black text-white text-sm">
          {item.total} <span className="text-xs font-normal text-slate-400">bao</span>
        </span>
      </div>
    </div>
  );
};
