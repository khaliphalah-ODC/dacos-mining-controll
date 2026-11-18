import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRepository } from '../src/repositories/postgres.js'
import { AuthService } from '../src/security/auth.js'
import { startDatabase } from './database.mjs'
if (existsSync('.env')) process.loadEnvFile('.env')
if (!process.env.DACOS_ADMIN_PASSWORD) throw new Error('Set DACOS_ADMIN_PASSWORD securely; minimum 12 characters. No default password is provided.')
let database, repository
const input = createInterface({ input: stdin, output: stdout })
try {
  if (!process.env.DATABASE_URL) { database = await startDatabase(); process.env.DATABASE_URL = database.url }
  const migration = spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:process.env,stdio:'inherit'})
  if (migration.status) throw new Error('Migration failed')
  repository = createRepository(process.env.DATABASE_URL)
  const email = await input.question('Admin email: ')
  const name = await input.question('Admin name: ')
  await new AuthService(repository.db).createUser({ email, name, role:'ADMIN', password:process.env.DACOS_ADMIN_PASSWORD })
  console.log('Admin created. Clear DACOS_ADMIN_PASSWORD from your environment.')
} finally { input.close(); await repository?.close(); await database?.stop() }
