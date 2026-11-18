// Configuration-only review: never connects, migrates, deploys or prints secrets.
import {existsSync} from 'node:fs'
import {configuredOrigins} from '../backend/src/security/origins.js'
const environmentFile=process.env.DACOS_ENV_FILE??'.env'
if(existsSync(environmentFile))process.loadEnvFile(environmentFile)
const required=['DATABASE_URL','DATABASE_URL_UNPOOLED','DACOS_JWT_SECRET','DACOS_ALLOWED_ORIGINS','DACOS_API_ORIGIN','VITE_SOCKET_ORIGIN','DACOS_TRUST_PROXY']
const checks=required.map(name=>({check:name,status:process.env[name]?'configured':'missing'}))
for(const key of Object.keys(process.env))if(/^VITE_.*(SECRET|PASSWORD|DATABASE|PRIVATE_KEY)/i.test(key))checks.push({check:'client-secret-exposure',status:'invalid'})
try{configuredOrigins();if(!process.env.DACOS_ALLOWED_ORIGINS)throw new Error();checks.push({check:'exact-origin-policy',status:'valid'})}catch{checks.push({check:'exact-origin-policy',status:'invalid'})}
for(const name of ['DATABASE_URL','DATABASE_URL_UNPOOLED'])try{const url=new URL(process.env[name]);checks.push({check:name+'-format',status:['postgresql:','postgres:'].includes(url.protocol)?'valid':'invalid'})}catch{checks.push({check:name+'-format',status:'invalid'})}
if(process.env.DACOS_JWT_SECRET&&Buffer.byteLength(process.env.DACOS_JWT_SECRET)<48)checks.push({check:'signing-key-length',status:'invalid'})
try{const api=new URL(process.env.DACOS_API_ORIGIN);checks.push({check:'frontend-backend-route',status:api.protocol==='https:'&&api.origin===process.env.DACOS_API_ORIGIN&&process.env.VITE_SOCKET_ORIGIN===api.origin?'valid':'invalid'})}catch{checks.push({check:'frontend-backend-route',status:'invalid'})}
for(const path of ['netlify.toml','railway.json','Dockerfile','frontend/dist/index.html'])checks.push({check:path,status:existsSync(path)?'present':'missing'})
console.log(JSON.stringify({review:'configuration-only',externalDeployment:'NOT APPROVED OR EXECUTED',checks},null,2))
if(checks.some(c=>['missing','invalid'].includes(c.status)))process.exitCode=1
