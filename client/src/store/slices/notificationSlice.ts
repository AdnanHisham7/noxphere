// src/store/slices/notificationSlice.ts
import { createSlice } from "@reduxjs/toolkit";

interface NotificationState {
  unreadCount: number;
  items: {
    id: string;
    title: string;
    body: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }[];
}

const notificationSlice = createSlice({
  name: "notifications",
  initialState: { unreadCount: 0, items: [] } as NotificationState,
  reducers: {
    setNotifications: (state, action) => {
      state.items = action.payload;
      state.unreadCount = action.payload.filter(
        (n: { isRead: boolean }) => !n.isRead,
      ).length;
    },
    addNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
    markOneRead: (state, action) => {
      const item = state.items.find((n) => n.id === action.payload);
      if (item && !item.isRead) {
        item.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead: (state) => {
      state.items.forEach((n) => (n.isRead = true));
      state.unreadCount = 0;
    },
    clearNotifications: (state) => {
      state.items = [];
      state.unreadCount = 0;
    },
  },
});

export const { setNotifications, addNotification, markOneRead, markAllRead, clearNotifications } =
  notificationSlice.actions;
export default notificationSlice.reducer;