import React, { useState, useRef, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import toast from 'react-hot-toast';
import { addOfflineTransaction } from '../lib/offlineSync';
import { showUndoToast, UndoableRecord } from '../utils/undoTransaction';
import { PackagePlus, Calendar, RotateCcw, CheckCircle2, ArrowRight, AlertTriangle, X, ShieldCheck } from 'lucide-react';

const INITIAL_QUANTITIES: Record<BagTypeID, number> = {
  BAO15: 0,
  BAO20: 0,
  BAO25: 0,
  BAO30: 0,
  BAO37: 0,
};

export const Import: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const [departmentId] = useState(SYSTEM_DEPARTMENTS[0].id);
  const [quantities, setQuantities] = useState<Record<BagTypeID, number>>(INITIAL_QUANTITIES);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAdjust = useCallback((typeId: BagTypeID, amount: number) => {
    setQuantities(prev => ({
      ...prev,
      [typeId]: Math.max(0, prev[typeId] + amount)
    }));
  }, []);

  const startAdjust = (typeId: BagTypeID, amount: number) => {
    handleAdjust(typeId, amount);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      handleAdjust(typeId, amount);
    }, 150);
  };

  const stopAdjust = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClearAll = () => {
    setQuantities(INITIAL_QUANTITIES);
  };

  // Calculate valid non-zero items
  const validEntries = (Object.entries(quantities) as [BagTypeID, number][]).filter(
    ([_, qty]) => qty > 0
  );

  const totalBags = validEntries.reduce((sum, [_, qty]) => sum + qty, 0);

  // Form submit handler opens confirmation modal
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (validEntries.length === 0) {
      toast.error('Vui lòng chọn số lượng nhập cho ít nhất 1 loại bao!');
      return;
    }
    setShowConfirmModal(true);
  };

  // Actual execution of import
  const executeImport = async () => {
    setIsSubmitting(true);
    try {
      const selectedDate = date ? new Date(date) : new Date();
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const timestamp = selectedDate.getTime();

      if (isDemoMode) {
        const demoRecords = demoStore.executeImport(validEntries, timestamp, user);
        notifyDemoChange();
        showUndoToast(`[Sandbox Demo] Đã nhập kho thành công ${validEntries.length} loại bao!`, demoRecords.map(r => ({
          docId: r.id,
          type: 'IMPORT',
          departmentId,
          bagTypeId: r.bagTypeId,
          quantity: r.quantity,
          qtyInBao: r.quantity,
          isOffline: false,
          userId: user?.uid,
          userEmail: user?.email,
        })));
        setQuantities(INITIAL_QUANTITIES);
        setShowConfirmModal(false);
        setIsSubmitting(false);
        return;
      }

      if (!navigator.onLine) {
        const offlineRecords: UndoableRecord[] = [];
        validEntries.forEach(([bagTypeId, qty]) => {
          const offlineTx = addOfflineTransaction({
            type: 'IMPORT',
            departmentId,
            bagTypeId,
            quantity: qty,
            timestamp,
            userId: user?.uid || '',
            userEmail: user?.email || '',
          });
          offlineRecords.push({
            docId: offlineTx.id,
            type: 'IMPORT',
            departmentId,
            bagTypeId,
            quantity: qty,
            qtyInBao: qty,
            isOffline: true,
            userId: user?.uid,
            userEmail: user?.email,
          });
        });

        showUndoToast(`[Ngoại tuyến] Đã lưu tạm nhập ${validEntries.length} loại bao!`, offlineRecords);
        setQuantities(INITIAL_QUANTITIES);
        setShowConfirmModal(false);
        setIsSubmitting(false);
        return;
      }

      const createdRecords: UndoableRecord[] = [];

      await runTransaction(db, async (t) => {
        // Read Settings once for conversion rate if needed
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let conversionRate = DEFAULT_SETTINGS.bao15ConversionRate;
        if (settingsDoc.exists()) {
          conversionRate = settingsDoc.data().bao15ConversionRate || conversionRate;
        }

        // STEP 1: ALL READS FIRST BEFORE ANY WRITES
        const currentQtyMap: Record<string, number> = {};

        for (const [bagTypeId] of validEntries) {
          const inventoryId = `${departmentId}_${bagTypeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);
          const invDoc = await t.get(inventoryRef);
          
          let currentQty = 0;
          if (invDoc.exists()) {
            currentQty = invDoc.data().quantity || 0;
          }
          currentQtyMap[bagTypeId] = currentQty;
        }

        // STEP 2: ALL WRITES AFTER ALL READS ARE COMPLETE
        for (const [bagTypeId, inputQty] of validEntries) {
          const stockQtyToAdd = inputQty; // Always store inventory stock in "bao"
          const currentQty = currentQtyMap[bagTypeId] || 0;

          const inventoryId = `${departmentId}_${bagTypeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);

          t.set(inventoryRef, {
            id: inventoryId,
            departmentId,
            bagTypeId,
            quantity: currentQty + stockQtyToAdd,
            updatedAt: Date.now()
          }, { merge: true });

          const txRef = doc(collection(db, 'imports'));
          t.set(txRef, {
            id: txRef.id,
            type: 'IMPORT',
            departmentId,
            bagTypeId,
            quantity: inputQty,
            timestamp,
            userId: user?.uid,
            userEmail: user?.email,
            conversionRateAtTime: conversionRate,
          });

          createdRecords.push({
            docId: txRef.id,
            type: 'IMPORT',
            departmentId,
            bagTypeId,
            quantity: inputQty,
            qtyInBao: stockQtyToAdd,
            isOffline: false,
            userId: user?.uid,
            userEmail: user?.email,
          });

          const logRef = doc(collection(db, 'activityLogs'));
          t.set(logRef, {
            id: logRef.id,
            userId: user?.uid,
            userEmail: user?.email,
            timestamp,
            deviceInfo: navigator.userAgent,
            transactionType: 'IMPORT',
            bagTypeId,
            quantity: inputQty,
            beforeData: { quantity: currentQty },
            afterData: { quantity: currentQty + stockQtyToAdd },
            conversionRateAtTime: conversionRate,
          });
        }
      });

      showUndoToast(`Đã nhập kho thành công ${validEntries.length} loại bao xốp!`, createdRecords);
      setQuantities(INITIAL_QUANTITIES);
      setShowConfirmModal(false);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || 'Lỗi khi nhập kho');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 pb-36 sm:pb-8 shadow-sm border border-slate-200 dark:border-slate-800 ring-4 ring-indigo-500/5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase">
            <PackagePlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            NHẬP KHO HÀNG LOẠT
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
            Tăng/giảm số lượng các loại bao rồi bấm Nhập Kho 1 lần duy nhất
          </p>
        </div>

        {validEntries.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại
          </button>
        )}
      </div>

      <form onSubmit={handleOpenConfirm} className="flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Date Selection */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Ngày Nhập Kho
            </label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-2xs"
              required
            />
          </div>

          {/* Bag Types List (Same structure as FastExport) */}
          <div className="flex-1 flex flex-col gap-3.5">
            {BAG_TYPES.map((bag) => {
              const qty = quantities[bag.id];
              const isSelected = qty > 0;
              const step = 1;

              return (
                <div 
                  key={bag.id}
                  className={`rounded-3xl p-4 transition-all duration-300 relative overflow-hidden backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-purple-500/15 dark:from-sky-500/25 dark:via-indigo-500/20 dark:to-purple-500/25 border border-sky-400/70 dark:border-sky-400/80 shadow-[0_12px_32px_0_rgba(14,165,233,0.25)] ring-2 ring-sky-400/50' 
                      : 'bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-sky-400/40 shadow-xs'
                  }`}
                >
                  {/* Bag Info */}
                  <div className="flex justify-between items-center sm:block">
                    <div>
                      <div className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-base flex items-center gap-2">
                        {bag.name}
                        {isSelected && (
                          <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white border border-sky-300/40 shadow-xs backdrop-blur-md">
                            Đã chọn
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Đơn vị: bao</div>
                    </div>
                  </div>

                  {/* Controls (- / Number / +) */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); startAdjust(bag.id, -step); }}
                      onPointerUp={stopAdjust}
                      onPointerLeave={stopAdjust}
                      onContextMenu={e => e.preventDefault()}
                      className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-full active:scale-95 transition-all touch-manipulation select-none shadow-xs backdrop-blur-md hover:border-sky-400/50 cursor-pointer"
                    >
                      <span className="text-xl font-black text-slate-700 dark:text-slate-300">-</span>
                    </button>

                    <div className="flex-1 min-w-[65px] sm:w-32 sm:flex-none h-10 sm:h-12 bg-white/90 dark:bg-slate-900/90 border border-sky-400/40 rounded-full flex items-center justify-center shadow-inner backdrop-blur-md px-2 sm:px-3">
                      <input 
                        type="number"
                        min="0"
                        step="1"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setQuantities(prev => ({ ...prev, [bag.id]: val }));
                        }}
                        placeholder="0"
                        className="w-0 flex-1 min-w-0 text-center bg-transparent font-black text-lg sm:text-xl text-sky-600 dark:text-sky-400 outline-none p-0 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
                      />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-0.5">bao</span>
                    </div>

                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); startAdjust(bag.id, step); }}
                      onPointerUp={stopAdjust}
                      onPointerLeave={stopAdjust}
                      onContextMenu={e => e.preventDefault()}
                      className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-full active:scale-95 transition-all touch-manipulation select-none shadow-xs backdrop-blur-md hover:border-sky-400/50 cursor-pointer"
                    >
                      <span className="text-xl font-black text-slate-700 dark:text-slate-300">+</span>
                    </button>

                    {/* Quick +5 & +10 increment buttons */}
                    <button
                      type="button"
                      onClick={() => handleAdjust(bag.id, 5)}
                      className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-white/70 dark:bg-slate-800/70 border border-sky-400/40 rounded-full font-extrabold text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 active:scale-95 transition-all cursor-pointer shadow-xs backdrop-blur-md shrink-0"
                      title="Cộng thêm 5 bao"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(bag.id, 10)}
                      className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-white/70 dark:bg-slate-800/70 border border-sky-400/40 rounded-full font-extrabold text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 active:scale-95 transition-all cursor-pointer shadow-xs backdrop-blur-md shrink-0"
                      title="Cộng thêm 10 bao"
                    >
                      +10
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary & Submit Action Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          {validEntries.length > 0 ? (
            <div className="p-3.5 mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Đã chọn {validEntries.length} loại bao để nhập:
                </span>
                <span className="font-black text-sm text-indigo-600 dark:text-indigo-400">
                  Tổng: {totalBags} bao
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {validEntries.map(([typeId, qty]) => {
                  const bag = BAG_TYPES.find(b => b.id === typeId);
                  return (
                    <span key={typeId} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 text-[11px] font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
                      {bag?.name}: <strong>{qty} bao</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 font-medium mb-3">
              Chưa chọn số lượng nhập. Sử dụng nút +/- hoặc nhập số lượng ở các dòng trên.
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || validEntries.length === 0}
            className="w-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none text-white font-black py-4 px-8 rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md text-base sm:text-lg cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Đang xử lý nhập kho...</span>
              </div>
            ) : (
              <>
                <span>XÁC NHẬN NHẬP KHO {validEntries.length > 0 ? `(${validEntries.length} LOẠI BAO)` : ''}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                    XÁC NHẬN SỐ LƯỢNG NHẬP KHO
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Kiểm tra lại toàn bộ chi tiết trước khi cập nhật dữ liệu
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Ngày nhập kho:
                </span>
                <span className="font-black text-slate-900 dark:text-white text-sm">{date}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="text-xs font-black uppercase text-slate-400 tracking-wider mb-1">
                  Danh Sách Bao Xốp Sẽ Nhập Kho:
                </div>
                <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {validEntries.map(([typeId, qty]) => {
                    const bag = BAG_TYPES.find(b => b.id === typeId);
                    return (
                      <div key={typeId} className="py-2.5 flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {bag?.name || typeId}
                        </span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-3 py-1 rounded-lg text-sm border border-indigo-200 dark:border-indigo-900">
                          + {qty} bao
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-black text-sm text-slate-900 dark:text-white">
                  <span>TỔNG CỘNG ({validEntries.length} loại bao):</span>
                  <span className="text-base text-indigo-600 dark:text-indigo-400 font-black">{totalBags} bao</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3.5 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy / Chỉnh Sửa
              </button>
              <button
                type="button"
                onClick={executeImport}
                disabled={isSubmitting}
                className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 font-black text-xs sm:text-sm text-white transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang lưu...</span>
                  </div>
                ) : (
                  <>
                    <span>Đồng Ý Nhập Kho</span>
                    <CheckCircle2 className="w-4 h-4" />
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


