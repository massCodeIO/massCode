import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'outline-none whitespace-pre-wrap break-words w-full rounded-md focus:outline-none py-1 px-2 border',
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
