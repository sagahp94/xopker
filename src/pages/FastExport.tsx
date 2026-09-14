import React, { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import { demoStore } from '../services/demoStore';
import toast from 'react-hot-toast';
import { addOfflineTransaction } from '../lib/offlineSync';
import { showUndoToast, UndoableRecord } from '../utils/undoTransaction';
import { Zap, RotateCcw, CheckCircle2, ArrowRight, Calendar, PackageCheck, X } from 'lucide-react';

const INITIAL_QUANTITIES: Record<BagTypeID, number> = {
  BAO15: 0,
  BAO20: 0,
  BAO25: 0,
  BAO30: 0,
  BAO37: 0,
};

export const FastExport: React.FC = () => {
  const { user } = useAuth();
  const { isDemoMode, notifyDemoChange } = useDemo();
  const [quantities, setQuantities] = useState(INITIAL_QUANTITIES);
  const [departmentId] = useState(SYSTEM_DEPARTMENTS[0].id);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allowCustomExportDate, setAllowCustomExportDate] = useState<boolean>(DEFAULT_SETTINGS.allowCustomExportDate);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const isAdmin = user?.role === 'Admin';

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      const demoSettings = demoStore.getSettings();
      setAllowCustomExportDate(demoSettings.allowCustomExportDate ?? DEFAULT_SETTINGS.allowCustomExportDate);
      return;
    }

    const fetchGlobalSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setAllowCustomExportDate(snap.data().allowCustomExportDate ?? DEFAULT_SETTINGS.allowCustomExportDate);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchGlobalSettings();
  }, [isDemoMode]);

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

  // Get valid non-zero items
  const validEntries = (Object.entries(quantities) as [BagTypeID, number][]).filter(
    ([_, qty]) => qty > 0
  );

  const handleOpenConfirmModal = () => {
    if (validEntries.length === 0) {
      toast.error('Vui lòng chọn số lượng cần xuất cho ít nhất 1 loại bao!');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleBatchExport = async () => {
    if (validEntries.length === 0) {
      toast.error('Vui lòng chọn số lượng cần xuất cho ít nhất 1 loại bao!');
      return;
    }

    setIsExporting(true);

    try {
      let targetTimestamp = Date.now();
      if (allowCustomExportDate && exportDate) {
        const d = new Date(exportDate);
        const now = new Date();
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        targetTimestamp = d.getTime();
      }

      if (isDemoMode) {
        const demoRecords = demoStore.executeExport(validEntries, targetTimestamp, user);
        notifyDemoChange();
        showUndoToast(`[Sandbox Demo] Đã xuất kho thành công ${validEntries.length} loại bao!`, demoRecords.map(r => ({
          docId: r.id,
          type: 'EXPORT',
          departmentId,
          bagTypeId: r.bagTypeId,
          quantity: r.quantity,
          qtyInBao: r.bagTypeId === 'BAO15' ? r.quantity / (demoStore.getSettings().bao15ConversionRate || 10) : r.quantity,
          isOffline: false,
          userId: user?.uid,
          userEmail: user?.email,
        })));
        setQuantities(INITIAL_QUANTITIES);
        setIsExporting(false);
        setShowConfirmModal(false);
        return;
      }

      if (!navigator.onLine) {
        const offlineRecords: UndoableRecord[] = [];
        validEntries.forEach(([typeId, qty]) => {
          const offlineTx = addOfflineTransaction({
            type: 'EXPORT',
            departmentId,
            bagTypeId: typeId,
            quantity: qty,
            timestamp: targetTimestamp,
            userId: user?.uid || '',
            userEmail: user?.email || '',
          });
          offlineRecords.push({
            docId: offlineTx.id,
            type: 'EXPORT',
            departmentId,
            bagTypeId: typeId,
            quantity: qty,
            qtyInBao: typeId === 'BAO15' ? qty / (DEFAULT_SETTINGS.bao15ConversionRate || 10) : qty,
            isOffline: true,
            userId: user?.uid,
            userEmail: user?.email,
          });
        });

        showUndoToast(`[Ngoại tuyến] Đã lưu tạm xuất ${validEntries.length} loại bao!`, offlineRecords);
        setQuantities(INITIAL_QUANTITIES);
        setIsExporting(false);
        return;
      }

      const createdRecords: UndoableRecord[] = [];

      await runTransaction(db, async (t) => {
        // Read Settings for conversion rate
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let currentRate = DEFAULT_SETTINGS.bao15ConversionRate || 10;
        if (settingsDoc.exists()) {
          currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        }

        const timestamp = targetTimestamp;

        // STEP 1: ALL READS FIRST BEFORE ANY WRITES
        const currentQtyMap: Record<string, number> = {};

        for (const [typeId, qty] of validEntries) {
          const isBao15 = typeId === 'BAO15';
          const qtyInBao = isBao15 ? qty / currentRate : qty;

          const inventoryId = `${departmentId}_${typeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);
          const invDoc = await t.get(inventoryRef);

          let currentQty = 0;
          if (invDoc.exists()) {
            currentQty = invDoc.data().quantity || 0;
          }

          if (currentQty < qtyInBao) {
            const bagName = BAG_TYPES.find(b => b.id === typeId)?.name || typeId;
            throw new Error(`Không đủ tồn kho cho ${bagName}! Cần ${qtyInBao} bao, kho chỉ còn ${currentQty} bao.`);
          }

          currentQtyMap[typeId] = currentQty;
        }

        // STEP 2: ALL WRITES AFTER ALL READS ARE COMPLETE
        for (const [typeId, qty] of validEntries) {
          const isBao15 = typeId === 'BAO15';
          const qtyInBao = isBao15 ? qty / currentRate : qty;
          const currentQty = currentQtyMap[typeId] || 0;

          const inventoryId = `${departmentId}_${typeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);

          t.set(inventoryRef, {
            id: inventoryId,
            departmentId,
            bagTypeId: typeId,
            quantity: currentQty - qtyInBao,
            updatedAt: timestamp
          }, { merge: true });

          const txRef = doc(collection(db, 'exports'));
          t.set(txRef, {
            id: txRef.id,
            type: 'EXPORT',
            departmentId,
            bagTypeId: typeId,
            quantity: qty,
            timestamp,
            userId: user?.uid,
            userEmail: user?.email,
            conversionRateAtTime: currentRate,
          });

          createdRecords.push({
            docId: txRef.id,
            type: 'EXPORT',
            departmentId,
            bagTypeId: typeId,
            quantity: qty,
            qtyInBao,
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
            transactionType: 'EXPORT',
            bagTypeId: typeId,
            quantity: qty,
            beforeData: { quantity: currentQty },
            afterData: { quantity: currentQty - qtyInBao },
            conversionRateAtTime: currentRate,
          });
        }
      });

      showUndoToast(`Đã xuất kho thành công ${validEntries.length} loại bao đã chọn!`, createdRecords);
      setQuantities(INITIAL_QUANTITIES);

    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || 'Lỗi khi xuất kho');
    } finally {
      setIsExporting(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 pb-36 sm:pb-8 shadow-sm border border-slate-200 dark:border-slate-800 ring-4 ring-indigo-500/5">
      {/* Header */}
      <div className="mb-5 sm:mb-6 flex justify-between items-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase">
            <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            XUẤT NHANH TẤT CẢ
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
            Tăng/giảm số lượng các loại bao rồi bấm Xuất Kho 1 lần duy nhất
          </p>
        </div>

        {validEntries.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại
          </button>
        )}
      </div>

      {/* Custom Date Picker (when enabled in Settings) */}
      {allowCustomExportDate && (
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Ngày Xuất Kho
            </label>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
              {exportDate ? format(new Date(exportDate + 'T00:00:00'), 'dd/MM/yyyy') : ''}
            </span>
          </div>
          <input 
            type="date" 
            value={exportDate}
            onChange={(e) => setExportDate(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-2xs"
            required
          />
        </div>
      )}

      {/* List of Bag Types */}
      <div className="flex-1 flex flex-col gap-3.5">
        {BAG_TYPES.map((bag) => {
          const isBao15 = bag.id === 'BAO15';
          const step = isBao15 ? 5 : 1;
          const unit = isBao15 ? 'kg' : 'bao';
          const qty = quantities[bag.id];
          const isSelected = qty > 0;

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
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Bước tăng/giảm: {step} {unit}</div>
                </div>
              </div>
              
              {/* Controls (- / Number / +) */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                <button
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
                    step={step}
                    value={qty === 0 ? '' : qty}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setQuantities(prev => ({ ...prev, [bag.id]: val }));
                    }}
                    placeholder="0"
                    className="w-0 flex-1 min-w-0 text-center bg-transparent font-black text-lg sm:text-xl text-sky-600 dark:text-sky-400 outline-none p-0 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-slate-400"
                  />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-0.5">{unit}</span>
                </div>
                
                <button
                  onPointerDown={(e) => { e.preventDefault(); startAdjust(bag.id, step); }}
                  onPointerUp={stopAdjust}
                  onPointerLeave={stopAdjust}
                  onContextMenu={e => e.preventDefault()}
                  className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-full active:scale-95 transition-all touch-manipulation select-none shadow-xs backdrop-blur-md hover:border-sky-400/50 cursor-pointer"
                >
                  <span className="text-xl font-black text-slate-700 dark:text-slate-300">+</span>
                </button>

                {/* Quick +10 / +50 buttons for ultra fast tapping */}
                <button
                  onClick={() => handleAdjust(bag.id, isBao15 ? 10 : 5)}
                  className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-white/70 dark:bg-slate-800/70 border border-sky-400/40 rounded-full font-extrabold text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 active:scale-95 transition-all cursor-pointer shadow-xs backdrop-blur-md shrink-0"
                  title={`Cộng thêm ${isBao15 ? 10 : 5}`}
                >
                  +{isBao15 ? 10 : 5}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary & Batch Submit Action Footer */}
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        {validEntries.length > 0 ? (
          <div className="p-3.5 mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Đã chọn {validEntries.length} loại bao để xuất:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {validEntries.map(([typeId, qty]) => {
                const bag = BAG_TYPES.find(b => b.id === typeId);
                const unit = typeId === 'BAO15' ? 'kg' : 'bao';
                return (
                  <span key={typeId} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 text-[11px] font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
                    {bag?.name}: <strong>{qty} {unit}</strong>
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400 font-medium mb-3">
            Chưa chọn số lượng xuất. Sử dụng nút +/- hoặc nhập số lượng ở các dòng trên.
          </p>
        )}

        <button
          onClick={handleOpenConfirmModal}
          disabled={isExporting || validEntries.length === 0}
          className="w-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 disabled:from-slate-200 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none text-white font-black py-4 px-8 rounded-full transition-all duration-300 shadow-xl shadow-indigo-500/25 border border-sky-300/30 backdrop-blur-md text-base sm:text-lg cursor-pointer flex items-center justify-center gap-2 active:scale-98"
        >
          {isExporting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Đang xử lý xuất kho...</span>
            </div>
          ) : (
            <>
              <span>XÁC NHẬN XUẤT KHO {validEntries.length > 0 ? `(${validEntries.length} LOẠI BAO)` : ''}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => !isExporting && setShowConfirmModal(false)}
        >
          <div 
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-sky-400/40 dark:border-sky-400/30 flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase">
                    Xác Nhận Xuất Kho
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Vui lòng kiểm tra lại thông tin xuất hàng
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date info if applicable */}
            {allowCustomExportDate && exportDate && (
              <div className="mt-3.5 px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Ngày xuất kho:
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">
                  {format(new Date(exportDate + 'T00:00:00'), 'dd/MM/yyyy')}
                </span>
              </div>
            )}

            {/* Bag Types & Quantities Summary List */}
            <div className="my-4 space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Danh sách bao xuất kho ({validEntries.length} loại):
              </div>
              
              <div className="space-y-2">
                {validEntries.map(([typeId, qty]) => {
                  const bag = BAG_TYPES.find(b => b.id === typeId);
                  const isBao15 = typeId === 'BAO15';
                  const unit = isBao15 ? 'kg' : 'bao';

                  return (
                    <div 
                      key={typeId} 
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 shadow-2xs" />
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                          {bag?.name || typeId}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                          {qty} <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{unit}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-full border border-slate-300 dark:border-slate-700 font-extrabold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleBatchExport}
                className="flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isExporting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xuất...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận xuất</span>
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

