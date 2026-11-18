export function configuredOrigins(value=process.env.DACOS_ALLOWED_ORIGINS??''){
 return value.split(',').map(s=>s.trim()).filter(Boolean).map(value=>{
  let url;try{url=new URL(value)}catch{throw new Error('Invalid DACOS_ALLOWED_ORIGINS entry')}
  if(url.origin!==value||url.username||url.password||!['http:','https:'].includes(url.protocol)||process.env.NODE_ENV==='production'&&url.protocol!=='https:')throw new Error('Allowed origins must be exact origins; production requires HTTPS')
  return url.origin
 })
}
export function allowedOrigin(origin,host,origins=configuredOrigins()){
 if(!origin)return false
 return origins.includes(origin)||origin===`https://${host}`||(process.env.NODE_ENV!=='production'&&origin===`http://${host}`)
}
