import {writeFile} from 'node:fs/promises'
const origin=process.env.DACOS_API_ORIGIN
let url;try{url=new URL(origin)}catch{throw new Error('Set DACOS_API_ORIGIN to the HTTPS Railway origin')}
if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw new Error('DACOS_API_ORIGIN must be an exact HTTPS origin without credentials or a path')
if(process.env.VITE_SOCKET_ORIGIN!==origin)throw new Error('VITE_SOCKET_ORIGIN must match DACOS_API_ORIGIN for direct authenticated WebSockets')
await writeFile('frontend/dist/_redirects',`/api/*  ${origin}/api/:splat  200!\n/*  /index.html  200\n`)
