import { type EnhanceAppContext, useData } from 'vitepress'
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import DefaultTheme from 'vitepress/theme'
import { defineComponent, h, nextTick, onUnmounted, watch } from 'vue'
import { configure, pageview } from 'vue-gtag'
import AppLink from '../components/global/AppLink.vue'
import AppVersion from '../components/global/AppVersion.vue'
import AssetsDownload from '../components/global/AssetsDownload.vue'
import SidebarSponsors from '../components/sponsors/SidebarSponsors.vue'

import './styles.css'
import './home.css'

function initGtag(context: EnhanceAppContext) {
  if (import.meta.env.SSR || !import.meta.env.VITE_GA)
    return

  configure({
    tagId: import.meta.env.VITE_GA,
    config: { send_page_view: false },
  })

  watch(
    () => context.router.route.data.relativePath,
    () => {
      pageview(context.router.route.path)
    },
    { immediate: true, flush: 'post' },
  )
}

export default {
  ...DefaultTheme,
  Layout: defineComponent({
    setup() {
      const { isDark, page } = useData()
      let frame: number | undefined
      let revision = 0

      if (!import.meta.env.SSR) {
        watch(
          [isDark, () => page.value.relativePath],
          async () => {
            const current = ++revision
            if (frame !== undefined)
              cancelAnimationFrame(frame)
            document.documentElement.classList.add('appearance-changing')
            await nextTick()
            if (current !== revision)
              return
            // Keep transitions disabled through a painted frame of the new appearance.
            frame = requestAnimationFrame(() => {
              frame = requestAnimationFrame(() => {
                document.documentElement.classList.remove(
                  'appearance-changing',
                )
                frame = undefined
              })
            })
          },
          { flush: 'sync' },
        )

        onUnmounted(() => {
          revision++
          if (frame !== undefined)
            cancelAnimationFrame(frame)
          document.documentElement.classList.remove('appearance-changing')
        })
      }

      return () =>
        h(DefaultTheme.Layout, null, {
          'aside-outline-after': () => h(SidebarSponsors),
        })
    },
  }),
  enhanceApp(context: EnhanceAppContext) {
    context.app.component('AppLink', AppLink)
    context.app.component('AppVersion', AppVersion)
    context.app.component('AssetsDownload', AssetsDownload)
    context.app.component('VPButton', VPButton)

    initGtag(context)
  },
}
