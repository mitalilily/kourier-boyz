// src/types/category.ts
import type { CertificateType } from "../api/certificates";

export interface Category {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  mainImage: string;
  hoverImage: string;
  banners: string[];
  top?: boolean;
  status: "active" | "inactive";
  productCount?: number;
  parent?: Category | string | null;
  parentId?: string | null;
  subcategories?: Category[];
  requiredCertificates?: CertificateType[];
  overrideParentCertificateRule?: boolean;
  effectiveRequiredCertificates?: CertificateType[];
  inheritedRequiredCertificates?: CertificateType[];
  inheritsParentCertificateRule?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryStats {
  total: number;
  active: number;
  inactive: number;
  top: number;
}
