/**
 * API client for table game.
 * @param {string} viewerId - Current player id
 */
export const createApi = (viewerId) => {
  const withViewer = (path) => {
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}viewerId=${encodeURIComponent(viewerId)}`
  }

  const request = async (path, options = {}) => {
    const method = options.method ?? 'GET'
    const url = method === 'GET' ? withViewer(path) : path
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? res.statusText)
    return data
  }

  return {
    state: () => request('/api/table/state'),
    legalActions: () => request('/api/table/legal-actions'),
    setupDemo: () =>
      request('/api/table/setup-demo', {
        method: 'POST',
        body: JSON.stringify({ viewerId }),
      }),
    startHand: () =>
      request('/api/table/start', { method: 'POST', body: '{}' }),
    action: (type, amount) =>
      request('/api/table/action', {
        method: 'POST',
        body: JSON.stringify({ type, amount, viewerId }),
      }),
  }
}
