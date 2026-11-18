import { z } from 'zod'
export const locationObservationSchema = z.object({
  deviceId:z.string().uuid(),workerId:z.string().min(1).max(50),
  source:z.enum(['GNSS','BLE','UWB','SIMULATED']),simulation:z.boolean(),
  timestamp:z.string().datetime(),sequence:z.number().int().min(0).max(2147483647),
  latitude:z.number().finite().min(-90).max(90).optional(),longitude:z.number().finite().min(-180).max(180).optional(),
  x:z.number().finite().optional(),y:z.number().finite().optional(),z:z.number().finite().optional(),
  coordinateFrame:z.string().trim().min(1).max(100).optional(),
  zoneId:z.string().trim().min(1).max(100).optional(),checkpointId:z.string().trim().min(1).max(100).optional(),
  accuracyMeters:z.number().finite().min(0).max(100000).optional(),confidence:z.number().finite().min(0).max(1).optional(),
}).strict().superRefine((v,ctx)=>{
  const issue=message=>ctx.addIssue({code:'custom',message})
  if(v.simulation!==(v.source==='SIMULATED'))issue('Simulation flag must match location source')
  const geographic=v.latitude!==undefined||v.longitude!==undefined,local=v.x!==undefined||v.y!==undefined||v.z!==undefined
  if(geographic&&(v.latitude===undefined||v.longitude===undefined))issue('Latitude and longitude are required together')
  if(local&&(v.x===undefined||v.y===undefined||!v.coordinateFrame))issue('Local coordinates require x, y and a named coordinate frame')
  if(local&&v.coordinateFrame==='WGS84')issue('Local coordinates require a local frame, not WGS84')
  if(geographic&&local)issue('Do not mix geographic and local coordinates')
  if(geographic&&v.coordinateFrame!=='WGS84')issue('Geographic coordinates require WGS84')
  if(v.source==='GNSS'&&(!geographic||local))issue('GNSS requires latitude/longitude')
  if(v.source==='BLE'&&(geographic||local||!v.zoneId&&!v.checkpointId||v.accuracyMeters!==undefined||v.coordinateFrame!==undefined))issue('BLE reports zone/checkpoint proximity only, not precise coordinates or meter accuracy')
  if(v.source==='UWB'&&(!local||geographic))issue('UWB requires local coordinates and a named surveyed frame')
  if(v.source==='SIMULATED'&&!geographic&&!local&&!v.zoneId&&!v.checkpointId)issue('Simulated observations need a zone, checkpoint or coordinates')
})
