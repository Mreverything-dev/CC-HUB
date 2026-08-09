import { ReactNode } from 'react';

import { ThemeContextProvider } from '@/contexts/ThemeContext';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContextProvider>{children}</ThemeContextProvider>;
}
