"use client";

import { useTransition } from "react";
import { deleteCallAction } from "./actions";

export function DeleteCallButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label="Delete call"
      onClick={() => window.confirm("Delete this call log?") && start(async () => { await deleteCallAction(id); })}
      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-ice disabled:opacity-50">
      <i className="bi bi-trash3" aria-hidden="true" />
    </button>
  );
}
