import React from 'react';
import { Loader2 } from 'lucide-react';

interface ExportOverlayProps {
  title: string;
  message: string;
}

export const ExportOverlay: React.FC<ExportOverlayProps> = React.memo(({ title, message }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4 relative animate-in zoom-in-95 duration-200">
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping"></div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse w-full"></div>
        </div>

        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest pt-1">
          Vui lòng không tắt hoặc tải lại trang
        </p>
      </div>
    </div>
  );
});

ExportOverlay.displayName = 'ExportOverlay';
