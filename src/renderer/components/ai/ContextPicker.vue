<script setup lang="ts">
import type { AiResult, AiVaultItem } from '~/shared/ai'
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { useAi } from '@/composables/ai/useAi'
import { i18n, ipc } from '@/electron'
import { watchDebounced } from '@vueuse/core'
import { Plus, X } from 'lucide-vue-next'

const {
  context,
  contextMode,
  attachments,
  attachEditor,
  attachedEditor,
  removeEditorContext,
  removeAttachment,
  addAttachment,
} = useAi()
const open = ref(false)
const query = ref('')
const results = ref<AiVaultItem[]>([])
const loading = ref(false)
const failed = ref(false)
let revision = 0
async function search() {
  const current = ++revision
  loading.value = true
  failed.value = false
  try {
    const result = (await ipc.invoke('system:ai:context-search', {
      query: query.value,
      type: 'all',
    })) as AiResult<AiVaultItem[]>
    if (current !== revision)
      return
    results.value = result.ok ? result.data : []
    failed.value = !result.ok
  }
  catch {
    if (current === revision) {
      results.value = []
      failed.value = true
    }
  }
  finally {
    if (current === revision)
      loading.value = false
  }
}
watch(open, (value) => {
  if (value)
    void search()
})
watchDebounced(
  query,
  () => {
    if (open.value)
      void search()
  },
  { debounce: 200 },
)
function add(item: AiVaultItem) {
  addAttachment(item)
  open.value = false
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1">
    <Popover.Popover v-model:open="open">
      <Popover.PopoverTrigger as-child>
        <UiActionButton :tooltip="i18n.t('ai.addContext')">
          <Plus class="size-4" />
        </UiActionButton>
      </Popover.PopoverTrigger>
      <Popover.PopoverContent
        class="w-80 space-y-2 p-2"
        align="start"
        side="top"
      >
        <UiInput
          v-model="query"
          :placeholder="i18n.t('ai.searchContext')"
          :aria-label="i18n.t('ai.searchContext')"
        />
        <div
          v-if="context"
          class="flex flex-wrap gap-1"
        >
          <Button
            variant="outline"
            size="sm"
            @click="
              attachEditor('fragment');
              open = false;
            "
          >
            {{ i18n.t("ai.attachCurrent") }}
          </Button>
          <Button
            v-if="context.selection"
            variant="outline"
            size="sm"
            @click="
              attachEditor('selection');
              open = false;
            "
          >
            {{ i18n.t("ai.selection") }}
          </Button>
        </div>
        <UiText
          v-if="loading"
          variant="caption"
          muted
        >
          {{ i18n.t("ai.searching") }}
        </UiText>
        <UiText
          v-else-if="failed"
          variant="caption"
        >
          {{ i18n.t("ai.errors.connection") }}
        </UiText>
        <UiText
          v-else-if="!results.length"
          variant="caption"
          muted
        >
          {{ i18n.t("ai.noResults") }}
        </UiText>
        <div class="scrollbar max-h-64 space-y-1 overflow-auto">
          <Button
            v-for="item in results"
            :key="`${item.type}:${item.id}`"
            variant="ghost"
            size="sm"
            class="w-full justify-start overflow-hidden"
            :disabled="attachments.length >= 8"
            @click="add(item)"
          >
            <UiText
              variant="xs"
              muted
            >
              {{ i18n.t(`ai.itemTypes.${item.type}`) }}
            </UiText><UiText
              variant="sm"
              class="truncate"
            >
              {{ item.name }}
            </UiText>
          </Button>
        </div>
        <UiText
          variant="xs"
          muted
        >
          {{ i18n.t("ai.savedContext") }}
        </UiText>
      </Popover.PopoverContent>
    </Popover.Popover>
    <div
      v-if="contextMode !== 'none'"
      class="bg-muted flex max-w-full items-center gap-1 rounded-md px-2 py-1"
    >
      <UiText
        variant="xs"
        class="truncate"
      >
        {{ attachedEditor?.name || i18n.t("ai.fragment")
        }}{{
          contextMode === "selection" ? ` · ${i18n.t("ai.selection")}` : ""
        }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('ai.removeContext')"
        @click="removeEditorContext"
      >
        <X class="size-3" />
      </UiActionButton>
    </div>
    <div
      v-for="(item, index) in attachments"
      :key="`${item.type}:${item.id}`"
      class="bg-muted flex max-w-full items-center gap-1 rounded-md px-2 py-1"
    >
      <UiText
        variant="xs"
        class="truncate"
      >
        {{ item.name }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('ai.removeContext')"
        @click="removeAttachment(index)"
      >
        <X class="size-3" />
      </UiActionButton>
    </div>
  </div>
</template>
