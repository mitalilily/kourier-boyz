'use strict'

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT)
const root = path.resolve(process.env.STATIC_ROOT || '.')

const mimeTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const parseFallbacks = () => {
  try {
    const parsed = JSON.parse(process.env.SPA_FALLBACKS || '[]')
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item.prefix === 'string' && typeof item.file === 'string')
        .sort((left, right) => right.prefix.length - left.prefix.length)
    }
  } catch (error) {
    console.error('Invalid SPA_FALLBACKS configuration', error)
  }

  return [{ prefix: '/', file: 'index.html' }]
}

const fallbacks = parseFallbacks()

const safeResolve = (relativePath) => {
  const resolved = path.resolve(root, relativePath.replace(/^[/\\]+/, ''))
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null
}

const sendFile = (request, response, filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  const immutable = /[/\\]assets[/\\]/.test(filePath) && !extension.endsWith('html')

  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  fs.createReadStream(filePath).pipe(response)
}

const resolveExistingFile = (candidate) => {
  if (!candidate || !fs.existsSync(candidate)) return null
  const stats = fs.statSync(candidate)
  if (stats.isFile()) return candidate
  if (!stats.isDirectory()) return null

  const indexPath = path.join(candidate, 'index.html')
  return fs.existsSync(indexPath) && fs.statSync(indexPath).isFile() ? indexPath : null
}

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer')
}

if (!fs.existsSync(root)) {
  throw new Error(`Static root does not exist: ${root}`)
}

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method Not Allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  } catch {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }

  if (pathname.includes('\0') || pathname.split('/').includes('..')) {
    response.writeHead(400)
    response.end('Bad Request')
    return
  }

  const requestedFile = resolveExistingFile(safeResolve(pathname))
  if (requestedFile) {
    sendFile(request, response, requestedFile)
    return
  }

  const fallback = fallbacks.find(({ prefix }) => pathname.startsWith(prefix))
  const fallbackFile = fallback ? resolveExistingFile(safeResolve(fallback.file)) : null
  if (fallbackFile) {
    sendFile(request, response, fallbackFile)
    return
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end('Not Found')
})

server.listen(port, host, () => {
  console.log(`Static app serving ${root} at http://${host}:${port}`)
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
