// src/store/api/resourcesApi.ts
import { baseApi } from "./baseApi";

export interface Resource {
  id: string;
  franchiseId: string;
  academyId: string;
  uploadedBy: string;
  uploadedByName?: string;
  title?: string;
  notes?: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
}

export interface ResourceListResult {
  data: Resource[];
  storage: StorageUsage | null;
}

export const resourcesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getResources: builder.query<ResourceListResult, { franchiseId: string }>({
      query: ({ franchiseId }) => `/resources?franchiseId=${franchiseId}`,
      transformResponse: (res: { data: ResourceListResult }) => res.data,
      providesTags: [{ type: "Resource", id: "LIST" }],
    }),
    uploadResource: builder.mutation<
      Resource,
      { franchiseId: string; file: File; title?: string; notes?: string }
    >({
      query: ({ franchiseId, file, title, notes }) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("franchiseId", franchiseId);
        if (title) formData.append("title", title.trim());
        if (notes) formData.append("notes", notes.trim());
        return { url: "/resources", method: "POST", body: formData };
      },
      transformResponse: (res: { data: Resource }) => res.data,
      invalidatesTags: [{ type: "Resource", id: "LIST" }],
    }),
    verifyResource: builder.mutation<Resource, string>({
      query: (id) => ({ url: `/resources/${id}/verify`, method: "PATCH" }),
      transformResponse: (res: { data: Resource }) => res.data,
      invalidatesTags: [{ type: "Resource", id: "LIST" }],
    }),
    deleteResource: builder.mutation<void, string>({
      query: (id) => ({ url: `/resources/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Resource", id: "LIST" }],
    }),
  }),
});

export const {
  useGetResourcesQuery,
  useUploadResourceMutation,
  useVerifyResourceMutation,
  useDeleteResourceMutation,
} = resourcesApi;