// src/hooks/useTransferWallEnabled.ts
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useGetFranchiseByIdQuery } from "../store/api/franchiseApi";
import { academyApi } from "../store/api/academyApi";
import { useGetPlatformTransferWallQuery } from "../store/api/academySubscriptionApi";

/**
 * Resolves the transfer-wall toggle globally (platform-level) and per-academy.
 * If the platform-wide toggle is disabled by Super Admin, returns false everywhere.
 * Otherwise, checks the user's academy transfer-wall setting.
 */
export function useTransferWallEnabled(): boolean {
  const { data: platformEnabled } = useGetPlatformTransferWallQuery();
  const { user } = useSelector((s: RootState) => s.auth);
  const franchiseId = user?.franchiseId;
  const academyId = user?.academyId;

  const { data: franchise } = useGetFranchiseByIdQuery(franchiseId ?? "", { skip: !franchiseId });
  const targetAcademyId = academyId || franchise?.academyId;
  const { data: academy } = academyApi.useGetAcademyByIdQuery(targetAcademyId ?? "", {
    skip: !targetAcademyId,
  });

  if (platformEnabled === false) return false;
  if (!targetAcademyId || !academy) return true;
  return academy.transferWallEnabled;
}