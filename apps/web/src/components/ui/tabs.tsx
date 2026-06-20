import * as React from 'react'
import { cn } from '@/lib/utils'

export function Tabs({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full', className)} {...props} />
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid h-10 grid-cols-2 rounded-md bg-muted p-1 text-muted-foreground', className)}
      {...props}
    />
  )
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}

export function TabsTrigger({ active, className, ...props }: TabsTriggerProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-background text-foreground shadow-sm',
        className,
      )}
      type="button"
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6', className)} {...props} />
}
