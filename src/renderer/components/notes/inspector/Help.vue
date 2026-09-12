<script setup lang="ts">
import { i18n } from '@/electron'
import { isMac } from '@/utils'
import { calloutTitleByType } from '../cm-extensions/callouts'

defineProps<{ tab: 'outline' | 'links' | 'annotations', canCreate: boolean }>()
const types = Object.keys(calloutTitleByType)
</script>

<template>
  <div class="flex shrink-0 items-center justify-end border-t px-2 py-1">
    <UiHelpButton
      v-if="tab === 'outline'"
      :label="i18n.t('notes.inspector.outline.help.title')"
    >
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.outline.help.navigation") }}
      </UiText>
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.outline.hint") }}
      </UiText>
    </UiHelpButton>
    <UiHelpButton
      v-else-if="tab === 'annotations'"
      :label="i18n.t('notes.inspector.annotations.help.title')"
    >
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.annotations.help.intro") }}
      </UiText>
      <div
        v-for="type in types"
        :key="type"
        class="space-y-1"
      >
        <code class="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{{
          `> [!${type}]`
        }}</code>
        <UiText
          as="p"
          variant="xs"
          muted
        >
          {{ i18n.t(`notes.inspector.annotations.help.types.${type}`) }}
        </UiText>
      </div>
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("notes.inspector.annotations.help.usage") }}
      </UiText>
      <NotesInspectorHelpAction
        translation-key="notes.inspector.annotations.help.navigate"
        action="locate"
      />
    </UiHelpButton>
    <UiHelpButton
      v-else
      :label="i18n.t('notes.inspector.linkHelp.title')"
    >
      <NotesInspectorHelpAction
        translation-key="notes.inspector.linkHelp.navigate"
        action="locate"
      />
      <NotesInspectorHelpAction
        v-if="canCreate"
        translation-key="notes.inspector.linkHelp.create"
        action="locate"
        :shortcut="isMac ? 'Cmd' : 'Ctrl'"
      />
      <NotesInspectorHelpAction
        translation-key="notes.inspector.linkHelp.external"
        action="external"
      />
    </UiHelpButton>
  </div>
</template>
