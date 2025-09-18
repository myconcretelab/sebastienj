import React, { useMemo } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material';

const paperTextureSvg =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Cdefs%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3C/defs%3E%3Crect width="200" height="200" filter="url(%23noise)" opacity="0.08"/%3E%3C/svg%3E';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: {
            main: '#6f89a6'
          },
          secondary: {
            main: '#d49a89'
          },
          background: {
            default: '#fdf8f1',
            paper: '#f8f2e8'
          }
        },
        typography: {
          fontFamily: '"Nunito", "Helvetica", "Arial", sans-serif',
          h1: { fontWeight: 700 },
          h2: { fontWeight: 600 }
        },
        shape: {
          borderRadius: 16
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.85)), url(${paperTextureSvg})`,
                boxShadow:
                  '0 12px 24px rgba(111, 137, 166, 0.08), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(111,137,166,0.12)'
              }
            }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: 0.2
              }
            }
          }
        }
      }),
    []
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            backgroundColor: theme.palette.background.default,
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(217, 191, 158, 0.1), transparent 40%), radial-gradient(circle at 80% 0%, rgba(163, 198, 216, 0.12), transparent 45%), url(${paperTextureSvg})`,
            backgroundAttachment: 'fixed',
            color: '#413832'
          }
        }}
      />
      {children}
    </MuiThemeProvider>
  );
};
