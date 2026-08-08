import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { BAG_TYPES, SYSTEM_DEPARTMENTS, DEFAULT_SETTINGS } from '../constants';
import { startOfDay, endOfDay } from 'date-fns';
import { useAuth } from './AuthContext';
import { useDemo } from './DemoContext';
import { demoStore } from '../services/demoStore';

export interface AppDataContextType {
  stock: Record<string, number>;
  conversionRate: number;
  todayImports: number;
  todayExports: number;
  activeBorrows: number;
  isInitializing: boolean;
  isDataReady: boolean;
  initStep: 'fetching' | 'preparing' | 'done';
  refreshAppData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isDemoMode, demoVersion } = useDemo();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [conversionRate, setConversionRate] = useState(DEFAULT_SETTINGS.bao15ConversionRate);
  const [todayExports, setTodayExports] = useState(0);
  const [todayImports, setTodayImports] = useState(0);
  const [activeBorrows, setActiveBorrows] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  const [initStep, setInitStep] = useState<'fetching' | 'preparing' | 'done'>('preparing');

  const fetchAllData = useCallback(async () => {
    if (isDemoMode || user?.isDemo) {
      // Demo mode: read purely from demoStore
      const demoStock = demoStore.getInventory();
      const demoSettings = demoStore.getSettings();
      const demoImports = demoStore.getImports();
      const demoExports = demoStore.getExports();
      const demoBorrows = demoStore.getBorrowReturns();

      const todayStart = startOfDay(new Date()).getTime();
      const todayEnd = endOfDay(new Date()).getTime();

      const todayImp = demoImports.filter(i => i.timestamp >= todayStart && i.timestamp <= todayEnd).length;
      const todayExp = demoExports.filter(e => e.timestamp >= todayStart && e.timestamp <= todayEnd).length;
      const activeBr = demoBorrows.filter(b => b.status === 'OPEN' || b.status === 'PARTIAL').length;

      setStock(demoStock);
      setConversionRate(demoSettings.bao15ConversionRate);
      setTodayImports(todayImp);
      setTodayExports(todayExp);
      setActiveBorrows(activeBr);
      return;
    }

    try {
      const todayStart = startOfDay(new Date()).getTime();
      const todayEnd = endOfDay(new Date()).getTime();

      // Parallelize all Firestore queries
      const [settingsDoc, inventorySnap, exportsSnap, importsSnap, borrowsSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'global')).catch(() => null),
        getDocs(collection(db, 'inventory')).catch(() => null),
        getDocs(
          query(
            collection(db, 'exports'),
            where('timestamp', '>=', todayStart),
            where('timestamp', '<=', todayEnd)
          )
        ).catch(() => null),
        getDocs(
          query(
            collection(db, 'imports'),
            where('timestamp', '>=', todayStart),
            where('timestamp', '<=', todayEnd)
          )
        ).catch(() => null),
        getDocs(
          query(
            collection(db, 'borrowReturns'),
            where('status', 'in', ['OPEN', 'PARTIAL'])
          )
        ).catch(() => null),
      ]);

      // Process Settings
      let currentRate = DEFAULT_SETTINGS.bao15ConversionRate;
      if (settingsDoc && settingsDoc.exists()) {
        currentRate = settingsDoc.data().bao15ConversionRate || currentRate;
      }
      setConversionRate(currentRate);

      // Process Stock
      const newStock: Record<string, number> = {};
      BAG_TYPES.forEach(b => (newStock[b.id] = 0));

      if (inventorySnap) {
        inventorySnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.bagTypeId && newStock[data.bagTypeId] !== undefined) {
            if (!data.departmentId || data.departmentId === SYSTEM_DEPARTMENTS[0].id) {
              newStock[data.bagTypeId] = data.quantity || 0;
            }
          }
        });
      }
      setStock(newStock);

      // Process Today's Stats
      setTodayExports(exportsSnap ? exportsSnap.size : 0);
      setTodayImports(importsSnap ? importsSnap.size : 0);
      setActiveBorrows(borrowsSnap ? borrowsSnap.size : 0);

    } catch (err) {
      console.error('Error fetching initial app data:', err);
    }
  }, [isDemoMode, user?.isDemo]);

  // Re-fetch on demo version updates
  useEffect(() => {
    if (isDemoMode) {
      fetchAllData();
    }
  }, [isDemoMode, demoVersion, fetchAllData]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsInitializing(true);
      setIsDataReady(false);
      setInitStep('preparing');

      // Step 1: Preparing screen / UI setup
      await new Promise(resolve => setTimeout(resolve, isDemoMode ? 200 : 600));

      if (!isMounted) return;

      // Step 2: Fetching data ("Đang chuẩn bị dữ liệu...")
      setInitStep('fetching');
      const dataTimer = new Promise(resolve => setTimeout(resolve, isDemoMode ? 200 : 800));
      if (user) {
        await Promise.all([dataTimer, fetchAllData()]);
      } else {
        await dataTimer;
      }

      if (!isMounted) return;

      // Step 3: Completion ("Đã hoàn tất")
      setInitStep('done');
      setIsDataReady(true);
      await new Promise(resolve => setTimeout(resolve, isDemoMode ? 100 : 400));

      if (isMounted) {
        setIsInitializing(false);
      }
    }

    if (!authLoading) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, user, fetchAllData, isDemoMode]);

  const refreshAppData = async () => {
    await fetchAllData();
  };

  return (
    <AppDataContext.Provider
      value={{
        stock,
        conversionRate,
        todayImports,
        todayExports,
        activeBorrows,
        isInitializing: authLoading || isInitializing,
        isDataReady,
        initStep,
        refreshAppData,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
