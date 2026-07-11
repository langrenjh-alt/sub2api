import type { RouterScrollBehavior } from 'vue-router'

const HOME_HEADER_OFFSET = 64

export const appScrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
  if (savedPosition) return savedPosition

  if (to.hash) {
    return {
      el: to.hash,
      top: HOME_HEADER_OFFSET,
      behavior: 'instant',
    }
  }

  return { top: 0 }
}
