"use client";

/** A checkbox styled as a pill toggle that submits its parent `<form>`
 * on change — for settings that save immediately without a submit button. */
export function AutoSubmitToggle({
  name,
  defaultChecked,
  ariaLabel,
}: Readonly<{
  name: string;
  defaultChecked: boolean;
  ariaLabel: string;
}>) {
  return (
    <label className="relative inline-flex shrink-0 items-center cursor-pointer" aria-label={ariaLabel}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="peer sr-only"
      />
      <div
        className="w-12 h-7 rounded-pill bg-cream/12 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] transition-colors duration-200
          peer-checked:bg-gold peer-checked:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15),0_0_0_4px_rgba(232,179,60,0.15)]
          peer-focus-visible:ring-2 peer-focus-visible:ring-gold/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
      />
      <div
        className="absolute left-1 top-1 w-5 h-5 rounded-pill bg-cream shadow-elevation-sm transition-transform duration-200 ease-out
          peer-checked:translate-x-5 peer-checked:shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
      />
    </label>
  );
}
