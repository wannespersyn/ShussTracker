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
      <div className="w-12 h-7 rounded-pill bg-chip transition-colors duration-200 peer-checked:bg-amber peer-focus-visible:ring-2 peer-focus-visible:ring-gold/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface" />
      <div className="absolute left-0.75 top-0.75 w-5.5 h-5.5 rounded-pill bg-muted transition-transform duration-200 ease-out peer-checked:translate-x-5 peer-checked:bg-ink" />
    </label>
  );
}
