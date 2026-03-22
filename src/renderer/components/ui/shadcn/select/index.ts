import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Select } from './Select.vue'
export { default as SelectContent } from './SelectContent.vue'
export { default as SelectGroup } from './SelectGroup.vue'
export { default as SelectItem } from './SelectItem.vue'
export { default as SelectItemText } from './SelectItemText.vue'
export { default as SelectLabel } from './SelectLabel.vue'
export { default as SelectScrollDownButton } from './SelectScrollDownButton.vue'
export { default as SelectScrollUpButton } from './SelectScrollUpButton.vue'
export { default as SelectSeparator } from './SelectSeparator.vue'
export { default as SelectTrigger } from './SelectTrigger.vue'
export { default as SelectValue } from './SelectValue.vue'

export const selectTriggerVariants = cva(
  'data-[placeholder]:text-muted-foreground flex h-7 w-fit items-center justify-between gap-2 rounded-md px-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4 [&>span]:truncate',
  {
    variants: {
      variant: {
        default:
          'border-input [&_svg:not([class*=\'text-\'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-[color-mix(in_oklch,var(--foreground)_2%,var(--background))] shadow-xs hover:bg-[color-mix(in_oklch,var(--foreground)_5%,var(--background))] focus-visible:ring-[3px]',
        ghost:
          'hover:bg-accent-hover hover:text-accent-foreground dark:hover:bg-accent/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
export type SelectTriggerVariants = VariantProps<typeof selectTriggerVariants>
