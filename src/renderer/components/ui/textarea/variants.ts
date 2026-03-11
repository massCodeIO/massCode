import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const variants = cva(
  'bg-background outline-none whitespace-pre-wrap break-words w-full rounded-md py-1 px-2 border text-sm',
  {
    variants: {
      variant: {
        default:
          'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        ghost:
          'border-transparent bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export type Variants = VariantProps<typeof variants>
