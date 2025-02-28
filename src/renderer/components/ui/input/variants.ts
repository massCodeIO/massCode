import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'w-full rounded-md transition-colors duration-200 focus:outline-none placeholder:text-text-muted py-1 px-2 border',
  {
    variants: {
      variant: {
        default: 'border-border focus:border-primary',
        ghost: 'border-transparent focus:border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export type Variants = VariantProps<typeof variants>
