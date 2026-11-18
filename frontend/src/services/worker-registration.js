// QR destinations contain only a public URL, never worker data or device credentials.
export function workerRegistrationUrl(origin) {
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter an HTTP(S) origin only, without a path, credentials or query.')
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !local) throw new Error('Use HTTPS for a non-local registration address.')
  return new URL('/worker-register', url.origin).href
}
