<script setup lang="ts">
import type { CalloutType } from '../cm-extensions/callouts'
import type { NoteAnnotation } from './annotations'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import {
  Flame,
  Info,
  LocateFixed,
  SquareCheck,
  TriangleAlert,
} from 'lucide-vue-next'
import { calloutTitleByType } from '../cm-extensions/callouts'
import { getAnnotations } from './annotations'

const props = defineProps<{
  noteId: number
  content: string
  disabled: boolean
}>()
const emit = defineEmits<{ reveal: [annotation: NoteAnnotation] }>()
const icons = {
  NOTE: Info,
  IMPORTANT: Flame,
  WARNING: TriangleAlert,
  TODO: SquareCheck,
}
const filter = ref('all')
const types = Object.keys(calloutTitleByType) as CalloutType[]
const annotations = computed(() => getAnnotations(props.content))
const visible = computed(() =>
  annotations.value.filter(
    item => filter.value === 'all' || item.type === filter.value,
  ),
)
const groups = computed(() =>
  types
    .map(type => ({
      type,
      items: visible.value.filter(item => item.type === type),
    }))
    .filter(group => group.items.length),
)
watch(
  () => props.noteId,
  () => (filter.value = 'all'),
)
function count(type: string) {
  return annotations.value.filter(
    item => type === 'all' || item.type === type,
  ).length
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
        {{
          i18n.t("notes.inspector.annotations.summary", {
            count: annotations.length,
          })
        }}
      </UiText>
      <div class="flex flex-wrap gap-1">
        <Select.Select v-model="filter">
          <Select.SelectTrigger
            class="h-7 w-auto"
            :aria-label="i18n.t('notes.inspector.annotations.filter')"
          >
            <Select.SelectValue>
              {{
                filter === "all"
                  ? i18n.t("notes.inspector.annotations.all")
                  : i18n.t(`notes.inspector.annotations.types.${filter}`)
              }}
              · {{ count(filter) }}
            </Select.SelectValue>
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="all">
              {{ i18n.t("notes.inspector.annotations.all") }} ·
              {{ annotations.length }}
            </Select.SelectItem>
            <Select.SelectItem
              v-for="type in types"
              :key="type"
              :value="type"
            >
              {{ i18n.t(`notes.inspector.annotations.types.${type}`) }} ·
              {{ count(type) }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </div>
    </div>
    <div class="scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-3">
      <UiText
        v-if="!visible.length"
        as="p"
        variant="xs"
        muted
      >
        {{
          i18n.t(
            annotations.length
              ? "notes.inspector.annotations.noMatches"
              : "notes.inspector.annotations.empty",
          )
        }}
      </UiText>
      <section
        v-for="group in groups"
        :key="group.type"
        class="space-y-1"
      >
        <UiText
          as="h3"
          variant="xs"
          weight="medium"
        >
          {{ i18n.t(`notes.inspector.annotations.types.${group.type}`) }} ·
          {{ group.items.length }}
        </UiText>
        <div
          v-for="item in group.items"
          :key="item.from"
          class="flex min-w-0 items-start gap-1 border-b py-1"
        >
          <div
            class="flex min-w-0 flex-1 items-start gap-2 px-1 py-2 text-left"
          >
            <span class="flex h-4 shrink-0 items-center"><component
              :is="icons[item.type]"
              class="size-3.5"
            /></span>
            <UiText
              as="p"
              variant="xs"
              class="line-clamp-3 min-w-0 flex-1 break-words whitespace-pre-wrap"
              :muted="!item.text"
            >
              {{
                item.text || i18n.t("notes.inspector.annotations.emptyCallout")
              }}
            </UiText>
          </div>
          <div class="mt-2 flex h-4 shrink-0 items-center">
            <UiActionButton
              :disabled="disabled"
              :tooltip="i18n.t('notes.inspector.annotations.reveal')"
              @click="emit('reveal', item)"
            >
              <LocateFixed class="size-3.5" />
            </UiActionButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
