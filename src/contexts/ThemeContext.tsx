import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type IconStyle = 'vibrant' | 'minimal' | 'rounded' | 'monochrome';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  iconStyle: IconStyle;
  setIconStyle: (style: IconStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'xopker_theme';
const ICON_STYLE_KEY = 'xopker_icon_style';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  });

  const [iconStyle, setIconStyleState] = useState<IconStyle>(() => {
    const saved = localStorage.getItem(ICON_STYLE_KEY);
    if (saved === 'vibrant' || saved === 'minimal' || saved === 'rounded' || saved === 'monochrome') {
      return saved as IconStyle;
    }
    return 'vibrant';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const setIconStyle = (newStyle: IconStyle) => {
    setIconStyleState(newStyle);
    localStorage.setItem(ICON_STYLE_KEY, newStyle);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-icon-style', iconStyle);
  }, [iconStyle]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark = mediaQuery.matches;
      }

      const root = document.documentElement;
      const body = document.body;
      if (isDark) {
        root.classList.add('dark');
        body.classList.add('dark');
        root.style.colorScheme = 'dark';
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
        root.style.colorScheme = 'light';
        setResolvedTheme('light');
      }
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, iconStyle, setIconStyle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

