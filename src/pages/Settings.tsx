import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { DEFAULT_SETTINGS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate.toString());
  const [isSaving, setIsSaving] = useState(false);
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConversionRate(docSnap.data().bao15ConversionRate?.toString() || DEFAULT_SETTINGS.bao15ConversionRate.toString());
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(conversionRate);
    if (!rate || rate <= 0) {
      toast.error('Tỷ lệ quy đổi không hợp lệ');
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        bao15ConversionRate: rate,
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
    <div className="max-w-xl mx-auto space-y-6 sm:space-y-8 pb-28 sm:pb-8">
      {/* Settings Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 text-slate-900 dark:text-white uppercase">Cài Đặt Hệ Thống</h2>
        
        <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quy đổi Bao 16</label>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-sm sm:text-base">1 bao = </span>
              <input 
                type="number" 
                step="0.1"
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                className="w-24 sm:w-32 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-center text-base sm:text-lg font-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300 text-sm sm:text-base">kg</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-3">Ví dụ: 1 bao = 10 kg. Hệ thống sẽ tự động quy đổi khi Nhập kho.</p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 text-sm sm:text-base cursor-pointer"
          >
            {isSaving ? 'Đang lưu...' : 'LƯU THAY ĐỔI'}
          </button>
        </form>
      </div>

      {/* Reset Data Card for Admin */}
      {user?.role === 'Admin' && (
        <div className="bg-red-500/5 dark:bg-red-500/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-red-500/20">
          <div className="flex items-start gap-3 sm:gap-4 mb-4">
            <div className="p-2.5 sm:p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 uppercase">Reset Dữ Liệu Về Mặc Định</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Xóa toàn bộ dữ liệu nhập xuất, kiểm kê, vay trả và tồn kho để ứng dụng trở về trạng thái ban đầu sạch sẽ trước khi bàn giao thực tế. (Tài khoản người dùng sẽ được giữ lại).
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            className="mt-2 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-black py-3 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Reset Toàn Bộ Dữ Liệu
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-8 h-8 shrink-0 animate-bounce" />
              <h3 className="text-lg font-black uppercase">Xác Nhận Reset Dữ Liệu</h3>
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
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center text-lg font-black uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
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

