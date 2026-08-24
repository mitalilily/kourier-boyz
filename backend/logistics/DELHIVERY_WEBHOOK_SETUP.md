# Delhivery Webhook Setup

Use these URLs when asking Delhivery to enable Tracking Push API / Scan Push for Kourier Boyz.

## Required Scan Push URL

```text
https://api.kourierboyz.com/api/webhook/delhivery/scan
```

Configuration to share with Delhivery:

- Method: `POST`
- Content-Type: `application/json`
- Expected response: `200 OK`
- Event type: Tracking Push API / Scan Push
- Required scan data: AWB or Waybill, Reference No, Status, StatusType, Instructions, StatusDateTime, StatusLocation, and NSLCode or StatusCode where available.
- Include all shipment scans, including manifested, pickup, in-transit, pending, dispatched, delivered, RTO, and NDR or exception scans.

## Optional Document Push URL

```text
https://api.kourierboyz.com/api/webhook/delhivery/document
```

Use this only if Delhivery separately supports POD, sorter image, QC image, or other document push callbacks.

## Admin Panel

The same URLs are shown in:

```text
Admin Panel > Couriers > Courier Credentials > Delhivery
```

The backend derives the URLs from `API_URL`. Production should use:

```text
API_URL=https://api.kourierboyz.com
```

Optional overrides are available for unusual hosting cases:

```text
DELHIVERY_SCAN_PUSH_WEBHOOK_URL=https://api.kourierboyz.com/api/webhook/delhivery/scan
DELHIVERY_DOCUMENT_PUSH_WEBHOOK_URL=https://api.kourierboyz.com/api/webhook/delhivery/document
DELHIVERY_LEGACY_WEBHOOK_URL=https://api.kourierboyz.com/api/webhook/delhivery/order
```
