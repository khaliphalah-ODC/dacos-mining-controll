export function routeAccess(to, user) {
  if (to.meta?.public) return
  if (!user && to.path !== '/login') return '/login'
  if (user && to.path === '/login') return '/overview'
  if (to.meta?.admin && user?.role !== 'ADMIN') return '/overview'
  if (to.meta?.manage && !['ADMIN','SUPERVISOR'].includes(user?.role)) return '/overview'
}
