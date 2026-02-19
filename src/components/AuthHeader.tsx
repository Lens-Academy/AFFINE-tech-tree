import Link from "next/link";
import { useRef, useState } from "react";

import { authClient } from "~/server/better-auth/client";
import { NotificationBell } from "~/components/NotificationBell";
import { api } from "~/utils/api";

function EditableName({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setName(currentName);
      setEditing(false);
      return;
    }
    await authClient.updateUser({ name: trimmed });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        className="rounded px-1 text-sm text-zinc-400 transition hover:text-zinc-200 hover:underline"
        title="Click to edit name"
      >
        {currentName}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex items-center gap-1"
    >
      <input
        ref={inputRef}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName(currentName);
            setEditing(false);
          }
        }}
        className="w-32 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
      />
    </form>
  );
}

export function AuthHeader() {
  const { data: session, isPending } = authClient.useSession();
  const utils = api.useUtils();
  const adminStatus = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });

  if (isPending) {
    return <span className="text-sm text-zinc-500">Loading…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <EditableName currentName={session.user.name ?? session.user.email} />
        {adminStatus.data?.isAdmin && (
          <Link
            href="/admin"
            className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Admin
          </Link>
        )}
        <NotificationBell />
        <button
          type="button"
          onClick={() => {
            void utils.userStatus.getAll.reset();
            void authClient.signOut();
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth"
      className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition hover:bg-orange-500/20"
    >
      Sign in
    </Link>
  );
}
