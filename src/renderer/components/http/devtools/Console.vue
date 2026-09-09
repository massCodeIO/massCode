<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import { useHttpConsole } from '@/composables/spaces/http/devtools/useHttpConsole'
import { i18n, ipc } from '@/electron'
import { useClipboard, useVirtualList } from '@vueuse/core'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Trash2,
} from 'lucide-vue-next'
import { consoleLevels } from '~/shared/httpDevtools'

const props = defineProps<{ detached?: boolean }>()
const { entries, error, clear } = useHttpConsole()
const search = ref('')
const levels = ref<string[]>([...consoleLevels])
const timestamps = ref(false)
const hideNetwork = ref(false)
const selected = ref('')
const raw = ref(false)
const { copy, copied } = useClipboard()
const visible = computed(() =>
  entries.value.filter(
    entry =>
      levels.value.includes(entry.level)
      && (!hideNetwork.value || entry.kind !== 'network')
      && (!search.value
        || `${entry.message} ${JSON.stringify(entry.details)}`
          .toLowerCase()
          .includes(search.value.toLowerCase())),
  ),
)
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  visible,
  { itemHeight: 32, overscan: 8 },
)
const selectedEntry = computed(() =>
  visible.value.find(entry => entry.id === selected.value),
)
const details = computed(() =>
  JSON.stringify(
    raw.value ? selectedEntry.value : selectedEntry.value?.details,
    null,
    2,
  ),
)
function toggleLevel(level: string) {
  levels.value = levels.value.includes(level)
    ? levels.value.filter(value => value !== level)
    : [...levels.value, level]
}
function select(id: string) {
  selected.value = selected.value === id ? '' : id
  raw.value = false
}
function copyAll() {
  void copy(visible.value.map(entry => JSON.stringify(entry)).join('\n'))
}
function detach() {
  void ipc.invoke('spaces:http:console:detach', undefined)
}
watch(
  () => visible.value.length,
  async () => {
    const element = containerProps.ref.value
    const atBottom
      = !element
        || element.scrollHeight - element.scrollTop - element.clientHeight < 80
    if (atBottom) {
      await nextTick()
      scrollTo(Math.max(0, visible.value.length - 1))
    }
  },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1">
      <UiInput
        v-model="search"
        variant="ghost"
        class="!h-6"
        :placeholder="i18n.t('spaces.http.devtools.filter')"
        :aria-label="i18n.t('spaces.http.devtools.filter')"
        clearable
      />
      <Button
        v-for="level in consoleLevels"
        :key="level"
        variant="ghost"
        size="sm"
        :aria-pressed="levels.includes(level)"
        :class="{ 'bg-accent': levels.includes(level) }"
        @click="toggleLevel(level)"
      >
        {{ i18n.t(`spaces.http.devtools.level.${level}`) }}
      </Button>
      <div class="flex-1" />
      <UiActionButton
        :tooltip="
          i18n.t(
            copied
              ? 'spaces.http.devtools.copied'
              : 'spaces.http.devtools.copyAll',
          )
        "
        :aria-label="i18n.t('spaces.http.devtools.copyAll')"
        @click="copyAll"
      >
        <Copy />
      </UiActionButton>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.devtools.clear')"
        :aria-label="i18n.t('spaces.http.devtools.clear')"
        @click="clear"
      >
        <Trash2 />
      </UiActionButton>
      <UiActionButton
        v-if="!props.detached"
        :tooltip="i18n.t('spaces.http.devtools.detach')"
        :aria-label="i18n.t('spaces.http.devtools.detach')"
        @click="detach"
      >
        <ExternalLink />
      </UiActionButton>
    </div>
    <UiText
      v-if="error"
      variant="xs"
      class="text-destructive p-2"
    >
      {{ error }}
    </UiText>
    <div
      v-bind="containerProps"
      class="scrollbar min-h-0 flex-1 overflow-auto"
    >
      <div v-bind="wrapperProps">
        <Button
          v-for="{ data: entry } in list"
          :key="entry.id"
          variant="ghost"
          class="h-8 w-full justify-start gap-2 rounded-none border-b px-3"
          :class="{
            'bg-destructive/5': entry.level === 'error',
            'bg-accent': selected === entry.id,
          }"
          :aria-expanded="selected === entry.id"
          @click="select(entry.id)"
        >
          <ChevronDown
            v-if="selected === entry.id"
            class="size-3"
          /><ChevronRight
            v-else
            class="size-3"
          />
          <UiText
            v-if="timestamps"
            variant="xs"
            muted
            mono
          >
            {{ new Date(entry.timestamp).toLocaleTimeString() }}
          </UiText>
          <UiText
            variant="xs"
            mono
            class="min-w-0 flex-1 truncate text-left"
            :class="{ 'text-destructive': entry.level === 'error' }"
          >
            {{ entry.message }}
          </UiText>
          <UiText
            v-if="entry.pending"
            variant="xs"
            muted
          >
            {{ i18n.t("spaces.http.devtools.pending") }}
          </UiText>
          <UiText
            v-if="entry.status"
            variant="xs"
            mono
          >
            {{ entry.status }}
          </UiText>
          <UiText
            v-if="entry.durationMs !== undefined"
            variant="xs"
            mono
            muted
          >
            {{ entry.durationMs }} ms
          </UiText>
        </Button>
      </div>
      <UiText
        v-if="!visible.length"
        as="div"
        variant="sm"
        muted
        class="p-6 text-center"
      >
        {{ i18n.t("spaces.http.devtools.noLogs") }}
      </UiText>
    </div>
    <div
      v-if="selectedEntry"
      class="flex max-h-[55%] min-h-0 shrink-0 flex-col border-t"
    >
      <div class="flex shrink-0 items-center gap-2 px-3 py-1">
        <Button
          variant="ghost"
          size="sm"
          :aria-pressed="raw"
          @click="raw = !raw"
        >
          {{ i18n.t("spaces.http.devtools.raw") }}
        </Button><UiText
          v-if="selectedEntry.truncated"
          variant="xs"
          muted
        >
          {{ i18n.t("spaces.http.devtools.truncated") }}
        </UiText>
        <div class="flex-1" />
        <UiActionButton
          :tooltip="i18n.t('spaces.http.devtools.copy')"
          @click="copy(details ?? '')"
        >
          <Copy />
        </UiActionButton>
      </div>
      <pre class="scrollbar min-h-0 overflow-auto px-3 pb-2 select-text"><UiText
variant="xs"
                                                                                 mono
      >{{ details }}</UiText></pre>
    </div>
    <div class="flex shrink-0 items-center gap-4 border-t px-3 py-1">
      <label class="flex items-center gap-2"><Checkbox v-model="timestamps" /><UiText
        variant="xs"
        muted
      >{{
        i18n.t("spaces.http.devtools.timestamps")
      }}</UiText></label>
      <label class="flex items-center gap-2"><Checkbox v-model="hideNetwork" /><UiText
        variant="xs"
        muted
      >{{
        i18n.t("spaces.http.devtools.hideNetwork")
      }}</UiText></label>
      <UiText
        variant="xs"
        muted
        class="ml-auto"
      >
        {{ visible.length }}
      </UiText>
    </div>
  </div>
</template>
