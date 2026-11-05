"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { completeProfileAction, type ProfileState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line bg-bg/60 px-4 py-3 text-[15px] text-fg placeholder:text-muted/60 outline-none transition focus:border-ice focus-visible:ring-2 focus-visible:ring-ice/40";

async function toSquareJpeg(file: File, size = 256) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const side = Math.min(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Props = { defaults: { fullName: string; email: string; phone: string; avatar: string | null }; username: string };

export function ProfileForm({ defaults, username }: Props) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(completeProfileAction, {});
  const [avatar, setAvatar] = useState(defaults.avatar ?? "");
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const v = state.values ?? defaults;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setPhotoError("Choose an image file under 10 MB.");
      return;
    }
    try {
      setAvatar(await toSquareJpeg(file));
    } catch {
      setPhotoError("That image could not be read. Try a different one.");
    }
  }

  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={v.fullName || username} src={avatar || null} size={72} />
        <div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium transition hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-ice">
            <i className="bi bi-camera" aria-hidden="true" /> {avatar ? "Change photo" : "Add photo"}
          </button>
          <p className="mt-1.5 text-xs text-muted">Optional. It is cropped to a square.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        <input type="hidden" name="avatar" value={avatar} />
      </div>
      {photoError && <p className="text-sm text-red-300">{photoError}</p>}

      <div className="space-y-2">
        <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
        <input id="fullName" name="fullName" required autoComplete="name" defaultValue={v.fullName} className={inputClass} />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} className={inputClass} />
      </div>
      <div className="space-y-2">
        <label htmlFor="phone" className="text-sm font-medium">Phone number</label>
        <input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="+92 300 1234567" defaultValue={v.phone} className={inputClass} />
      </div>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <i className="bi bi-exclamation-circle" aria-hidden="true" /> {state.error}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ice to-[#c4d8fb] px-5 py-3 text-[15px] font-semibold text-[#08080e] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice disabled:opacity-70">
        {pending ? <><i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Saving</> : "Save and continue"}
      </button>
    </form>
  );
}
