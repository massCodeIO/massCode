<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Check } from 'lucide-vue-next'
import { cardTitleClass, copy, demoStackClass, surfaceClass } from './copy'

const rootInput = ref('massCode')
const rootErrorInput = ref('invalid-value')
const rootTextareaInput = ref('First line\nSecond line')
const rootContentEditable = ref('Editable note')
</script>

<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold">
        {{ copy.sections.rootUi }}
      </h2>
      <p class="text-muted-foreground text-sm">
        {{ copy.sections.rootUiDescription }}
      </p>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <div :class="surfaceClass">
        <h3 :class="cardTitleClass">
          {{ copy.cards.buttons }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline">
            {{ copy.states.default }}
          </Button>
          <Button>
            {{ copy.states.primary }}
          </Button>
          <Button variant="destructive">
            {{ copy.states.danger }}
          </Button>
          <Button variant="outline">
            {{ copy.states.active }}
          </Button>
          <Button variant="ghost">
            <Check />
          </Button>
          <Button variant="ghost">
            <Check />
            {{ copy.states.iconText }}
          </Button>
          <Button
            variant="outline"
            disabled
          >
            {{ copy.states.disabled }}
          </Button>
        </div>
      </div>

      <div :class="surfaceClass">
        <h3 :class="cardTitleClass">
          {{ copy.cards.inputs }}
        </h3>
        <div :class="demoStackClass">
          <UiInput
            v-model="rootInput"
            :placeholder="copy.text.inputPlaceholder"
            :description="copy.text.description"
          />
          <UiInput
            v-model="rootInput"
            clearable
            :placeholder="copy.text.inputPlaceholder"
          />
          <UiInput
            v-model="rootErrorInput"
            :placeholder="copy.text.inputPlaceholder"
            :error="copy.text.error"
          />
          <UiInput
            v-model="rootInput"
            variant="ghost"
            :placeholder="copy.states.ghost"
          />
          <UiInput
            v-model="rootTextareaInput"
            type="textarea"
            :placeholder="copy.text.textareaPlaceholder"
          />
        </div>
      </div>

      <!-- Text: full-width section -->
      <div class="col-span-full space-y-4">
        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.text }}
          </h3>
          <p class="text-muted-foreground -mt-2 mb-4 text-xs">
            {{ copy.cards.textDescription }}
          </p>

          <!-- UI Patterns grid -->
          <UiText
            variant="caption"
            uppercase
            muted
            weight="bold"
            class="mb-3 block"
          >
            {{ copy.cards.textPatterns }}
          </UiText>

          <div class="grid gap-3 xl:grid-cols-2">
            <!-- a) Sidebar -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Sidebar
              </UiText>
              <div class="space-y-2">
                <UiText
                  variant="sm"
                  weight="bold"
                >
                  {{ copy.text.sidebarTitle }}
                </UiText>
                <div>
                  <UiText
                    variant="caption"
                    uppercase
                    weight="bold"
                    muted
                    class="mb-1 block tracking-wider"
                  >
                    {{ copy.text.sidebarSection }}
                  </UiText>
                  <div class="space-y-0.5 pl-2">
                    <UiText
                      variant="sm"
                      class="block"
                    >
                      {{ copy.text.sidebarFolder1 }}
                    </UiText>
                    <UiText
                      variant="sm"
                      class="block"
                    >
                      {{ copy.text.sidebarFolder2 }}
                    </UiText>
                    <UiText
                      variant="sm"
                      class="block"
                    >
                      {{ copy.text.sidebarFolder3 }}
                    </UiText>
                  </div>
                </div>
              </div>
            </div>

            <!-- b) Snippet List Item -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Snippet List Item
              </UiText>
              <div class="border-border/40 rounded-md border p-2.5">
                <UiText
                  variant="sm"
                  weight="medium"
                  class="block"
                >
                  {{ copy.text.snippetTitle }}
                </UiText>
                <div class="mt-1 flex gap-2">
                  <UiText
                    variant="xs"
                    muted
                  >
                    {{ copy.text.snippetFolder }}
                  </UiText>
                  <UiText
                    variant="xs"
                    muted
                  >
                    &middot;
                  </UiText>
                  <UiText
                    variant="xs"
                    muted
                  >
                    {{ copy.text.snippetDate }}
                  </UiText>
                </div>
              </div>
            </div>

            <!-- c) Section Headers -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Section Headers
              </UiText>
              <UiText
                variant="xs"
                weight="semibold"
                uppercase
                class="block tracking-[0.14em]"
              >
                {{ copy.text.sectionHeader }}
              </UiText>
              <div class="bg-border/60 mt-2 h-px" />
            </div>

            <!-- d) Status Bar -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Status Bar
              </UiText>
              <div
                class="bg-muted/50 flex items-center gap-4 rounded px-3 py-1.5"
              >
                <UiText variant="xs">
                  {{ copy.text.statusLang }}
                </UiText>
                <UiText
                  variant="xs"
                  muted
                >
                  {{ copy.text.statusPosition }}
                </UiText>
                <UiText
                  variant="xs"
                  muted
                >
                  {{ copy.text.statusEncoding }}
                </UiText>
              </div>
            </div>

            <!-- e) Empty State -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Empty State
              </UiText>
              <div class="flex flex-col items-center py-4">
                <UiText
                  variant="sm"
                  muted
                >
                  {{ copy.text.emptyState }}
                </UiText>
                <UiText
                  variant="xs"
                  muted
                  class="mt-1"
                >
                  {{ copy.text.emptyStateHint }}
                </UiText>
              </div>
            </div>

            <!-- f) Settings Row -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Settings Row
              </UiText>
              <div class="flex items-center justify-between">
                <div>
                  <UiText
                    variant="sm"
                    weight="medium"
                    class="block"
                  >
                    {{ copy.text.settingLabel }}
                  </UiText>
                  <UiText
                    variant="xs"
                    muted
                    class="mt-0.5 block"
                  >
                    {{ copy.text.settingDescription }}
                  </UiText>
                </div>
                <UiSwitch />
              </div>
            </div>

            <!-- g) Code Metadata -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                Code Metadata
              </UiText>
              <div class="flex gap-4">
                <UiText
                  variant="sm"
                  mono
                  muted
                >
                  {{ copy.text.codeLang }}
                </UiText>
                <UiText
                  variant="sm"
                  mono
                  muted
                >
                  {{ copy.text.codeSize }}
                </UiText>
                <UiText
                  variant="sm"
                  mono
                  muted
                >
                  {{ copy.text.codeLines }}
                </UiText>
              </div>
            </div>

            <!-- h) API Method Badges -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                mono
                muted
                class="mb-2 block"
              >
                API Method Badges
              </UiText>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex w-16 items-center justify-center rounded bg-emerald-500/15 px-2 py-0.5"
                  >
                    <UiText
                      variant="caption"
                      weight="semibold"
                      class="text-emerald-500"
                    >
                      {{ copy.text.methodGet }}
                    </UiText>
                  </span>
                  <UiText
                    variant="xs"
                    mono
                    muted
                  >
                    {{ copy.text.methodGetPath }}
                  </UiText>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex w-16 items-center justify-center rounded bg-sky-500/15 px-2 py-0.5"
                  >
                    <UiText
                      variant="caption"
                      weight="semibold"
                      class="text-sky-500"
                    >
                      {{ copy.text.methodPost }}
                    </UiText>
                  </span>
                  <UiText
                    variant="xs"
                    mono
                    muted
                  >
                    {{ copy.text.methodPostPath }}
                  </UiText>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex w-16 items-center justify-center rounded bg-red-500/15 px-2 py-0.5"
                  >
                    <UiText
                      variant="caption"
                      weight="semibold"
                      class="text-red-500"
                    >
                      {{ copy.text.methodDelete }}
                    </UiText>
                  </span>
                  <UiText
                    variant="xs"
                    mono
                    muted
                  >
                    {{ copy.text.methodDeletePath }}
                  </UiText>
                </div>
              </div>
            </div>
          </div>

          <!-- Reference: Scale, Weight, Modifiers -->
          <UiText
            variant="caption"
            uppercase
            muted
            weight="bold"
            class="mt-6 mb-3 block"
          >
            {{ copy.cards.textReference }}
          </UiText>

          <div class="grid gap-3 xl:grid-cols-3">
            <!-- Size scale -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                muted
                class="mb-2 block"
              >
                Size scale
              </UiText>
              <div class="space-y-1.5">
                <div
                  v-for="v in [
                    'caption',
                    'xs',
                    'sm',
                    'base',
                    'lg',
                    'xl',
                  ] as const"
                  :key="v"
                  class="flex items-baseline gap-3"
                >
                  <UiText
                    variant="caption"
                    mono
                    muted
                    class="w-14 shrink-0 text-right"
                  >
                    {{ v }}
                  </UiText>
                  <UiText :variant="v">
                    The quick brown fox
                  </UiText>
                </div>
              </div>
            </div>

            <!-- Weight scale -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                muted
                class="mb-2 block"
              >
                Weight scale
              </UiText>
              <div class="space-y-1.5">
                <div
                  v-for="w in ['normal', 'medium', 'semibold', 'bold'] as const"
                  :key="w"
                  class="flex items-baseline gap-3"
                >
                  <UiText
                    variant="caption"
                    mono
                    muted
                    class="w-14 shrink-0 text-right"
                  >
                    {{ w }}
                  </UiText>
                  <UiText :weight="w">
                    The quick brown fox
                  </UiText>
                </div>
              </div>
            </div>

            <!-- Modifiers -->
            <div class="border-border/60 bg-background rounded-md border p-3">
              <UiText
                variant="caption"
                muted
                class="mb-2 block"
              >
                Modifiers
              </UiText>
              <div class="space-y-2">
                <div>
                  <UiText
                    variant="caption"
                    mono
                    muted
                  >
                    muted
                  </UiText>
                  <UiText
                    muted
                    class="ml-2"
                  >
                    Secondary info
                  </UiText>
                </div>
                <div>
                  <UiText
                    variant="caption"
                    mono
                    muted
                  >
                    mono
                  </UiText>
                  <UiText
                    mono
                    class="ml-2"
                  >
                    fn(x) => 42
                  </UiText>
                </div>
                <div>
                  <UiText
                    variant="caption"
                    mono
                    muted
                  >
                    uppercase
                  </UiText>
                  <UiText
                    variant="caption"
                    uppercase
                    class="ml-2"
                  >
                    section label
                  </UiText>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div :class="surfaceClass">
        <h3 :class="cardTitleClass">
          {{ copy.cards.contentEditable }}
        </h3>
        <UiTextarea
          v-model="rootContentEditable"
          :placeholder="copy.text.contentEditablePlaceholder"
        />
      </div>
    </div>
  </section>
</template>
