import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import { useTheme } from '../contexts/ThemeContext';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle2, Calendar, Palette, Sun, Moon, Monitor, Check, Shapes, Sparkles, Box } from 'lucide-react';
import toast from 'react-hot-toast';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const { theme, setTheme, iconStyle, setIconStyle } = useTheme();
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate.toString());
  const [allowCustomExportDate, setAllowCustomExportDate] = useState<boolean>(DEFAULT_SETTINGS.allowCustomExportDate);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (isDemoMode) {
        const demoSettings = demoStore.getSettings();
        setConversionRate(demoSettings.bao15ConversionRate?.toString() || DEFAULT_SETTINGS.bao15ConversionRate.toString());
        setAllowCustomExportDate(demoSettings.allowCustomExportDate ?? DEFAULT_SETTINGS.allowCustomExportDate);
        return;
      }

      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConversionRate(data.bao15ConversionRate?.toString() || DEFAULT_SETTINGS.bao15ConversionRate.toString());
        setAllowCustomExportDate(data.allowCustomExportDate ?? DEFAULT_SETTINGS.allowCustomExportDate);
      }
    };
    fetchSettings();
  }, [isDemoMode]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(conversionRate);
    if (!rate || rate <= 0) {
      toast.error('Tỷ lệ quy đổi không hợp lệ');
      return;
    }

    setIsSaving(true);
    try {
      if (isDemoMode) {
        demoStore.updateSettings(rate, allowCustomExportDate);
        notifyDemoChange();
        toast.success('[Sandbox Demo] Lưu cài đặt thành công');
        setIsSaving(false);
        return;
      }

      await setDoc(doc(db, 'settings', 'global'), {
        bao15ConversionRate: rate,
        allowCustomExportDate,
        updatedAt: Date.now()
      }, { merge: true });
      toast.success('Lưu cài đặt thành công');
    } catch (error) {
      toast.error('Lỗi khi lưu cài đặt');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESET') {
      toast.error('Vui lòng nhập chính xác từ "RESET" để xác nhận');
      return;
    }

    setIsResetting(true);
    try {
      if (isDemoMode) {
        demoStore.resetAllData();
        notifyDemoChange();
        setConversionRate(DEFAULT_SETTINGS.bao15ConversionRate.toString());
        toast.success('[Sandbox Demo] Đã reset toàn bộ dữ liệu ứng dụng về mặc định!');
        setShowResetModal(false);
        setResetConfirmInput('');
        setIsResetting(false);
        return;
      }

      const collectionsToClear = [
        'imports',
        'exports',
        'borrowReturns',
        'activityLogs',
        'stockChecks',
        'inventory'
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs;
        
        // Delete in batches of 400
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Reset global settings to defaults
      await setDoc(doc(db, 'settings', 'global'), {
        bao15ConversionRate: DEFAULT_SETTINGS.bao15ConversionRate,
        updatedAt: Date.now()
      });
      setConversionRate(DEFAULT_SETTINGS.bao15ConversionRate.toString());

      // Clear offline queue in local storage
      localStorage.removeItem('xopker_offline_queue');

      toast.success('Đã reset toàn bộ dữ liệu ứng dụng về mặc định!');
      setShowResetModal(false);
      setResetConfirmInput('');
    } catch (error) {
      console.error('Lỗi khi reset dữ liệu:', error);
      toast.error('Lỗi khi reset dữ liệu hệ thống');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-8 pb-28 sm:pb-8">
      {/* Theme Customization Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800/80 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-600 dark:text-sky-400 rounded-xl sm:rounded-2xl shrink-0 backdrop-blur-md border border-sky-400/30">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Giao Diện & Chế Độ (Themes)</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Tùy chỉnh chế độ hiển thị sáng/tối cho ứng dụng.</p>
          </div>
        </div>

        {/* Responsive 3-column compact grid for mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {/* Light Theme Option */}
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              toast.success('Đã chuyển sang giao diện Sáng');
            }}
            className={`p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl transition-all duration-300 flex flex-col items-center gap-1.5 sm:gap-3 text-center cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              theme === 'light'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-transform duration-300 ${
              theme === 'light' 
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30 scale-105' 
                : 'bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 backdrop-blur-sm'
            }`}>
              <Sun className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center justify-center gap-1">
                Giao Diện Sáng
                {theme === 'light' && (
                  <span className="p-0.5 rounded-full bg-sky-500 text-white ring-1 ring-sky-300/40 shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-[11px] font-medium opacity-80 mt-1">Sáng rõ, tương phản cao ban ngày</div>
            </div>
          </button>

          {/* Dark Theme Option */}
          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              toast.success('Đã chuyển sang giao diện Tối');
            }}
            className={`p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl transition-all duration-300 flex flex-col items-center gap-1.5 sm:gap-3 text-center cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              theme === 'dark'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-transform duration-300 ${
              theme === 'dark' 
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30 scale-105' 
                : 'bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 backdrop-blur-sm'
            }`}>
              <Moon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center justify-center gap-1">
                Giao Diện Tối
                {theme === 'dark' && (
                  <span className="p-0.5 rounded-full bg-sky-500 text-white ring-1 ring-sky-300/40 shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-[11px] font-medium opacity-80 mt-1">Dịu mắt, tiết kiệm pin ban đêm</div>
            </div>
          </button>

          {/* System Theme Option */}
          <button
            type="button"
            onClick={() => {
              setTheme('system');
              toast.success('Đã chuyển sang giao diện Theo Hệ Thống');
            }}
            className={`p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl transition-all duration-300 flex flex-col items-center gap-1.5 sm:gap-3 text-center cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              theme === 'system'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-transform duration-300 ${
              theme === 'system' 
                ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30 scale-105' 
                : 'bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 backdrop-blur-sm'
            }`}>
              <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center justify-center gap-1">
                Hệ Thống
                {theme === 'system' && (
                  <span className="p-0.5 rounded-full bg-sky-500 text-white ring-1 ring-sky-300/40 shadow-xs">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-[11px] font-medium opacity-80 mt-1">Tự động chuyển đổi theo thiết bị</div>
            </div>
          </button>
        </div>
      </div>

      {/* Icon Style Customization Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800/80 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2.5 sm:p-3 bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-600 dark:text-sky-400 rounded-xl sm:rounded-2xl shrink-0 backdrop-blur-md border border-sky-400/30">
            <Shapes className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Kiểu Biểu Tượng (Icon Style)</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Tùy chọn phong cách hiển thị icon.</p>
          </div>
        </div>

        {/* 2-column grid on mobile for optimal fit */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* 1. Vibrant / Rực Rỡ */}
          <button
            type="button"
            onClick={() => {
              setIconStyle('vibrant');
              toast.success('Đã chọn kiểu biểu tượng Rực Rỡ');
            }}
            className={`p-3 sm:p-4.5 rounded-2xl sm:rounded-3xl transition-all duration-300 text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              iconStyle === 'vibrant'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
                  <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              {iconStyle === 'vibrant' && (
                <span className="p-0.5 sm:p-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white ring-1 ring-sky-300/40 shadow-xs">
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>
              )}
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                Rực Rỡ (Vibrant)
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium opacity-80 mt-0.5 line-clamp-2">Gradient rực rỡ, viền nổi bật</div>
            </div>
          </button>

          {/* 2. Minimalist / Tối Giản */}
          <button
            type="button"
            onClick={() => {
              setIconStyle('minimal');
              toast.success('Đã chọn kiểu biểu tượng Tối Giản');
            }}
            className={`p-3 sm:p-4.5 rounded-2xl sm:rounded-3xl transition-all duration-300 text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              iconStyle === 'minimal'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              {iconStyle === 'minimal' && (
                <span className="p-0.5 sm:p-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white ring-1 ring-sky-300/40 shadow-xs">
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>
              )}
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                Tối Giản (Minimal)
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium opacity-80 mt-0.5 line-clamp-2">Viền mỏng thanh lịch</div>
            </div>
          </button>

          {/* 3. Rounded / Bo Tròn */}
          <button
            type="button"
            onClick={() => {
              setIconStyle('rounded');
              toast.success('Đã chọn kiểu biểu tượng Bo Tròn');
            }}
            className={`p-3 sm:p-4.5 rounded-2xl sm:rounded-3xl transition-all duration-300 text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              iconStyle === 'rounded'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              {iconStyle === 'rounded' && (
                <span className="p-0.5 sm:p-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white ring-1 ring-sky-300/40 shadow-xs">
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>
              )}
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                Bo Tròn (Pastel)
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium opacity-80 mt-0.5 line-clamp-2">Viên tròn pastel nhẹ nhàng</div>
            </div>
          </button>

          {/* 4. Monochrome / Đơn Sắc */}
          <button
            type="button"
            onClick={() => {
              setIconStyle('monochrome');
              toast.success('Đã chọn kiểu biểu tượng Đơn Sắc');
            }}
            className={`p-3 sm:p-4.5 rounded-2xl sm:rounded-3xl transition-all duration-300 text-left flex flex-col justify-between gap-2.5 cursor-pointer relative overflow-hidden backdrop-blur-xl ${
              iconStyle === 'monochrome'
                ? 'border border-sky-400/70 dark:border-sky-400/80 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 text-slate-900 dark:text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-400/50'
                : 'border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-sky-400/40 hover:bg-white/70 dark:hover:bg-slate-800/50 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-xl sm:rounded-2xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
                  <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              {iconStyle === 'monochrome' && (
                <span className="p-0.5 sm:p-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white ring-1 ring-sky-300/40 shadow-xs">
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>
              )}
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm flex items-center gap-1">
                Đơn Sắc (Slate)
              </div>
              <div className="text-[10px] sm:text-[11px] font-medium opacity-80 mt-0.5 line-clamp-2">Đen xám kim loại sang trọng</div>
            </div>
          </button>
        </div>
      </div>

      {/* Settings Card for Manager & Admin only */}
      {(user?.role === 'Admin' || user?.role === 'Manager') && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800/80 space-y-4 sm:space-y-6">
          <h2 className="text-base sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Cài Đặt Hệ Thống Kho</h2>
          
          <form onSubmit={handleSave} className="space-y-5 sm:space-y-8">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Quy đổi Bao 16</label>
              <div className="flex items-center gap-2.5 sm:gap-4">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-base">1 bao = </span>
                <input 
                  type="number" 
                  step="0.1"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  className="w-24 sm:w-32 bg-slate-50/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-center text-sm sm:text-lg font-black outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-base">kg</span>
              </div>
              <p className="text-[11px] sm:text-sm font-medium text-slate-500 mt-2">Ví dụ: 1 bao = 10 kg. Hệ thống sẽ tự động quy đổi khi Nhập kho.</p>
            </div>

            {/* Toggle Allow Custom Export Date */}
            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-sky-500 shrink-0" />
                    Tùy Chọn Ngày Xuất Kho
                  </label>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Cho phép chọn ngày xuất kho trong quá khứ để phục vụ cho việc quên nhập liệu trước đó. Khi <strong>TẮT</strong>, ngày xuất kho sẽ mặc định là <strong>ngày hiện tại</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAllowCustomExportDate(!allowCustomExportDate)}
                  className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 shrink-0 cursor-pointer rounded-full border border-sky-400/30 transition-all duration-300 ease-in-out focus:outline-none backdrop-blur-md ${
                    allowCustomExportDate 
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 shadow-md shadow-sky-500/25 ring-2 ring-sky-400/40' 
                      : 'bg-slate-200/80 dark:bg-slate-800/80'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 sm:h-6 sm:w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out my-1 sm:my-0.5 ${
                      allowCustomExportDate ? 'translate-x-5.5 sm:translate-x-6.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-2 text-[11px] sm:text-xs font-bold text-sky-600 dark:text-sky-400">
                Trạng thái: {allowCustomExportDate ? 'ĐANG BẬT (Cho phép chọn ngày)' : 'ĐANG TẮT (Ngày hiện tại)'}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black py-3 sm:py-4 px-6 sm:px-10 rounded-xl sm:rounded-full transition-all duration-300 disabled:opacity-50 shadow-lg shadow-indigo-500/20 text-xs sm:text-base cursor-pointer border border-sky-300/30 backdrop-blur-md active:scale-95"
            >
              {isSaving ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}
            </button>
          </form>
        </div>
      )}

      {/* Reset Data Card for Admin */}
      {user?.role === 'Admin' && (
        <div className="bg-red-500/5 dark:bg-red-500/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-red-500/20">
          <div className="flex items-start gap-2.5 sm:gap-4 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl sm:rounded-2xl shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black text-red-600 dark:text-red-400 uppercase">Reset Dữ Liệu Về Mặc Định</h3>
              <p className="text-[11px] sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1">
                Xóa toàn bộ dữ liệu nhập xuất, kiểm kê, vay trả và tồn kho để ứng dụng trở về trạng thái ban đầu sạch sẽ trước khi bàn giao thực tế. (Tài khoản người dùng sẽ được giữ lại).
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            className="mt-2 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-black py-3 px-5 sm:px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Trash2 className="w-4 h-4" /> Reset Toàn Bộ Dữ Liệu
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 animate-bounce" />
              <h3 className="text-base sm:text-lg font-black uppercase">Xác Nhận Reset Dữ Liệu</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Thao tác này sẽ <strong className="text-red-500">XÓA VĨNH VIỄN</strong> tất cả lịch sử giao dịch (nhập kho, xuất kho, vay trả, nhật ký, kiểm kê) và đặt lại kho hàng về 0. Hành động này không thể hoàn tác!
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Nhập từ <span className="text-red-500 font-black">RESET</span> bên dưới để tiếp tục:
              </label>
              <input 
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 sm:py-3 text-center text-base sm:text-lg font-black uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmInput('');
                }}
                disabled={isResetting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-xs sm:text-sm uppercase cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleResetData}
                disabled={isResetting || resetConfirmInput.trim().toUpperCase() !== 'RESET'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 text-xs sm:text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang xóa...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Đồng Ý Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

