import React from 'react';
import { ShoppingBag } from 'lucide-react';

export const VersionBadge: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const isSm = size === 'sm';

  return (
    <div className="relative inline-flex items-center group select-none">
      {/* Metallic Blue Glow Backdrop */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-600 rounded-full blur-[4px] opacity-80 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

      {/* Main Glass Frame with Metallic Blue Border & Glow */}
      <div className={`relative flex items-center justify-center ${
        isSm ? 'px-2.5 py-0.5 text-[9.5px]' : 'px-3.5 py-1 text-xs'
      } font-black rounded-full bg-slate-950/85 dark:bg-slate-950/90 border border-sky-300/90 shadow-[0_0_15px_rgba(56,189,248,0.5)] backdrop-blur-xl`}>
        
        {/* Metallic Blue Gradient Text */}
        <span className="bg-gradient-to-r from-cyan-200 via-sky-100 to-blue-200 bg-clip-text text-transparent font-black tracking-widest drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">
          v3.1.0
        </span>

        {/* 5-pointed Diamond-Gold Sparkling Star at Top-Right */}
        <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center pointer-events-none">
          <svg
            className={`${isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-pulse drop-shadow-[0_0_10px_rgba(56,189,248,0.95)] filter`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="metallic-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0F2FE" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
            </defs>
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="url(#metallic-star-gradient)"
              stroke="#BAE6FD"
              strokeWidth="0.75"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export const LuxuryGlassLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const containerClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-2xl',
    lg: 'w-20 h-20 rounded-[28px]',
  }[size];

  const iconClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-10 h-10',
  }[size];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${containerClasses} group overflow-hidden`}>
      {/* Outer ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 rounded-[28px] blur-md opacity-70 group-hover:opacity-95 transition-opacity duration-500" />

      {/* Frosted Glass Luxury Container */}
      <div className={`relative w-full h-full ${containerClasses} bg-gradient-to-br from-cyan-600/40 via-sky-600/30 to-blue-700/40 backdrop-blur-2xl border border-white/40 dark:border-white/20 shadow-[0_8px_32px_0_rgba(14,165,233,0.4)] flex items-center justify-center transition-all duration-300 group-hover:scale-105`}>
        {/* Reflection Highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        <ShoppingBag className={`${iconClasses} text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)] relative z-10`} />
      </div>
    </div>
  );
};
