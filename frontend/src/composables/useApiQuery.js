import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
export function useApiQuery(url,{realtime=false}={}){
 const auth=useAuthStore(),telemetry=useTelemetryStore(),data=ref(null),loading=ref(true),error=ref('')
 let active=true,controller,timer,generation=0
 async function load(){if(!active)return;controller?.abort();controller=new AbortController();const run=++generation;loading.value=true
  try{const value=await auth.request(typeof url==='function'?url():url,undefined,'GET',{signal:controller.signal});if(active&&run===generation){data.value=value;error.value=''}}catch(e){if(active&&run===generation&&e.name!=='AbortError')error.value=e.message}finally{if(active&&run===generation)loading.value=false}}
 if(realtime)watch(()=>[telemetry.snapshot?.sequence,telemetry.incidentRevision],()=>{clearTimeout(timer);timer=setTimeout(load,200)})
 onMounted(load);onBeforeUnmount(()=>{active=false;generation++;controller?.abort();clearTimeout(timer)})
 return {data,loading,error,load}
}
