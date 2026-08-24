import { shipmozoService } from '../services/shipmozo.service'

async function testShipmozoInfo() {
  try {
    const response = await shipmozoService.getInfo()
    console.log('Shipmozo info endpoint is reachable:')
    console.log(JSON.stringify(response, null, 2))
    process.exit(0)
  } catch (error: any) {
    console.error('Shipmozo info test failed:', error.message || error)
    process.exit(1)
  }
}

void testShipmozoInfo()
