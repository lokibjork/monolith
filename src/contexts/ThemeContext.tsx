import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  tema: Theme;
  toggleTema: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  tema: 'dark',
  toggleTema: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Theme>(() => {
    return (localStorage.getItem('monolith_tema') as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('monolith_tema', tema);
  }, [tema]);

  const toggleTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ tema, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
