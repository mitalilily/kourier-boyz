'use strict'

const fs = require('node:fs')
const path = require('node:path')

const deployRoot = process.env.KB_DEPLOY_ROOT || '/opt/apps/kourier-boyz/current'
const sharedRoot = process.env.KB_SHARED_ROOT || '/opt/apps/kourier-boyz/shared'
const runtimeRoot = process.env.KB_RUNTIME_ROOT || '/opt/apps/kourier-boyz/runtime'
const nodeInterpreter =
  process.env.KB_NODE_INTERPRETER || path.join(runtimeRoot, 'node', 'bin', 'node')

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {}

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        const key = line.slice(0, separator).trim()
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, '$2')
        return [key, value]
      }),
  )
}

const backendEnv = readEnvFile(path.join(sharedRoot, 'backend.env'))
const staticServer = path.join(deployRoot, 'deploy', 'static-server.cjs')

const staticApp = (name, port, staticRoot, fallbacks) => ({
  name,
  script: staticServer,
  cwd: deployRoot,
  instances: 1,
  exec_mode: 'fork',
  interpreter: nodeInterpreter,
  autorestart: true,
  max_memory_restart: '300M',
  env: {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    STATIC_ROOT: path.join(deployRoot, staticRoot),
    SPA_FALLBACKS: JSON.stringify(fallbacks),
  },
})

module.exports = {
  apps: [
    {
      name: 'kourier-boyz-api',
      script: path.join(deployRoot, 'backend', 'unified-server.js'),
      cwd: path.join(deployRoot, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      interpreter: nodeInterpreter,
      autorestart: true,
      max_memory_restart: '1500M',
      kill_timeout: 15000,
      listen_timeout: 30000,
      env: {
        ...backendEnv,
        NODE_ENV: 'production',
        PORT: '4100',
      },
    },
    staticApp('kourier-boyz-web', 4170, 'frontend/dist', [
      { prefix: '/', file: 'index.html' },
    ]),
    staticApp('kourier-boyz-seller', 4171, 'seller-client/dist', [
      { prefix: '/store', file: 'store/index.html' },
      { prefix: '/', file: 'index.html' },
    ]),
    staticApp('kourier-boyz-admin', 4172, 'admin/dist', [
      { prefix: '/logistics', file: 'logistics/index.html' },
      { prefix: '/', file: 'index.html' },
    ]),
  ],
}
