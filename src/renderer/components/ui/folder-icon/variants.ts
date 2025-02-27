import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva('', {
  variants: {
    size: {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
})

export type Variants = VariantProps<typeof variants>
