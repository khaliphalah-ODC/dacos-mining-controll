import { randomUUID } from 'node:crypto'
export class OperationalAdapter {
  constructor(repository) { this.repository=repository; this.mode='operational'; this.sequence=0; this.streamId=randomUUID() }
  async advance() {
    const [workers,zones] = await Promise.all([this.repository.db.worker.findMany({where:{active:true,origin:'registered'}}),this.repository.db.zone.findMany({where:{origin:'registered'}})])
    this.previous={mode:'operational',streamId:this.streamId,sequence:++this.sequence,timestamp:new Date().toISOString(),source:'dacos-hardware',simulation:false,scenario:'normal',workers,zones,devices:[],readings:[],alerts:[],incidents:[]}
    return this.previous
  }
  setScenario() { throw Object.assign(new Error('Simulation controls are disabled in operational mode'),{status:403}) }
}
