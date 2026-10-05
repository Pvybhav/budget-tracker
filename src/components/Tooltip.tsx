import type { ReactElement } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  readonly content: string;
  readonly children: ReactElement;
}

export default function Tooltip({ content, children }: Readonly<TooltipProps>) {
  if (!content.trim()) return children;

  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {content}
          <RadixTooltip.Arrow className="fill-white dark:fill-slate-800" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
