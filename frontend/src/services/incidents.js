export const incidentStatuses=['OPEN','ACKNOWLEDGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']
export const incidentSeverities=['LOW','MEDIUM','HIGH','CRITICAL']
export function incidentActions(incident,user){
 if(!incident||!user||incident.lifecycleStatus==='CLOSED')return []
 const manager=['ADMIN','SUPERVISOR'].includes(user.role),owner=incident.ownerId===user.id,s=incident.lifecycleStatus
 const actions=['note']
 if(s==='OPEN')actions.push('acknowledge')
 if(manager&&['ACKNOWLEDGED','ASSIGNED'].includes(s))actions.push('assign')
 if((manager||owner)&&s==='ASSIGNED')actions.push('start')
 if((manager||owner)&&s==='IN_PROGRESS')actions.push('resolve')
 if(manager&&s==='RESOLVED')actions.push('close')
 if(manager&&!['RESOLVED','CLOSED'].includes(s)&&incident.severityLevel!=='CRITICAL')actions.push('escalate')
 return actions
}
export function incidentQuery(filters){return new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null)).toString()}
