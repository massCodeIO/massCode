<script setup lang="ts">
import { Checkbox as OldCheckbox } from '@/components/ui/shadcn/checkbox'
import * as OldCommand from '@/components/ui/shadcn/command'
import * as OldContextMenu from '@/components/ui/shadcn/context-menu'
import * as OldDialog from '@/components/ui/shadcn/dialog'
import * as OldPopover from '@/components/ui/shadcn/popover'
import * as OldSelect from '@/components/ui/shadcn/select'
import { Switch as OldSwitch } from '@/components/ui/shadcn/switch'
import * as OldTabs from '@/components/ui/shadcn/tabs'
import * as OldTooltip from '@/components/ui/shadcn/tooltip'
import { Copy, MoreHorizontal, Trash2 } from 'lucide-vue-next'
import {
  cardTitleClass,
  copy,
  demoStackClass,
  options,
  surfaceClass,
} from './copy'

const oldSelectValue = ref('alpha')
const oldTabsValue = ref('preview')
const oldCheckboxValue = ref(true)
const oldSwitchValue = ref(true)
const oldPopoverOpen = ref(false)
const oldDialogOpen = ref(false)
</script>

<template>
  <section class="space-y-4">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold">
        {{ copy.sections.legacyShadcn }}
      </h2>
      <p class="text-muted-foreground text-sm">
        {{ copy.sections.legacyShadcnDescription }}
      </p>
    </div>

    <OldTooltip.TooltipProvider>
      <div class="grid gap-4 xl:grid-cols-2">
        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.selection }}
          </h3>
          <div :class="demoStackClass">
            <OldSelect.Select v-model="oldSelectValue">
              <OldSelect.SelectTrigger class="w-56">
                <OldSelect.SelectValue
                  :placeholder="copy.text.selectPlaceholder"
                />
              </OldSelect.SelectTrigger>
              <OldSelect.SelectContent>
                <OldSelect.SelectItem
                  v-for="option in options"
                  :key="`old-select-${option}`"
                  :value="option"
                >
                  {{ copy.text.option[option] }}
                </OldSelect.SelectItem>
              </OldSelect.SelectContent>
            </OldSelect.Select>

            <OldTabs.Tabs
              v-model="oldTabsValue"
              class="w-full"
            >
              <OldTabs.TabsList>
                <OldTabs.TabsTrigger value="preview">
                  {{ copy.text.tabPreview }}
                </OldTabs.TabsTrigger>
                <OldTabs.TabsTrigger value="code">
                  {{ copy.text.tabCode }}
                </OldTabs.TabsTrigger>
              </OldTabs.TabsList>
              <OldTabs.TabsContent
                value="preview"
                class="pt-3 text-sm"
              >
                {{ copy.text.previewBody }}
              </OldTabs.TabsContent>
              <OldTabs.TabsContent
                value="code"
                class="pt-3 text-sm"
              >
                {{ copy.text.codeBody }}
              </OldTabs.TabsContent>
            </OldTabs.Tabs>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.toggles }}
          </h3>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <OldCheckbox v-model:checked="oldCheckboxValue" />
              {{ copy.cards.checkbox }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <OldSwitch v-model:checked="oldSwitchValue" />
              {{ copy.cards.switch }}
            </label>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.overlays }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <OldTooltip.Tooltip>
              <OldTooltip.TooltipTrigger as-child>
                <UiButton>
                  {{ copy.text.tooltipTrigger }}
                </UiButton>
              </OldTooltip.TooltipTrigger>
              <OldTooltip.TooltipContent>
                {{ copy.text.tooltip }}
              </OldTooltip.TooltipContent>
            </OldTooltip.Tooltip>

            <OldPopover.Popover v-model:open="oldPopoverOpen">
              <OldPopover.PopoverTrigger as-child>
                <UiButton>
                  {{ copy.text.openPopover }}
                </UiButton>
              </OldPopover.PopoverTrigger>
              <OldPopover.PopoverContent>
                <p class="px-2 py-1 text-sm">
                  {{ copy.text.popoverBody }}
                </p>
              </OldPopover.PopoverContent>
            </OldPopover.Popover>

            <OldDialog.Dialog v-model:open="oldDialogOpen">
              <OldDialog.DialogTrigger as-child>
                <UiButton>
                  {{ copy.text.openDialog }}
                </UiButton>
              </OldDialog.DialogTrigger>
              <OldDialog.DialogContent>
                <OldDialog.DialogHeader>
                  <OldDialog.DialogTitle>
                    {{ copy.text.dialogTitle }}
                  </OldDialog.DialogTitle>
                  <OldDialog.DialogDescription>
                    {{ copy.text.dialogDescription }}
                  </OldDialog.DialogDescription>
                </OldDialog.DialogHeader>
              </OldDialog.DialogContent>
            </OldDialog.Dialog>
          </div>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.command }}
          </h3>
          <OldCommand.Command class="h-[220px]">
            <OldCommand.CommandInput
              :placeholder="copy.text.commandPlaceholder"
            />
            <OldCommand.CommandList>
              <OldCommand.CommandEmpty>
                {{ copy.text.commandEmpty }}
              </OldCommand.CommandEmpty>
              <OldCommand.CommandGroup :heading="copy.text.commandGroup">
                <OldCommand.CommandItem value="rename">
                  {{ copy.text.rename }}
                  <OldCommand.CommandShortcut>R</OldCommand.CommandShortcut>
                </OldCommand.CommandItem>
                <OldCommand.CommandItem value="duplicate">
                  {{ copy.text.duplicate }}
                  <OldCommand.CommandShortcut>D</OldCommand.CommandShortcut>
                </OldCommand.CommandItem>
                <OldCommand.CommandSeparator />
                <OldCommand.CommandItem value="delete">
                  {{ copy.text.delete }}
                  <OldCommand.CommandShortcut>⌫</OldCommand.CommandShortcut>
                </OldCommand.CommandItem>
              </OldCommand.CommandGroup>
            </OldCommand.CommandList>
          </OldCommand.Command>
        </div>

        <div :class="surfaceClass">
          <h3 :class="cardTitleClass">
            {{ copy.cards.contextMenu }}
          </h3>
          <p class="text-muted-foreground mb-3 text-sm">
            {{ copy.text.rightClick }}
          </p>
          <OldContextMenu.Root>
            <OldContextMenu.Trigger as-child>
              <UiButton size="iconText">
                <MoreHorizontal />
                {{ copy.text.menuTrigger }}
              </UiButton>
            </OldContextMenu.Trigger>
            <OldContextMenu.Content>
              <OldContextMenu.Item>
                <Copy />
                {{ copy.text.duplicate }}
              </OldContextMenu.Item>
              <OldContextMenu.Item>
                {{ copy.text.rename }}
              </OldContextMenu.Item>
              <OldContextMenu.Separator />
              <OldContextMenu.Item>
                <Trash2 />
                {{ copy.text.delete }}
              </OldContextMenu.Item>
            </OldContextMenu.Content>
          </OldContextMenu.Root>
        </div>
      </div>
    </OldTooltip.TooltipProvider>
  </section>
</template>
