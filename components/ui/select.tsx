'use client';

// shadcn-style Select adaptado al sistema visual Vértice (light dialog +
// gold accent). Wraps @radix-ui/react-select.

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'group/sel relative flex h-14 w-full items-center justify-between gap-3 rounded-2xl border-0 bg-[#0A0F1C]/[0.04] px-4 text-left text-[16px] text-[#0A0F1C] outline-none transition-all',
      'shadow-[inset_0_0_0_1px_rgba(10,15,28,0.09)]',
      'hover:bg-[#0A0F1C]/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(10,15,28,0.14)]',
      'focus-visible:bg-[#0A0F1C]/[0.06] focus-visible:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.6),0_0_0_4px_rgba(200,168,100,0.10)]',
      'data-[state=open]:bg-[#0A0F1C]/[0.06] data-[state=open]:shadow-[inset_0_0_0_1.5px_rgba(200,168,100,0.6)]',
      'data-[placeholder]:text-[#0A0F1C]/35',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className={cn(
          'size-4 shrink-0 text-[#0A0F1C]/55 transition-all duration-200',
          'group-hover/sel:text-[#0A0F1C]/85',
          'group-data-[state=open]/sel:rotate-180 group-data-[state=open]/sel:text-[#C8A864]'
        )}
        strokeWidth={2.5}
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={8}
      className={cn(
        'relative z-[60] overflow-hidden rounded-2xl bg-[#FBF9F2] text-[#0A0F1C]',
        'shadow-[0_24px_60px_-18px_rgba(10,15,28,0.32),0_0_0_1px_rgba(10,15,28,0.08)]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        data-lenis-prevent
        className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5"
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'group/item relative flex w-full cursor-default select-none items-center rounded-xl py-2.5 pl-3.5 pr-9 text-[14.5px] text-[#0A0F1C]/80 outline-none transition-colors',
      'data-[highlighted]:bg-[#0A0F1C]/[0.06] data-[highlighted]:text-[#0A0F1C]',
      'data-[state=checked]:font-medium data-[state=checked]:text-[#0A0F1C]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span
      aria-hidden
      className="pointer-events-none absolute right-3 inline-flex size-4 items-center justify-center"
    >
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5 text-[#C8A864]" strokeWidth={2.75} />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
