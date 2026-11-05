"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { inputClass, primaryBtn, ghostBtn } from "@/components/form-styles";
import { toSquareJpeg } from "@/lib/image";
import { updateMyProfileAction, type FormState } from "./actions";

export function ProfileCard({ me }: { me: { username: string; fullName: string; email: string; phone: string; avatar: string | null } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateMyProfileAction, {});
  const [avatar, setAvatar] = useState(me.avatar ?? "");
  const [photoError, setPhotoError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoError("");
    if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) return setPhotoError("Choose an image file under 10 MB.");
    try { setAvatar(await toSquareJpeg(f)); } catch { setPhotoError("That image could not be read."); }
  }

  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={me.fullName || me.username} src={avatar || null} size={72} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => file.current?.click()} className={ghostBtn}><i className="bi bi-camera" aria-hidden="true" /> {avatar ? "Change photo" : "Add photo"}</button>
          {avatar && <button type="button" onClick={() => setAvatar("")} className={ghostBtn}>Remove</button>}
        </div>
        <input ref={file} type="file" accept="image/*" onChange={pick} className="hidden" />
        <input type="hidden" name="avatar" value={avatar} />
      </div>
      {photoError && <p className="text-sm text-red-600 dark:text-red-300">{photoError}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><label htmlFor="pf-name" className="text-sm font-medium">Full name</label>
          <input id="pf-name" name="fullName" defaultValue={me.fullName} required className={inputClass} /></div>
        <div className="space-y-1.5"><label htmlFor="pf-user" className="text-sm font-medium">Username</label>
          <input id="pf-user" value={me.username} disabled className={`${inputClass} opacity-60`} /></div>
        <div className="space-y-1.5"><label htmlFor="pf-email" className="text-sm font-medium">Email</label>
          <input id="pf-email" name="email" type="email" defaultValue={me.email} required className={inputClass} /></div>
        <div className="space-y-1.5"><label htmlFor="pf-phone" className="text-sm font-medium">Phone number</label>
          <input id="pf-phone" name="phone" type="tel" defaultValue={me.phone} required className={inputClass} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? "Saving" : "Save profile"}</button>
        {state.ok && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-300"><i className="bi bi-check2" aria-hidden="true" /> Saved</p>}
        {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      </div>
    </form>
  );
}
