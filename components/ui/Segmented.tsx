import { cn } from "@/lib/cn";

type Option = { value: string; label: string };

/** Pill-in-a-tray segmented control that submits a server action — one
 * `<button name value>` per option, so it works without client JS. */
export function SegmentedForm({
  action,
  name,
  value,
  options,
  ariaLabel,
}: Readonly<{
  action: (formData: FormData) => Promise<void>;
  name: string;
  value: string;
  options: Option[];
  ariaLabel: string;
}>) {
  return (
    <form
      action={action}
      aria-label={ariaLabel}
      className="grid gap-1 p-1 rounded-[14px] bg-surface-panel border border-cream/10"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="submit"
            name={name}
            value={o.value}
            aria-pressed={active}
            className={cn(
              "h-10 rounded-[10px] font-heading font-bold text-[15px] tracking-[0.06em] uppercase transition-colors",
              active ? "bg-amber text-ink" : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </form>
  );
}
