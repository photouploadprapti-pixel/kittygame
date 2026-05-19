const SUIT_SYM = { c: '♣', d: '♦', h: '♥', s: '♠' }
const RED = new Set(['h', 'd'])

/**
 * Render a playing card element.
 * @param {string} code - e.g. "Ah" or "??"
 */
export const renderCard = (code) => {
  const el = document.createElement('div')
  el.className = 'card'

  if (code === '??' || !code || code.length < 2) {
    el.classList.add('back')
    return el
  }

  const rank = code.slice(0, -1)
  const suit = code.slice(-1).toLowerCase()
  const red = RED.has(suit)
  el.classList.add(red ? 'red' : 'black')
  el.innerHTML = `<span>${rank}</span><span class="suit">${SUIT_SYM[suit] ?? suit}</span>`
  return el
}

/**
 * Clear and fill a container with cards.
 * @param {HTMLElement} container
 * @param {string[]} codes
 */
export const renderCards = (container, codes) => {
  container.innerHTML = ''
  for (const c of codes) {
    container.appendChild(renderCard(c))
  }
}
