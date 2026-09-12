<script setup lang="ts">
import type { LinkRow, ResolvedLink } from './links'
import type { InternalLinkMatch } from '~/shared/notes/internalLinks'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { subscribeStorageMutations } from '@/composables/useStorageMutation'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { useDebounceFn } from '@vueuse/core'
import {
  Code2,
  ExternalLink,
  FileText,
  Globe,
  LocateFixed,
  Send,
} from 'lucide-vue-next'
import { findInternalLinks } from '~/shared/notes/internalLinks'
import { groupExternalLinks, groupLinks, resolveInspectorLinks } from './links'

const props = defineProps<{
  noteId: number
  content: string
  disabled: boolean
  canCreate: boolean
}>()
const emit = defineEmits<{
  reveal: [match: LinkRow['occurrences'][number]]
  activate: [match: InternalLinkMatch]
}>()
const statusFilter = ref<'all' | 'linked' | 'planned' | 'missing'>('all')
const spaceFilter = ref('all')
const statuses = ['all', 'linked', 'planned', 'missing'] as const
const spaces = ['all', 'note', 'snippet', 'http-request', 'external'] as const
const displayedNoteId = ref<number>()
const displayedContent = ref('')
const actionsDisabled = computed(
  () => props.disabled || displayedNoteId.value !== props.noteId,
)
const resolved = shallowRef(new Map<string, ResolvedLink | null>())
const loading = ref(false)
const showLoading = computed(() => loading.value && resolved.value.size === 0)
const failed = ref(false)
const revision = ref(0)
const refresh = useDebounceFn(() => {
  revision.value += 1
}, 200)
const unsubscribeMutations = subscribeStorageMutations(refresh)
onBeforeUnmount(unsubscribeMutations)
ipc.on('system:storage-synced', refresh)
onBeforeUnmount(() => ipc.removeListener('system:storage-synced', refresh))
const matches = computed(() => findInternalLinks(displayedContent.value))
const targetKey = computed(() =>
  JSON.stringify(
    [
      ...new Set(
        findInternalLinks(props.content)
          .filter(match => !match.plannedTarget)
          .map(match => match.target),
      ),
    ].sort(),
  ),
)
const rows = computed(() => [
  ...groupLinks(matches.value, resolved.value),
  ...groupExternalLinks(displayedContent.value),
])
const summary = computed(() => ({
  external: rows.value.filter(row => row.status === 'external').length,
  linked: rows.value.filter(row => row.status === 'linked').length,
  planned: rows.value.filter(row => row.status === 'planned').length,
  missing: rows.value.filter(row => row.status === 'missing').length,
}))
const groups = computed(() => {
  const filtered = rows.value.filter(
    row =>
      (statusFilter.value === 'all' || row.status === statusFilter.value)
      && (spaceFilter.value === 'all' || row.type === spaceFilter.value),
  )
  return [
    ...(['note', 'snippet', 'http-request'] as const).map(type => ({
      key: type,
      label: i18n.t(`internalLinks.planned.types.${type}`),
      rows: filtered.filter(
        row => row.status === 'linked' && row.type === type,
      ),
    })),
    {
      key: 'external',
      label: i18n.t('notes.inspector.external'),
      rows: filtered.filter(row => row.status === 'external'),
    },
    ...(['planned', 'missing', 'pending'] as const).map(status => ({
      key: status,
      label: i18n.t(`notes.inspector.${status}`),
      rows: filtered.filter(row => row.status === status),
    })),
  ].filter(group => group.rows.length)
})
watch(
  [() => props.noteId, targetKey, revision, () => props.disabled],
  async ([noteId], _, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    if (props.disabled)
      return
    failed.value = false
    const targets: string[] = JSON.parse(targetKey.value)
    loading.value = targets.length > 0
    if (!targets.length) {
      resolved.value = new Map()
      displayedContent.value = props.content
      displayedNoteId.value = noteId
      return
    }
    try {
      const result = await resolveInspectorLinks(targets)
      if (!cancelled) {
        resolved.value = result
        displayedContent.value = props.content
        displayedNoteId.value = noteId
      }
    }
    catch {
      if (!cancelled) {
        failed.value = true
        if (displayedNoteId.value !== noteId) {
          resolved.value = new Map()
          displayedContent.value = props.content
          displayedNoteId.value = noteId
        }
      }
    }
    finally {
      if (!cancelled)
        loading.value = false
    }
  },
  { immediate: true },
)
watch(
  () => props.content,
  (value) => {
    if (!props.disabled && displayedNoteId.value === props.noteId)
      displayedContent.value = value
  },
)
watch(
  () => props.noteId,
  () => {
    statusFilter.value = 'all'
    spaceFilter.value = 'all'
  },
)
function icon(row: LinkRow) {
  if (row.type === 'external')
    return Globe
  return row.type === 'snippet'
    ? Code2
    : row.type === 'http-request'
      ? Send
      : FileText
}
function openRow(row: LinkRow, event: MouseEvent) {
  if (actionsDisabled.value)
    return
  if (
    row.status === 'planned'
    && props.canCreate
    && (isMac ? event.metaKey : event.ctrlKey)
  ) {
    const match = row.occurrences[0]!
    if ('plannedTarget' in match)
      emit('activate', match)
  }
  else {
    revealRow(row)
  }
}
const occurrenceIndex = new Map<string, number>()
watch(
  () => props.noteId,
  () => occurrenceIndex.clear(),
)
function revealRow(row: LinkRow) {
  const index = (occurrenceIndex.get(row.key) ?? 0) % row.occurrences.length
  emit('reveal', row.occurrences[index]!)
  occurrenceIndex.set(row.key, index + 1)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="space-y-2 p-3">
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.summary", summary) }}
      </UiText>
      <div class="flex flex-wrap gap-1">
        <Select.Select v-model="statusFilter">
          <Select.SelectTrigger
            class="h-7 w-auto"
            :aria-label="i18n.t('notes.inspector.filterStatus')"
          >
            <Select.SelectValue>
              {{ i18n.t(`notes.inspector.status.${statusFilter}`) }} ·
              {{ statusFilter === "all" ? rows.length : summary[statusFilter] }}
            </Select.SelectValue>
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="status in statuses"
              :key="status"
              :value="status"
            >
              {{ i18n.t(`notes.inspector.status.${status}`) }} ·
              {{ status === "all" ? rows.length : summary[status] }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <Select.Select v-model="spaceFilter">
          <Select.SelectTrigger
            class="h-7 w-auto"
            :aria-label="i18n.t('notes.inspector.filterSpace')"
          >
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="space in spaces"
              :key="space"
              :value="space"
            >
              {{ i18n.t(`notes.inspector.space.${space}`) }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </div>
      <UiText
        v-if="showLoading"
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.pending") }}
      </UiText>
      <template v-if="failed">
        <UiText
          as="p"
          variant="xs"
        >
          {{ i18n.t("notes.inspector.failed") }}
        </UiText>
        <Button
          variant="outline"
          size="sm"
          @click="revision++"
        >
          {{ i18n.t("contentLoad.retry") }}
        </Button>
      </template>
    </div>
    <div
      class="scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3"
      :aria-busy="loading"
    >
      <UiText
        v-if="!groups.length"
        as="p"
        variant="xs"
        muted
      >
        {{
          i18n.t(
            rows.length ? "notes.inspector.noMatches" : "notes.inspector.empty",
          )
        }}
      </UiText>
      <section
        v-for="group in groups"
        :key="group.key"
        class="space-y-1"
      >
        <UiText
          as="h3"
          variant="xs"
          weight="medium"
        >
          {{ group.label }} · {{ group.rows.length }}
        </UiText>
        <div
          v-for="row in group.rows"
          :key="row.key"
          class="flex min-w-0 items-start gap-1 border-b py-1"
        >
          <div
            class="flex min-w-0 flex-1 items-start gap-2 px-1 py-2 text-left"
          >
            <span class="flex h-4 shrink-0 items-center">
              <component
                :is="icon(row)"
                class="size-3.5"
              />
            </span>
            <span class="min-w-0">
              <UiText
                as="span"
                variant="xs"
                class="block truncate"
              >{{
                row.name
              }}</UiText>
              <NotesInspectorAlias
                v-for="alias in row.aliases"
                :key="alias"
                :alias="alias"
              />
              <UiText
                as="span"
                variant="xs"
                muted
                class="block truncate"
              >{{
                row.url
                  ? row.url
                  : row.status === "linked"
                    ? row.path || i18n.t("common.inbox")
                    : row.type
                      ? i18n.t(`internalLinks.planned.types.${row.type}`)
                      : row.name
              }}</UiText>
            </span>
          </div>
          <div class="mt-2 flex h-4 shrink-0 items-center">
            <UiText
              variant="xs"
              muted
              class="pr-2"
            >
              ×{{ row.occurrences.length }}
            </UiText>
            <UiActionButton
              v-if="row.url"
              :tooltip="i18n.t('notes.inspector.openExternal')"
              :disabled="actionsDisabled"
              @click="ipc.invoke('system:open-external', row.url)"
            >
              <ExternalLink class="size-3.5" />
            </UiActionButton>
            <UiActionButton
              :tooltip="i18n.t('notes.inspector.reveal')"
              :disabled="actionsDisabled"
              @click="openRow(row, $event)"
            >
              <LocateFixed class="size-3.5" />
            </UiActionButton>
          </div>
        </div>
      </section>
      <UiText
        v-if="summary.planned && canCreate"
        as="p"
        variant="xs"
        muted
      >
        {{
          i18n.t("notes.inspector.createHint", {
            shortcut: isMac ? "Cmd" : "Ctrl",
          })
        }}
      </UiText>
    </div>
  </div>
</template>
