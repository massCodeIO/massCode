<template>
  <div class="snippet-screenshot">
    <SnippetHeaderTools>
      <div class="left">
        <div class="tools__item">
          <AppCheckbox
            v-model="appStore.screenshot.background"
            name="background"
            :label="i18n.t('background')"
          />
        </div>
        <div class="tools__item">
          <AppCheckbox
            v-model="appStore.screenshot.darkMode"
            name="darkMode"
            :label="i18n.t('darkMode')"
          />
        </div>
        <div class="tools__item">
          <ScreenshotPalette v-model="appStore.screenshot.gradient" />
        </div>
      </div>
      <div class="right">
        <AppActionButton
          v-tooltip="`${i18n.t('button.saveAs')} PNG`"
          @click="onSaveScreenshot('png')"
        >
          PNG &nbsp;
          <UniconsFileDownload />
        </AppActionButton>
        <AppActionButton
          v-tooltip="`${i18n.t('button.saveAs')} SVG`"
          @click="onSaveScreenshot('svg')"
        >
          SVG &nbsp;
          <UniconsFileDownload />
        </AppActionButton>
      </div>
    </SnippetHeaderTools>
    <PerfectScrollbar>
      <div class="content">
        <div
          ref="frameRef"
          class="frame"
        >
          <div
            ref="snippetRef"
            class="background"
            :style="colorBgStyle"
          >
            <div class="body">
              <div class="window-controls">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="54"
                  height="14"
                  viewBox="0 0 54 14"
                >
                  <g
                    fill="none"
                    fill-rule="evenodd"
                    transform="translate(1 1)"
                  >
                    <circle
                      cx="6"
                      cy="6"
                      r="6"
                      fill="#FF5F56"
                      stroke="#E0443E"
                      stroke-width=".5"
                    />
                    <circle
                      cx="26"
                      cy="6"
                      r="6"
                      fill="#FFBD2E"
                      stroke="#DEA123"
                      stroke-width=".5"
                    />
                    <circle
                      cx="46"
                      cy="6"
                      r="6"
                      fill="#27C93F"
                      stroke="#1AAB29"
                      stroke-width=".5"
                    />
                  </g>
                </svg>
              </div>
              <div ref="editorRef" />
            </div>
          </div>
          <div class="transparent" />
          <div
            ref="gutterRef"
            class="gutter"
          />
        </div>
      </div>
    </PerfectScrollbar>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store/app'
import interact from 'interactjs'
import { computed, onMounted, ref, watch } from 'vue'
import { store, i18n } from '@/electron'
import { track } from '@/services/analytics'
import { useSnippetStore } from '@/store/snippets'
import { useMagicKeys } from '@vueuse/core'
import domToImage from 'dom-to-image'
import CodeMirror from 'codemirror'
import { getThemeName } from '../editor/themes'

const GUTTER_RIGHT_OFFSET = 10
const GUTTER_WIDTH = 8
const MAX_WIDTH = 920
const MIN_WIDTH = 520

interface Props {
  snippet: string
  lang: string
  name: string
}

const props = defineProps<Props>()

const appStore = useAppStore()
const snippetStore = useSnippetStore()
// eslint-disable-next-line camelcase
const { escape, Meta_C, Ctrl_C } = useMagicKeys()

const frameRef = ref<HTMLElement>()
const snippetRef = ref<HTMLElement>()
const gutterRef = ref<HTMLElement>()
const editorRef = ref<HTMLElement>()

const gutterWidth = ref(GUTTER_WIDTH + 'px')
const offsetGutterRight = ref(GUTTER_RIGHT_OFFSET + 'px')

const forceRefresh = ref()

const frameWidthC = computed(() => appStore.screenshot.width + 'px')
const transparentOpacity = computed(() =>
  appStore.isLightTheme ? '75%' : '10%'
)
const colorBodyBg = computed(() =>
  appStore.screenshot.darkMode ? '#263238' : '#fff'
)
const colorBgStyle = computed(() => {
  if (!appStore.screenshot.background) return
  return {
    backgroundImage: `linear-gradient(45deg, ${appStore.screenshot.gradient[0]}, ${appStore.screenshot.gradient[1]})`
  }
})
const fontSize = computed(() => appStore.editor.fontSize + 'px')
const fontFamily = computed(() => appStore.editor.fontFamily)

let editor: CodeMirror.Editor

const height = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  forceRefresh.value

  const result =
    appStore.sizes.editor.titleHeight +
    appStore.sizes.titlebar +
    appStore.sizes.editor.footerHeight

  return window.innerHeight - result + 'px'
})

const setValue = (value: string) => {
  if (!editor) return

  const cursor = editor.getCursor()
  editor.setValue(value)

  if (cursor) editor.setCursor(cursor)
}

const setLang = (lang: string) => {
  if (!editor) return
  editor.setOption('mode', lang)
}

const setTheme = (theme: string) => {
  if (!editor) return
  editor.setOption('theme', theme)
}

const init = () => {
  editor = CodeMirror(editorRef.value!, {
    value: props.snippet,
    mode: props.lang,
    theme: appStore.screenshot.darkMode
      ? getThemeName('dark:material')
      : getThemeName('light:github'),
    lineNumbers: false,
    lineWrapping: true,
    tabSize: appStore.editor.tabSize,
    scrollbarStyle: 'null',
    readOnly: true
  })

  interact(frameRef.value!).resizable({
    allowFrom: gutterRef.value!,
    onmove: e => {
      const { pageX } = e
      const gutterOffset = GUTTER_RIGHT_OFFSET + GUTTER_WIDTH / 2
      const width = Math.floor(
        pageX -
          appStore.sizes.sidebar -
          appStore.sizes.snippetList +
          gutterOffset
      )

      appStore.screenshot.width = width

      if (width < MIN_WIDTH) {
        appStore.screenshot.width = 520
      }

      if (width > MAX_WIDTH) {
        appStore.screenshot.width = 920
      }
    }
  })
}

const onSaveScreenshot = async (type: 'png' | 'svg' = 'png') => {
  let data = ''

  if (type === 'png') {
    data = await domToImage.toPng(snippetRef.value!)
  }

  if (type === 'svg') {
    data = await domToImage.toSvg(snippetRef.value!)
  }

  const a = document.createElement('a')
  a.href = data
  a.download = `${props.name}.${type}`
  a.click()

  track('snippets/create-screenshot')
}

const copyToClipboard = async () => {
  const data = await domToImage.toBlob(snippetRef.value!)
  navigator.clipboard.write([new ClipboardItem({ 'image/png': data })])
  track('snippets/create-screenshot')
}

watch(
  () => appStore.screenshot.darkMode,
  v => {
    if (v) {
      setTheme(getThemeName('dark:material')!)
    } else {
      setTheme(getThemeName('light:github')!)
    }
  }
)

watch(
  () => appStore.screenshot,
  v => {
    store.preferences.set('screenshot', JSON.parse(JSON.stringify(v)))
  },
  { deep: true }
)

watch(
  () => props.snippet,
  v => setValue(v)
)
watch(
  () => props.lang,
  v => setLang(v)
)

watch(escape, () => {
  snippetStore.isScreenshotPreview = false
})

watch(Meta_C, v => {
  if (v) {
    copyToClipboard()
  }
})
watch(Ctrl_C, v => {
  if (v) {
    copyToClipboard()
  }
})

onMounted(() => {
  init()
})

window.addEventListener('resize', () => {
  forceRefresh.value = Math.random()
})
</script>

<style lang="scss" scoped>
.snippet-screenshot {
  --color-bg-transparent: hsla(0, 0%, v-bind(transparentOpacity));

  :deep(pre) {
    white-space: pre-wrap;
    font-size: 12px;
  }
  :deep(.ps) {
    height: v-bind(height);
  }
  :deep(.CodeMirror) {
    height: 100%;
    font-size: v-bind(fontSize);
    font-family: v-bind(fontFamily);
    line-height: calc(v-bind(fontSize) * 1.5);
  }
  .left {
    gap: var(--spacing-sm);
    align-items: center;
    display: flex;
  }
  .right {
    display: flex;
  }
  .content {
    flex: 1;
    display: flex;
  }
  .frame {
    position: relative;
    width: v-bind(frameWidthC);
    min-width: 520px;
    max-width: 920px;
  }

  .background {
    position: relative;
    padding: var(--spacing-lg);
    z-index: 10;
  }
  .transparent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(
        45deg,
        var(--color-bg-transparent) 25%,
        transparent 0
      ),
      linear-gradient(-45deg, var(--color-bg-transparent) 25%, transparent 0),
      linear-gradient(45deg, transparent 75%, var(--color-bg-transparent) 0),
      linear-gradient(-45deg, transparent 75%, var(--color-bg-transparent) 0);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    z-index: 1;
  }

  .gutter {
    position: absolute;
    width: v-bind(gutterWidth);
    height: 40px;
    background-color: var(--color-contrast-medium);
    right: v-bind(offsetGutterRight);
    border-radius: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    cursor: col-resize;
  }

  .body {
    padding: var(--spacing-sm);
    border-radius: 12px;
    background-color: v-bind(colorBodyBg);
    user-select: none;
    .window-controls {
      margin-bottom: var(--spacing-xs);
    }
  }
}
</style>
