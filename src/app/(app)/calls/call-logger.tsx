"use client";

import { useState } from "react";
import { CallForm } from "@/components/call-form";
import { primaryBtn } from "@/components/form-styles";
import { Modal } from "@/components/modal";
import type { LeadHit } from "@/lib/lead-hit";

export function CallLogger({ preselected, defaultOpen }: { preselected?: LeadHit | null; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);

  function close() {
    setOpen(false);
    if (preselected) {
      // Opened from a lead: drop ?lead= from the address so it does not reopen on refresh
      const params = new URLSearchParams(window.location.search);
      params.delete("lead");
      window.history.replaceState(null, "", `/calls${params.size ? `?${params}` : ""}`);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        <i className="bi bi-plus-lg" aria-hidden="true" /> Log a call
      </button>
      <Modal open={open} onClose={close} title="Log a call" wide>
        <CallForm onDone={close} preselected={preselected} />
      </Modal>
    </>
  );
}
