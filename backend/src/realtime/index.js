import {allowedOrigin,configuredOrigins} from '../security/origins.js'
import { Server } from 'socket.io'
export function attachRealtime(server, service, auth) {
  const origins=configuredOrigins()
  const io = new Server(server, { maxHttpBufferSize: 16384, cors:{credentials:true,origin:(origin,callback)=>callback(null,!origin||origins.includes(origin))} })
  if (!auth) throw new Error('Realtime authentication service is required')
  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin
      const host = socket.handshake.headers.host
      if (origin && !allowedOrigin(origin,host,origins)) return next(new Error('Origin not allowed'))
      const session = socket.handshake.auth?.ticket?await auth.redeemSocketTicket(socket.handshake.auth.ticket):await auth.session(socket.handshake.headers.cookie)
      if (!session) return next(new Error('Sign in required'))
      socket.data.session = session
      next()
    } catch { next(new Error('Session unavailable')) }
  })
  io.on('connection', socket => {
    socket.join(socket.handshake.auth?.delta===true?'delta-clients':'legacy-clients')
    socket.on('telemetry:resync',async()=>{if(Date.now()-(socket.data.lastResync??0)<1000)return;socket.data.lastResync=Date.now();try{if(!await auth.activeSession(socket.data.session.id))return socket.disconnect(true);socket.emit('telemetry:snapshot',service.snapshot())}catch{socket.emit('telemetry:unavailable',{message:'Telemetry unavailable'})}})
    const check = setInterval(async () => {
      try { if (!await auth.activeSession(socket.data.session.id)) socket.disconnect(true) }
      catch { socket.disconnect(true) }
    }, 2000)
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.session.expiresAt.getTime() - Date.now()))
    socket.on('disconnect', () => { clearInterval(check); clearTimeout(expiry) })
    try { socket.emit('telemetry:snapshot', service.snapshot()) }
    catch { socket.emit('telemetry:unavailable', { simulation: true, message: 'Telemetry unavailable' }) }
  })
  const unsubscribeIncidents=service.subscribeIncidents(payload=>io.emit('incident:changed',payload))
  let previous = null
  const unsubscribe = service.subscribe(snapshot => {
    // A complete authoritative snapshot on every tick also repairs missed or duplicate events.
    io.to('legacy-clients').emit('telemetry:snapshot',snapshot)
    if(!previous||previous.streamId!==snapshot.streamId||snapshot.sequence%30===0)io.to('delta-clients').emit('telemetry:snapshot',snapshot)
    else{
      const changes={}
      for(const key of ['mode','source','simulation','scenario','workers','zones','devices','readings','alerts','incidents','deviceSessions','deviceEvents'])if(JSON.stringify(previous[key])!==JSON.stringify(snapshot[key]))changes[key]=snapshot[key]
      io.to('delta-clients').emit('telemetry:delta',{streamId:snapshot.streamId,baseSequence:previous.sequence,sequence:snapshot.sequence,timestamp:snapshot.timestamp,changes})
    }
    const envelope = { streamId: snapshot.streamId, sequence: snapshot.sequence, timestamp: snapshot.timestamp, source: snapshot.source, simulation: snapshot.simulation }
    for (const [event, kind] of [['worker:location', 'location'], ['health:reading', 'health'], ['environment:reading', 'environment'], ['device:status', 'device']]) {
      for (const reading of snapshot.readings.filter(r => r.kind === kind)) io.to('legacy-clients').emit(event, { ...envelope, ...reading })
    }
    for (const worker of snapshot.workers) io.to('legacy-clients').emit('worker:status', { ...envelope, id: worker.id, workerId: worker.id, quality: snapshot.scenario === 'disconnected' ? 'offline' : snapshot.scenario === 'stale' ? 'stale' : 'simulated' })
    for (const alert of snapshot.alerts) if (!previous?.alerts.some(a => a.id === alert.id && a.severity === alert.severity)) io.to('legacy-clients').emit('alert:created', { ...envelope, ...alert })
    for (const incident of snapshot.incidents) io.to('legacy-clients').emit('incident:updated', { ...envelope, ...incident })
    previous = snapshot
  })
  return { io, close: async () => { unsubscribe(); unsubscribeIncidents(); await new Promise(resolve => io.close(resolve)) } }
}
