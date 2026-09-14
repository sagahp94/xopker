import React, { useEffect, useState } from 'react';
import { LuxuryGlassLogo, VersionBadge } from './BrandLogo';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  isDone?: boolean;
  step?: 'fetching' | 'preparing' | 'done';
}

const STAGES = [
  { id: 'preparing', label: 'Đang chuẩn bị màn hình' },
  { id: 'fetching', label: 'Đang chuẩn bị dữ liệu' },
  { id: 'done', label: 'Đã hoàn tất' },
] as const;

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Đang chuẩn bị màn hình',
  isDone = false,
  step = 'preparing',
}) => {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isDone || step === 'done') {
      setProgress(100);
    } else if (step === 'fetching') {
      interval = setInterval(() => {
        setProgress(prev => {
          const startBase = prev < 45 ? 48 : prev;
          const next = startBase + Math.floor(Math.random() * 3) + 2;
          return Math.min(92, Math.max(prev, next));
        });
      }, 70);
    } else {
      // step === 'preparing'
      interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + Math.floor(Math.random() * 3) + 2;
          return Math.min(45, Math.max(prev, next));
        });
      }, 60);
    }

    return () => clearInterval(interval);
  }, [isDone, step]);

  const completed = isDone || step === 'done' || progress === 100;
  
  let activeIndex = 0;
  if (completed) {
    activeIndex = 2;
  } else if (step === 'fetching' || progress >= 45) {
    activeIndex = 1;
  } else {
    activeIndex = 0;
  }

  const ITEM_HEIGHT_PX = 36; // Compact stage line row height

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 p-4 sm:p-6 md:p-8 relative overflow-hidden select-none">
      {/* Dynamic Ambient Glass Glow Background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 md:w-[500px] h-72 sm:h-96 md:h-[500px] bg-gradient-to-tr from-fuchsia-600/30 via-purple-600/30 to-pink-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-60 sm:w-80 md:w-[400px] h-60 sm:h-80 md:h-[400px] bg-gradient-to-br from-indigo-600/20 to-sky-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphism Responsive Card (Compact text container) */}
      <div className="relative z-10 w-full max-w-[88vw] sm:max-w-sm md:max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-[0_0_50px_rgba(180,28,140,0.35)] flex flex-col items-center text-center transition-all duration-300">
        
        {/* Luxury Glass Logo */}
        <div className="relative mb-3 sm:mb-4 transform hover:scale-105 transition-transform duration-300">
          <LuxuryGlassLogo size="md" />
        </div>

        {/* Brand Name & Version Badge */}
        <div className="flex flex-col items-center gap-1.5 mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-white drop-shadow-[0_2px_14px_rgba(255,255,255,0.4)]">
            XỐPKER
          </h1>
          <VersionBadge size="sm" />
        </div>

        {/* Vertical Scrolling Stages Viewport (Thu nhỏ khung chứa chữ) */}
        <div className="w-full mb-5">
          <div className="relative w-full h-[108px] overflow-hidden rounded-xl bg-slate-950/70 border border-white/10 p-1.5 shadow-inner flex flex-col items-center justify-center">
            {/* Focal Highlight Bar in Center */}
            <div className={`absolute top-[36px] left-1.5 right-1.5 h-[36px] rounded-lg backdrop-blur-sm pointer-events-none transition-all duration-500 border ${
              completed
                ? 'bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-gradient-to-r from-fuchsia-500/15 via-purple-500/20 to-pink-500/15 border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.2)]'
            }`} />

            {/* Scrolling Reel Stack */}
            <div 
              className="w-full flex flex-col items-center transition-transform duration-500 ease-out"
              style={{ transform: `translateY(${(1 - activeIndex) * ITEM_HEIGHT_PX}px)` }}
            >
              {STAGES.map((stageItem, index) => {
                const isActive = index === activeIndex;
                const isCompletedStage = index < activeIndex || (completed && index === 2);
                
                const displayLabel = isActive && message && message !== STAGES[0].label && index === 0
                  ? message
                  : stageItem.label;

                return (
                  <div
                    key={stageItem.id}
                    style={{ height: `${ITEM_HEIGHT_PX}px` }}
                    className={`w-full flex items-center justify-center gap-2 px-3 transition-all duration-500 ${
                      isActive
                        ? 'scale-100 opacity-100 font-bold text-sm sm:text-base md:text-lg z-10'
                        : isCompletedStage
                        ? 'scale-95 opacity-50 font-medium text-xs sm:text-sm text-emerald-400/80'
                        : 'scale-90 opacity-30 font-medium text-xs text-slate-400'
                    }`}
                  >
                    {isActive ? (
                      completed ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 animate-bounce" />
                      ) : (
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-fuchsia-400 shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                      )
                    ) : isCompletedStage ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                    )}

                    <span className={`truncate ${
                      isActive 
                        ? (completed 
                            ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]' 
                            : 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-purple-100 to-pink-300 drop-shadow-[0_0_12px_rgba(232,121,249,0.5)]')
                        : ''
                    }`}>
                      {displayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sleek Glassmorphism Loading Bar (Double height: h-8 sm:h-10 md:h-12) */}
        <div className="w-full h-8 sm:h-10 md:h-12 bg-slate-950/90 rounded-full p-1 sm:p-1.5 border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.6)] overflow-hidden relative flex items-center justify-between px-3 sm:px-4">
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-300 ease-out ${
              completed
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_22px_rgba(16,185,129,0.9)]'
                : 'bg-gradient-to-r from-fuchsia-600 via-purple-500 to-pink-500 shadow-[0_0_22px_rgba(217,70,239,0.9)]'
            }`}
            style={{ width: `${progress}%` }}
          />

          {/* Left Side Icon (Green checkmark when completed) */}
          <div className="relative z-10 flex items-center shrink-0 w-5 h-5 justify-center">
            {completed && (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-bounce" />
            )}
          </div>

          {/* Centered Percentage Indicator Inside Progress Bar */}
          <span className="relative z-10 text-xs sm:text-sm font-black font-sans text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-wider">
            {progress}%
          </span>

          {/* Balance spacer element to keep % centered */}
          <div className="w-5 h-5 shrink-0 opacity-0 pointer-events-none" />
        </div>

      </div>
    </div>
  );
};

