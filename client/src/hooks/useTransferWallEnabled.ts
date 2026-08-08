// src/hooks/useTransferWallEnabled.ts
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useGetFranchiseByIdQuery } from "../store/api/franchiseApi";
import { academyApi } from "../store/api/academyApi";

/**
 * Resolves the transfer-wall toggle for the current user's academy, via
 * their franchise. Defaults to `true` while the chain is still loading, or
 * for roles with no franchise (super_admin) — this only ever needs to
 * hide/disable something for manager/coach, never to gate super_admin.
 */
export function useTransferWallEnabled(): boolean {
  const { user } = useSelector((s: RootState) => s.auth);
  const franchiseId = user?.franchiseId;
  const academyId = user?.academyId;

  const { data: franchise } = useGetFranchiseByIdQuery(franchiseId ?? "", { skip: !franchiseId });
  const targetAcademyId = academyId || franchise?.academyId;
  const { data: academy } = academyApi.useGetAcademyByIdQuery(targetAcademyId ?? "", {
    skip: !targetAcademyId,
  });

  if (!targetAcademyId || !academy) return true;
  return academy.transferWallEnabled;
}