// src/hooks/useCurrentFranchiseId.ts
import { useSelector } from "react-redux";
import { RootState } from "../store";

export const useCurrentFranchiseId = (): string | null => {
  return useSelector((state: RootState) => {
    // Coaches are no longer locked to a single franchise — like a
    // manager, they operate against whichever franchise is currently
    // active in the UI (see CoachFranchiseSwitcher in TopBar, which only
    // ever offers franchises the coach actually has a team or session
    // in). Falling back to state.auth.user?.franchiseId covers the brief
    // window right after login before the switcher has picked a default.
    return state.ui.activeFranchiseId ?? state.auth.user?.franchiseId ?? null;
  });
};