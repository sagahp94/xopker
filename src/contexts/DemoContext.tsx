import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { demoStore } from '../services/demoStore';

interface DemoContextType {
  isDemoMode: boolean;
  demoRole: 'Manager' | 'Staff' | null;
  demoVersion: number;
  enterDemoMode: (role: 'Manager' | 'Staff') => void;
  exitDemoMode: () => void;
  notifyDemoChange: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoRole, setDemoRole] = useState<'Manager' | 'Staff' | null>(null);
  const [demoVersion, setDemoVersion] = useState<number>(0);

  const notifyDemoChange = useCallback(() => {
    setDemoVersion(prev => prev + 1);
  }, []);

  const enterDemoMode = useCallback((role: 'Manager' | 'Staff') => {
    demoStore.resetToInitial();
    setDemoRole(role);
    setIsDemoMode(true);
    setDemoVersion(prev => prev + 1);
  }, []);

  const exitDemoMode = useCallback(() => {
    demoStore.resetToInitial();
    setIsDemoMode(false);
    setDemoRole(null);
    setDemoVersion(0);
  }, []);

  // Cleanup on unmount or refresh
  useEffect(() => {
    return () => {
      if (isDemoMode) {
        demoStore.resetToInitial();
      }
    };
  }, [isDemoMode]);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoRole,
        demoVersion,
        enterDemoMode,
        exitDemoMode,
        notifyDemoChange,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
