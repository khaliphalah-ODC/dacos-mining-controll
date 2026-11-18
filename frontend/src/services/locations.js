export function locationDescription(observation) {
  if(!observation)return 'Location Unavailable'
  if(observation.latitude!==null&&observation.latitude!==undefined)return `${observation.latitude.toFixed(6)}, ${observation.longitude.toFixed(6)} · WGS84`
  if(observation.x!==null&&observation.x!==undefined)return `x ${observation.x}, y ${observation.y}${observation.z===null||observation.z===undefined?'':`, z ${observation.z}`} · ${observation.coordinateFrame}`
  if(observation.zoneId||observation.checkpointId)return [observation.zoneId&&`Zone ${observation.zoneId}`,observation.checkpointId&&`Checkpoint ${observation.checkpointId}`].filter(Boolean).join(' · ')
  return 'Location Unavailable'
}
