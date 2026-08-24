import { promises as fs } from 'fs'
import path from 'path'

const DEFAULT_LOG_DIR = process.env.LOG_DIR || 'logs'
const DEFAULT_LOG_APP_NAME = process.env.LOG_APP_NAME || 'kourier-boyz-logistics'
const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 1000
const READ_CHUNK_BYTES = 64 * 1024
const MAX_READ_BYTES = 512 * 1024

const resolveLogPath = (suffix: 'out' | 'error') =>
  path.join(DEFAULT_LOG_DIR, `${DEFAULT_LOG_APP_NAME}-${suffix}.log`)

const normalizeLimit = (limit?: number) => {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Number(limit), 1), MAX_LIMIT)
}

const readTailLines = async (filePath: string, limit: number) => {
  try {
    const fileHandle = await fs.open(filePath, 'r')

    try {
      const stats = await fileHandle.stat()
      if (stats.size === 0) return []

      let remainingBytes = Math.min(stats.size, MAX_READ_BYTES)
      let offset = stats.size
      let text = ''

      while (remainingBytes > 0) {
        const chunkSize = Math.min(READ_CHUNK_BYTES, remainingBytes)
        offset -= chunkSize

        const buffer = Buffer.alloc(chunkSize)
        await fileHandle.read(buffer, 0, chunkSize, offset)
        text = buffer.toString('utf8') + text

        const lines = text.split(/\r?\n/)
        if (lines.length > limit + 1) {
          return lines.filter(Boolean).slice(-limit)
        }

        remainingBytes -= chunkSize
      }

      return text.split(/\r?\n/).filter(Boolean).slice(-limit)
    } finally {
      await fileHandle.close()
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

export const getDeveloperLiveLogsService = async ({ limit }: { limit?: number }) => {
  const normalizedLimit = normalizeLimit(limit)
  const stdoutPath = resolveLogPath('out')
  const stderrPath = resolveLogPath('error')

  const [stdoutLines, stderrLines] = await Promise.all([
    readTailLines(stdoutPath, normalizedLimit),
    readTailLines(stderrPath, normalizedLimit),
  ])

  return {
    limit: normalizedLimit,
    fetchedAt: new Date().toISOString(),
    sources: {
      stdout: {
        path: stdoutPath,
        lines: stdoutLines,
        lineCount: stdoutLines.length,
      },
      stderr: {
        path: stderrPath,
        lines: stderrLines,
        lineCount: stderrLines.length,
      },
    },
  }
}
