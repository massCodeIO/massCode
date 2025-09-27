import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'w-full rounded-md focus:outline-none placeholder:text-text-muted py-0.5 px-2 border dark:bg-black/10 bg-black/3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
  {
    variants: {
      variant: {
        default: 'border-border focus:border-primary',
        ghost: 'border-transparent focus:border-transparent !bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export type Variants = VariantProps<typeof variants>
