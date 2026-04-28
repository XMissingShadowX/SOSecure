'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonGroupVariants = cva(
  'flex w-fit items-stretch',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  }
)

interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {}

function ButtonGroup({ className, orientation, ...props }: ButtonGroupProps) {
  return (
    <div
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}

export { ButtonGroup }
