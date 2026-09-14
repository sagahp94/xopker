import React from 'react';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { doc, runTransaction, collection } from 'firebase/firestore';
import { removeOfflineTransaction } from '../lib/offlineSync';
import { demoStore } from '../services/demoStore';
import { BagTypeID } from '../types';
import { CheckCircle2, RotateCcw } from 'lucide-react';

export interface UndoableRecord {
  docId: string;
  type: 'IMPORT' | 'EXPORT';
  departmentId: string;
  bagTypeId: BagTypeID;
  quantity: number; // raw input qty
  qtyInBao: number; // stock qty in bao
  isOffline: boolean;
  userId?: string;
  userEmail?: string;
}

export async function performUndo(records: UndoableRecord[]): Promise<void> {
  if (!records || records.length === 0) return;

  const offlineRecords = records.filter(r => r.isOffline);
  const onlineRecords = records.filter(r => !r.isOffline);

  // 1. Handle offline records
  for (const rec of offlineRecords) {
    removeOfflineTransaction(rec.docId);
  }

  // 2. Handle online records in Firestore or Demo Store
  if (onlineRecords.length > 0) {
    const demoRecords = onlineRecords.filter(r => r.docId.startsWith('demo-'));
    const realOnlineRecords = onlineRecords.filter(r => !r.docId.startsWith('demo-'));

    // Handle demo records
    for (const rec of demoRecords) {
      demoStore.undoTransaction(rec.docId, rec.type, rec.bagTypeId, rec.qtyInBao, null);
    }

    if (realOnlineRecords.length > 0) {
      await runTransaction(db, async (t) => {
        // READ PHASE FIRST
        const currentStockMap: Record<string, number> = {};
        for (const rec of realOnlineRecords) {
          const inventoryId = `${rec.departmentId}_${rec.bagTypeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);
          const invDoc = await t.get(inventoryRef);

          let currentQty = 0;
          if (invDoc.exists()) {
            currentQty = invDoc.data().quantity || 0;
          }

          // For undoing IMPORT: subtract stock
          if (rec.type === 'IMPORT') {
            const newQty = currentQty - rec.qtyInBao;
            if (newQty < 0) {
              throw new Error(`Không thể hoàn tác nhập ${rec.bagTypeId}: tồn kho hiện tại (${currentQty}) ít hơn số lượng cần trừ (${rec.qtyInBao}).`);
            }
            currentStockMap[rec.docId] = newQty;
          } else {
            // For undoing EXPORT: add stock back
            currentStockMap[rec.docId] = currentQty + rec.qtyInBao;
          }
        }

        // WRITE PHASE AFTER ALL READS ARE COMPLETE
        for (const rec of realOnlineRecords) {
          const inventoryId = `${rec.departmentId}_${rec.bagTypeId}`;
          const inventoryRef = doc(db, 'inventory', inventoryId);
          const collectionName = rec.type === 'IMPORT' ? 'imports' : 'exports';
          const txRef = doc(db, collectionName, rec.docId);

          const newQty = currentStockMap[rec.docId];

          // Update inventory
          t.set(inventoryRef, {
            id: inventoryId,
            departmentId: rec.departmentId,
            bagTypeId: rec.bagTypeId,
            quantity: newQty,
            updatedAt: Date.now()
          }, { merge: true });

          // Delete the transaction document
          t.delete(txRef);

          // Write activity log for UNDO action
          const logRef = doc(collection(db, 'activityLogs'));
          t.set(logRef, {
            id: logRef.id,
            userId: rec.userId || '',
            userEmail: rec.userEmail || '',
            timestamp: Date.now(),
            deviceInfo: `Undo Action / ${navigator.userAgent}`,
            transactionType: `UNDO_${rec.type}`,
            bagTypeId: rec.bagTypeId,
            quantity: rec.quantity,
            afterData: { quantity: newQty },
            note: `Hoàn tác giao dịch ${rec.type === 'IMPORT' ? 'Nhập' : 'Xuất'} (Mã: ${rec.docId})`
          });
        }
      });
    }
  }
}

export function showUndoToast(
  message: string,
  records: UndoableRecord[],
  onSuccessUndo?: () => void
) {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-2 duration-300' : 'animate-out fade-out duration-200'
        } max-w-md w-full bg-slate-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-white/10 p-3.5 sm:p-4 justify-between items-center gap-3 border border-slate-700`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black text-white truncate">{message}</p>
            <p className="text-[10.5px] text-slate-400 font-medium">Có thể hoàn tác trong 8 giây</p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            toast.dismiss(t.id);
            const loadingToast = toast.loading('Đang hoàn tác giao dịch...');
            try {
              await performUndo(records);
              toast.dismiss(loadingToast);
              toast.success('Đã hoàn tác giao dịch thành công!');
              if (onSuccessUndo) onSuccessUndo();
            } catch (err: any) {
              toast.dismiss(loadingToast);
              toast.error(err.message || 'Lỗi khi hoàn tác giao dịch!');
            }
          }}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-xl shadow-md transition-all duration-200 flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Hoàn tác
        </button>
      </div>
    ),
    { duration: 8000 }
  );
}
