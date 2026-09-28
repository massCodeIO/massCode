<script setup lang="ts">
import type { NoteAnnotation } from './annotations'
import type { LinkRow } from './links'
import type { OutlineHeading, OutlineMove } from './outline'
import type { InternalLinkMatch } from '~/shared/notes/internalLinks'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useNotesApp } from '@/composables/spaces/notes/useNotesApp'
import { i18n } from '@/electron'
import { X } from 'lucide-vue-next'

defineProps<{
  embedded?: boolean
  noteId: number
  content: string
  cursor: number
  disabled: boolean
  canCreate: boolean
}>()
const emit = defineEmits<{
  annotation: [annotation: NoteAnnotation]
  close: []
  reveal: [match: LinkRow['occurrences'][number]]
  activate: [match: InternalLinkMatch]
  heading: [heading: OutlineHeading]
  move: [move: OutlineMove]
}>()
const { notesInspectorTab: tab } = useNotesApp()
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col"
    :class="!embedded && 'pt-[var(--content-top-offset)]'"
  >
    <div
      v-if="!embedded"
      class="flex h-[calc(41px-var(--content-top-offset))] shrink-0 items-center justify-between gap-2 border-b px-3 pb-1"
    >
      <UiText
        variant="sm"
        weight="medium"
      >
        {{ i18n.t("notes.inspector.title") }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('action.close')"
        @click="emit('close')"
      >
        <X class="size-4" />
      </UiActionButton>
    </div>
    <Tabs.Tabs
      v-model="tab"
      class="flex min-h-0 flex-1 flex-col gap-0"
    >
      <Tabs.TabsList class="mx-3 mt-2 shrink-0">
        <Tabs.TabsTrigger value="outline">
          {{ i18n.t("notes.inspector.outline.title") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="links">
          {{ i18n.t("notes.inspector.links") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="annotations">
          {{ i18n.t("notes.inspector.annotations.title") }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>
      <Tabs.TabsContent
        value="outline"
        class="min-h-0 overflow-hidden"
      >
        <NotesInspectorOutline
          :note-id="noteId"
          :content="content"
          :cursor="cursor"
          :disabled="disabled"
          :can-edit="canCreate"
          @reveal="emit('heading', $event)"
          @move="emit('move', $event)"
        />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        value="links"
        force-mount
        class="min-h-0 overflow-hidden data-[state=inactive]:hidden"
      >
        <NotesInspectorLinks
          :note-id="noteId"
          :content="content"
          :disabled="disabled"
          :can-create="canCreate"
          @reveal="emit('reveal', $event)"
          @activate="emit('activate', $event)"
        />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        value="annotations"
        class="min-h-0 overflow-hidden"
        force-mount
        :hidden="tab !== 'annotations'"
      >
        <NotesInspectorAnnotations
          :note-id="noteId"
          :content="content"
          :disabled="disabled"
          @reveal="emit('annotation', $event)"
        />
      </Tabs.TabsContent>
    </Tabs.Tabs>
    <NotesInspectorHelp
      :key="tab"
      :tab="tab"
      :can-create="canCreate"
    />
  </div>
</template>
