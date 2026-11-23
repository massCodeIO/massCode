<script setup lang="ts">
import type { CommunityThemeItem } from '~/main/store/types/theme'
import { Badge } from '@/components/ui/shadcn/badge'
import { Button } from '@/components/ui/shadcn/button'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { i18n, ipc } from '@/electron'
import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Paintbrush,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'

interface Props {
  item: CommunityThemeItem
  isActive: boolean
  busy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [item: CommunityThemeItem]
  update: [item: CommunityThemeItem]
  apply: [id: string]
  uninstall: [item: CommunityThemeItem]
}>()

const fallbackPalette = computed(() => {
  if (props.item.type === 'light') {
    return {
      background: '#ffffff',
      card: '#f5f5f5',
      foreground: '#1f2328',
      primary: '#2563eb',
      accent: '#e5e7eb',
      border: '#d4d4d8',
      keyword: '#7c3aed',
      string: '#16a34a',
      comment: '#9ca3af',
    }
  }

  return {
    background: '#18181b',
    card: '#1f1f23',
    foreground: '#e4e4e7',
    primary: '#60a5fa',
    accent: '#27272a',
    border: '#3f3f46',
    keyword: '#c084fc',
    string: '#4ade80',
    comment: '#71717a',
  }
})

const palette = computed(() => {
  const fb = fallbackPalette.value
  const p = props.item.preview

  return {
    background: p?.background ?? fb.background,
    card: p?.card ?? fb.card,
    foreground: p?.foreground ?? fb.foreground,
    primary: p?.primary ?? fb.primary,
    accent: p?.accent ?? p?.card ?? fb.accent,
    border: p?.border ?? fb.border,
    keyword: p?.keyword ?? p?.primary ?? fb.keyword,
    string: p?.string ?? p?.foreground ?? fb.string,
    comment: p?.comment ?? p?.border ?? fb.comment,
  }
})

const REGISTRY_BLOB_BASE_URL
  = 'https://github.com/massCodeIO/masscode-themes/blob/main'

const isInstalled = computed(() => props.item.status !== 'available')
const hasUpdate = computed(
  () =>
    props.item.status === 'update-available' && Boolean(props.item.registry),
)
const themeSourceUrl = computed(() => {
  if (props.item.registry?.file) {
    return `${REGISTRY_BLOB_BASE_URL}/${props.item.registry.file}`
  }

  return null
})

async function openAuthorUrl() {
  if (!props.item.authorUrl) {
    return
  }

  await ipc.invoke('system:open-external', props.item.authorUrl)
}

async function openThemeSource() {
  if (!themeSourceUrl.value) {
    return
  }

  await ipc.invoke('system:open-external', themeSourceUrl.value)
}
</script>

<template>
  <div
    class="border-border bg-card flex flex-col overflow-hidden rounded-lg border transition-colors"
    :class="{ 'ring-primary ring-1': isActive }"
  >
    <!-- CSS mini-preview built from theme palette -->
    <div
      class="flex h-24 w-full overflow-hidden border-b"
      :style="{
        backgroundColor: palette.background,
        borderColor: palette.border,
      }"
    >
      <!-- Mini sidebar -->
      <div
        class="flex w-1/3 flex-col gap-1.5 border-r p-2"
        :style="{
          backgroundColor: palette.card,
          borderColor: palette.border,
        }"
      >
        <div
          class="h-2 w-10 rounded-full opacity-90"
          :style="{ backgroundColor: palette.primary }"
        />
        <div
          class="h-2.5 w-full rounded-sm px-1.5 py-0.5"
          :style="{ backgroundColor: palette.accent }"
        >
          <div
            class="h-1.5 w-3/4 rounded-full"
            :style="{ backgroundColor: palette.foreground }"
          />
        </div>
        <div
          class="h-1.5 w-4/5 rounded-full opacity-55"
          :style="{ backgroundColor: palette.foreground }"
        />
        <div
          class="h-1.5 w-2/3 rounded-full opacity-40"
          :style="{ backgroundColor: palette.foreground }"
        />
      </div>

      <!-- Mini editor -->
      <div class="flex flex-1 flex-col justify-center gap-1.5 p-2.5">
        <div class="flex items-center gap-1.5">
          <span
            class="h-1.5 w-6 rounded-full"
            :style="{ backgroundColor: palette.keyword }"
          />
          <span
            class="h-1.5 w-10 rounded-full"
            :style="{ backgroundColor: palette.foreground }"
          />
          <span
            class="h-1.5 w-8 rounded-full"
            :style="{ backgroundColor: palette.string }"
          />
        </div>
        <div class="flex items-center gap-1.5 pl-2.5">
          <span
            class="h-1.5 w-7 rounded-full"
            :style="{ backgroundColor: palette.primary }"
          />
          <span
            class="h-1.5 w-12 rounded-full"
            :style="{ backgroundColor: palette.string }"
          />
        </div>
        <div class="flex items-center gap-1.5 pl-2.5">
          <span
            class="h-1.5 w-14 rounded-full opacity-75"
            :style="{ backgroundColor: palette.comment }"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <span
            class="h-1.5 w-5 rounded-full"
            :style="{ backgroundColor: palette.keyword }"
          />
          <span
            class="h-1.5 w-9 rounded-full"
            :style="{ backgroundColor: palette.foreground }"
          />
        </div>
      </div>
    </div>

    <!-- Card body -->
    <div class="flex flex-1 flex-col justify-between gap-3 p-3">
      <div class="space-y-1">
        <div class="flex items-start justify-between gap-2">
          <UiText
            size="sm"
            class="truncate font-medium"
            :title="item.name"
          >
            {{ item.name }}
          </UiText>
          <Badge
            variant="secondary"
            class="shrink-0 text-[10px]"
          >
            {{
              item.type === "dark"
                ? i18n.t("preferences:appearance.theme.dark")
                : i18n.t("preferences:appearance.theme.light")
            }}
          </Badge>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-if="item.author && item.authorUrl"
            type="button"
            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors hover:underline"
            @click="openAuthorUrl"
          >
            <span class="truncate">
              {{
                i18n.t("preferences:appearance.community.byAuthor", {
                  author: item.author,
                })
              }}
            </span>
          </button>
          <UiText
            v-else-if="item.author"
            size="xs"
            muted
            class="truncate"
          >
            {{
              i18n.t("preferences:appearance.community.byAuthor", {
                author: item.author,
              })
            }}
          </UiText>

          <Badge
            v-if="item.isDelisted"
            variant="outline"
            class="text-muted-foreground text-[10px]"
          >
            {{ i18n.t("preferences:appearance.community.delisted") }}
          </Badge>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center">
          <Button
            v-if="!isInstalled && item.registry"
            size="sm"
            variant="outline"
            class="max-w-full"
            :disabled="busy"
            @click="emit('install', item)"
          >
            <Loader2
              v-if="busy"
              class="mr-1 h-3.5 w-3.5 shrink-0 animate-spin"
            />
            <Download
              v-else
              class="mr-1 h-3.5 w-3.5 shrink-0"
            />
            <span class="truncate">
              {{ i18n.t("preferences:appearance.community.install") }}
            </span>
          </Button>

          <template v-else-if="isInstalled">
            <span
              v-if="isActive"
              class="border-primary/30 bg-primary/15 text-primary inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium"
            >
              <Check class="h-3.5 w-3.5 shrink-0" />
              <span class="truncate">
                {{ i18n.t("preferences:appearance.community.active") }}
              </span>
            </span>
            <Button
              v-else
              size="sm"
              variant="outline"
              class="max-w-full"
              :disabled="busy"
              @click="emit('apply', item.id)"
            >
              <Paintbrush class="mr-1 h-3.5 w-3.5 shrink-0" />
              <span class="truncate">
                {{ i18n.t("preferences:appearance.community.apply") }}
              </span>
            </Button>
          </template>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Tooltip.TooltipProvider v-if="hasUpdate">
            <Tooltip.Tooltip>
              <Tooltip.TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="text-primary hover:bg-primary/15 hover:text-primary h-7 w-7"
                  :disabled="busy"
                  :aria-label="
                    i18n.t('preferences:appearance.community.update')
                  "
                  @click="emit('update', item)"
                >
                  <RefreshCw
                    class="h-3.5 w-3.5"
                    :class="{ 'animate-spin': busy }"
                  />
                </Button>
              </Tooltip.TooltipTrigger>
              <Tooltip.TooltipContent>
                {{ i18n.t("preferences:appearance.community.update") }}
              </Tooltip.TooltipContent>
            </Tooltip.Tooltip>
          </Tooltip.TooltipProvider>

          <Tooltip.TooltipProvider v-if="themeSourceUrl">
            <Tooltip.Tooltip>
              <Tooltip.TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="text-muted-foreground hover:text-foreground h-7 w-7"
                  :aria-label="
                    i18n.t('preferences:appearance.community.viewOnGithub')
                  "
                  @click="openThemeSource"
                >
                  <ExternalLink class="h-3.5 w-3.5" />
                </Button>
              </Tooltip.TooltipTrigger>
              <Tooltip.TooltipContent>
                {{ i18n.t("preferences:appearance.community.viewOnGithub") }}
              </Tooltip.TooltipContent>
            </Tooltip.Tooltip>
          </Tooltip.TooltipProvider>

          <Tooltip.TooltipProvider v-if="isInstalled">
            <Tooltip.Tooltip>
              <Tooltip.TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive h-7 w-7"
                  :disabled="busy"
                  :aria-label="
                    i18n.t('preferences:appearance.community.uninstall')
                  "
                  @click="emit('uninstall', item)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </Tooltip.TooltipTrigger>
              <Tooltip.TooltipContent>
                {{ i18n.t("preferences:appearance.community.uninstall") }}
              </Tooltip.TooltipContent>
            </Tooltip.Tooltip>
          </Tooltip.TooltipProvider>
        </div>
      </div>
    </div>
  </div>
</template>
