import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  generateAgreementPDF,
  getAgreementByType,
  getAgreements,
  upsertAgreement,
  type AgreementType,
} from './agreements'

export const useAgreements = () => {
  return useQuery({
    queryKey: ['agreements'],
    queryFn: getAgreements,
  })
}

export const useAgreementByType = (type: AgreementType | null) => {
  return useQuery({
    queryKey: ['agreement', type],
    queryFn: () => getAgreementByType(type!),
    enabled: !!type,
  })
}

export const useUpsertAgreement = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertAgreement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      queryClient.invalidateQueries({ queryKey: ['agreement'] })
    },
  })
}

export const useGenerateAgreementPDF = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateAgreementPDF,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] })
      queryClient.invalidateQueries({ queryKey: ['agreement'] })
    },
  })
}
