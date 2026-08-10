import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "./axiosInstance";

export interface BrandingSettings {
  invoiceLogoUrl?: string;
  labelLogoUrl?: string;
  signatureUrl?: string;
  signatureName?: string;
  signatureTitle?: string;
  companyName?: string;
  companyTagline?: string;
}

export interface AboutUsSettings {
  title?: string;
  content?: string;
  heroImage?: string;
  mission?: string;
  vision?: string;
  isPublished?: boolean;
}

interface BrandingResponse {
  success: boolean;
  data: BrandingSettings;
}

interface AboutUsResponse {
  success: boolean;
  data: AboutUsSettings;
}

export const fetchBrandingSettings = async (): Promise<BrandingResponse> => {
  const response = await API.get<BrandingResponse>("/admin/settings/branding");
  return response.data;
};

export const updateBrandingSettingsApi = async (
  payload: FormData
): Promise<BrandingResponse> => {
  const response = await API.post<BrandingResponse>(
    "/admin/settings/branding",
    payload,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export const useBrandingSettings = () => {
  return useQuery({
    queryKey: ["branding-settings"],
    queryFn: fetchBrandingSettings,
  });
};

export const useUpdateBrandingSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBrandingSettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding-settings"] });
    },
  });
};

// About Us Settings
export const fetchAboutUsSettings = async (): Promise<AboutUsResponse> => {
  const response = await API.get<AboutUsResponse>("/admin/settings/about-us");
  return response.data;
};

export const updateAboutUsSettingsApi = async (
  payload: FormData
): Promise<AboutUsResponse> => {
  const response = await API.post<AboutUsResponse>(
    "/admin/settings/about-us",
    payload,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export const useAboutUsSettings = () => {
  return useQuery({
    queryKey: ["about-us-settings"],
    queryFn: fetchAboutUsSettings,
  });
};

export const useUpdateAboutUsSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAboutUsSettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["about-us-settings"] });
    },
  });
};

// Invoice Settings
export interface InvoiceSettings {
  invoicePrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  financialYearFormat: string;
  sequenceStart: number;
  resetFrequency: 'FINANCIAL_YEAR' | 'CALENDAR_YEAR' | 'NEVER';
  currency: string;
  roundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  gstRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  dateFormat: string;
  showHsnSummary: boolean;
  showGstBreakup: boolean;
  allowSellerLogo: boolean;
  allowSellerSignature: boolean;
  allowSellerFooterNote: boolean;
  lockAfterIssue: boolean;
}

interface InvoiceSettingsResponse {
  success: boolean;
  data: InvoiceSettings;
}

export const fetchInvoiceSettings = async (): Promise<InvoiceSettingsResponse> => {
  const response = await API.get<InvoiceSettingsResponse>("/admin/settings/invoice");
  return response.data;
};

export const updateInvoiceSettingsApi = async (
  payload: Partial<InvoiceSettings>
): Promise<InvoiceSettingsResponse> => {
  const response = await API.post<InvoiceSettingsResponse>(
    "/admin/settings/invoice",
    payload
  );
  return response.data;
};

export const useInvoiceSettings = () => {
  return useQuery({
    queryKey: ["invoice-settings"],
    queryFn: fetchInvoiceSettings,
  });
};

export const useUpdateInvoiceSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInvoiceSettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
    },
  });
};

// SLA / TAT Settings
export interface SLASettings {
  _id?: string;
  awbGenerationTatHours: number;
  dispatchTatHours: number;
  sellerOverrides?: Array<{
    sellerId: string;
    awbGenerationTatHours?: number;
    dispatchTatHours?: number;
  }>;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SLASettingsResponse {
  success: boolean;
  data: SLASettings;
}

export const fetchSLASettings = async (): Promise<SLASettingsResponse> => {
  const response = await API.get<SLASettingsResponse>("/admin/settings/sla");
  return response.data;
};

export const updateSLASettingsApi = async (
  payload: Partial<SLASettings>
): Promise<SLASettingsResponse> => {
  const response = await API.put<SLASettingsResponse>(
    "/admin/settings/sla",
    payload
  );
  return response.data;
};

export const useSLASettings = () => {
  return useQuery({
    queryKey: ["sla-settings"],
    queryFn: fetchSLASettings,
  });
};

export const useUpdateSLASettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSLASettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-settings"] });
    },
  });
};

// Footer Settings
export interface SocialLink {
  platform: 'facebook' | 'twitter' | 'instagram' | 'youtube' | 'linkedin' | 'pinterest' | 'tiktok' | 'snapchat';
  url: string;
  order?: number;
}

export interface FooterSettings {
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  socialLinks?: SocialLink[];
}

interface FooterResponse {
  success: boolean;
  data: FooterSettings;
}

export const fetchFooterSettings = async (): Promise<FooterResponse> => {
  const response = await API.get<FooterResponse>("/admin/settings/footer");
  return response.data;
};

export const updateFooterSettingsApi = async (
  payload: Partial<FooterSettings>
): Promise<FooterResponse> => {
  const response = await API.post<FooterResponse>(
    "/admin/settings/footer",
    payload
  );
  return response.data;
};

export const useFooterSettings = () => {
  return useQuery({
    queryKey: ["footer-settings"],
    queryFn: fetchFooterSettings,
  });
};

export const useUpdateFooterSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFooterSettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footer-settings"] });
    },
  });
};

// Settlement Calculation Settings
export interface SettlementSettings {
  // Commission Calculation
  // Note: commissionType and commissionValue come from Global/Seller settings
  commissionRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  includeShippingInSaleAmount: boolean;

  // Fee Calculation
  includeShippingInNetAmount: boolean;
  courierFeeCalculationMethod: 'AWB_WISE' | 'ORDER_WISE';
  codFeeCalculationMethod: 'AWB_WISE' | 'ORDER_WISE';
  pgFeeCalculationMethod: 'PERCENTAGE' | 'FIXED' | 'FROM_PAYMENT_META';
  pgFeePercentage?: number;
  pgFeeFixedAmount?: number;

  // Rounding Settings
  settlementAmountRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  feeRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  ledgerEntryRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  roundLedgerEntriesIndividually: boolean;
  roundLedgerAggregation: boolean;
  ledgerAggregationRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';

  // Calculation Method
  netAmountCalculationMethod: 'CREDITS_MINUS_DEBITS' | 'SALE_MINUS_ALL';

  // Settlement Eligibility
  requireOrderDelivered: boolean;
  requireReturnWindowPassed: boolean;
  excludeReplacementOrders: boolean;
  excludeCancelledOrders: boolean;
  excludeFullyReturnedOrders: boolean;

  // Batch Generation
  // Note: minimumSettlementAmount (minBatchAmount) comes from Global/Seller settings
  allowNegativeSettlements: boolean;
  createCarryForwardOnNegativeClamp: boolean;
  includeUnlinkedLedgerEntries: boolean;
  includePreviousNegativeBalances: boolean;

  // Ledger Entry Creation
  createLedgerEntriesOnEligibility: boolean;
  createLedgerEntriesOnBatchCreation: boolean;
  roundLedgerEntriesBeforeStorage: boolean;

  // TDS/TCS
  calculateTdsAtBatchLevel: boolean;
  calculateTcsAtBatchLevel: boolean;
  tdsRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';
  tcsRoundingMode: 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN';

  // Refund & Return
  reverseCommissionOnReturn: boolean;
  reverseShippingOnReturn: boolean;
  reverseCourierCostOnReturn: boolean;
  refundCalculationMethod: 'FULL' | 'PROPORTIONAL';
}

interface SettlementSettingsResponse {
  success: boolean;
  data: SettlementSettings;
}

export const fetchSettlementSettings = async (): Promise<SettlementSettingsResponse> => {
  const response = await API.get<SettlementSettingsResponse>("/admin/settings/settlement");
  return response.data;
};

export const updateSettlementSettingsApi = async (
  payload: Partial<SettlementSettings>
): Promise<SettlementSettingsResponse> => {
  const response = await API.post<SettlementSettingsResponse>(
    "/admin/settings/settlement",
    payload
  );
  return response.data;
};

export const useSettlementSettings = () => {
  return useQuery({
    queryKey: ["settlement-settings"],
    queryFn: fetchSettlementSettings,
  });
};

export const useUpdateSettlementSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettlementSettingsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement-settings"] });
    },
  });
};
