import { useQuery } from '@tanstack/react-query'
import { fetchWalletBalance, fetchWalletTransactions } from '../api/wallet.api'
import { isDemoLogisticsSession } from '../demo/demoSession'

export const useWalletBalance = (enabled = true) => {
  const demoMode = isDemoLogisticsSession()
  const query = useQuery({
    queryKey: ['walletBalance'],
    queryFn: fetchWalletBalance,
    enabled: enabled && !demoMode,
    initialData: demoMode ? { data: { balance: 86420 } } : undefined,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
  })

  return query
}

interface UseWalletTransactionsOptions {
  limit?: number
  page?: number
  type?: 'credit' | 'debit'
  dateFrom?: string
  dateTo?: string
  enabled?: boolean
}

export const useWalletTransactions = ({
  limit = 50,
  page = 0,
  type,
  dateFrom,
  dateTo,
  enabled = true,
}: UseWalletTransactionsOptions = {}) => {
  return useQuery({
    queryKey: ['walletTransactions', page, limit, type, dateFrom, dateTo],
    queryFn: () =>
      fetchWalletTransactions({
        limit,
        page,
        type,
        dateFrom,
        dateTo,
      }),
    enabled,
  })
}
