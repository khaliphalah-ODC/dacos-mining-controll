export function historySeries(rows){
 const groups=new Map()
 for(const r of rows){const key=[r.deviceId,r.workerId??'',r.zoneId??'',r.metric,r.unit,r.source].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 const series=[]
 for(const [key,readings] of groups){let segment=[],last=null
  for(const r of readings.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||(a.sequence??0)-(b.sequence??0))){
   const time=Date.parse(r.timestamp),valid=typeof r.value==='number'&&Number.isFinite(r.value)&&Number.isFinite(time)&&!['unavailable','offline','stale'].includes(r.quality)
   if(!valid||(last!==null&&time-last>(r.source==='dacos-simulator'?120000:30000))){if(segment.length)series.push({key,source:readings[0].source,unit:readings[0].unit,points:segment});segment=[]}
   if(valid)segment.push({time,value:r.value});last=valid?time:null
  }
  if(segment.length)series.push({key,source:readings[0].source,unit:readings[0].unit,points:segment})
 }
 return series
}
export function isoDate(value){return value?new Date(value).toISOString():''}
