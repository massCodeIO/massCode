<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Select from '@/components/ui/shadcn/select'
import { useHttpConsole } from '@/composables/spaces/http/devtools/useHttpConsole'
import { i18n, ipc } from '@/electron'
import { useClipboard, useVirtualList } from '@vueuse/core'
import { Copy, ExternalLink, Trash2 } from 'lucide-vue-next'
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
  {
    itemHeight: index =>
      visible.value[index]?.id === selected.value ? 353 : 32,
    overscan: 8,
  },
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
function select(id: string) {
  selected.value = selected.value === id ? '' : id
  raw.value = false
}
watch(selected, () => containerProps.onScroll(), { flush: 'post' })
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
      <div class="flex-1" />
      <Select.Select
        v-model="levels"
        multiple
      >
        <Select.SelectTrigger
          class="h-7 w-auto shrink-0"
          :aria-label="i18n.t('spaces.http.devtools.logLevels')"
        >
          <Select.SelectValue>
            {{
              i18n.t(
                levels.length === consoleLevels.length
                  ? "spaces.http.devtools.allLogs"
                  : "spaces.http.devtools.customLogs",
              )
            }}
          </Select.SelectValue>
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="level in consoleLevels"
            :key="level"
            :value="level"
          >
            {{ i18n.t(`spaces.http.devtools.level.${level}`) }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
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
    <UiAlert
      v-if="error"
      variant="error"
      layout="panel"
    >
      {{ error }}
    </UiAlert>
    <div
      v-bind="containerProps"
      class="scrollbar min-h-0 flex-1 overflow-auto"
    >
      <div v-bind="wrapperProps">
        <UiExpandableRow
          v-for="{ data: entry } in list"
          :key="entry.id"
          :expanded="selected === entry.id"
          :header-class="{ 'bg-destructive/5': entry.level === 'error' }"
          @update:expanded="select(entry.id)"
        >
          <template #header>
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
          </template>
          <div class="flex h-80 min-h-0 flex-col">
            <div class="flex shrink-0 items-center gap-2 px-3 py-1">
              <Button
                variant="ghost"
                size="sm"
                :aria-pressed="raw"
                @click="raw = !raw"
              >
                {{ i18n.t("spaces.http.devtools.raw") }}
              </Button><UiText
                v-if="entry.truncated"
                variant="xs"
                muted
              >
                {{ i18n.t("spaces.http.devtools.truncated") }}
              </UiText>
              <div class="flex-1" />
              <UiActionButton
                :tooltip="i18n.t('spaces.http.devtools.copy')"
                :aria-label="i18n.t('spaces.http.devtools.copy')"
                @click="copy(details ?? '')"
              >
                <Copy />
              </UiActionButton>
            </div>
            <HttpDevtoolsConsoleDetails
              :entry="entry"
              :raw="raw"
            />
          </div>
        </UiExpandableRow>
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
