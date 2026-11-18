import {it,expect} from 'vitest'
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
it('generates same-origin API rewrites and SPA fallback without credentials or external deployment',async()=>{
 const directory=await mkdtemp(resolve(tmpdir(),'dacos-netlify-'))
 try{
  await mkdir(resolve(directory,'frontend/dist'),{recursive:true})
  const script=resolve('scripts/prepare-netlify.mjs'),env={...process.env,DACOS_API_ORIGIN:'https://backend.example.test',VITE_SOCKET_ORIGIN:'https://backend.example.test'}
  const result=spawnSync(process.execPath,[script],{cwd:directory,env,encoding:'utf8'})
  expect(result.status).toBe(0)
  expect(await readFile(resolve(directory,'frontend/dist/_redirects'),'utf8')).toBe('/api/*  https://backend.example.test/api/:splat  200!\n/*  /index.html  200\n')
  expect(spawnSync(process.execPath,[script],{cwd:directory,env:{...env,DACOS_API_ORIGIN:'http://unsafe.example'},encoding:'utf8'}).status).not.toBe(0)
 }finally{await rm(directory,{recursive:true,force:true})}
})
