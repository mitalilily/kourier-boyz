import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from 'lucide-react'

const Payments = () => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Manage your saved cards and payment options</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Saved Cards</h3>
          <p className="text-gray-600 mb-6">Save your payment methods for faster checkout</p>
          <Button variant="outline">
            <CreditCard className="w-4 h-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default Payments

