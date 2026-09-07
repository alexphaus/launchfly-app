'use client';
import { usePathname } from 'next/navigation';
import { type Shell, shellOf } from '@/lib/copilot/shell';

/** The shell the viewer actually opened. Use it for every in-app href so links
 *  stay inside /copilot or /lifeos instead of jumping between the two. */
export function useShell(): Shell {
  return shellOf(usePathname());
}
