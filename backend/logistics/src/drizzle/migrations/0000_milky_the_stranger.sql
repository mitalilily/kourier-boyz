CREATE TYPE "public"."bank_account_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."accountType" AS ENUM('CURRENT', 'SAVINGS');--> statement-breakpoint
CREATE TYPE "public"."billingInvoiceTypeEnum" AS ENUM('weekly', 'monthly_summary', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('paid', 'pending', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."cod_remittance_status" AS ENUM('pending', 'credited');--> statement-breakpoint
CREATE TYPE "public"."invoice_adjustment_type" AS ENUM('credit', 'debit', 'waiver', 'surcharge');--> statement-breakpoint
CREATE TYPE "public"."invoice_dispute_status" AS ENUM('open', 'in_review', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."invoice_payment_method" AS ENUM('upi', 'neft', 'pg', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('b2b', 'b2c');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'verification_in_progress', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."business_structure_enum" AS ENUM('individual', 'company', 'partnership_firm', 'sole_proprietor');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."wallet_topup_status" AS ENUM('created', 'processing', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "b2b_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" varchar(255),
	"company_gst" varchar(50),
	"order_number" varchar(50) NOT NULL,
	"cod_charges" numeric,
	"order_id" varchar(100),
	"order_date" varchar(50) NOT NULL,
	"order_amount" numeric NOT NULL,
	"integration_type" varchar(50),
	"order_type" varchar(20) NOT NULL,
	"prepaid_amount" numeric,
	"freight_charges" numeric,
	"shipping_charges" numeric,
	"courier_cost" numeric,
	"transaction_fee" numeric,
	"discount" numeric,
	"gift_wrap" numeric,
	"order_status" varchar(50) DEFAULT 'pending',
	"invoice_number" varchar(100),
	"invoice_date" varchar(50),
	"invoice_amount" numeric,
	"buyer_name" varchar(255) NOT NULL,
	"buyer_phone" varchar(20) NOT NULL,
	"buyer_email" varchar(255),
	"address" varchar(500) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'India',
	"pincode" varchar(20) NOT NULL,
	"label" varchar(100),
	"invoice_link" varchar(300),
	"manifest" varchar(100),
	"products" jsonb NOT NULL,
	"packages" jsonb,
	"weight" numeric,
	"length" numeric,
	"breadth" numeric,
	"height" numeric,
	"actual_weight" numeric,
	"volumetric_weight" numeric,
	"charged_weight" numeric,
	"weight_discrepancy" boolean DEFAULT false,
	"courier_partner" varchar(50),
	"courier_id" numeric,
	"awb_number" varchar(100),
	"shipment_id" varchar(100),
	"provider_reference" varchar(120),
	"provider_request_id" varchar(120),
	"provider_mode" varchar(50),
	"provider_service" varchar(50),
	"provider_last_status" varchar(80),
	"provider_meta" jsonb,
	"is_insurance" boolean DEFAULT false,
	"declared_value" numeric,
	"rov_charge" numeric,
	"charges_breakdown" jsonb,
	"delivery_location" varchar(100),
	"delivery_message" varchar(100),
	"pickup_location_id" varchar(50),
	"pickup_details" jsonb,
	"rto_details" jsonb,
	"is_rto_different" boolean DEFAULT false,
	"is_external_api" boolean DEFAULT false,
	"tags" varchar(200),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "b2b_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "b2c_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"order_date" varchar(50) NOT NULL,
	"order_amount" numeric NOT NULL,
	"order_id" varchar(100),
	"cod_charges" numeric,
	"invoice_number" varchar(100),
	"invoice_date" varchar(50),
	"invoice_amount" numeric,
	"buyer_name" varchar(255) NOT NULL,
	"buyer_phone" varchar(20) NOT NULL,
	"buyer_email" varchar(255),
	"address" varchar(500) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'India',
	"pincode" varchar(20) NOT NULL,
	"products" jsonb NOT NULL,
	"weight" numeric NOT NULL,
	"length" numeric NOT NULL,
	"breadth" numeric NOT NULL,
	"height" numeric NOT NULL,
	"actual_weight" numeric,
	"volumetric_weight" numeric,
	"charged_weight" numeric,
	"weight_discrepancy" boolean DEFAULT false,
	"charged_slabs" numeric,
	"order_type" varchar(20) NOT NULL,
	"prepaid_amount" numeric,
	"freight_charges" numeric,
	"shipping_charges" numeric,
	"other_charges" numeric,
	"gst_percent" numeric DEFAULT 0,
	"gst_amount" numeric DEFAULT 0,
	"wallet_debit_amount" numeric DEFAULT 0,
	"courier_cost" numeric,
	"transaction_fee" numeric,
	"gift_wrap" numeric,
	"discount" numeric,
	"edd" varchar(120),
	"order_status" varchar(50) DEFAULT 'pending',
	"pickup_status" varchar(50) DEFAULT 'pending',
	"pickup_error" varchar(255),
	"courier_partner" varchar(50),
	"delivery_location" varchar(100),
	"delivery_message" varchar(100),
	"courier_id" numeric,
	"shipping_mode" varchar(50),
	"selected_max_slab_weight" numeric,
	"shipment_id" varchar(100),
	"provider_reference" varchar(120),
	"provider_request_id" varchar(120),
	"provider_mode" varchar(50),
	"provider_service" varchar(50),
	"provider_last_status" varchar(80),
	"provider_meta" jsonb,
	"is_insurance" boolean DEFAULT false,
	"label" varchar(100),
	"sort_code" varchar(100),
	"invoice_link" varchar(300),
	"manifest" varchar(100),
	"manifest_error" varchar(255),
	"manifest_retry_count" integer DEFAULT 0 NOT NULL,
	"manifest_last_retry_at" timestamp,
	"awb_number" varchar(100),
	"pickup_location_id" varchar(50),
	"pickup_details" jsonb,
	"rto_details" jsonb,
	"is_rto_different" boolean DEFAULT false,
	"integration_type" varchar DEFAULT 'delhivery',
	"is_external_api" boolean DEFAULT false,
	"tags" varchar(200),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "b2c_orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"bankName" varchar(128) NOT NULL,
	"branch" varchar(128) NOT NULL,
	"accountHolder" varchar(128) NOT NULL,
	"upiId" varchar(128),
	"accountNumber" varchar(64),
	"accountType" "accountType" DEFAULT 'CURRENT',
	"fundAccountId" varchar(128),
	"isPrimary" boolean DEFAULT false,
	"ifsc" varchar(12),
	"chequeImageUrl" varchar(255),
	"status" "bank_account_status" DEFAULT 'pending' NOT NULL,
	"rejectionReason" varchar,
	"createdAt" timestamp DEFAULT now(),
	CONSTRAINT "bank_accounts_upiId_unique" UNIQUE("upiId"),
	CONSTRAINT "bank_accounts_accountNumber_unique" UNIQUE("accountNumber"),
	CONSTRAINT "bank_accounts_fundAccountId_unique" UNIQUE("fundAccountId")
);
--> statement-breakpoint
CREATE TABLE "billingInvoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" varchar(50) NOT NULL,
	"seller_id" uuid NOT NULL,
	"billing_start" date NOT NULL,
	"billing_end" date NOT NULL,
	"taxable_value" numeric(12, 2) DEFAULT '0',
	"cgst" numeric(12, 2) DEFAULT '0',
	"sgst" numeric(12, 2) DEFAULT '0',
	"igst" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) DEFAULT '0',
	"gst_rate" integer DEFAULT 18,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"type" "billingInvoiceTypeEnum" DEFAULT 'weekly' NOT NULL,
	"pdf_url" text NOT NULL,
	"csv_url" text NOT NULL,
	"order_numbers" jsonb,
	"is_disputed" boolean DEFAULT false,
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "billingInvoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "billing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"frequency" varchar(20) DEFAULT 'weekly',
	"auto_generate" boolean DEFAULT true,
	"custom_frequency_days" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blogs" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" varchar(512) NOT NULL,
	"slug" varchar(512) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"featured_image" varchar(1024),
	"featured_image_alt" varchar(512),
	"tags" text,
	"meta_title" varchar(512),
	"meta_description" text,
	"focus_keywords" varchar(512),
	"og_image" varchar(1024),
	"published_at" timestamp,
	"author_id" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blogs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cod_remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_type" varchar(10) NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"awb_number" varchar(100),
	"courier_partner" varchar(50),
	"cod_amount" numeric(12, 2) NOT NULL,
	"cod_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"shipping_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remittable_amount" numeric(12, 2) NOT NULL,
	"status" "cod_remittance_status" DEFAULT 'pending' NOT NULL,
	"collected_at" timestamp,
	"credited_at" timestamp,
	"wallet_transaction_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courier_priority_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"personalised_order" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"api_base" varchar(255) DEFAULT '' NOT NULL,
	"client_name" varchar(255) DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"client_id" varchar(255) DEFAULT '' NOT NULL,
	"username" varchar(255) DEFAULT '' NOT NULL,
	"password" varchar(255) DEFAULT '' NOT NULL,
	"webhook_secret" varchar(255) DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courier_credentials_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "courier_registration_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"provider" varchar(50) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"address_id" uuid,
	"pickup_address_id" uuid,
	"warehouse_alias" varchar(255),
	"error_code" varchar(100),
	"error_message" text NOT NULL,
	"error_payload" jsonb,
	"request_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"serviceProvider" varchar(100) NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"business_type" jsonb DEFAULT '["b2c","b2b"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "couriers_id_serviceProvider_pk" PRIMARY KEY("id","serviceProvider")
);
--> statement-breakpoint
CREATE TABLE "courier_summary" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_courier_count" integer NOT NULL,
	"serviceable_pincodes_count" integer NOT NULL,
	"pickup_pincodes_count" integer NOT NULL,
	"total_rto_count" integer NOT NULL,
	"total_oda_count" integer NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "developer_issue_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_key" varchar(255) NOT NULL,
	"admin_user_id" uuid,
	"action" varchar(50) NOT NULL,
	"note" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_issue_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_key" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"owner_admin_id" uuid,
	"resolved_by_admin_id" uuid,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"alert_seen_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"widget_visibility" jsonb DEFAULT '{"quickStats":true,"quickActions":true,"insights":true,"actionItems":true,"recommendations":true,"performanceMetrics":true,"ordersTrend":true,"financialHealth":true,"recentActivity":true,"revenueChart":true,"todaysOperations":true,"orderStatusChart":true,"revenueByTypeChart":true,"courierComparison":true,"metricsOverview":true,"courierPerformance":true,"topDestinations":true}'::jsonb NOT NULL,
	"widget_order" jsonb DEFAULT '["quickStats","quickActions","insights","actionItems","recommendations","performanceMetrics","ordersTrend","financialHealth","recentActivity","revenueChart","todaysOperations","orderStatusChart","revenueByTypeChart","courierComparison","metricsOverview","courierPerformance","topDestinations"]'::jsonb NOT NULL,
	"layout" jsonb DEFAULT '{"columns":12,"spacing":3,"cardStyle":"default","showGridLines":false}'::jsonb NOT NULL,
	"date_range" jsonb DEFAULT '{"defaultRange":"7days"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"phone" varchar(20),
	"role" varchar(50) NOT NULL,
	"module_access" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"is_online" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "employees_userId_unique" UNIQUE("userId"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoice_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"type" "invoice_adjustment_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"is_applied" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_cod_offsets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"cod_remittance_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "invoice_dispute_status" DEFAULT 'open' NOT NULL,
	"subject" varchar(140) NOT NULL,
	"details" text,
	"line_item_ref" varchar(120),
	"resolution_notes" text,
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"method" "invoice_payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reference" varchar(120),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prefix" varchar(10) DEFAULT 'INV' NOT NULL,
	"suffix" varchar(10) DEFAULT '',
	"template" varchar(20) DEFAULT 'classic' NOT NULL,
	"include_logo" boolean DEFAULT true NOT NULL,
	"include_signature" boolean DEFAULT true NOT NULL,
	"logo_file" varchar(255),
	"signature_file" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"type" "invoice_type" DEFAULT 'b2c' NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"billing_period_from" date NOT NULL,
	"billing_period_to" date NOT NULL,
	"link" varchar(150) NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"invoice_date" date NOT NULL,
	"net_payable_amount" numeric(12, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"structure" "business_structure_enum" DEFAULT 'company',
	"gstin" varchar(20),
	"panNumber" varchar(10),
	"cin" varchar(25),
	"panCardUrl" text,
	"aadhaarUrl" text,
	"cancelledChequeUrl" text,
	"boardResolutionUrl" text,
	"partnershipDeedUrl" text,
	"llpAgreementUrl" text,
	"panCardStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"panCardRejectionReason" text,
	"aadhaarStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"aadhaarRejectionReason" text,
	"cancelledChequeStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"companyAddressProofStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"cancelledChequeRejectionReason" text DEFAULT 'pending' NOT NULL,
	"boardResolutionStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"boardResolutionRejectionReason" text,
	"partnershipDeedStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"partnershipDeedRejectionReason" text,
	"aadhaarMime" varchar(100),
	"panCardMime" varchar(100),
	"cancelledChequeMime" varchar(100),
	"boardResolutionMime" varchar(100),
	"partnershipDeedMime" varchar(100),
	"llpAgreementMime" varchar(100),
	"companyAddressProofMime" varchar(100),
	"cinStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"cinRejectionReason" text,
	"llpAgreementStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"llpAgreementRejectionReason" text,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"companyType" varchar(50),
	"businessPanUrl" text,
	"companyAddressProofUrl" text,
	"gstCertificateUrl" text,
	"businessPanMime" varchar(100),
	"gstCertificateMime" varchar(100),
	"businessPanStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"gstCertificateStatus" "kyc_doc_status" DEFAULT 'pending' NOT NULL,
	"businessPanRejectionReason" text,
	"gstCertificateRejectionReason" text,
	"rejectionReason" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "kyc_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_label_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"printer_type" varchar(20) DEFAULT 'thermal' NOT NULL,
	"order_info" jsonb DEFAULT '{
        "orderId": true,
        "invoiceNumber": true,
        "orderDate": false,
        "invoiceDate": false,
        "orderBarcode": true,
        "invoiceBarcode": true,
        "rtoRoutingCode": true,
        "declaredValue": true,
        "cod": true,
        "awb": true,
        "terms": true
      }'::jsonb NOT NULL,
	"shipper_info" jsonb DEFAULT '{
        "shipperPhone": true,
        "shipperName": true,
        "gstin": true,
        "shipperAddress": true,
        "rtoAddress": false,
        "sellerBrandName": true,
        "brandLogo": true
      }'::jsonb NOT NULL,
	"product_info" jsonb DEFAULT '{
        "itemName": true,
        "productCost": true,
        "productQuantity": true,
        "skuCode": false,
        "dimension": false,
        "deadWeight": false,
        "otherCharges": true
      }'::jsonb NOT NULL,
	"char_limit" integer DEFAULT 25 NOT NULL,
	"max_items" integer DEFAULT 3 NOT NULL,
	"brand_logo" text,
	"powered_by" varchar(120) DEFAULT 'Kourier Boyz',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pincode" varchar(15) NOT NULL,
	"city" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"country" varchar(120) DEFAULT 'India' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"targetRole" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pending_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"awb_number" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"type" varchar(20) NOT NULL,
	"contactName" varchar(100) NOT NULL,
	"contactPhone" varchar(20) NOT NULL,
	"contactEmail" varchar(100),
	"addressLine1" text NOT NULL,
	"addressLine2" text,
	"landmark" varchar(100),
	"addressNickname" varchar(100),
	"city" varchar(50) NOT NULL,
	"state" varchar(50) NOT NULL,
	"country" varchar(50) DEFAULT 'India' NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"latitude" varchar(10),
	"longitude" varchar(100),
	"gstNumber" varchar(100),
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pickup_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"addressId" uuid,
	"rtoAddressId" uuid,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"isPickupEnabled" boolean DEFAULT true,
	"isRTOSame" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	CONSTRAINT "platforms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"service_provider" varchar(50),
	"cod_charges" numeric(10, 2),
	"cod_percent" numeric(5, 2),
	"other_charges" numeric(10, 2),
	"rate" numeric(10, 2) NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"courier_id" integer NOT NULL,
	"courier_name" varchar(100) NOT NULL,
	"mode" varchar(50) NOT NULL,
	"business_type" varchar(10) NOT NULL,
	"min_weight" numeric(10, 2) NOT NULL,
	"zone_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipping_rate_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipping_rate_id" uuid NOT NULL,
	"weight_from" numeric(10, 3) NOT NULL,
	"weight_to" numeric(10, 3),
	"rate" numeric(10, 2) NOT NULL,
	"extra_rate" numeric(10, 2),
	"extra_weight_unit" numeric(10, 3),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"userId" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"platformId" integer NOT NULL,
	"apiKey" varchar(255) NOT NULL,
	"adminApiAccessToken" varchar(255) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timezone" varchar(100),
	"country" varchar(100),
	"currency" varchar(10),
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stores_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "static_pages" (
	"slug" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(512),
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"awb_number" text,
	"description" text NOT NULL,
	"attachments" text[] DEFAULT '{}',
	"due_date" timestamp with time zone,
	"status" "ticket_status" DEFAULT 'open',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"business_type" varchar(10) DEFAULT 'b2c' NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"onboardingStep" integer DEFAULT 1 NOT NULL,
	"monthlyOrderCount" varchar DEFAULT '0-100',
	"salesChannels" jsonb,
	"companyInfo" jsonb NOT NULL,
	"domesticKyc" jsonb DEFAULT 'null'::jsonb,
	"bankDetails" jsonb DEFAULT 'null'::jsonb,
	"gstDetails" jsonb DEFAULT 'null'::jsonb,
	"business_type" jsonb NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"rejectionReason" text,
	"onboardingComplete" boolean DEFAULT false NOT NULL,
	"profileComplete" boolean DEFAULT false,
	"approvedAt" timestamp with time zone,
	"submittedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(100),
	"phone" varchar(20),
	"googleId" varchar(64),
	"pendingEmail" varchar(100),
	"pendingPhone" varchar(20),
	"passwordHash" varchar(200),
	"refreshToken" varchar(500),
	"refreshTokenExpiresAt" timestamp,
	"previousRefreshToken" varchar(500),
	"previousRefreshTokenExpiresAt" timestamp,
	"emailVerified" boolean DEFAULT false,
	"phoneVerified" boolean DEFAULT false,
	"accountVerified" boolean DEFAULT false,
	"role" varchar(20) DEFAULT 'customer',
	"profilePicture" varchar(512),
	"otp" varchar(6),
	"otpExpiresAt" timestamp with time zone,
	"emailVerificationToken" varchar(8),
	"emailVerificationTokenExpiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_googleId_unique" UNIQUE("googleId")
);
--> statement-breakpoint
CREATE TABLE "wallet_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"walletId" uuid NOT NULL,
	"gateway" varchar(20) DEFAULT 'razorpay' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR',
	"status" "wallet_topup_status" DEFAULT 'created',
	"gatewayOrderId" varchar(64),
	"gatewayPaymentId" varchar(64),
	"meta" jsonb,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR',
	"type" "wallet_txn_type" NOT NULL,
	"ref" varchar(64),
	"reason" varchar(128),
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0.00',
	"currency" varchar(3) DEFAULT 'INR',
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "wallets_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "weight_adjustment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discrepancy_id" uuid,
	"b2c_order_id" uuid,
	"b2b_order_id" uuid,
	"action_type" varchar(50) NOT NULL,
	"previous_weight" numeric(10, 3),
	"new_weight" numeric(10, 3),
	"weight_difference" numeric(10, 3),
	"charge_adjustment" numeric(10, 2),
	"changed_by" uuid,
	"changed_by_type" varchar(20),
	"reason" varchar(500),
	"notes" varchar(1000),
	"source" varchar(100),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weight_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"b2c_order_id" uuid,
	"b2b_order_id" uuid,
	"order_type" varchar(10) NOT NULL,
	"user_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"awb_number" varchar(100),
	"courier_partner" varchar(50),
	"declared_weight" numeric(10, 3) NOT NULL,
	"actual_weight" numeric(10, 3),
	"volumetric_weight" numeric(10, 3),
	"charged_weight" numeric(10, 3) NOT NULL,
	"weight_difference" numeric(10, 3) NOT NULL,
	"declared_dimensions" jsonb,
	"actual_dimensions" jsonb,
	"original_shipping_charge" numeric(10, 2),
	"revised_shipping_charge" numeric(10, 2),
	"additional_charge" numeric(10, 2) NOT NULL,
	"weight_slab_original" varchar(50),
	"weight_slab_charged" varchar(50),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"auto_accepted" boolean DEFAULT false,
	"acceptance_threshold" numeric(10, 3),
	"has_dispute" boolean DEFAULT false,
	"dispute_id" uuid,
	"courier_remarks" varchar(500),
	"courier_weight_slip_url" varchar(300),
	"courier_weight_proof_images" jsonb,
	"weighing_metadata" jsonb,
	"courier_reported_at" timestamp,
	"admin_notes" varchar(1000),
	"resolution_notes" varchar(1000),
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weight_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discrepancy_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dispute_reason" varchar(100) NOT NULL,
	"customer_comment" varchar(2000) NOT NULL,
	"customer_evidence_urls" jsonb,
	"customer_claimed_weight" numeric(10, 3),
	"customer_claimed_dimensions" jsonb,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"admin_response" varchar(2000),
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"resolution" varchar(50),
	"refund_amount" numeric(10, 2),
	"final_weight" numeric(10, 3),
	"resolution_notes" varchar(1000),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "weight_reconciliation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"auto_accept_enabled" boolean DEFAULT false,
	"auto_accept_threshold_kg" numeric(10, 3) DEFAULT '0.05',
	"auto_accept_threshold_percent" numeric(5, 2) DEFAULT '5',
	"notify_on_discrepancy" boolean DEFAULT true,
	"notify_on_large_discrepancy" boolean DEFAULT true,
	"large_discrepancy_threshold_kg" numeric(10, 3) DEFAULT '0.5',
	"email_daily_summary" boolean DEFAULT false,
	"email_weekly_report" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "weight_reconciliation_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_additional_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"courier_id" integer,
	"service_provider" varchar(100),
	"awb_charges" numeric(12, 2) DEFAULT '0',
	"cft_factor" numeric(6, 2) DEFAULT '5',
	"minimum_chargeable_amount" numeric(12, 2) DEFAULT '0',
	"minimum_chargeable_weight" numeric(12, 2) DEFAULT '0',
	"minimum_chargeable_method" varchar(20) DEFAULT 'whichever_is_higher',
	"free_storage_days" integer DEFAULT 5,
	"demurrage_per_awb_day" numeric(12, 2) DEFAULT '0',
	"demurrage_per_kg_day" numeric(12, 2) DEFAULT '0',
	"demurrage_method" varchar(20) DEFAULT 'whichever_is_higher',
	"public_holiday_pickup_charge" numeric(12, 2) DEFAULT '0',
	"fuel_surcharge_percentage" numeric(6, 2) DEFAULT '0',
	"green_tax" numeric(12, 2) DEFAULT '0',
	"oda_charges" numeric(12, 2) DEFAULT '0',
	"oda_per_kg_charge" numeric(12, 2) DEFAULT '0',
	"oda_method" varchar(20) DEFAULT 'whichever_is_higher',
	"csd_delivery_charge" numeric(12, 2) DEFAULT '0',
	"time_specific_per_kg" numeric(12, 2) DEFAULT '0',
	"time_specific_per_awb" numeric(12, 2) DEFAULT '500',
	"time_specific_method" varchar(20) DEFAULT 'whichever_is_higher',
	"mall_delivery_per_kg" numeric(12, 2) DEFAULT '0',
	"mall_delivery_per_awb" numeric(12, 2) DEFAULT '500',
	"mall_delivery_method" varchar(20) DEFAULT 'whichever_is_higher',
	"delivery_reattempt_per_kg" numeric(12, 2) DEFAULT '0',
	"delivery_reattempt_per_awb" numeric(12, 2) DEFAULT '500',
	"delivery_reattempt_method" varchar(20) DEFAULT 'whichever_is_higher',
	"handling_single_piece" numeric(12, 2) DEFAULT '0',
	"handling_below_100_kg" numeric(12, 2) DEFAULT '0',
	"handling_100_to_200_kg" numeric(12, 2) DEFAULT '0',
	"handling_above_200_kg" numeric(12, 2) DEFAULT '0',
	"insurance_charge" numeric(12, 2) DEFAULT '0',
	"cod_fixed_amount" numeric(12, 2) DEFAULT '50',
	"cod_percentage" numeric(6, 2) DEFAULT '1',
	"cod_method" varchar(20) DEFAULT 'whichever_is_higher',
	"rov_fixed_amount" numeric(12, 2) DEFAULT '100',
	"rov_percentage" numeric(6, 2) DEFAULT '0.5',
	"rov_method" varchar(20) DEFAULT 'whichever_is_higher',
	"liability_limit" numeric(12, 2) DEFAULT '5000',
	"liability_method" varchar(20) DEFAULT 'whichever_is_lower',
	"custom_fields" jsonb,
	"field_definitions" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_overhead_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"code" varchar(50),
	"name" varchar(150) NOT NULL,
	"description" text,
	"type" varchar(20) NOT NULL,
	"amount" numeric(12, 2),
	"percent" numeric(6, 2),
	"applies_to" varchar(50) DEFAULT 'freight',
	"condition" jsonb,
	"priority" integer DEFAULT 0,
	"courier_id" integer,
	"service_provider" varchar(100),
	"business_type" varchar(10) DEFAULT 'B2B' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_pincodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pincode" varchar(15) NOT NULL,
	"city" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"zone_id" uuid NOT NULL,
	"courier_id" integer,
	"service_provider" varchar(100),
	"is_oda" boolean DEFAULT false NOT NULL,
	"is_remote" boolean DEFAULT false NOT NULL,
	"is_mall" boolean DEFAULT false NOT NULL,
	"is_sez" boolean DEFAULT false NOT NULL,
	"is_airport" boolean DEFAULT false NOT NULL,
	"is_high_security" boolean DEFAULT false NOT NULL,
	"is_csd" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_volumetric_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"courier_id" integer,
	"service_provider" varchar(100),
	"volumetric_divisor" numeric(10, 2) DEFAULT '5000',
	"cft_factor" numeric(6, 2) DEFAULT '5',
	"minimum_volumetric_weight" numeric(10, 2) DEFAULT '0',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_zone_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"state" varchar(200),
	"pincode_pattern" varchar(50),
	"courier_id" integer,
	"service_provider" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_zone_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"state_name" varchar(200) NOT NULL,
	"courier_id" integer,
	"service_provider" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_b2b_zone_to_zone_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"origin_zone_id" uuid NOT NULL,
	"destination_zone_id" uuid NOT NULL,
	"courier_id" integer,
	"service_provider" varchar(100),
	"rate_per_kg" numeric(12, 4) NOT NULL,
	"volumetric_factor" numeric(6, 2) DEFAULT '5000',
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_zone_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"region" varchar(120),
	"business_type" varchar(10) NOT NULL,
	"metadata" jsonb,
	"states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ndr_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"awb_number" varchar(100),
	"status" varchar(60) NOT NULL,
	"reason" varchar(300),
	"remarks" varchar(500),
	"attempt_no" varchar(20),
	"payload" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cod_enabled" boolean DEFAULT true NOT NULL,
	"prepaid_enabled" boolean DEFAULT true NOT NULL,
	"min_wallet_recharge" integer DEFAULT 0 NOT NULL,
	"gst_percent" numeric DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rto_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"awb_number" varchar(100),
	"status" varchar(60) NOT NULL,
	"reason" varchar(300),
	"remarks" varchar(500),
	"rto_charges" numeric,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"awb_number" varchar(100),
	"courier" varchar(60),
	"status_code" varchar(80),
	"status_text" varchar(200),
	"location" varchar(120),
	"raw" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_name" varchar(255) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"api_secret" varchar(255) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "api_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_id" varchar(255),
	"payload" jsonb NOT NULL,
	"status" varchar(50) NOT NULL,
	"http_status" integer,
	"response_body" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" varchar(512) NOT NULL,
	"name" varchar(255),
	"events" jsonb NOT NULL,
	"secret" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_delay_ms" integer DEFAULT 1000 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"successful_deliveries" integer DEFAULT 0 NOT NULL,
	"failed_deliveries" integer DEFAULT 0 NOT NULL,
	"last_delivery_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kourier_boyz_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"state" varchar(200),
	"courier_id" integer,
	"service_provider" varchar(100),
	"is_recurring" boolean DEFAULT false NOT NULL,
	"year" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "xpressbees_awb_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"range_id" uuid NOT NULL,
	"awb_number" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'reserved' NOT NULL,
	"order_number" varchar(100),
	"local_order_id" uuid,
	"user_id" uuid,
	"provider_reference" varchar(120),
	"failure_reason" text,
	"provider_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	CONSTRAINT "xpressbees_awb_allocations_awb_number_unique" UNIQUE("awb_number")
);
--> statement-breakpoint
CREATE TABLE "xpressbees_awb_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_awb" varchar(64) NOT NULL,
	"end_awb" varchar(64) NOT NULL,
	"next_awb" varchar(64) NOT NULL,
	"last_allocated_awb" varchar(64),
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exhausted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "b2b_orders" ADD CONSTRAINT "b2b_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c_orders" ADD CONSTRAINT "b2c_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billingInvoices" ADD CONSTRAINT "billingInvoices_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_preferences" ADD CONSTRAINT "billing_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_registration_errors" ADD CONSTRAINT "courier_registration_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_registration_errors" ADD CONSTRAINT "courier_registration_errors_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_registration_errors" ADD CONSTRAINT "courier_registration_errors_pickup_address_id_pickup_addresses_id_fk" FOREIGN KEY ("pickup_address_id") REFERENCES "public"."pickup_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_issue_audit_logs" ADD CONSTRAINT "developer_issue_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_issue_states" ADD CONSTRAINT "developer_issue_states_owner_admin_id_users_id_fk" FOREIGN KEY ("owner_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_issue_states" ADD CONSTRAINT "developer_issue_states_resolved_by_admin_id_users_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_invoice_id_billingInvoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billingInvoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_cod_offsets" ADD CONSTRAINT "invoice_cod_offsets_invoice_id_billingInvoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billingInvoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_cod_offsets" ADD CONSTRAINT "invoice_cod_offsets_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_cod_offsets" ADD CONSTRAINT "invoice_cod_offsets_cod_remittance_id_cod_remittances_id_fk" FOREIGN KEY ("cod_remittance_id") REFERENCES "public"."cod_remittances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_disputes" ADD CONSTRAINT "invoice_disputes_invoice_id_billingInvoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billingInvoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_disputes" ADD CONSTRAINT "invoice_disputes_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_disputes" ADD CONSTRAINT "invoice_disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_billingInvoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billingInvoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_preferences" ADD CONSTRAINT "invoice_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc" ADD CONSTRAINT "kyc_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kourier_boyz_label_preferences" ADD CONSTRAINT "kourier_boyz_label_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_addresses" ADD CONSTRAINT "pickup_addresses_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_addresses" ADD CONSTRAINT "pickup_addresses_addressId_addresses_id_fk" FOREIGN KEY ("addressId") REFERENCES "public"."addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_addresses" ADD CONSTRAINT "pickup_addresses_rtoAddressId_addresses_id_fk" FOREIGN KEY ("rtoAddressId") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rate_slabs" ADD CONSTRAINT "shipping_rate_slabs_shipping_rate_id_shipping_rates_id_fk" FOREIGN KEY ("shipping_rate_id") REFERENCES "public"."shipping_rates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_platformId_platforms_id_fk" FOREIGN KEY ("platformId") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_walletId_wallets_id_fk" FOREIGN KEY ("walletId") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_adjustment_history" ADD CONSTRAINT "weight_adjustment_history_discrepancy_id_weight_discrepancies_id_fk" FOREIGN KEY ("discrepancy_id") REFERENCES "public"."weight_discrepancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_adjustment_history" ADD CONSTRAINT "weight_adjustment_history_b2c_order_id_b2c_orders_id_fk" FOREIGN KEY ("b2c_order_id") REFERENCES "public"."b2c_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_adjustment_history" ADD CONSTRAINT "weight_adjustment_history_b2b_order_id_b2b_orders_id_fk" FOREIGN KEY ("b2b_order_id") REFERENCES "public"."b2b_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_discrepancies" ADD CONSTRAINT "weight_discrepancies_b2c_order_id_b2c_orders_id_fk" FOREIGN KEY ("b2c_order_id") REFERENCES "public"."b2c_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_discrepancies" ADD CONSTRAINT "weight_discrepancies_b2b_order_id_b2b_orders_id_fk" FOREIGN KEY ("b2b_order_id") REFERENCES "public"."b2b_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_discrepancies" ADD CONSTRAINT "weight_discrepancies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_disputes" ADD CONSTRAINT "weight_disputes_discrepancy_id_weight_discrepancies_id_fk" FOREIGN KEY ("discrepancy_id") REFERENCES "public"."weight_discrepancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_disputes" ADD CONSTRAINT "weight_disputes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_reconciliation_settings" ADD CONSTRAINT "weight_reconciliation_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kourier_boyz_b2b_zone_regions" ADD CONSTRAINT "kourier_boyz_b2b_zone_regions_zone_id_kourier_boyz_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."kourier_boyz_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kourier_boyz_b2b_zone_states" ADD CONSTRAINT "kourier_boyz_b2b_zone_states_zone_id_kourier_boyz_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."kourier_boyz_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kourier_boyz_zone_mappings" ADD CONSTRAINT "kourier_boyz_zone_mappings_zone_id_kourier_boyz_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."kourier_boyz_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kourier_boyz_zone_mappings" ADD CONSTRAINT "kourier_boyz_zone_mappings_location_id_kourier_boyz_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."kourier_boyz_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndr_events" ADD CONSTRAINT "ndr_events_order_id_b2c_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."b2c_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndr_events" ADD CONSTRAINT "ndr_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rto_events" ADD CONSTRAINT "rto_events_order_id_b2c_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."b2c_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rto_events" ADD CONSTRAINT "rto_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_order_id_b2c_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."b2c_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xpressbees_awb_allocations" ADD CONSTRAINT "xpressbees_awb_allocations_range_id_xpressbees_awb_ranges_id_fk" FOREIGN KEY ("range_id") REFERENCES "public"."xpressbees_awb_ranges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "b2b_orders_user_order_number_unique" ON "b2b_orders" USING btree ("user_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "b2c_orders_user_order_number_unique" ON "b2c_orders" USING btree ("user_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_priority" ON "courier_priority_profiles" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "developer_issue_states_issue_key_unique" ON "developer_issue_states" USING btree ("issue_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_plans_user_business_type_unique" ON "user_plans" USING btree ("userId","business_type");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_code_business_type_unique" ON "kourier_boyz_zones" USING btree ("code","business_type");