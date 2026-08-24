import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'dist')

await mkdir(output, { recursive: true })
for (const entry of await readdir(output)) {
  await rm(resolve(output, entry), {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  })
}
await cp(resolve(root, 'apps/logistics/dist'), output, { recursive: true })
await mkdir(resolve(output, 'store'), { recursive: true })
await cp(resolve(root, 'apps/marketplace/dist'), resolve(output, 'store'), { recursive: true })

console.log('Kourier Boyz seller-client build assembled in seller-client/dist')
