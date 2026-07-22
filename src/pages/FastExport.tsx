import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BAG_TYPES, SYSTEM_DEPARTMENTS } from '../constants';
import { BagTypeID, Transaction } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { addOfflineTransaction } from '../lib/offlineSync';

const INITIAL_QUANTITIES: Record<BagTypeID, number> = {
  BAO15: 0,
  BAO20: 0,
  BAO25: 0,
  BAO30: 0,
  BAO37: 0,
};

export const FastExport: React.FC = () => {
  const { user } = useAuth();
  const [quantities, setQuantities] = useState(INITIAL_QUANTITIES);
  const [departmentId] = useState(SYSTEM_DEPARTMENTS[0].id);
  const [isExporting, setIsExporting] = useState<BagTypeID | null>(null);

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

  const handleExport = async (typeId: BagTypeID) => {
    const qty = quantities[typeId];
    if (qty <= 0) return;
    
    setIsExporting(typeId);
    
    try {
      if (!navigator.onLine) {
        addOfflineTransaction({
          type: 'EXPORT',
          departmentId,
          bagTypeId: typeId,
          quantity: qty,
          timestamp: Date.now(),
          userId: user?.uid || '',
          userEmail: user?.email || '',
        });
        toast.success(`[Ngoại tuyến] Đã lưu tạm xuất ${qty} ${typeId === 'BAO15' ? 'kg' : 'bao'}!`);
        setTimeout(() => {
          setQuantities(prev => ({ ...prev, [typeId]: 0 }));
        }, 1000);
        return;
      }

      await runTransaction(db, async (t) => {
        // Read Settings for conversion rate
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let currentRate = 10; // Default fallback
        if (settingsDoc.exists()) {
          currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
        }

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
          throw new Error('Không đủ tồn kho!');
        }

        t.set(inventoryRef, {
          id: inventoryId,
          departmentId,
          bagTypeId: typeId,
          quantity: currentQty - qtyInBao,
          updatedAt: Date.now()
        }, { merge: true });

        const txRef = doc(collection(db, 'exports'));
        t.set(txRef, {
          id: txRef.id,
          type: 'EXPORT',
          departmentId,
          bagTypeId: typeId,
          quantity: qty, // Store the export quantity in kg
          timestamp: Date.now(),
          userId: user?.uid,
          userEmail: user?.email,
        });

        const logRef = doc(collection(db, 'activityLogs'));
        t.set(logRef, {
          id: logRef.id,
          userId: user?.uid,
          userEmail: user?.email,
          timestamp: Date.now(),
          deviceInfo: navigator.userAgent,
          transactionType: 'EXPORT',
          bagTypeId: typeId,
          quantity: qty,
          beforeData: { quantity: currentQty },
          afterData: { quantity: currentQty - qtyInBao }
        });
      });

      toast.success(`Đã xuất ${qty} ${typeId === 'BAO15' ? 'kg' : 'bao'} thành công!`);
      
      setTimeout(() => {
        setQuantities(prev => ({ ...prev, [typeId]: 0 }));
      }, 1000);

    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi xuất kho');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 pb-28 sm:pb-6 shadow-sm border border-slate-200 dark:border-slate-800 ring-4 ring-indigo-500/5">
      <div className="mb-5 sm:mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase">XUẤT NHANH</h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">Chế độ thao tác nhanh liên tục</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {BAG_TYPES.map((bag) => {
          const isBao15 = bag.id === 'BAO15';
          const step = isBao15 ? 5 : 1;
          const unit = isBao15 ? 'kg' : 'bao';
          const qty = quantities[bag.id];

          return (
            <div 
              key={bag.id} 
              className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:border-slate-200 dark:hover:border-slate-700"
            >
              {/* Left Column: Title & details */}
              <div className="flex justify-between items-center sm:block">
                <div>
                  <div className="font-black text-slate-800 dark:text-slate-200 text-lg sm:text-base">{bag.name}</div>
                  <div className="text-xs text-slate-400 font-medium mt-0.5">Bước tăng: {step} {unit}</div>
                </div>
              </div>
              
              {/* Middle Column: Controls (- / Number / +) */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onPointerDown={(e) => { e.preventDefault(); startAdjust(bag.id, -step); }}
                  onPointerUp={stopAdjust}
                  onPointerLeave={stopAdjust}
                  onContextMenu={e => e.preventDefault()}
                  className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl active:bg-slate-100 dark:active:bg-slate-700 transition-colors touch-manipulation select-none shadow-sm"
                >
                  <span className="text-2xl font-black text-slate-600 dark:text-slate-400">-</span>
                </button>
                
                <div className="flex-1 sm:w-28 sm:flex-none h-12 sm:h-14 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shadow-inner">
                  <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {qty} <span className="text-xs sm:text-sm font-bold ml-1 opacity-70">{unit}</span>
                  </span>
                </div>
                
                <button
                  onPointerDown={(e) => { e.preventDefault(); startAdjust(bag.id, step); }}
                  onPointerUp={stopAdjust}
                  onPointerLeave={stopAdjust}
                  onContextMenu={e => e.preventDefault()}
                  className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl active:bg-slate-100 dark:active:bg-slate-700 transition-colors touch-manipulation select-none shadow-sm"
                >
                  <span className="text-2xl font-black text-slate-600 dark:text-slate-400">+</span>
                </button>
              </div>

              {/* Right Column: Export Button */}
              <div className="w-full sm:w-28 shrink-0">
                <button
                  onClick={() => handleExport(bag.id)}
                  disabled={qty === 0 || isExporting === bag.id}
                  className="w-full h-12 sm:h-14 rounded-xl font-black text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-600/20 disabled:shadow-none disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600"
                >
                  {isExporting === bag.id ? (
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : (
                    'XUẤT'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
