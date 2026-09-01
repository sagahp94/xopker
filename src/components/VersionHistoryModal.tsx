import React from 'react';
import { X, Sparkles, History, CheckCircle2, ChevronRight, GitCommit } from 'lucide-react';
import { VERSION_HISTORY } from '../constants/versionHistory';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl w-full max-w-2xl max-h-[85vh] rounded-3xl p-5 sm:p-7 shadow-2xl border border-sky-400/40 dark:border-sky-400/30 flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black bg-gradient-to-r from-slate-900 via-sky-950 to-slate-800 dark:from-white dark:via-sky-100 dark:to-slate-200 bg-clip-text text-transparent">
                  Lịch Sử Phiên Bản
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-[10px] border border-sky-400/30">
                  {VERSION_HISTORY.length} bản cập nhật
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Nhật ký các thay đổi và tính năng mới của XỐPKER
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Version List */}
        <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-4 custom-scrollbar">
          {VERSION_HISTORY.map((ver) => {
            return (
              <div
                key={ver.version}
                className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden ${
                  ver.isLatest
                    ? 'bg-gradient-to-br from-sky-50/90 via-indigo-50/40 to-white dark:from-sky-950/40 dark:via-indigo-950/20 dark:to-slate-900 border-sky-400 dark:border-sky-500/80 shadow-lg shadow-sky-500/10 ring-2 ring-sky-400/20'
                    : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Highlight Badge for Latest Version */}
                {ver.isLatest && (
                  <div className="absolute top-0 right-0">
                    <span className="px-3 py-1 rounded-bl-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Sparkles className="w-3 h-3 text-cyan-200 animate-pulse" /> MỚI NHẤT
                    </span>
                  </div>
                )}

                {/* Version Title & Meta */}
                <div className="flex flex-wrap items-center gap-2 mb-2 pr-16">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider shadow-xs ${
                      ver.isLatest
                        ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white ring-2 ring-sky-300/40'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {ver.version}
                  </span>

                  {ver.tagline && (
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60">
                      {ver.tagline}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-2.5 flex items-center gap-1.5">
                  <GitCommit className={`w-4 h-4 shrink-0 ${ver.isLatest ? 'text-sky-500' : 'text-slate-400'}`} />
                  {ver.title}
                </h4>

                {/* Changes List */}
                <ul className="space-y-1.5 pl-1">
                  {ver.changes.map((change, idx) => (
                    <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-start gap-2 leading-relaxed">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ver.isLatest ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400'}`} />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end text-xs text-slate-500 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-full transition-all active:scale-95 cursor-pointer shadow-sm text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
