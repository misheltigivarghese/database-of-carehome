import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface TabDef {
  id: string;
  label: string;
  /** Optional count rendered beside the label (e.g. number of notes). */
  count?: number;
}

interface TabsProps {
  tabs: TabDef[];
  value: string;
  onValueChange: (id: string) => void;
  idPrefix?: string;
  label?: string;
}

/**
 * Implements the WAI-ARIA tabs pattern: roving tabindex, Left/Right/Home/End
 * keys, and each tab wired to its panel via aria-controls.
 */
export function Tabs({ tabs, value, onValueChange, idPrefix = "tab", label = "Sections" }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    if (next === null) return;
    event.preventDefault();
    onValueChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "-mb-px shrink-0 cursor-pointer border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ease-out",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  selected ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  value: string;
  idPrefix?: string;
  children: ReactNode;
}

export function TabPanel({ id, value, idPrefix = "tab", children }: TabPanelProps) {
  if (id !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className="pt-5 focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
