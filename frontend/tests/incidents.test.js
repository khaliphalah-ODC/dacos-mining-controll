import {it,expect} from 'vitest'
import {incidentActions,incidentQuery} from '../src/services/incidents.js'
it('shows only incident controls permitted by role, state and ownership',()=>{
 const i={lifecycleStatus:'OPEN',severityLevel:'LOW',ownerId:null},op={id:'op',role:'OPERATOR'},admin={id:'admin',role:'ADMIN'}
 expect(incidentActions(i,op)).toEqual(['note','acknowledge'])
 expect(incidentActions({...i,lifecycleStatus:'ACKNOWLEDGED'},admin)).toContain('assign')
 expect(incidentActions({...i,lifecycleStatus:'ASSIGNED',ownerId:'other'},op)).not.toContain('start')
 expect(incidentActions({...i,lifecycleStatus:'ASSIGNED',ownerId:'op'},op)).toContain('start')
 expect(incidentActions({...i,lifecycleStatus:'IN_PROGRESS',ownerId:'op'},op)).toContain('resolve')
 expect(incidentActions({...i,lifecycleStatus:'RESOLVED'},admin)).toContain('close')
 expect(incidentActions({...i,lifecycleStatus:'CLOSED'},admin)).toEqual([])
 expect(incidentQuery({q:'SOS & test',status:'',limit:25})).toBe('q=SOS+%26+test&limit=25')
})
