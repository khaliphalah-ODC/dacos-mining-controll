import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

export async function startDatabase({ directory = '.data/postgres', port = 55432, database = 'dacos' } = {}) {
  const databaseDir = resolve(repositoryRoot, directory)
  const credentialPath = resolve(repositoryRoot, `${directory}.credential`)
  await mkdir(resolve(repositoryRoot, directory, '..'), { recursive: true })
  let password
  if (existsSync(credentialPath)) password = await readFile(credentialPath, 'utf8')
  else { password = randomBytes(24).toString('hex'); await writeFile(credentialPath, password, { mode: 0o600 }) }
  const postgres = new EmbeddedPostgres({ databaseDir, port, user: 'dacos', password,
    persistent: true, authMethod: 'scram-sha-256', createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', resolve(repositoryRoot, directory, '..')],
    onLog: () => {}, onError: message => { if (String(message).includes('FATAL')) console.error(String(message)) },
  })
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await postgres.initialise()
  await postgres.start()
  try {
    const client = postgres.getPgClient()
    await client.connect()
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (!result.rowCount) await postgres.createDatabase(database)
    await client.end()
  } catch (error) { await postgres.stop(); throw error }
  return { url: `postgresql://dacos:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`, stop: () => postgres.stop() }
}
