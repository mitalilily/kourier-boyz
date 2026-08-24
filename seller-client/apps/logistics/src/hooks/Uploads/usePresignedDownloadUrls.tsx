import { useMutation, useQuery } from '@tanstack/react-query'
import { getPresignedDownloadUrls } from '../../api/upload.api'

type UsePresignedDownloadOptions = {
  keys: string | string[] | undefined
  enabled?: boolean
}

/**
 * React Query hook to fetch presigned download URL(s)
 * - Accepts string or string[]
 */
export const usePresignedDownloadUrls = ({ keys, enabled = true }: UsePresignedDownloadOptions) => {
  return useQuery({
    queryKey: ['presigned-download', keys],
    queryFn: () => {
      if (!keys) throw new Error('No keys provided')
      return getPresignedDownloadUrls(keys)
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

type PresignedDownloadMutationProps = {
  keys: string[]
}

export const usePresignedDownloadMutation = () => {
  return useMutation({
    mutationFn: async ({ keys }: PresignedDownloadMutationProps) => {
      if (!keys?.length) throw new Error('No keys provided for download')
      return getPresignedDownloadUrls(keys)
    },
  })
}
