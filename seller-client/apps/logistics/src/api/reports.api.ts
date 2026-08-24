import axiosInstance from './axiosInstance'

export interface CustomReportPayload {
  fromDate: string
  toDate: string
  selectedFields: string[]
}

export const downloadCustomReportCsv = async (payload: CustomReportPayload): Promise<Blob> => {
  const response = await axiosInstance.post('/reports/custom-export', payload, {
    responseType: 'blob',
  })
  return response.data
}
