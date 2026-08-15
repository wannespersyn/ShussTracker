"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { createCrew } from "@/app/(app)/crews/actions";

/** Header trigger + bottom sheet for starting a new crew — keeps the
 * always-visible header slim while the name field only appears on demand. */
export function CreateCrewSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create crew"
        className="w-10 h-10 shrink-0 rounded-md bg-gold flex items-center justify-center text-ink"
      >
        <PlusIcon className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/75"
          />
          <div className="relative bg-surface-deep rounded-t-xl border-t border-cream/10 flex flex-col animate-sheet-up pb-8">
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-5">
              <div className="flex-1 font-display text-2xl leading-[1.05] text-cream">New crew</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-11 h-11 shrink-0 rounded-md bg-cream/8 flex items-center justify-center text-cream text-lg"
              >
                ×
              </button>
            </div>

            <form action={createCrew} className="px-5 flex flex-col gap-3.5">
              <input
                type="text"
                name="name"
                required
                autoFocus
                placeholder="New crew name"
                className="h-14 rounded-md bg-cream/8 px-4 font-body text-[15px] text-cream placeholder:text-cream/40 outline-none border border-transparent focus:border-gold/40"
              />
              <PrimaryButton type="submit" className="w-full">
                Create
              </PrimaryButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
