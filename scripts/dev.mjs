import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { startDatabase } from '../backend/scripts/database.mjs'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
process.chdir(repositoryRoot)
const backendRequire = createRequire(resolve('backend/package.json'))
const frontendRequire = createRequire(resolve('frontend/package.json'))

if (existsSync('.env')) process.loadEnvFile('.env')
let database
const children = []
let stopping = false
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  await Promise.all(children.map(async child => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 5000))])
    }
  }))
  if (database) await database.stop()
  process.exitCode = code
}
function run(file, args, wait = false) {
  const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit', env: process.env })
  children.push(child)
  if (wait) return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`))) })
  child.once('exit', code => { if (!stopping) shutdown(code ?? 1) })
  return child
}
process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
try {
  if (!process.env.DATABASE_URL) {
    console.log('Starting project-local PostgreSQL (fictional data only)…')
    database = await startDatabase()
    process.env.DATABASE_URL = database.url
  }
  await run(resolve(dirname(backendRequire.resolve('prisma/package.json')), 'build/index.js'), ['migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'], true)
  run(resolve('backend/src/server.js'), [])
  run(resolve(dirname(frontendRequire.resolve('vite/package.json')), 'bin/vite.js'), [resolve('frontend'), '--host', '127.0.0.1', '--port', process.env.FRONTEND_PORT ?? '5173', '--strictPort'])
} catch (error) {
  console.error('DACOS could not start:', error.message)
  await shutdown(1)
}
