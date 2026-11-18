import {it,expect,vi} from 'vitest'
import {allowedOrigin,configuredOrigins} from '../src/security/origins.js'
it('requires exact allowlisted origins and HTTPS in production',()=>{
 expect(allowedOrigin('https://pilot.netlify.app','backend.example',['https://pilot.netlify.app'])).toBe(true)
 expect(allowedOrigin('https://pilot.netlify.app.attacker.example','backend.example',['https://pilot.netlify.app'])).toBe(false)
 expect(()=>configuredOrigins('*')).toThrow()
 expect(()=>configuredOrigins('https://user:secret@example.test')).toThrow()
 vi.stubEnv('NODE_ENV','production')
 try{expect(()=>configuredOrigins('http://example.test')).toThrow();expect(allowedOrigin('http://localhost:3001','localhost:3001',[])).toBe(false)}finally{vi.unstubAllEnvs()}
})
