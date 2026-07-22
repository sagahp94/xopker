import { db } from './firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { BagTypeID } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

export interface OfflineTransaction {
  id: string;
  type: 'IMPORT' | 'EXPORT';
  departmentId: string;
  bagTypeId: BagTypeID;
  quantity: number;
  timestamp: number;
  userId: string;
  userEmail: string;
}

const STORAGE_KEY = 'xopker_offline_queue';

export function getOfflineQueue(): OfflineTransaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading offline queue:', e);
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineTransaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving offline queue:', e);
  }
}

export function addOfflineTransaction(tx: Omit<OfflineTransaction, 'id'>): OfflineTransaction {
  const queue = getOfflineQueue();
  const id = `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newTx: OfflineTransaction = { ...tx, id };
  queue.push(newTx);
  saveOfflineQueue(queue);
  
  // Dispatch a custom event so other components can react
  window.dispatchEvent(new Event('offline-queue-changed'));
  return newTx;
}

export function removeOfflineTransaction(id: string) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.id !== id);
  saveOfflineQueue(filtered);
  window.dispatchEvent(new Event('offline-queue-changed'));
}

export async function syncSingleTransaction(tx: OfflineTransaction): Promise<void> {
  await runTransaction(db, async (t) => {
    // Read Settings
    const settingsRef = doc(db, 'settings', 'global');
    const settingsDoc = await t.get(settingsRef);
    let conversionRate = DEFAULT_SETTINGS.bao15ConversionRate;
    if (settingsDoc.exists()) {
      conversionRate = settingsDoc.data().bao15ConversionRate || conversionRate;
    }

    const isBao15 = tx.bagTypeId === 'BAO15';
    
    let stockQtyChange = tx.quantity;
    if (tx.type === 'EXPORT') {
      const qtyInBao = isBao15 ? tx.quantity / conversionRate : tx.quantity;
      stockQtyChange = -qtyInBao;
    } else {
      stockQtyChange = tx.quantity;
    }

    const inventoryId = `${tx.departmentId}_${tx.bagTypeId}`;
    const inventoryRef = doc(db, 'inventory', inventoryId);
    const invDoc = await t.get(inventoryRef);
    
    let currentQty = 0;
    if (invDoc.exists()) {
      currentQty = invDoc.data().quantity || 0;
    }

    const finalQty = currentQty + stockQtyChange;
    if (finalQty < 0) {
      throw new Error(`Không đủ tồn kho cho giao dịch ${tx.type === 'EXPORT' ? 'Xuất' : 'Nhập'} ${tx.bagTypeId}!`);
    }

    t.set(inventoryRef, {
      id: inventoryId,
      departmentId: tx.departmentId,
      bagTypeId: tx.bagTypeId,
      quantity: finalQty,
      updatedAt: Date.now()
    }, { merge: true });

    const collectionName = tx.type === 'EXPORT' ? 'exports' : 'imports';
    const txRef = doc(collection(db, collectionName));
    t.set(txRef, {
      id: txRef.id,
      type: tx.type,
      departmentId: tx.departmentId,
      bagTypeId: tx.bagTypeId,
      quantity: tx.quantity,
      timestamp: tx.timestamp,
      userId: tx.userId,
      userEmail: tx.userEmail,
    });

    const logRef = doc(collection(db, 'activityLogs'));
    t.set(logRef, {
      id: logRef.id,
      userId: tx.userId,
      userEmail: tx.userEmail,
      timestamp: Date.now(),
      deviceInfo: `Offline Sync / ${navigator.userAgent}`,
      transactionType: tx.type,
      beforeData: { quantity: currentQty },
      afterData: { quantity: finalQty }
    });
  });
}
