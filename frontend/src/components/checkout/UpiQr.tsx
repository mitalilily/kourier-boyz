import { QRCodeSVG } from 'qrcode.react'

interface UpiQrProps {
  upiUrl: string
  amount: number
  merchantName: string
}

export const UpiQr: React.FC<UpiQrProps> = ({ upiUrl, amount, merchantName }) => {
  if (!upiUrl || amount <= 0) return null

  return (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/80 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">Scan &amp; Pay with any UPI app</h4>
      <div className="flex flex-col items-center gap-3">
        <QRCodeSVG value={upiUrl} size={192} includeMargin />
        <p className="text-xs text-gray-600 text-center">
          Scan this QR with Google Pay, PhonePe, Paytm or any UPI app to pay ₹
          {amount.toFixed(2)} to {merchantName}.
        </p>
      </div>
    </div>
  )
}


