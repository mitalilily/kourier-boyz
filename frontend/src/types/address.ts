export interface Address {
  _id: string;
  user: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  addressType?: "home" | "work" | "other";
  landmark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressFormData {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  addressType?: "home" | "work" | "other";
  landmark?: string;
}

export interface AddressesResponse {
  addresses: Address[];
}

export interface AddressResponse {
  address: Address;
  message?: string;
}
