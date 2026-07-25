import { useCurrentFranchiseId } from "./useCurrentFranchiseId";
import { useGetFranchiseByIdQuery } from "../store/api/franchiseApi";

/**
 * Resolves the academyId of the currently active franchise. Coaches and
 * resources are scoped by academy rather than by a single franchise, so
 * any page that needs to list "every coach in this academy" or "every
 * resource in this academy" should use this instead of franchiseId.
 */
export const useCurrentAcademyId = (): string | null => {
  const franchiseId = useCurrentFranchiseId();
  const { data: franchise } = useGetFranchiseByIdQuery(franchiseId ?? "", {
    skip: !franchiseId,
  });
  return franchise?.academyId ?? null;
};
