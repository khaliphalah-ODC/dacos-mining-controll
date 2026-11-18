import {snapshotSchema} from '@dacos/contracts'
export function applyTelemetryDelta(current,packet){
 if(!current||!packet||packet.streamId!==current.streamId||packet.baseSequence!==current.sequence||!Number.isInteger(packet.sequence)||packet.sequence<=current.sequence)return null
 const allowed=['mode','source','simulation','scenario','workers','zones','devices','readings','alerts','incidents','deviceSessions','deviceEvents']
 if(!packet.changes||Object.keys(packet.changes).some(k=>!allowed.includes(k)))return null
 const result=snapshotSchema.safeParse({...current,...packet.changes,streamId:packet.streamId,sequence:packet.sequence,timestamp:packet.timestamp})
 return result.success?result.data:null
}
