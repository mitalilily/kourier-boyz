import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(projectRoot, 'src')
const routesSource = fs.readFileSync(path.join(sourceRoot, 'routes', 'AppRoutes.tsx'), 'utf8')

const routePaths = [...routesSource.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((routePath) => routePath.startsWith('/'))

const sourceFiles = []
const collectSourceFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(absolutePath)
    } else if (/\.tsx?$/.test(entry.name)) {
      sourceFiles.push(absolutePath)
    }
  }
}
collectSourceFiles(sourceRoot)

const routeReferences = []
const referencePatterns = [
  /navigate\(\s*['"]([^'"]+)['"]/g,
  /<(?:Link|NavLink)[^>]*\bto=['"]([^'"]+)['"]/g,
  /\bpath:\s*['"]([^'"]+)['"]/g,
]

for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, 'utf8')
  for (const pattern of referencePatterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1].startsWith('/')) {
        routeReferences.push({ path: match[1], sourceFile })
      }
    }
  }
}

const navigationOnlyParents = new Set([
  '/orders',
  '/ops',
  '/billing',
  '/reconciliation',
  '/tools',
  '/channels',
  '/support',
])

const withoutQuery = (routePath) => routePath.replace(/\?.*$/, '')
const matchesRoute = (reference, route) => {
  const referenceParts = withoutQuery(reference).split('/').filter(Boolean)
  const routeParts = route.split('/').filter(Boolean)

  if (route.endsWith('/*')) {
    const prefix = route.slice(0, -2)
    return reference === prefix || reference.startsWith(`${prefix}/`)
  }

  if (referenceParts.length !== routeParts.length) return false
  return routeParts.every((part, index) => part.startsWith(':') || part === referenceParts[index])
}

const unresolved = routeReferences.filter(({ path: reference }) => {
  const normalizedReference = withoutQuery(reference)
  if (navigationOnlyParents.has(normalizedReference)) return false
  return !routePaths.some((route) => matchesRoute(normalizedReference, route))
})

if (unresolved.length > 0) {
  const formatted = unresolved
    .map(({ path: reference, sourceFile }) =>
      `${reference} (${path.relative(projectRoot, sourceFile).replaceAll('\\', '/')})`,
    )
    .join('\n')
  throw new Error(`Unresolved internal route references:\n${formatted}`)
}

console.log(`Route integrity check passed (${routePaths.length} routes, ${routeReferences.length} references)`)
