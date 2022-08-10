<template>
  <div
    class="app-title-bar"
    :class="{ 'is-win': appStore.platform === 'win32' }"
  />
  <RouterView />
  <div class="top-notification">
    <span
      v-if="!appStore.isSponsored && !isUpdateAvailable"
      class="unsponsored"
    >
      {{ i18n.t('special:unsponsored') }}
    </span>
    <span
      v-if="isUpdateAvailable"
      class="update"
      @click="onClickUpdate"
    >
      {{ i18n.t('updateAvailable') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import router from '@/router'
import { nextTick, ref, watch } from 'vue'
import { ipc, store, track, i18n } from './electron'
import { useAppStore } from './store/app'
import { repository } from '../../package.json'
import { useSnippetStore } from './store/snippets'
import {
  onAddNewSnippet,
  onAddNewFragment,
  onAddNewFolder,
  onCopySnippet,
  emitter,
  onCreateSnippet,
  onAddDescription,
  checkForRemoteNotification
} from '@/composable'
import { createToast, destroyAllToasts } from 'vercel-toast'
import { useRoute } from 'vue-router'
import type { Snippet } from '@shared/types/main/db'
import { addDays, isSameDay, isYesterday } from 'date-fns'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { loadGrammars } from '@/components/editor/grammars'

// По какой то причине необходимо явно установить роут в '/'
// для корректного поведения в продакшен сборке
// TODO: выяснить причину
router.push('/')

const appStore = useAppStore()
const snippetStore = useSnippetStore()
const route = useRoute()

const isUpdateAvailable = ref(false)
const isSupportToastShow = ref(false)

const init = async () => {
  loadWASM(onigasmFile)
  await loadGrammars()

  const theme = store.preferences.get('theme')
  const dateInstallation = store.app.get('dateInstallation')
  const isValid = appStore.isEditorSettingsValid(
    store.preferences.get('editor')
  )

  if (isValid) appStore.editor = store.preferences.get('editor')

  appStore.sizes.sidebar = store.app.get('sidebarWidth')
  appStore.sizes.snippetList = store.app.get('snippetListWidth')
  appStore.screenshot = store.preferences.get('screenshot')
  appStore.markdown = store.preferences.get('markdown')

  snippetStore.sort = store.app.get('sort')

  if (theme) {
    appStore.setTheme(theme)
  } else {
    appStore.setTheme('light:github')
  }

  if (!dateInstallation) {
    store.app.set('dateInstallation', new Date().valueOf())
  }

  trackAppUpdate()
  checkForRemoteNotification()
}

const setTheme = (theme: string) => {
  document.body.dataset.theme = theme
}

const onClickUpdate = () => {
  ipc.invoke('main:open-url', `${repository}/releases`)
  track('app/update')
}

const trackAppUpdate = () => {
  const installedVersion = store.app.get('version')

  if (!installedVersion) track('app/install')

  if (installedVersion && appStore.version !== installedVersion) {
    track('app/update', `from-${installedVersion}`)
  }

  store.app.set('version', appStore.version)
}

// Yes, this is that annoying piece of crap code.
// You can delete it, but know that you hurt me.
const showSupportToast = () => {
  if (appStore.isSponsored) return

  const addNextNotice = () => {
    store.app.set('nextSupportNotice', addDays(new Date(), 7).valueOf())
  }

  const date = store.app.get('nextSupportNotice')

  if (!date) addNextNotice()

  const isShow = isSameDay(new Date(), date) || isYesterday(date)

  if (!isShow) return
  if (isSupportToastShow.value) return

  const message = document.createElement('div')
  message.innerHTML = i18n.t('special:supportMessage', {
    tagStart: '<a id="donate" href="#">',
    tagEnd: '</a>'
  })

  createToast(message, {
    action: {
      text: i18n.t('close'),
      callback (toast) {
        toast.destroy()
        addNextNotice()
        isSupportToastShow.value = false
        track('app/notify', 'support-close')
      }
    }
  })

  const d = document.querySelector('#donate')

  d?.addEventListener('click', () => {
    ipc.invoke('main:open-url', 'https://masscode.io/donate')
    destroyAllToasts()
    addNextNotice()
    isSupportToastShow.value = false
    track('app/notify', 'support-go-to-masscode')
  })

  isSupportToastShow.value = true
}

init()

watch(
  () => appStore.theme,
  () => setTheme(appStore.theme),
  { immediate: true }
)

watch(
  () => [snippetStore.selectedId, snippetStore.fragment],
  () => {
    snippetStore.isMarkdownPreview = false
  }
)

watch(
  () => route.path,
  () => {
    if (route.path === '/') {
      nextTick(() => {
        emitter.emit('scroll-to:snippet', snippetStore.selectedId!)
      })
    }
  }
)

ipc.on('main:update-available', () => {
  isUpdateAvailable.value = true
})

ipc.on('main:focus', () => {
  showSupportToast()
})

ipc.on('main-menu:preferences', () => {
  router.push('/preferences')
})

ipc.on('main-menu:new-folder', async () => {
  await onAddNewFolder()
})

ipc.on('main-menu:new-snippet', async () => {
  await onAddNewSnippet()
})

ipc.on('main-menu:new-fragment', () => {
  onAddNewFragment()
})

ipc.on('main-menu:preview-markdown', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    snippetStore.isMarkdownPreview = !snippetStore.isMarkdownPreview
    track('snippets/markdown-preview')
  }
})
ipc.on('main-menu:presentation-mode', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    router.push('/presentation')
    track('snippets/presentation-mode')
  }
})

ipc.on('main-menu:preview-code', () => {
  snippetStore.isCodePreview = !snippetStore.isCodePreview
})

ipc.on('main-menu:copy-snippet', () => {
  onCopySnippet()
})

ipc.on('main-menu:format-snippet', () => {
  emitter.emit('snippet:format', true)
})

ipc.on('main-menu:search', () => {
  emitter.emit('search:focus', true)
})

ipc.on('main-menu:sort-snippets', (event, sort) => {
  snippetStore.setSort(sort)
})

ipc.on('main-menu:add-description', async () => {
  await onAddDescription()
})

ipc.on('api:snippet-create', (event, body: Snippet) => {
  onCreateSnippet(body)
})
</script>

<style lang="scss">
body {
  margin: 0;
}
#app {
  height: 100vh;
  overflow: hidden;
}
.app {
  &-title-bar {
    position: absolute;
    top: 0;
    width: 100%;
    height: var(--title-bar-height);
    user-select: none;
    -webkit-app-region: drag;
    z-index: 1010;
    transition: all 0.5s;
    &.is-win {
      border-top: 1px solid var(--color-border);
    }
  }
}
.top-notification {
  position: absolute;
  top: 5px;
  right: var(--spacing-sm);
  z-index: 1020;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  gap: var(--spacing-sm);
}
.update {
  background: -webkit-linear-gradient(60deg, var(--color-primary), limegreen);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: shine 3s ease infinite;
}

@keyframes shine {
  from {
    background-position: 200%;
  }
}

@keyframes zoom {
  from {
    background-position: 100%;
  }
}
</style>
