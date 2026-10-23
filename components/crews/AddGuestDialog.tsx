/**
 * "Add guest" button + popup: name field, then the new guest's claim code
 * with a WhatsApp/share link so the claim link goes out while they're still
 * at the table. Used on the crew leaderboard and the manage-crew screen.
 */
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { format } from "@/lib/i18n";
import { PlusIcon } from "@/components/ui/icons";
import { createGuestAction } from "@/app/(app)/crews/[crewId]/guests/actions";

type Added = { name: string; claimToken: string };

export function AddGuestDialog({ crewId, crewName }: Readonly<{ crewId: string; crewName: string }>) {
  const { t } = useT();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    reset();
    dialogRef.current?.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close() {
    dialogRef.current?.close();
  }

  function reset() {
    setName("");
    setError(null);
    setAdded(null);
    setCopied(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await createGuestAction(crewId, name);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setAdded({ name: res.name, claimToken: res.claimToken });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const claimUrl = added ? `${window.location.origin}/claim?code=${added.claimToken}` : "";
  const claimText = added ? format(t.crew.claimMessage, { name: added.name, crew: crewName, url: claimUrl, code: added.claimToken }) : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(claimText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="shrink-0 h-9 px-3 rounded-pill border border-dashed border-cream/25 text-cream font-body font-semibold text-[13px] flex items-center gap-1.5"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        {t.crew.addGuest}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={t.crew.addGuest}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(400px,calc(100vw-32px))] rounded-[22px] bg-surface-raised border border-line text-cream p-0 backdrop:bg-black/60"
      >
        <div className="p-5 flex flex-col gap-4">
          {added ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-display font-extrabold text-[26px] leading-none uppercase">
                  {format(t.crew.guestAdded, { name: added.name })}
                </span>
                <span className="font-body text-sm text-muted">{t.crew.guestAddedSub}</span>
              </div>
              <div className="rounded-md bg-surface-deep border border-line px-3.5 py-3 flex items-center justify-between">
                <span className="font-body text-xs text-muted">{t.more.claimCode}</span>
                <span className="font-heading font-bold text-lg tracking-[0.16em] text-gold">{added.claimToken}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(claimText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 rounded-md bg-amber text-ink font-heading font-bold text-sm uppercase flex items-center justify-center"
                >
                  {t.crew.sendClaim}
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="h-11 rounded-md bg-surface-panel border border-line text-cream font-heading font-bold text-sm uppercase"
                >
                  {copied ? t.game.copied : t.crew.copyLink}
                </button>
              </div>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="h-10 px-2 font-heading font-bold text-xs tracking-[0.1em] uppercase text-gold"
                >
                  + {t.crew.addAnother}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="h-10 px-2 font-heading font-bold text-xs tracking-[0.1em] uppercase text-muted"
                >
                  {t.crew.done}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <span className="font-display font-extrabold text-[26px] leading-none uppercase">{t.crew.addGuest}</span>
              <input
                ref={inputRef}
                type="text"
                name="name"
                required
                maxLength={40}
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.more.guestName}
                aria-label={t.more.guestName}
                className="h-12 rounded-md bg-surface-panel border border-line px-3.5 font-body text-[15px] text-cream placeholder:text-muted outline-none focus:border-gold/60"
              />
              {error && <span className="font-body text-sm text-red-pale">{error}</span>}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="h-11 rounded-md bg-surface-panel border border-line text-cream font-heading font-bold text-sm uppercase"
                >
                  {t.game.cancel}
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="h-11 rounded-md bg-amber text-ink font-heading font-bold text-sm uppercase disabled:opacity-50"
                >
                  {pending ? t.crew.adding : t.crew.addGuest}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
