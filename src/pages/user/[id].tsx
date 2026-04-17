import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import { AvailabilityCircle } from "~/components/AvailabilityCircle";
import { AvailabilityToggle } from "~/components/AvailabilityToggle";
import { PageLayout } from "~/components/PageLayout";
import { StarIcon } from "~/components/StarIcon";
import { getLevelLabel } from "~/shared/understandingLevels";
import {
  USER_SEGMENTS,
  getSegmentLabel,
  type UserSegment,
} from "~/shared/userSegments";
import { useAppMutation } from "~/hooks/useAppMutation";
import { useSignOut } from "~/hooks/useSignOut";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { authClient } from "~/server/better-auth/client";
import { HELPFULNESS_RATING_LABELS } from "~/shared/feedbackTypes";
import { formatDate } from "~/shared/formatDate";
import type { HelpfulnessRating } from "~/shared/feedbackTypes";
import { api, type RouterInputs, type RouterOutputs } from "~/utils/api";

type UpdateProfileMutationOptions = Exclude<
  Parameters<typeof api.userProfile.updateProfile.useMutation>[0],
  undefined
>;

type BecomeAdminMutationOptions = Exclude<
  Parameters<typeof api.admin.becomeAdmin.useMutation>[0],
  undefined
>;
type DeleteUserMutationOptions = Exclude<
  Parameters<typeof api.admin.deleteUserByAdmin.useMutation>[0],
  undefined
>;
type SetUserAdminMutationOptions = Exclude<
  Parameters<typeof api.admin.setUserAdmin.useMutation>[0],
  undefined
>;
type SetUserApprovalMutationOptions = Exclude<
  Parameters<typeof api.admin.setUserApproval.useMutation>[0],
  undefined
>;
type SetUserSegmentMutationOptions = Exclude<
  Parameters<typeof api.admin.setUserSegment.useMutation>[0],
  undefined
>;

function EditableField({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <div>
        <label className="mb-1 block text-sm text-zinc-500">{label}</label>
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-200">{value || "(not set)"}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(true);
                requestAnimationFrame(() => inputRef.current?.select());
              }}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-500">{label}</label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) {
            onSave(trimmed);
          }
          setEditing(false);
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className="w-64 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
        />
        <button
          type="submit"
          className="text-xs text-orange-400 hover:text-orange-300"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

type ResetLinkMutationOptions = Exclude<
  Parameters<typeof api.userProfile.generatePasswordResetLink.useMutation>[0],
  undefined
>;

function PasswordSection({
  isSelf,
  userId,
}: {
  isSelf: boolean;
  userId: string;
}) {
  // Self: change password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin: generate reset link
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const generateResetLink = useAppMutation(
    (opts: ResetLinkMutationOptions) =>
      api.userProfile.generatePasswordResetLink.useMutation(opts),
    {
      disableDefaultErrorToast: true,
    },
  );

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="mb-3 text-zinc-200">Password</h2>
      {isSelf ? (
        <form
          onSubmit={(e) => void handleChangePassword(e)}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-500">
              Current password
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-64 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-500">
              New password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-64 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-500">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-64 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-orange-500 px-3 py-1.5 text-sm text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
          >
            {loading ? "Changing..." : "Change password"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setResetUrl(null);
              try {
                const result = await generateResetLink.mutateAsync({
                  userId,
                });
                setResetUrl(result.url);
                setCopyStatus("idle");
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to generate link",
                );
              }
            }}
            disabled={generateResetLink.isPending}
            className="rounded bg-orange-500 px-3 py-1.5 text-sm text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
          >
            {generateResetLink.isPending
              ? "Generating..."
              : "Generate password reset link"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {resetUrl && (
            <div className="space-y-1">
              <p className="text-sm text-zinc-400">
                Send this link to the user:
              </p>
              <div className="space-y-1">
                <input
                  type="text"
                  readOnly
                  value={resetUrl}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resetUrl);
                      setCopyStatus("copied");
                    } catch {
                      setCopyStatus("error");
                    }
                    setTimeout(() => setCopyStatus("idle"), 1500);
                  }}
                  className="w-full cursor-copy rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-300 outline-none"
                />
                <p
                  className={`text-xs ${
                    copyStatus === "copied"
                      ? "text-green-400"
                      : copyStatus === "error"
                        ? "text-red-400"
                        : "text-zinc-500"
                  }`}
                >
                  {copyStatus === "copied"
                    ? "✓ Copied"
                    : copyStatus === "error"
                      ? "Clipboard copy failed"
                      : "Click field to copy"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackAboutUser({
  feedback,
}: {
  feedback: {
    id: number;
    helpfulnessRating: string | null;
    comment: string | null;
    createdAt: Date;
    author: { id: string; name: string | null; email: string } | null;
    topic: { id: number; name: string } | null;
  }[];
}) {
  if (feedback.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No feedback has been left about this user yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {feedback.map((fi) => (
        <li
          key={fi.id}
          className="rounded border border-zinc-800 px-3 py-2 text-sm"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-zinc-300">
              {fi.topic ? (
                <Link
                  href={`/topic/${fi.topic.id}`}
                  className="text-orange-400 hover:text-orange-300"
                >
                  {fi.topic.name}
                </Link>
              ) : (
                "(unknown topic)"
              )}
            </span>
            <span className="text-xs text-zinc-600">
              {formatDate(fi.createdAt)}
            </span>
          </div>
          {fi.helpfulnessRating && (
            <div className="mt-1 text-zinc-400">
              {HELPFULNESS_RATING_LABELS[
                fi.helpfulnessRating as HelpfulnessRating
              ] ?? fi.helpfulnessRating}
            </div>
          )}
          {fi.comment && <div className="mt-1 text-zinc-500">{fi.comment}</div>}
          {fi.author && (
            <div className="mt-1 text-xs text-zinc-600">
              by {fi.author.name ?? fi.author.email}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const userId = router.query.id as string | undefined;
  const { viewerUser, isPending: viewerPending } = useViewerAccess();
  const utils = api.useUtils();
  const signOut = useSignOut();

  const profile = api.userProfile.get.useQuery(
    { userId: userId! },
    { enabled: !!userId && !!viewerUser },
  );

  const updateProfile = useAppMutation(
    (opts: UpdateProfileMutationOptions) =>
      api.userProfile.updateProfile.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["userProfile"]["updateProfile"];
        const key = { userId: vars.userId };
        await utils.userProfile.get.cancel(key);
        const previous = utils.userProfile.get.getData(key);
        utils.userProfile.get.setData(key, (old) =>
          old
            ? {
                ...old,
                user: {
                  ...old.user,
                  name: vars.name ?? old.user.name,
                  email: vars.email ?? old.user.email,
                },
              }
            : old,
        );
        return { previous };
      },
      onError: (_err, rawVars, ctx) => {
        const vars = rawVars as RouterInputs["userProfile"]["updateProfile"];
        const context = ctx as
          | { previous?: RouterOutputs["userProfile"]["get"] }
          | undefined;
        if (context?.previous) {
          utils.userProfile.get.setData(
            { userId: vars.userId },
            context.previous,
          );
        }
      },
      refresh: [
        () => utils.userProfile.get.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );

  const becomeAdmin = useAppMutation(
    (opts: BecomeAdminMutationOptions) =>
      api.admin.becomeAdmin.useMutation(opts),
    {
      refresh: [
        () => utils.userProfile.get.invalidate(),
        () => utils.admin.getAdminStatus.invalidate(),
      ],
    },
  );
  const deleteUser = useAppMutation(
    (opts: DeleteUserMutationOptions) =>
      api.admin.deleteUserByAdmin.useMutation(opts),
    {
      refresh: [
        () => utils.admin.getAdminStatus.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );
  const setUserAdmin = useAppMutation(
    (opts: SetUserAdminMutationOptions) =>
      api.admin.setUserAdmin.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["admin"]["setUserAdmin"];
        const key = { userId: vars.userId };
        await utils.userProfile.get.cancel(key);
        const previous = utils.userProfile.get.getData(key);
        utils.userProfile.get.setData(key, (old) =>
          old ? { ...old, isAdmin: vars.isAdmin } : old,
        );
        return { previous };
      },
      onError: (_err, rawVars, ctx) => {
        const vars = rawVars as RouterInputs["admin"]["setUserAdmin"];
        const context = ctx as
          | { previous?: RouterOutputs["userProfile"]["get"] }
          | undefined;
        if (context?.previous) {
          utils.userProfile.get.setData(
            { userId: vars.userId },
            context.previous,
          );
        }
      },
      refresh: [
        () => utils.userProfile.get.invalidate(),
        () => utils.admin.getAdminStatus.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );
  const setUserSegment = useAppMutation(
    (opts: SetUserSegmentMutationOptions) =>
      api.admin.setUserSegment.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["admin"]["setUserSegment"];
        const key = { userId: vars.userId };
        await utils.userProfile.get.cancel(key);
        const previous = utils.userProfile.get.getData(key);
        utils.userProfile.get.setData(key, (old) =>
          old ? { ...old, user: { ...old.user, segment: vars.segment } } : old,
        );
        return { previous };
      },
      onError: (_err, rawVars, ctx) => {
        const vars = rawVars as RouterInputs["admin"]["setUserSegment"];
        const context = ctx as
          | { previous?: RouterOutputs["userProfile"]["get"] }
          | undefined;
        if (context?.previous) {
          utils.userProfile.get.setData(
            { userId: vars.userId },
            context.previous,
          );
        }
      },
      refresh: [
        () => utils.userProfile.get.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );
  const setUserApproval = useAppMutation(
    (opts: SetUserApprovalMutationOptions) =>
      api.admin.setUserApproval.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["admin"]["setUserApproval"];
        const key = { userId: vars.userId };
        await utils.userProfile.get.cancel(key);
        const previous = utils.userProfile.get.getData(key);
        utils.userProfile.get.setData(key, (old) =>
          old
            ? {
                ...old,
                user: { ...old.user, isApproved: vars.isApproved },
              }
            : old,
        );
        return { previous };
      },
      onError: (_err, rawVars, ctx) => {
        const vars = rawVars as RouterInputs["admin"]["setUserApproval"];
        const context = ctx as
          | { previous?: RouterOutputs["userProfile"]["get"] }
          | undefined;
        if (context?.previous) {
          utils.userProfile.get.setData(
            { userId: vars.userId },
            context.previous,
          );
        }
      },
      refresh: [
        () => utils.userProfile.get.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );
  const [confirmDeleteArmed, setConfirmDeleteArmed] = useState(false);

  const data = profile.data;
  const viewingSelf = !!viewerUser && viewerUser.id === userId;
  const displayName =
    data?.user.name ??
    data?.user.email ??
    (viewingSelf ? (viewerUser.name ?? viewerUser.email) : "");

  useEffect(() => {
    setConfirmDeleteArmed(false);
  }, [data?.user.id]);

  return (
    <>
      <Head>
        <title>
          {data
            ? `${displayName} | AFFINE Tech Tree`
            : "User | AFFINE Tech Tree"}
        </title>
      </Head>
      <PageLayout>
        <div>
          {(viewingSelf || data) && (
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-zinc-100">
                {displayName}
                {(data?.isSelf ?? viewingSelf) && (
                  <span className="ml-2 text-base font-normal text-zinc-500">
                    (you)
                  </span>
                )}
              </h1>
              {viewingSelf && (
                <div className="flex flex-wrap items-center gap-3">
                  <AvailabilityToggle />
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {viewerPending && <p className="text-zinc-500">Loading session...</p>}
          {!viewerPending && !viewerUser && (
            <p className="text-zinc-400">Please sign in to view profiles.</p>
          )}

          {profile.isLoading && viewerUser && (
            <p className="text-zinc-500">Loading profile...</p>
          )}

          {profile.error && (
            <p className="text-red-400">{profile.error.message}</p>
          )}

          {data && (
            <div className="space-y-4">
              {/* Profile info */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <div className="space-y-3">
                  <EditableField
                    label="Name"
                    value={data.user.name ?? ""}
                    onSave={(name) =>
                      updateProfile.mutate({ userId: data.user.id, name })
                    }
                    disabled={!data.isSelf && !data.viewerIsAdmin}
                  />
                  <EditableField
                    label="Email"
                    value={data.user.email}
                    onSave={(email) =>
                      updateProfile.mutate({ userId: data.user.id, email })
                    }
                    disabled={!data.isSelf && !data.viewerIsAdmin}
                  />
                  <div>
                    <label className="mb-1 block text-sm text-zinc-500">
                      Member since
                    </label>
                    <span className="text-zinc-200">
                      {formatDate(data.user.createdAt)}
                    </span>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-500">
                      Approval
                    </label>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          data.user.isApproved
                            ? "text-zinc-200"
                            : "text-zinc-400"
                        }
                      >
                        {data.user.isApproved
                          ? "Approved"
                          : "Waiting for approval"}
                      </span>
                      {data.viewerIsAdmin && !data.isSelf && (
                        <button
                          type="button"
                          onClick={() =>
                            setUserApproval.mutate({
                              userId: data.user.id,
                              isApproved: !data.user.isApproved,
                            })
                          }
                          disabled={setUserApproval.isPending}
                          className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {setUserApproval.isPending
                            ? "Updating..."
                            : data.user.isApproved
                              ? "Unapprove"
                              : "Approve"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-500">
                      Segment
                    </label>
                    <div className="flex items-center gap-3">
                      {data.viewerIsAdmin ? (
                        <select
                          value={data.user.segment ?? ""}
                          onChange={(e) =>
                            setUserSegment.mutate({
                              userId: data.user.id,
                              segment:
                                e.target.value === ""
                                  ? null
                                  : (e.target.value as UserSegment),
                            })
                          }
                          disabled={setUserSegment.isPending}
                          className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-orange-500/50"
                        >
                          <option value="">Unassigned</option>
                          {USER_SEGMENTS.map((seg) => (
                            <option key={seg} value={seg}>
                              {getSegmentLabel(seg)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={
                            data.user.segment
                              ? "text-zinc-200"
                              : "text-zinc-500"
                          }
                        >
                          {getSegmentLabel(data.user.segment)}
                        </span>
                      )}
                    </div>
                  </div>
                  {data.user.isNonUser && (
                    <div className="text-sm text-zinc-500">
                      Non-user teacher account
                    </div>
                  )}
                </div>
              </div>

              {/* Admin status */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-2 text-zinc-200">Admin status</h2>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      data.isAdmin ? "text-orange-400" : "text-zinc-500"
                    }
                  >
                    {data.isAdmin ? "Admin" : "Not admin"}
                  </span>
                  {data.isSelf && !data.isAdmin && data.honorSystemEnabled && (
                    <button
                      type="button"
                      onClick={() => becomeAdmin.mutate()}
                      disabled={becomeAdmin.isPending}
                      className="rounded bg-orange-500 px-3 py-1.5 text-sm text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
                    >
                      {becomeAdmin.isPending ? "Applying..." : "Become admin"}
                    </button>
                  )}
                  {data.viewerIsAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setUserAdmin.mutate({
                          userId: data.user.id,
                          isAdmin: !data.isAdmin,
                        })
                      }
                      disabled={setUserAdmin.isPending}
                      className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {setUserAdmin.isPending
                        ? "Updating..."
                        : data.isAdmin
                          ? "Remove admin"
                          : "Make admin"}
                    </button>
                  )}
                </div>
                {data.isSelf && !data.isAdmin && !data.honorSystemEnabled && (
                  <p className="mt-1 text-sm text-zinc-600">
                    Honor system is disabled. Ask an existing admin for access.
                  </p>
                )}
                {data.viewerIsAdmin && !data.isSelf && (
                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <p className="mb-2 text-xs text-zinc-500">
                      Dangerous action
                    </p>
                    {!confirmDeleteArmed ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteArmed(true)}
                        className="rounded bg-red-900/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-900/60"
                      >
                        Delete user…
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteArmed(false)}
                          disabled={deleteUser.isPending}
                          className="min-w-26 rounded bg-zinc-800 px-3 py-1.5 text-center text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteUser.mutateAsync({
                              userId: data.user.id,
                            });
                            await router.push("/admin");
                          }}
                          disabled={deleteUser.isPending}
                          className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {deleteUser.isPending
                            ? "Deleting..."
                            : "Confirm delete"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-2 text-zinc-200">Availability</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Status:</span>
                  <AvailabilityCircle
                    available={data.user.availableForTutoring}
                    className="shrink-0"
                  />
                  <span
                    className={
                      data.user.availableForTutoring
                        ? "text-orange-400"
                        : "text-zinc-400"
                    }
                  >
                    {data.user.availableForTutoring
                      ? "Available for tutoring"
                      : "Unavailable"}
                  </span>
                </div>
              </div>

              {/* Excited to teach */}
              {data.excitedToTeachTopics.length > 0 && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                  <h2 className="mb-3 flex items-center gap-2 text-zinc-200">
                    <span className="text-orange-400">
                      <StarIcon filled />
                    </span>
                    Excited to teach
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {data.excitedToTeachTopics.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/topic/${t.id}`}
                          className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-orange-400 hover:border-orange-500/40 hover:text-orange-300"
                        >
                          <span>{t.name}</span>
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {getLevelLabel(t.level)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Password management */}
              {(data.isSelf || data.viewerIsAdmin) && (
                <PasswordSection isSelf={data.isSelf} userId={data.user.id} />
              )}

              {/* Feedback about this user */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-3 text-zinc-200">Feedback about this user</h2>
                <FeedbackAboutUser feedback={data.feedbackAboutUser} />
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </>
  );
}
