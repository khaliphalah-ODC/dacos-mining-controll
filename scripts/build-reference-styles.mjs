import {readFile,writeFile} from 'node:fs/promises'
import vm from 'node:vm'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
const projectRoot=fileURLToPath(new URL('../',import.meta.url))
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
const html=await readFile(new URL('../stitch_dacos_mine_safety_ui/dacos_monitoring_overview/code.html',import.meta.url),'utf8')
const context={tailwind:{}}
vm.runInNewContext(html.match(/<script[^>]*id="tailwind-config"[^>]*>([\s\S]*?)<\/script>/)[1],context,{timeout:1000})
const config={...context.tailwind.config,content:[resolve(projectRoot,'frontend/src/**/*.{vue,js}'),resolve(projectRoot,'stitch_dacos_mine_safety_ui/{dacos_monitoring_overview,dacos_accounts_security_audit,dacos_ble_gateway,dacos_control_room_login,dacos_control_room_telemetry,dacos_device_management,dacos_environmental_monitoring,dacos_fictional_mine_map,dacos_history_reports,dacos_incident_detail_inc_104,dacos_incident_management_console,dacos_live_workers_directory,dacos_my_account_security_profile,dacos_operational_threshold_rules,dacos_wi_fi_device_simulator,dacos_worker_detail_peter_kollie_w_088,dacos_worker_management}/code.html')]}
const result=await postcss([tailwindcss(config)]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})
result.root.walkRules(rule=>{
 if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return
 rule.selectors=rule.selectors.map(selector=>{
  if(selector==='html'||selector===':host'||selector==='body')return '.reference-ui'
  return '.reference-ui '+selector.replace(/:is\(\.dark /g,':is(.dark ')
 })
})
const icons=`.reference-ui .material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-smoothing:antialiased;font-feature-settings:'liga';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}`
await writeFile(new URL('../frontend/src/reference-design.css',import.meta.url),icons+'\n'+result.root.toString()+'\n')
