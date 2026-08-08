import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { BAG_TYPES, DEFAULT_SETTINGS } from '../constants';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import toast from 'react-hot-toast';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  isWithinInterval,
  eachDayOfInterval,
  format,
  differenceInCalendarDays,
  addDays
} from 'date-fns';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'custom';

export const BAG_COLORS: Record<string, { main: string; name: string; bg: string }> = {
  BAO15: { main: '#d946ef', name: 'Bao 16', bg: 'bg-fuchsia-500' },
  BAO20: { main: '#10b981', name: 'Bao 20', bg: 'bg-emerald-500' },
  BAO25: { main: '#3b82f6', name: 'Bao 25', bg: 'bg-blue-500' },
  BAO30: { main: '#f59e0b', name: 'Bao 30', bg: 'bg-amber-500' },
  BAO37: { main: '#f43f5e', name: 'Bao 37', bg: 'bg-rose-500' },
};

interface ExportRecord {
  id: string;
  timestamp: number;
  bagTypeId?: string;
  quantity?: number;
  conversionRateAtTime?: number;
  items?: Array<{ bagTypeId: string; quantity: number }>;
}

export const UsageTrendChart: React.FC = () => {
  const { isDemoMode, demoVersion } = useDemo();
  // Default timeframe is 'week' (Tuần) as explicitly required
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(addDays(new Date(), -6), 'yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [conversionRate, setConversionRate] = useState<number>(DEFAULT_SETTINGS.bao15ConversionRate || 10);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeBagIds, setActiveBagIds] = useState<Record<string, boolean>>({
    BAO15: true,
    BAO20: true,
    BAO25: true,
    BAO30: true,
    BAO37: true,
  });

  const handleCustomStartChange = (val: string) => {
    setCustomStartDate(val);
    if (val && customEndDate) {
      const s = new Date(val);
      const e = new Date(customEndDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        if (e < s) {
          setCustomEndDate(val);
        } else if (differenceInCalendarDays(e, s) > 30) {
          toast.error('Khoảng thời gian tối đa lựa chọn là 31 ngày');
          setCustomEndDate(format(addDays(s, 30), 'yyyy-MM-dd'));
        }
      }
    }
  };

  const handleCustomEndChange = (val: string) => {
    if (customStartDate && val) {
      const s = new Date(customStartDate);
      const e = new Date(val);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        if (e < s) {
          toast.error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
          setCustomEndDate(customStartDate);
          return;
        }
        if (differenceInCalendarDays(e, s) > 30) {
          toast.error('Khoảng thời gian tối đa lựa chọn là 31 ngày');
          setCustomEndDate(format(addDays(s, 30), 'yyyy-MM-dd'));
          return;
        }
      }
    }
    setCustomEndDate(val);
  };

  // Subscribe in real-time to Firestore or DemoStore exports
  useEffect(() => {
    let isMounted = true;

    if (isDemoMode) {
      const demoSettings = demoStore.getSettings();
      setConversionRate(demoSettings.bao15ConversionRate || DEFAULT_SETTINGS.bao15ConversionRate);
      const demoExports = demoStore.getExports();
      const records: ExportRecord[] = demoExports.map((d: any) => ({
        id: d.id,
        timestamp: Number(d.timestamp) || Date.now(),
        bagTypeId: d.bagTypeId,
        quantity: Number(d.quantity) || 0,
        conversionRateAtTime: d.conversionRateAtTime ? Number(d.conversionRateAtTime) : undefined,
        items: d.items,
      }));
      records.sort((a, b) => a.timestamp - b.timestamp);
      if (isMounted) {
        setExportsList(records);
        setLoading(false);
      }
      return;
    }

    // Listen for global settings
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().bao15ConversionRate) {
          setConversionRate(Number(docSnap.data().bao15ConversionRate));
        }
      },
      (err) => console.warn('Settings snapshot warning:', err)
    );

    // Listen in real-time to all records in "exports" collection created by Xuất Nhanh
    const unsubExports = onSnapshot(
      collection(db, 'exports'),
      (snapshot) => {
        const records: ExportRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          records.push({
            id: docSnap.id,
            timestamp: Number(d.timestamp) || Date.now(),
            bagTypeId: d.bagTypeId,
            quantity: Number(d.quantity) || 0,
            conversionRateAtTime: d.conversionRateAtTime ? Number(d.conversionRateAtTime) : undefined,
            items: d.items,
          });
        });

        // Sort chronologically
        records.sort((a, b) => a.timestamp - b.timestamp);

        if (isMounted) {
          setExportsList(records);
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Realtime exports subscription error, retrying fetch:', err);
        getDocs(collection(db, 'exports'))
          .then((snap) => {
            const records: ExportRecord[] = [];
            snap.forEach((docSnap) => {
              const d = docSnap.data();
              records.push({
                id: docSnap.id,
                timestamp: Number(d.timestamp) || Date.now(),
                bagTypeId: d.bagTypeId,
                quantity: Number(d.quantity) || 0,
                conversionRateAtTime: d.conversionRateAtTime ? Number(d.conversionRateAtTime) : undefined,
                items: d.items,
              });
            });
            records.sort((a, b) => a.timestamp - b.timestamp);
            if (isMounted) {
              setExportsList(records);
              setLoading(false);
            }
          })
          .catch(() => {
            if (isMounted) setLoading(false);
          });
      }
    );

    return () => {
      isMounted = false;
      unsubSettings();
      unsubExports();
    };
  }, [isDemoMode, demoVersion]);

  // Compute 100% real aggregated export totals from "Xuất Nhanh" for each timeframe
  const timeFrameData = useMemo(() => {
    const now = new Date();

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    // Aggregators
    const rawDay: Record<string, Record<string, number>> = {};
    const rawWeek: Record<string, Record<string, number>> = {};
    const rawMonth: Record<string, Record<string, number>> = {};
    const rawYear: Record<string, Record<string, number>> = {};
    const rawCustom: Record<string, Record<string, number>> = {};

    // Custom date interval setup
    const sDate = customStartDate ? startOfDay(new Date(customStartDate)) : startOfDay(addDays(now, -6));
    const eDate = customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now);
    const validStart = !isNaN(sDate.getTime()) ? sDate : startOfDay(addDays(now, -6));
    const validEnd = !isNaN(eDate.getTime()) && eDate >= validStart ? eDate : endOfDay(validStart);

    let daysInInterval: Date[] = [];
    try {
      daysInInterval = eachDayOfInterval({ start: validStart, end: validEnd });
    } catch {
      daysInInterval = [validStart];
    }

    const customLabels: string[] = [];
    daysInInterval.forEach((d) => {
      const label = format(d, 'dd/MM');
      customLabels.push(label);
      rawCustom[label] = {};
    });

    exportsList.forEach((rec) => {
      const recDate = new Date(rec.timestamp);

      // Extract bag items
      const itemsToProcess: Array<{ bagTypeId: string; qtyInBao: number }> = [];

      const docRate = rec.conversionRateAtTime && rec.conversionRateAtTime > 0 
        ? rec.conversionRateAtTime 
        : conversionRate;

      if (rec.items && Array.isArray(rec.items)) {
        rec.items.forEach((it) => {
          const bId = it.bagTypeId;
          const rawQ = Number(it.quantity) || 0;
          const qBao = bId === 'BAO15' ? (docRate > 0 ? rawQ / docRate : rawQ / 10) : rawQ;
          itemsToProcess.push({ bagTypeId: bId, qtyInBao: qBao });
        });
      } else if (rec.bagTypeId) {
        const bId = rec.bagTypeId;
        const rawQ = Number(rec.quantity) || 0;
        const qBao = bId === 'BAO15' ? (docRate > 0 ? rawQ / docRate : rawQ / 10) : rawQ;
        itemsToProcess.push({ bagTypeId: bId, qtyInBao: qBao });
      }

      itemsToProcess.forEach(({ bagTypeId, qtyInBao }) => {
        if (!BAG_COLORS[bagTypeId] || qtyInBao <= 0) return;

        // 1. Ngày (Hôm nay - chia theo khung giờ)
        if (isWithinInterval(recDate, { start: dayStart, end: dayEnd })) {
          const hour = recDate.getHours();
          // Group into 2-hour slots: 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
          const slotHour = Math.floor(hour / 2) * 2;
          const slot = `${slotHour < 10 ? '0' : ''}${slotHour}:00`;
          if (!rawDay[slot]) rawDay[slot] = {};
          rawDay[slot][bagTypeId] = (rawDay[slot][bagTypeId] || 0) + qtyInBao;
        }

        // 2. Tuần (Trong tuần này - T2 -> CN)
        if (isWithinInterval(recDate, { start: weekStart, end: weekEnd })) {
          const dayMap: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
          const dayName = dayMap[recDate.getDay()] || 'T2';
          if (!rawWeek[dayName]) rawWeek[dayName] = {};
          rawWeek[dayName][bagTypeId] = (rawWeek[dayName][bagTypeId] || 0) + qtyInBao;
        }

        // 3. Tháng (Trong tháng này - Tuần 1 -> Tuần 5)
        if (isWithinInterval(recDate, { start: monthStart, end: monthEnd })) {
          const dateNum = recDate.getDate();
          const weekNum = Math.min(Math.ceil(dateNum / 7), 5);
          const slot = `Tuần ${weekNum}`;
          if (!rawMonth[slot]) rawMonth[slot] = {};
          rawMonth[slot][bagTypeId] = (rawMonth[slot][bagTypeId] || 0) + qtyInBao;
        }

        // 4. Năm (Trong năm này - Thg 1 -> Thg 12)
        if (isWithinInterval(recDate, { start: yearStart, end: yearEnd })) {
          const slot = `Thg ${recDate.getMonth() + 1}`;
          if (!rawYear[slot]) rawYear[slot] = {};
          rawYear[slot][bagTypeId] = (rawYear[slot][bagTypeId] || 0) + qtyInBao;
        }

        // 5. Custom Date Range
        if (isWithinInterval(recDate, { start: validStart, end: validEnd })) {
          const slot = format(recDate, 'dd/MM');
          if (!rawCustom[slot]) rawCustom[slot] = {};
          rawCustom[slot][bagTypeId] = (rawCustom[slot][bagTypeId] || 0) + qtyInBao;
        }
      });
    });

    // Label structures
    const dayLabels = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    const weekLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const monthLabels = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5'];
    const yearLabels = [
      'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6', 
      'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12'
    ];

    // Build strict real dataset without any fake seeds
    const createDataSet = (labels: string[], raw: Record<string, Record<string, number>>) => {
      return labels.map((label) => {
        const item: Record<string, any> = { time: label };
        BAG_TYPES.forEach((b) => {
          const realQty = raw[label]?.[b.id] || 0;
          item[b.id] = Math.round(realQty * 10) / 10;
        });
        return item;
      });
    };

    return {
      day: createDataSet(dayLabels, rawDay),
      week: createDataSet(weekLabels, rawWeek),
      month: createDataSet(monthLabels, rawMonth),
      year: createDataSet(yearLabels, rawYear),
      custom: createDataSet(customLabels, rawCustom),
    };
  }, [exportsList, conversionRate, customStartDate, customEndDate]);

  const toggleBag = (bagId: string) => {
    setActiveBagIds((prev) => ({ ...prev, [bagId]: !prev[bagId] }));
  };

  const currentDataset = timeFrameData[timeFrame];

  // Total real exports in current timeframe view
  const totalExportInView = useMemo(() => {
    let total = 0;
    currentDataset.forEach((row) => {
      BAG_TYPES.forEach((b) => {
        if (activeBagIds[b.id]) {
          total += Number(row[b.id] || 0);
        }
      });
    });
    return Math.round(total * 10) / 10;
  }, [currentDataset, activeBagIds]);

  const timeframeLabelMap: Record<TimeFrame, string> = {
    day: 'Hôm nay',
    week: 'Tuần này',
    month: 'Tháng này',
    year: 'Năm nay',
    custom: 'Tùy chọn ngày',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
      {/* Header & Timeframe Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Xu Hướng Sử Dụng Các Loại Bao
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Số lượng xuất thực tế: <strong className="text-slate-700 dark:text-slate-200 font-bold">{totalExportInView.toLocaleString('vi-VN')} bao</strong> ({timeframeLabelMap[timeFrame]})
            </p>
          </div>
        </div>

        {/* Filter Segmented Control: Ngày, Tuần, Tháng, Năm, Tùy chọn */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold self-start sm:self-auto flex-wrap gap-0.5">
          <button
            type="button"
            onClick={() => setTimeFrame('day')}
            className={`px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
              timeFrame === 'day'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ngày
          </button>
          <button
            type="button"
            onClick={() => setTimeFrame('week')}
            className={`px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
              timeFrame === 'week'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tuần
          </button>
          <button
            type="button"
            onClick={() => setTimeFrame('month')}
            className={`px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
              timeFrame === 'month'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tháng
          </button>
          <button
            type="button"
            onClick={() => setTimeFrame('year')}
            className={`px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer ${
              timeFrame === 'year'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Năm
          </button>
          <button
            type="button"
            onClick={() => setTimeFrame('custom')}
            className={`px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1 ${
              timeFrame === 'custom'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Tùy chọn
          </button>
        </div>
      </div>

      {/* Custom Date Range Selector (Max 31 days) */}
      {timeFrame === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50/90 dark:bg-indigo-950/50 p-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-xs animate-in fade-in zoom-in-95 duration-150 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Từ:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => handleCustomStartChange(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
          <span className="text-indigo-400 font-bold hidden sm:inline">➔</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Đến:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => handleCustomEndChange(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1">
            (Tối đa 31 ngày)
          </span>
        </div>
      )}

      {/* Bag Types Toggle Chips */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Loại bao:</span>
        {BAG_TYPES.map((bag) => {
          const colorInfo = BAG_COLORS[bag.id] || { main: '#6366f1', name: bag.name, bg: 'bg-indigo-500' };
          const active = activeBagIds[bag.id];
          return (
            <button
              key={bag.id}
              type="button"
              onClick={() => toggleBag(bag.id)}
              style={{
                borderColor: active ? colorInfo.main : undefined,
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer border ${
                active 
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs ring-1' 
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60 opacity-50 hover:opacity-100'
              }`}
            >
              <span 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: colorInfo.main }}
              />
              {bag.name}
            </button>
          );
        })}
      </div>

      {/* Line Chart Area */}
      <div className="w-full h-64 sm:h-72 pt-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={currentDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 11, fill: '#94a3b8' }} 
              axisLine={false} 
              tickLine={false}
              dy={5}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#94a3b8' }} 
              axisLine={false} 
              tickLine={false} 
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900/95 dark:bg-slate-800/95 border border-slate-700 text-white p-2.5 rounded-xl shadow-xl backdrop-blur-xs text-xs space-y-1.5">
                      <p className="font-extrabold text-slate-300 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-4">
                        <span>Thời gian: {label}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-400">{timeframeLabelMap[timeFrame]}</span>
                      </p>
                      {payload.map((entry: any) => {
                        const bagInfo = BAG_COLORS[entry.dataKey];
                        if (!bagInfo) return null;
                        return (
                          <div key={entry.dataKey} className="flex items-center justify-between gap-4 font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              {bagInfo.name}:
                            </span>
                            <span className="font-black text-white">
                              {entry.value} <span className="text-[10px] font-normal text-slate-400">bao</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {BAG_TYPES.map((bag) => {
              if (!activeBagIds[bag.id]) return null;
              const colorInfo = BAG_COLORS[bag.id] || { main: '#6366f1' };
              return (
                <Line
                  key={bag.id}
                  type="monotone"
                  dataKey={bag.id}
                  name={bag.name}
                  stroke={colorInfo.main}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, fill: colorInfo.main }}
                  isAnimationActive={true}
                  animationDuration={350}
                  animationEasing="ease-in-out"
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
