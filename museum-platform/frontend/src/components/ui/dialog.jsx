import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = React.forwardRef(({ className, children, open, onOpenChange, ...props }, ref) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      <div
        ref={ref}
        className={cn(
          "relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
})
Dialog.displayName = "Dialog"

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-4", className)} {...props} />
))
DialogContent.displayName = "DialogContent"

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTrigger = React.forwardRef(({ className, asChild = true, ...props }, ref) => {
  // Simple implementation - renders children without wrapper
  return props.children || null
})
DialogTrigger.displayName = "DialogTrigger"

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, DialogTrigger }
