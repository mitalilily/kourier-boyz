import { backfillDelhiveryB2BLabelsService } from '../models/services/shiprocket.service'

const parseArgs = () => {
  const args = process.argv.slice(2)
  const orderNumber = args.find((arg) => !arg.startsWith('--')) || process.env.ORDER_NUMBER || ''
  const limitArg = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || process.env.LIMIT
  const includeExisting = args.includes('--include-existing') || process.env.INCLUDE_EXISTING === 'true'

  return {
    orderNumber,
    limit: Number(limitArg || 100),
    onlyMissing: !includeExisting,
  }
}

async function main() {
  const options = parseArgs()
  const result = await backfillDelhiveryB2BLabelsService(options)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('Delhivery B2B label backfill failed:', error?.message || error)
  process.exit(1)
})
