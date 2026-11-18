import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import { createServer } from 'node:http'
import { createRepository } from './repositories/postgres.js'
import { OperationalAdapter } from './services/operational.js'
import { SimulationAdapter } from './simulation/adapter.js'
import { TelemetryService } from './services/telemetry.js'
import { createApp } from './app.js'
import { attachRealtime } from './realtime/index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required. Run npm run dev for the local database.')
const repository = createRepository(databaseUrl)
await repository.health()
const mode = process.env.DACOS_MODE ?? (process.env.NODE_ENV === 'production' ? 'operational' : 'demo')
if (!['demo','operational'].includes(mode)) throw new Error('DACOS_MODE must be demo or operational')
const adapter = mode === 'operational' ? new OperationalAdapter(repository) : new SimulationAdapter({seed:Number(process.env.SIMULATION_SEED ?? 42)})
const service = new TelemetryService({adapter,repository})
await service.update()
const frontendDirectory=process.env.NODE_ENV==='production'&&process.env.SERVE_FRONTEND!=='false'?fileURLToPath(new URL('../../frontend/dist',import.meta.url)):null
if(frontendDirectory&&!existsSync(frontendDirectory+'/index.html'))throw new Error('Build the frontend before starting production mode')
const app = createApp({ frontendDirectory, service, repository, allowSimulationControl: mode === 'demo' && process.env.SIMULATION_CONTROLS !== 'false' })
const server = createServer(app)
const realtime = attachRealtime(server, service, app.locals.auth)
service.start(Number(process.env.SIMULATION_INTERVAL_MS ?? 2000))
server.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 3001),process.env.API_HOST ?? '127.0.0.1',()=>console.log(JSON.stringify({event:'server.ready',mode,port:Number(process.env.PORT??process.env.API_PORT??3001)})))
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await service.stop()
  await realtime.close()
  await repository.close()
}
process.on('SIGINT', () => stop().then(() => process.exit(0)))
process.on('SIGTERM', () => stop().then(() => process.exit(0)))
