<template>
  <div
    class="presentation"
    @mousemove="onHover"
  >
    <div class="header">
      <AppActionButton
        v-tooltip="i18n.t('close')"
        class="action"
        :class="{ show: showActions }"
        @click="toHome"
      >
        <UniconsTimes />
      </AppActionButton>
    </div>
    <div class="body">
      <TheMarkdown
        :scale="scale"
        :value="snippetStore.currentContent!"
      />
    </div>
    <div class="footer">
      <div
        class="actions"
        :class="{ show: showActions }"
      >
        <AppActionButton @click="onFullscreen">
          <UniconsExpandAlt
            v-if="!isFullscreen"
            width="24px"
            height="24px"
          />
          <UniconsCompressAlt
            v-else
            width="24px"
            height="24px"
          />
        </AppActionButton>
        <div class="nav">
          <AppActionButton @click="onPrevSlide">
            <UniconsArrowLeft
              width="24px"
              height="24px"
            />
          </AppActionButton>
          <AppActionButton @click="onNextSlide">
            <UniconsArrowRight
              width="24px"
              height="24px"
            />
          </AppActionButton>
        </div>
        <div class="scale">
          <AppActionButton @click="onMinusScale">
            <UniconsMinus
              width="24px"
              height="24px"
            />
          </AppActionButton>
          <div class="factor">
            {{ scale }}
          </div>
          <AppActionButton @click="onPlusScale">
            <UniconsPlus
              width="24px"
              height="24px"
            />
          </AppActionButton>
        </div>
        <div class="count">
          {{ currentIndex + 1 }} / {{ slideIds.length }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { i18n, store, track } from '@/electron'
import { useSnippetStore } from '@/store/snippets'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn, useMagicKeys, useFullscreen } from '@vueuse/core'
import { useAppStore } from '@/store/app'

const snippetStore = useSnippetStore()
const appStore = useAppStore()
const router = useRouter()
const { left, right, escape } = useMagicKeys()
const { isFullscreen, toggle } = useFullscreen()

const slideIds = snippetStore.snippets
  .filter(i => i.content[0].language === 'markdown')
  .map(i => i.id)
const currentIndex = computed(() =>
  snippetStore.snippets.findIndex(i => i.id === snippetStore.selectedId)
)

const showActions = ref(false)
const scale = computed({
  get: () => appStore.markdown.presentationScale,
  set: v => {
    appStore.markdown.presentationScale = Number(v.toFixed(1))
    store.preferences.set('markdown', { ...appStore.markdown })
  }
})
const toHome = () => {
  router.push('/')
}

const onPrevSlide = () => {
  const prevId = slideIds[currentIndex.value - 1]
  if (prevId) {
    snippetStore.getSnippetsById(prevId)
  }
}

const onNextSlide = () => {
  const nextId = slideIds[currentIndex.value + 1]
  if (nextId) {
    snippetStore.getSnippetsById(nextId)
  }
}

const onMinusScale = () => {
  if (scale.value.toFixed(1) === '1.0') return
  scale.value -= 0.1
}

const onPlusScale = () => {
  scale.value += 0.1
}

const onFullscreen = () => {
  toggle()
}

const hideActions = useDebounceFn(() => {
  showActions.value = false
}, 2000)

const onHover = () => {
  showActions.value = true
  hideActions()
}

watch(left, v => {
  if (v) onPrevSlide()
})

watch(right, v => {
  if (v) onNextSlide()
})

watch(escape, v => {
  if (v) toHome()
})

track('presentation')
</script>

<style lang="scss" scoped>
.presentation {
  margin-top: var(--title-bar-height);
}
.header {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--spacing-xs);
}
.body {
  padding: var(--spacing-sm) var(--spacing-xl);
  display: grid;
  :deep(h1) {
    border-bottom: none;
  }
}

.footer {
  position: absolute;
  left: var(--spacing-sm);
  bottom: var(--spacing-sm);
  .actions {
    align-items: center;
    display: flex;
    gap: var(--spacing-sm);
    opacity: 0;
    transition: opacity 0.3s;
    &:hover {
      opacity: 1;
    }
    &.show {
      opacity: 1;
    }
    .nav {
      display: flex;
    }
    .scale {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      .factor {
        width: 20px;
        text-align: center;
      }
    }
  }
}
.action {
  opacity: 0;
  transition: opacity 0.3s;
  &.show {
    opacity: 1;
  }
}
</style>
