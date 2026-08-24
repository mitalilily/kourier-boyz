import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'dist')

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(resolve(root, 'apps/logistics/dist'), output, { recursive: true })
await mkdir(resolve(output, 'store'), { recursive: true })
await cp(resolve(root, 'apps/marketplace/dist'), resolve(output, 'store'), { recursive: true })

console.log('Kourier Boyz seller-client build assembled in seller-client/dist')
