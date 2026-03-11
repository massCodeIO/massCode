<script setup lang="ts">
import { Button as NewButton } from '@/components/ui/shadcn2/button'
import { Checkbox as NewCheckbox } from '@/components/ui/shadcn2/checkbox'
import * as NewCommand from '@/components/ui/shadcn2/command'
import * as NewContextMenu from '@/components/ui/shadcn2/context-menu'
import * as NewDialog from '@/components/ui/shadcn2/dialog'
import { Input as NewInput } from '@/components/ui/shadcn2/input'
import * as NewPopover from '@/components/ui/shadcn2/popover'
import * as NewResizable from '@/components/ui/shadcn2/resizable'
import * as NewSelect from '@/components/ui/shadcn2/select'
import { Switch as NewSwitch } from '@/components/ui/shadcn2/switch'
import * as NewTabs from '@/components/ui/shadcn2/tabs'
import { Textarea as NewTextarea } from '@/components/ui/shadcn2/textarea'
import * as NewTooltip from '@/components/ui/shadcn2/tooltip'
import {
  Check,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from 'lucide-vue-next'
import {
  cardTitleClass,
  copy,
  demoStackClass,
  options,
  surfaceClass,
} from './copy'

const newSelectValue = ref('alpha')
const newTabsValue = ref('preview')
const newCheckboxValue = ref(true)
const newSwitchValue = ref(true)
const newPopoverOpen = ref(false)
const newDialogOpen = ref(false)

interface ResizablePanelApi {
  resize: (size: number) => void
}

const defaultSizes = { a: 30, b: 50, c: 50 }
const panelInputs = ref({
  a: String(defaultSizes.a),
  b: String(defaultSizes.b),
  c: String(defaultSizes.c),
})
const panelARef = ref<ResizablePanelApi | null>(null)
const panelBRef = ref<ResizablePanelApi | null>(null)
const panelCRef = ref<ResizablePanelApi | null>(null)

function onResizeA(size: number) {
  panelInputs.value.a = String(Math.round(size))
}
function onResizeB(size: number) {
  panelInputs.value.b = String(Math.round(size))
}
function onResizeC(size: number) {
  panelInputs.value.c = String(Math.round(size))
}

function applyPanelSize(panel: 'a' | 'b' | 'c') {
  const size = Number(panelInputs.value[panel])
  if (Number.isNaN(size) || size < 0 || size > 100)
    return
  const refs = { a: panelARef, b: panelBRef, c: panelCRef }
  refs[panel].value?.resize(size)
}

function resetPanels() {
  panelARef.value?.resize(defaultSizes.a)
  panelBRef.value?.resize(defaultSizes.b)
  panelCRef.value?.resize(defaultSizes.c)
  panelInputs.value = {
    a: String(defaultSizes.a),
    b: String(defaultSizes.b),
    c: String(defaultSizes.c),
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold">
        {{ copy.sections.newShadcn2 }}
      </h2>
      <p class="text-muted-foreground text-sm">
        {{ copy.sections.newShadcn2Description }}
      </p>
    </div>

    <NewTooltip.TooltipProvider>
      <div class="grid gap-4 xl:grid-cols-2">
        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.buttons }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <NewButton>{{ copy.states.default }}</NewButton>
            <NewButton variant="secondary">
              {{ copy.states.secondary }}
            </NewButton>
            <NewButton variant="outline">
              {{ copy.states.outline }}
            </NewButton>
            <NewButton variant="destructive">
              {{ copy.states.danger }}
            </NewButton>
            <NewButton variant="ghost">
              {{ copy.states.ghostButton }}
            </NewButton>
            <NewButton>
              <Check />
              {{ copy.states.iconText }}
            </NewButton>
            <NewButton disabled>
              {{ copy.states.disabled }}
            </NewButton>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.inputs }}
          </h3>
          <div :class="demoStackClass">
            <NewInput :placeholder="copy.text.inputPlaceholder" />
            <NewInput
              aria-invalid="true"
              :placeholder="copy.text.inputPlaceholder"
            />
            <NewInput
              variant="ghost"
              :placeholder="copy.states.ghost"
            />
            <NewTextarea :placeholder="copy.text.textareaPlaceholder" />
            <NewTextarea
              variant="ghost"
              :placeholder="copy.states.ghost"
            />
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.selection }}
          </h3>
          <div :class="demoStackClass">
            <NewSelect.Select v-model="newSelectValue">
              <NewSelect.SelectTrigger class="w-56">
                <NewSelect.SelectValue
                  :placeholder="copy.text.selectPlaceholder"
                />
              </NewSelect.SelectTrigger>
              <NewSelect.SelectContent>
                <NewSelect.SelectItem
                  v-for="option in options"
                  :key="`new-select-${option}`"
                  :value="option"
                >
                  {{ copy.text.option[option] }}
                </NewSelect.SelectItem>
              </NewSelect.SelectContent>
            </NewSelect.Select>

            <NewTabs.Tabs
              v-model="newTabsValue"
              class="w-full"
            >
              <NewTabs.TabsList>
                <NewTabs.TabsTrigger value="preview">
                  {{ copy.text.tabPreview }}
                </NewTabs.TabsTrigger>
                <NewTabs.TabsTrigger value="code">
                  {{ copy.text.tabCode }}
                </NewTabs.TabsTrigger>
              </NewTabs.TabsList>
              <NewTabs.TabsContent
                value="preview"
                class="pt-3 text-sm"
              >
                {{ copy.text.previewBody }}
              </NewTabs.TabsContent>
              <NewTabs.TabsContent
                value="code"
                class="pt-3 text-sm"
              >
                {{ copy.text.codeBody }}
              </NewTabs.TabsContent>
            </NewTabs.Tabs>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.toggles }}
          </h3>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <NewCheckbox v-model:checked="newCheckboxValue" />
              {{ copy.cards.checkbox }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <NewSwitch v-model:checked="newSwitchValue" />
              {{ copy.cards.switch }}
            </label>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.overlays }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <NewTooltip.Tooltip>
              <NewTooltip.TooltipTrigger as-child>
                <NewButton>
                  {{ copy.text.tooltipTrigger }}
                </NewButton>
              </NewTooltip.TooltipTrigger>
              <NewTooltip.TooltipContent>
                {{ copy.text.tooltip }}
              </NewTooltip.TooltipContent>
            </NewTooltip.Tooltip>

            <NewPopover.Popover v-model:open="newPopoverOpen">
              <NewPopover.PopoverTrigger as-child>
                <NewButton>
                  {{ copy.text.openPopover }}
                </NewButton>
              </NewPopover.PopoverTrigger>
              <NewPopover.PopoverContent>
                <p class="px-2 py-1 text-sm">
                  {{ copy.text.popoverBody }}
                </p>
              </NewPopover.PopoverContent>
            </NewPopover.Popover>

            <NewDialog.Dialog v-model:open="newDialogOpen">
              <NewDialog.DialogTrigger as-child>
                <NewButton>
                  {{ copy.text.openDialog }}
                </NewButton>
              </NewDialog.DialogTrigger>
              <NewDialog.DialogContent>
                <NewDialog.DialogHeader>
                  <NewDialog.DialogTitle>
                    {{ copy.text.dialogTitle }}
                  </NewDialog.DialogTitle>
                  <NewDialog.DialogDescription>
                    {{ copy.text.dialogDescription }}
                  </NewDialog.DialogDescription>
                </NewDialog.DialogHeader>
              </NewDialog.DialogContent>
            </NewDialog.Dialog>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.command }}
          </h3>
          <NewCommand.Command class="h-[220px]">
            <NewCommand.CommandInput
              :placeholder="copy.text.commandPlaceholder"
            />
            <NewCommand.CommandList>
              <NewCommand.CommandEmpty>
                {{ copy.text.commandEmpty }}
              </NewCommand.CommandEmpty>
              <NewCommand.CommandGroup :heading="copy.text.commandGroup">
                <NewCommand.CommandItem value="rename">
                  {{ copy.text.rename }}
                  <NewCommand.CommandShortcut>R</NewCommand.CommandShortcut>
                </NewCommand.CommandItem>
                <NewCommand.CommandItem value="duplicate">
                  {{ copy.text.duplicate }}
                  <NewCommand.CommandShortcut>D</NewCommand.CommandShortcut>
                </NewCommand.CommandItem>
                <NewCommand.CommandSeparator />
                <NewCommand.CommandItem value="delete">
                  {{ copy.text.delete }}
                  <NewCommand.CommandShortcut>⌫</NewCommand.CommandShortcut>
                </NewCommand.CommandItem>
              </NewCommand.CommandGroup>
            </NewCommand.CommandList>
          </NewCommand.Command>
        </div>

        <div
          :class="surfaceClass"
          class="mb-13"
        >
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold">
              {{ copy.cards.resizable }}
            </h3>
            <NewButton
              variant="ghost"
              @click="resetPanels"
            >
              <RotateCcw />
              Reset
            </NewButton>
          </div>
          <div
            class="border-border h-[150px] overflow-hidden rounded-md border"
          >
            <NewResizable.ResizablePanelGroup
              direction="horizontal"
              class="h-full"
            >
              <NewResizable.ResizablePanel
                ref="panelARef"
                :default-size="defaultSizes.a"
                @resize="onResizeA"
              >
                <div
                  class="flex h-full flex-col items-center justify-center gap-1 text-sm"
                >
                  <span>A</span>
                  <span class="text-muted-foreground text-xs">{{ panelInputs.a }}%</span>
                </div>
              </NewResizable.ResizablePanel>
              <NewResizable.ResizableHandle with-handle />
              <NewResizable.ResizablePanel :default-size="100 - defaultSizes.a">
                <NewResizable.ResizablePanelGroup
                  direction="vertical"
                  class="h-full"
                >
                  <NewResizable.ResizablePanel
                    ref="panelBRef"
                    :default-size="defaultSizes.b"
                    @resize="onResizeB"
                  >
                    <div
                      class="flex h-full flex-col items-center justify-center gap-1 text-sm"
                    >
                      <span>B</span>
                      <span class="text-muted-foreground text-xs">{{ panelInputs.b }}%</span>
                    </div>
                  </NewResizable.ResizablePanel>
                  <NewResizable.ResizableHandle with-handle />
                  <NewResizable.ResizablePanel
                    ref="panelCRef"
                    :default-size="defaultSizes.c"
                    @resize="onResizeC"
                  >
                    <div
                      class="flex h-full flex-col items-center justify-center gap-1 text-sm"
                    >
                      <span>C</span>
                      <span class="text-muted-foreground text-xs">{{ panelInputs.c }}%</span>
                    </div>
                  </NewResizable.ResizablePanel>
                </NewResizable.ResizablePanelGroup>
              </NewResizable.ResizablePanel>
            </NewResizable.ResizablePanelGroup>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <template
              v-for="panel in ['a', 'b', 'c'] as const"
              :key="panel"
            >
              <label class="flex items-center gap-1.5 text-xs">
                <span class="text-muted-foreground uppercase">{{ panel }}</span>
                <NewInput
                  v-model="panelInputs[panel]"
                  class="w-16 text-center"
                  @keydown.enter="applyPanelSize(panel)"
                />
                <span class="text-muted-foreground">%</span>
              </label>
            </template>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.contextMenu }}
          </h3>
          <p class="text-muted-foreground mb-3 text-sm">
            {{ copy.text.rightClick }}
          </p>
          <NewContextMenu.ContextMenu>
            <NewContextMenu.ContextMenuTrigger as-child>
              <div
                class="bg-muted/40 border-border flex h-20 w-full cursor-default items-center justify-center rounded-md border border-dashed text-sm"
              >
                <div class="flex items-center gap-2">
                  <MoreHorizontal class="h-4 w-4" />
                  {{ copy.text.menuTrigger }}
                </div>
              </div>
            </NewContextMenu.ContextMenuTrigger>
            <NewContextMenu.ContextMenuContent>
              <NewContextMenu.ContextMenuItem>
                <Copy />
                {{ copy.text.duplicate }}
              </NewContextMenu.ContextMenuItem>
              <NewContextMenu.ContextMenuItem>
                {{ copy.text.rename }}
              </NewContextMenu.ContextMenuItem>
              <NewContextMenu.ContextMenuSeparator />
              <NewContextMenu.ContextMenuItem variant="destructive">
                <Trash2 />
                {{ copy.text.delete }}
              </NewContextMenu.ContextMenuItem>
            </NewContextMenu.ContextMenuContent>
          </NewContextMenu.ContextMenu>
        </div>
      </div>
    </NewTooltip.TooltipProvider>
  </section>
</template>
