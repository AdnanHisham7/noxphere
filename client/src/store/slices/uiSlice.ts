  // src/store/slices/uiSlice.ts
  import { createSlice, PayloadAction } from '@reduxjs/toolkit';

  export type ThemeMode = 'dark' | 'light';

  interface UiState {
    sidebarCollapsed: boolean;
    activeFranchiseId: string | null;
    theme: ThemeMode;
  }

  const savedTheme = (localStorage.getItem('theme') as ThemeMode) || 'dark';
  // Ensure DOM matches initially
  if (typeof document !== 'undefined') {
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  const uiSlice = createSlice({
    name: 'ui',
    initialState: {
      sidebarCollapsed: false,
      activeFranchiseId: localStorage.getItem('activeFranchiseId'),
      theme: savedTheme,
    } as UiState,
    reducers: {
      toggleSidebar: (state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      },
      setActiveFranchise: (state, action: PayloadAction<string>) => {
        state.activeFranchiseId = action.payload;
        localStorage.setItem('activeFranchiseId', action.payload);
      },
      clearActiveFranchise: (state) => {
        state.activeFranchiseId = null;
        localStorage.removeItem('activeFranchiseId');
      },
      toggleTheme: (state) => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', state.theme);
        if (typeof document !== 'undefined') {
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
      setTheme: (state, action: PayloadAction<ThemeMode>) => {
        state.theme = action.payload;
        localStorage.setItem('theme', action.payload);
        if (typeof document !== 'undefined') {
          if (action.payload === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
    },
  });

  export const {
    toggleSidebar,
    setActiveFranchise,
    clearActiveFranchise,
    toggleTheme,
    setTheme,
  } = uiSlice.actions;
  export default uiSlice.reducer;

