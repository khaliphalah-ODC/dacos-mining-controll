import { defineStore } from 'pinia'
import { ref } from 'vue'
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null), csrfToken = ref(''), ready = ref(false)
  let pending,epoch=0
  async function request(path, body, method = 'POST', options = {}) {
    const current=epoch
    const response = await fetch(path, { method, signal: options.signal, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken.value }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const data = await response.json()
    if (response.status === 401 && current===epoch) { user.value = null; csrfToken.value = '' }
    if (!response.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status:response.status })
    return data
  }
  async function download(path, filename) {
    const response=await fetch(path,{credentials:'same-origin'})
    if(response.status===401){user.value=null;csrfToken.value=''}
    if(!response.ok)throw new Error((await response.json()).error??'Download failed')
    const url=URL.createObjectURL(await response.blob()),anchor=document.createElement('a')
    anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function restore() {
    if (pending) return pending
    const current=epoch
    pending = (async () => {
      try { const data = await request('/api/auth/session', undefined, 'GET'); if(current===epoch){user.value=data.user;csrfToken.value=data.csrfToken} }
      catch { if(current===epoch)user.value = null }
      finally { ready.value = true; pending = null }
    })()
    return pending
  }
  async function login(email, password) { const current=++epoch; const data = await request('/api/auth/login', { email, password }); if(current===epoch){user.value = data.user; csrfToken.value = data.csrfToken; ready.value = true} }
  async function logout() { ++epoch; await request('/api/auth/logout', {}); user.value = null; csrfToken.value = '' }
  const canManage = () => ['ADMIN', 'SUPERVISOR'].includes(user.value?.role)
  return { user, csrfToken, ready, restore, login, logout, request, download, canManage }
})
