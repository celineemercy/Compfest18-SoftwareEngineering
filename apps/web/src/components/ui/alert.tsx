import * as React from 'react'
import { cn } from '@/lib/utils'

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'destructive' | 'success'
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        variant === 'destructive' && 'border-destructive/50 bg-destructive/10 text-destructive',
        variant === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
        variant === 'default' && 'bg-card text-card-foreground',
        className,
      )}
      role="status"
      {...props}
    />
  )
}
