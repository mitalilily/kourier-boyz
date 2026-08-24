import axiosInstance from "./axiosInstance";

export const getPresignedDownloadUrls = async (
  keys: string | string[]
): Promise<string | Array<string | null>> => {
  const response = await axiosInstance.post("/uploads/presign-download-url", {
    keys,
  });

  if (Array.isArray(keys)) {
    return (response.data.urls || []) as Array<string | null>;
  } else {
    return response.data.url as string;
  }
};
