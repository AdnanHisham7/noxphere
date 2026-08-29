// src/hooks/useConfirm.tsx
import React, { useCallback, useRef, useState } from "react";
import { ConfirmModal } from "../components/ui/ConfirmModal";

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

const initialState: ConfirmState = {
  isOpen: false,
  title: "",
  message: "",
};

// Promise-based replacement for window.confirm(), rendered as an
// on-brand modal instead of the browser's native dialog. Usage:
//
//   const { confirm, ConfirmDialog } = useConfirm();
//   ...
//   if (!(await confirm({ title: "Remove player", message: "...", danger: true }))) return;
//   ...
//   return <>{ConfirmDialog}</>;
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(initialState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, isOpen: true });
    });
  }, []);

  const settle = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialog = (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, ConfirmDialog };
}