// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  sidebarCollapsed: boolean;
  activeAcademyId: string | null;
  activeAcademyName: string | null;
}

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    sidebarCollapsed: false,
    activeAcademyId: localStorage.getItem("activeAcademyId"),
    activeAcademyName: localStorage.getItem("activeAcademyName"),
  } as UiState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setActiveAcademy: (
      state,
      action: PayloadAction<{ id: string; name: string }>,
    ) => {
      state.activeAcademyId = action.payload.id;
      state.activeAcademyName = action.payload.name;
      localStorage.setItem("activeAcademyId", action.payload.id);
      localStorage.setItem("activeAcademyName", action.payload.name);
    },
  },
});

export const { toggleSidebar, setActiveAcademy } = uiSlice.actions;
export default uiSlice.reducer;
