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
let isSyncingQueue = false;

export function getOfflineQueue(): OfflineTransaction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const list: OfflineTransaction[] = data ? JSON.parse(data) : [];
    // Always sort ascending by timestamp to guarantee strict chronological order execution
    return list.sort((a, b) => a.timestamp - b.timestamp);
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

  // Dispatch custom event so UI updates count instantly
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
    const collectionName = tx.type === 'EXPORT' ? 'exports' : 'imports';
    // Use tx.id as document ID for idempotency check (prevents duplicate execution if retried)
    const txRef = doc(db, collectionName, tx.id);
    const existingTxDoc = await t.get(txRef);

    // If transaction already exists in Firestore, skip inventory adjustment to prevent duplicate inventory updates
    if (existingTxDoc.exists()) {
      return;
    }

    // Read Settings for conversion rate at time of sync
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

    // Update inventory atomically
    t.set(
      inventoryRef,
      {
        id: inventoryId,
        departmentId: tx.departmentId,
        bagTypeId: tx.bagTypeId,
        quantity: finalQty,
        updatedAt: Date.now()
      },
      { merge: true }
    );

    // Write import/export document using tx.id for strict idempotency
    t.set(txRef, {
      id: tx.id,
      offlineTxId: tx.id,
      type: tx.type,
      departmentId: tx.departmentId,
      bagTypeId: tx.bagTypeId,
      quantity: tx.quantity,
      timestamp: tx.timestamp,
      userId: tx.userId,
      userEmail: tx.userEmail,
      conversionRateAtTime: conversionRate
    });

    // Write activity log document
    const logRef = doc(collection(db, 'activityLogs'));
    t.set(logRef, {
      id: logRef.id,
      offlineTxId: tx.id,
      userId: tx.userId,
      userEmail: tx.userEmail,
      timestamp: Date.now(),
      deviceInfo: `Offline Sync / ${navigator.userAgent}`,
      transactionType: tx.type,
      beforeData: { quantity: currentQty },
      afterData: { quantity: finalQty },
      conversionRateAtTime: conversionRate
    });
  });
}

/**
 * Centralized offline queue processor with strict concurrency lock.
 */
export async function processOfflineQueue(): Promise<{
  successCount: number;
  failedCount: number;
  errors: string[];
}> {
  if (isSyncingQueue) {
    return { successCount: 0, failedCount: 0, errors: ['Sync progress is already running'] };
  }

  isSyncingQueue = true;
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  try {
    const queue = getOfflineQueue();
    for (const tx of queue) {
      try {
        await syncSingleTransaction(tx);
        removeOfflineTransaction(tx.id);
        successCount++;
      } catch (err: any) {
        console.error(`Offline sync failed for tx ${tx.id}:`, err);
        failedCount++;
        const msg = err.message || 'Lỗi không xác định';
        errors.push(msg);

        // If inventory is insufficient, drop transaction from queue so it doesn't block future items
        if (msg.includes('Không đủ tồn kho')) {
          removeOfflineTransaction(tx.id);
        } else {
          // If network error, stop processing remaining items to maintain strict order
          break;
        }
      }
    }
  } finally {
    isSyncingQueue = false;
  }

  return { successCount, failedCount, errors };
}
