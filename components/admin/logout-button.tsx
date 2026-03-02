"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin" })}
      className="rounded-full border border-neutral-400 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
    >
      Выйти
    </button>
  );
}
