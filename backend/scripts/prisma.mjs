import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const environmentFile = resolve(repositoryRoot, process.env.DACOS_ENV_FILE ?? '.env')
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile)
const require = createRequire(import.meta.url)
const executable = resolve(dirname(require.resolve('prisma/package.json')), 'build/index.js')
const schema = resolve(repositoryRoot, 'backend/prisma/schema.prisma')
const child = spawn(process.execPath, [executable, ...process.argv.slice(2), '--schema', schema], {
  cwd: repositoryRoot,
  env: {...process.env,...(process.argv.includes('migrate')&&process.env.DATABASE_URL_UNPOOLED?{DATABASE_URL:process.env.DATABASE_URL_UNPOOLED}:{})},
  stdio: 'inherit',
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
