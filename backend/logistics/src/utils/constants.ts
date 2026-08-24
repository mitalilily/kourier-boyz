import {
  BusinessStructure,
  CompanyType,
  KycDetails,
} from "../types/users.types";

export const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

export const requiredKycDetails: Record<
  BusinessStructure,
  (keyof KycDetails)[] | Record<CompanyType, (keyof KycDetails)[]>
> = {
  individual: ["panNumber", "panCardUrl", "aadhaarUrl", "cancelledChequeUrl"],
  sole_proprietor: [
    "panNumber",
    "gstin",
    "panCardUrl",
    "aadhaarUrl",
    "cancelledChequeUrl",
    "gstCertificateUrl",
  ],
  partnership_firm: [
    "panNumber",
    "gstin",
    "partnershipDeedUrl",
    "panCardUrl",
    "aadhaarUrl",
    "cancelledChequeUrl",
    "gstCertificateUrl",
  ],
  company: {
    private_limited: [
      "panNumber",
      "gstin",
      "cin",
      "gstCertificateUrl",
      "boardResolutionUrl",
      "businessPanUrl",
      "aadhaarUrl",
    ],
    llp: [
      "panNumber",
      "gstin",
      "businessPanUrl",
      "aadhaarUrl",
      "companyAddressProofUrl",
      "cancelledChequeUrl",
      "llpAgreementUrl",
      "gstCertificateUrl",
    ],
    one_person_company: [
      "panNumber",
      "gstin",
      "businessPanUrl",
      "aadhaarUrl",
      "cin",
      "companyAddressProofUrl",
      "cancelledChequeUrl",
    ],
    section_8_company: [
      "panNumber",
      "gstin",
      "businessPanUrl",
      "aadhaarUrl",
      "companyAddressProofUrl",
      "boardResolutionUrl",
      "cancelledChequeUrl",
    ],
    public_limited: [
      "panNumber",
      "gstin",
      "businessPanUrl",
      "aadhaarUrl",
      "gstCertificateUrl",
    ],
  },
};

export const requiredKycFieldMap: Record<
  BusinessStructure,
  Record<string, boolean> | Record<CompanyType, Record<string, boolean>>
> = {
  individual: {
    panNumber: true,
    gstin: false,
    panCardUrl: true,
    aadhaarUrl: true,
    cancelledChequeUrl: true,
  },
  sole_proprietor: {
    panNumber: true,
    gstin: false,
    panCardUrl: true,
    aadhaarUrl: true,
    cancelledChequeUrl: true,
  },
  partnership_firm: {
    panNumber: true,
    gstin: false,
    partnershipDeedUrl: true,
    panCardUrl: true,
    aadhaarUrl: true,
    cancelledChequeUrl: true,
    gstCertificateUrl: false,
  },
  company: {
    private_limited: {
      panNumber: true,
      gstin: false,
      cin: true,
      gstCertificateUrl: true,
      boardResolutionUrl: true,
      businessPanUrl: true,
      aadhaarUrl: true,
    },
    llp: {
      panNumber: true,
      gstin: false,
      businessPanUrl: true,
      aadhaarUrl: true,
      companyAddressProofUrl: true,
      cancelledChequeUrl: true,
      llpAgreementUrl: true,
      gstCertificateUrl: false,
    },
    one_person_company: {
      panNumber: true,
      gstin: false,
      businessPanUrl: true,
      aadhaarUrl: true,
      cin: true,
      companyAddressProofUrl: true,
      cancelledChequeUrl: true,
    },
    section_8_company: {
      panNumber: true,
      gstin: false,
      businessPanUrl: true,
      aadhaarUrl: true,
      companyAddressProofUrl: true,
      boardResolutionUrl: true,
      cancelledChequeUrl: true,
    },
    public_limited: {
      panNumber: true,
      gstin: false,
      businessPanUrl: true,
      aadhaarUrl: true,
      gstCertificateUrl: true,
    },
  },
};
