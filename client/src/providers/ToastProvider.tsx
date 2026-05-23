// src/providers/ToastProvider.tsx
import { Toaster } from "react-hot-toast";

const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#1a1a24",
          color: "#e2e8f0",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "6px",
          fontSize: "13px",
        },

        success: {
          iconTheme: {
            primary: "#ccff00",
            secondary: "#0a0a0f",
          },
        },

        error: {
          iconTheme: {
            primary: "#ff6b35",
            secondary: "#0a0a0f",
          },
        },
      }}
    />
  );
};

export default ToastProvider;
