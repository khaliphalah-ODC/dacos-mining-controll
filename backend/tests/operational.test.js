import {it,expect,vi} from 'vitest'
import {OperationalAdapter} from '../src/services/operational.js'
import {TelemetryService} from '../src/services/telemetry.js'
it('operational mode never generates fixture readings and rejects demo scenarios',async()=>{
 const repository={db:{worker:{findMany:vi.fn(async()=>[])},zone:{findMany:vi.fn(async()=>[])}},save:vi.fn(async()=>{}),deviceState:async()=>({workers:[],registrations:[],events:[]})}
 const adapter=new OperationalAdapter(repository),service=new TelemetryService({adapter,repository})
 const snapshot=await service.update()
 expect(snapshot).toMatchObject({mode:'operational',source:'dacos-hardware',simulation:false,readings:[],workers:[],zones:[],devices:[]})
 await expect(service.update('critical')).rejects.toMatchObject({status:403})
})
it('rejects simulator pairing in operational mode before creating an assignment',async()=>{
 const {DeviceService}=await import('../src/services/devices.js')
 const repository={registerDevice:vi.fn()}
 const devices=new DeviceService(repository,{snapshot:()=>({mode:'operational',workers:[{id:'P-1'}]})})
 const {code}=devices.issuePairing()
 await expect(devices.register({code,workerId:'P-1',transport:'wifi',source:'simulator'})).rejects.toMatchObject({status:403})
 expect(repository.registerDevice).not.toHaveBeenCalled()
})
