import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-xl",
    "text-sm font-semibold",
    "transition-all duration-200",
    "outline-none select-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:ring-2 focus-visible:ring-ring/50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-sm",
          "hover:-translate-y-0.5 hover:shadow-md",
          "active:translate-y-0 active:shadow-sm",
        ].join(" "),

        secondary: [
          "bg-secondary text-secondary-foreground",
          "border border-border/70",
          "shadow-sm",
          "hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-md",
          "active:translate-y-0",
        ].join(" "),

        outline: [
          "border border-border",
          "bg-background text-foreground",
          "shadow-sm",
          "hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground hover:shadow-md",
          "active:translate-y-0",
        ].join(" "),

        ghost: [
          "bg-transparent text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
          "active:bg-muted/80",
        ].join(" "),

        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-sm",
          "hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-md",
          "active:translate-y-0",
        ].join(" "),

        link: [
          "h-auto rounded-md p-0",
          "text-primary underline-offset-4",
          "hover:underline",
        ].join(" "),

        "ai-primary": [
          "relative overflow-hidden",
          "bg-primary text-primary-foreground",
          "shadow-[0_8px_30px_-12px_color-mix(in_oklch,var(--primary)_65%,transparent)]",
          "hover:-translate-y-0.5",
          "hover:shadow-[0_12px_35px_-12px_color-mix(in_oklch,var(--primary)_75%,transparent)]",
          "active:translate-y-0",
        ].join(" "),
      },

      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        xl: "h-12 rounded-xl px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  if (asChild) {
    return (
      <button
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }

  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
