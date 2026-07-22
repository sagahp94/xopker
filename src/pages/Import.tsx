import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { BagTypeID } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { addOfflineTransaction } from '../lib/offlineSync';

export const Import: React.FC = () => {
  const { user } = useAuth();
  const [departmentId] = useState(SYSTEM_DEPARTMENTS[0].id);
  const [bagTypeId, setBagTypeId] = useState<BagTypeID>('BAO15');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) {
      toast.error('Vui lòng nhập số lượng hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!navigator.onLine) {
        addOfflineTransaction({
          type: 'IMPORT',
          departmentId,
          bagTypeId,
          quantity: Number(quantity),
          timestamp: new Date(date).getTime(),
          userId: user?.uid || '',
          userEmail: user?.email || '',
        });
        toast.success(`[Ngoại tuyến] Đã lưu tạm nhập ${quantity} bao!`);
        setQuantity('');
        setIsSubmitting(false);
        return;
      }

      await runTransaction(db, async (t) => {
        // Read Settings for Bao15 conversion
        const settingsRef = doc(db, 'settings', 'global');
        const settingsDoc = await t.get(settingsRef);
        let conversionRate = DEFAULT_SETTINGS.bao15ConversionRate;
        if (settingsDoc.exists()) {
          conversionRate = settingsDoc.data().bao15ConversionRate || conversionRate;
        }

        const inputQty = Number(quantity); // always in "bao"
        const stockQtyToAdd = inputQty; // Always store inventory stock in "bao" for all types

        const inventoryId = `${departmentId}_${bagTypeId}`;
        const inventoryRef = doc(db, 'inventory', inventoryId);
        const invDoc = await t.get(inventoryRef);
        
        let currentQty = 0;
        if (invDoc.exists()) {
          currentQty = invDoc.data().quantity || 0;
        }

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
          quantity: inputQty, // Store import in "bao"
          timestamp: new Date(date).getTime(),
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
          transactionType: 'IMPORT',
          bagTypeId,
          quantity: inputQty,
          beforeData: { quantity: currentQty },
          afterData: { quantity: currentQty + stockQtyToAdd }
        });
      });

      toast.success('Nhập kho thành công!');
      setQuantity('');
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi nhập kho');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 mb-28 sm:mb-8 shadow-sm border border-slate-200 dark:border-slate-800">
      <h2 className="text-xl sm:text-2xl font-black mb-6 sm:mb-8 text-slate-900 dark:text-white uppercase">Nhập Kho</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Loại Bao</label>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {BAG_TYPES.map(bag => (
              <button
                type="button"
                key={bag.id}
                onClick={() => setBagTypeId(bag.id)}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border-2 font-bold transition-all text-sm sm:text-base ${
                  bagTypeId === bag.id 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {bag.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Số lượng (Bao)</label>
          <input 
            type="number" 
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Nhập số lượng bao..."
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 sm:py-3.5 text-lg sm:text-xl font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Ngày nhập</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 sm:py-3.5 text-sm sm:text-base font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 sm:py-4 rounded-xl mt-6 sm:mt-8 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 text-base sm:text-lg"
        >
          {isSubmitting ? 'Đang xử lý...' : 'XÁC NHẬN NHẬP'}
        </button>
      </form>
    </div>
  );
};
