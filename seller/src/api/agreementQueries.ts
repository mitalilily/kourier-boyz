import { useQuery } from '@tanstack/react-query'
import { getAgreementByType, type AgreementType } from './agreements'

export const useAgreementByType = (type: AgreementType | null) => {
  return useQuery({
    queryKey: ['agreement', type],
    queryFn: () => getAgreementByType(type!),
    enabled: !!type, // Only fetch if type is provided
  })
}

// Helper hook to always fetch agreement (for PDF viewing)
export const useAgreementAlways = (type: AgreementType) => {
  return useQuery({
    queryKey: ['agreement', type],
    queryFn: () => getAgreementByType(type),
    enabled: true, // Always enabled
  })
}
