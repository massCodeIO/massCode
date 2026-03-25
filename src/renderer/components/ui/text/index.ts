import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Text } from './Text.vue'

export const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      caption: 'text-[10px] leading-3',
      xs: 'text-xs leading-4',
      sm: 'text-[13px] leading-5',
      base: 'text-sm leading-[21px]',
      lg: 'text-base leading-6',
      xl: 'text-lg leading-6',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    mono: {
      true: 'font-mono',
      false: '',
    },
    muted: {
      true: 'text-muted-foreground',
      false: '',
    },
    uppercase: {
      true: 'uppercase',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'base',
    weight: 'normal',
    mono: false,
    muted: false,
    uppercase: false,
  },
})

export type TextVariants = VariantProps<typeof textVariants>
