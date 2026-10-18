"use client";

import { useActionState, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon } from "@/components/shell/icons";
import { FieldError, inputClass } from "@/components/ui";
import { idleState } from "@/lib/form-state";
import type { ChecklistItem } from "@/lib/matches/queries";
import {
  addChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from "../actions";
import { ErrorText, useAction } from "./match-tools";

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-[10px] text-slate-600 hover:bg-slate-100 hover:text-navy focus-visible:outline-2 focus-visible:outline-court disabled:opacity-30";

/** Add, rename, reorder, tick and remove checklist items. The page reloads its data after each change. */
export function ChecklistEditor({ matchId, items }: { matchId: string; items: ChecklistItem[] }) {
  const [state, formAction, adding] = useActionState(addChecklistItem.bind(null, matchId), idleState);
  const { error, pending, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const addError = state.status === "error" ? (state.fieldErrors.label ?? state.message) : undefined;

  return (
    <div className="rounded-2xl border border-line bg-white p-2">
      {items.length === 0 ? <p className="px-2 py-3 text-[15px] text-slate-600">No checklist items yet.</p> : null}
      <ul className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center gap-1 py-1">
            {editing === item.id ? (
              <form
                className="flex flex-1 items-center gap-1.5"
                action={(formData) =>
                  run(
                    () => renameChecklistItem(item.id, String(formData.get("label") ?? "")),
                    () => setEditing(null),
                  )
                }
              >
                <label className="sr-only" htmlFor={`rename-${item.id}`}>
                  Checklist item
                </label>
                <input
                  id={`rename-${item.id}`}
                  name="label"
                  defaultValue={item.label}
                  autoFocus
                  className={`${inputClass} h-11`}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="h-11 shrink-0 rounded-[10px] bg-navy px-3 text-[14px] font-bold text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-11 shrink-0 rounded-[10px] px-2 text-[14px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  aria-pressed={item.done}
                  disabled={pending}
                  onClick={() => run(() => toggleChecklistItem(item.id, !item.done))}
                  className="flex min-h-11 flex-1 items-center gap-3 rounded-[10px] px-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-court"
                >
                  {item.done ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-navy text-ball">
                      <CheckIcon size={14} strokeWidth={3.2} />
                    </span>
                  ) : (
                    <span className="size-6 shrink-0 rounded-[7px] border-2 border-muted" />
                  )}
                  <span className={item.done ? "text-[15px] text-slate-600 line-through" : "text-[15px] font-medium"}>
                    {item.label}
                  </span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending}
                  onClick={() => setEditing(item.id)}
                  aria-label={`Rename "${item.label}"`}
                >
                  <PencilIcon size={18} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveChecklistItem(item.id, "up"))}
                  aria-label={`Move "${item.label}" up`}
                >
                  <ChevronUpIcon size={18} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || i === items.length - 1}
                  onClick={() => run(() => moveChecklistItem(item.id, "down"))}
                  aria-label={`Move "${item.label}" down`}
                >
                  <ChevronDownIcon size={18} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending}
                  onClick={() => run(() => deleteChecklistItem(item.id))}
                  aria-label={`Remove "${item.label}"`}
                >
                  <TrashIcon size={18} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <ErrorText error={error} />

      <form
        action={formAction}
        // React resets the form after a successful add; after an error, remount with what was typed.
        key={state.status === "error" ? JSON.stringify(state.values) : "add"}
        className="mt-2 flex items-start gap-1.5 border-t border-slate-100 pt-2"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="new-checklist-item" className="sr-only">
            New checklist item
          </label>
          <input
            id="new-checklist-item"
            name="label"
            placeholder="Add an item"
            defaultValue={state.status === "error" ? String(state.values.label ?? "") : ""}
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? "new-checklist-item-error" : undefined}
            className={`${inputClass} h-11`}
          />
          <FieldError id="new-checklist-item-error" message={addError} />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="h-11 shrink-0 rounded-[10px] border-[1.5px] border-court px-4 text-[14px] font-bold text-court hover:bg-blue-50 disabled:opacity-60"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
