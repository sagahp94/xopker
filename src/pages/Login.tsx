import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { LoadingScreen } from '../components/LoadingScreen';
import { LuxuryGlassLogo, VersionBadge } from '../components/BrandLogo';
import { ShieldCheck, UserCheck, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, signInAsDemo, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 font-sans relative overflow-hidden">
      {/* Background Decorative Glow Blobs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-sky-400/30 dark:border-sky-400/20 relative z-10"
      >
        <div className="p-6 sm:p-10 text-center flex flex-col items-center">
          <div className="mb-5 flex justify-center">
            <LuxuryGlassLogo size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">XỐPKER</h1>
            <VersionBadge size="md" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 mb-6 font-semibold text-sm">Hệ thống quản lý kho bao xốp chuyên nghiệp</p>
          
          <button
            type="button"
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white px-6 py-3.5 rounded-full border border-sky-400/40 dark:border-sky-400/50 shadow-xl shadow-sky-500/15 backdrop-blur-xl transition-all duration-300 active:scale-98 font-extrabold text-base cursor-pointer group hover:border-sky-400 hover:shadow-sky-500/25 ring-2 ring-sky-400/20"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-extrabold text-slate-800 dark:text-white">Đăng nhập với Google</span>
          </button>

          {/* Demo Sandbox Quick Login Options */}
          <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80 w-full">
            <div className="flex items-center justify-center gap-1.5 mb-3 text-[11px] font-black tracking-wider text-amber-600 dark:text-amber-400 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dùng thử Chế độ Demo (Sandbox)</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => signInAsDemo('Manager')}
                className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Demo Quản Lý</span>
                </div>
                <span className="text-[10px] font-medium text-amber-600/90 dark:text-amber-400/90">Quyền Quản Lý</span>
              </button>

              <button
                type="button"
                onClick={() => signInAsDemo('Staff')}
                className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-black text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span>Demo Nhân Viên</span>
                </div>
                <span className="text-[10px] font-medium text-emerald-600/90 dark:text-emerald-400/90">Quyền Nhân Viên</span>
              </button>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">
              * Dữ liệu trong Demo Mode chỉ lưu tạm thời và không ảnh hưởng dữ liệu thật.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
