'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

function Avatar({ className, size = 'md', ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizeMap[size],
        className
      )}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
