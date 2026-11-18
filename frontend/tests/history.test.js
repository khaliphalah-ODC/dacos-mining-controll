import {it,expect} from 'vitest'
import {historySeries} from '../src/services/history.js'
import {csvText} from '../../backend/src/services/reporting.js'
it('does not invent zeros or interpolate missing time gaps and separates device/source series',()=>{
 const row={deviceId:'test',metric:'heartRate',unit:'bpm',source:'hardware',quality:'live'}
 const rows=[{...row,timestamp:'2026-11-17T00:00:00Z',value:80},{...row,timestamp:'2026-11-17T00:00:10Z',value:null},{...row,timestamp:'2026-11-17T00:00:20Z',value:82},{...row,timestamp:'2026-11-17T00:02:20Z',value:84}]
 expect(historySeries(rows).map(s=>s.points.map(p=>p.value))).toEqual([[80],[82],[84]])
})
it('escapes report formulas and preserves quoted CSV values',()=>{
 const csv=csvText([{name:'=HYPERLINK("bad")',value:'a,b'}],['name','value'])
 expect(csv).toContain("'=");expect(csv).toContain('"a,b"');expect(csv).toContain('""bad""')
})
