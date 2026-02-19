import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthHeader } from "~/components/AuthHeader";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";

type TopicOption = { id: number; name: string };

export default function NonUserTeachersAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  const adminStatus = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const teachers = api.admin.listNonUserTeachers.useQuery(undefined, {
    enabled: !!session?.user && !!adminStatus.data?.isAdmin,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [deleteHistoryById, setDeleteHistoryById] = useState<
    Record<string, boolean>
  >({});

  const createTeacher = api.admin.createNonUserTeacher.useMutation({
    onSuccess: async () => {
      setName("");
      setEmail("");
      setSelectedTopicIds([]);
      await teachers.refetch();
    },
  });
  const updateTeacher = api.admin.updateNonUserTeacher.useMutation({
    onSuccess: async () => {
      await teachers.refetch();
    },
  });
  const deleteTeacher = api.admin.deleteNonUserTeacher.useMutation({
    onSuccess: async () => {
      await teachers.refetch();
    },
  });

  const topicMap = api.topic.list.useQuery();
  const allTopics = useMemo<TopicOption[]>(
    () => (topicMap.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    [topicMap.data],
  );

  return (
    <>
      <Head>
        <title>Non-user teachers | Admin</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/admin"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to admin
            </Link>
            <AuthHeader />
          </div>

          <h1 className="mb-6 text-2xl font-bold text-zinc-100">
            Non-user teachers
          </h1>

          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !session?.user && (
            <p className="text-zinc-400">
              Please sign in to access admin features.
            </p>
          )}

          {session?.user && adminStatus.data && !adminStatus.data.isAdmin && (
            <p className="text-zinc-400">Admin access required.</p>
          )}

          {session?.user && adminStatus.data?.isAdmin && (
            <div className="space-y-6">
              <section className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  Create teacher
                </h2>
                <form
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createTeacher.mutate({
                      name: name.trim(),
                      email: email.trim(),
                      topicIds: selectedTopicIds,
                    });
                  }}
                >
                  <label className="text-sm text-zinc-300">
                    Name
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100"
                    />
                  </label>
                  <label className="text-sm text-zinc-300">
                    Email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100"
                    />
                  </label>
                  <div className="text-sm text-zinc-300 md:col-span-2">
                    Topics
                    <TopicMultiSelect
                      topics={allTopics}
                      selectedTopicIds={selectedTopicIds}
                      onChange={setSelectedTopicIds}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={createTeacher.isPending}
                      className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-orange-400 disabled:opacity-50"
                    >
                      {createTeacher.isPending ? "Creating…" : "Create"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                  Existing non-user teachers
                </h2>
                {teachers.isLoading ? (
                  <p className="text-zinc-500">Loading…</p>
                ) : (teachers.data ?? []).length === 0 ? (
                  <p className="text-zinc-500">No non-user teachers yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {(teachers.data ?? []).map((t) => {
                      return (
                        <TeacherEditor
                          key={t.id}
                          teacher={t}
                          allTopics={allTopics}
                          deleteHistory={!!deleteHistoryById[t.id]}
                          onToggleDeleteHistory={(checked) =>
                            setDeleteHistoryById((old) => ({
                              ...old,
                              [t.id]: checked,
                            }))
                          }
                          onSave={(values) =>
                            updateTeacher.mutate({
                              userId: t.id,
                              name: values.name,
                              email: values.email,
                              topicIds: values.topicIds,
                            })
                          }
                          onDelete={() =>
                            deleteTeacher.mutate({
                              userId: t.id,
                              deleteTeachingStatusHistory:
                                !!deleteHistoryById[t.id],
                            })
                          }
                          saving={
                            updateTeacher.isPending || deleteTeacher.isPending
                          }
                        />
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function TeacherEditor({
  teacher,
  allTopics,
  deleteHistory,
  onToggleDeleteHistory,
  onSave,
  onDelete,
  saving,
}: {
  teacher: {
    id: string;
    name: string | null;
    email: string;
    topics: { topicId: number; topicName: string; level: string }[];
  };
  allTopics: TopicOption[];
  deleteHistory: boolean;
  onToggleDeleteHistory: (checked: boolean) => void;
  onSave: (values: { name: string; email: string; topicIds: number[] }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(teacher.name ?? "");
  const [email, setEmail] = useState(teacher.email);
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>(
    teacher.topics.map((t) => t.topicId),
  );

  return (
    <li className="rounded border border-zinc-700 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100"
          />
        </label>
        <div className="text-sm text-zinc-300 md:col-span-2">
          Topics
          <TopicMultiSelect
            topics={allTopics}
            selectedTopicIds={selectedTopicIds}
            onChange={setSelectedTopicIds}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              name: name.trim(),
              email: email.trim(),
              topicIds: selectedTopicIds,
            })
          }
          className="rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
        >
          Save
        </button>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={deleteHistory}
            onChange={(e) => onToggleDeleteHistory(e.target.checked)}
          />
          Delete teaching status history
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={onDelete}
          className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 hover:bg-red-900/60 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function TopicMultiSelect({
  topics,
  selectedTopicIds,
  onChange,
}: {
  topics: TopicOption[];
  selectedTopicIds: number[];
  onChange: (next: number[]) => void;
}) {
  const selectedSet = useMemo(
    () => new Set(selectedTopicIds),
    [selectedTopicIds],
  );

  return (
    <div className="mt-1 max-h-56 overflow-y-auto rounded border border-zinc-600 bg-zinc-800 p-2">
      {topics.length === 0 ? (
        <p className="text-xs text-zinc-500">No topics loaded.</p>
      ) : (
        <ul className="space-y-1">
          {topics.map((topic) => {
            const checked = selectedSet.has(topic.id);
            return (
              <li key={topic.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-700/70">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedTopicIds, topic.id]);
                      } else {
                        onChange(
                          selectedTopicIds.filter((id) => id !== topic.id),
                        );
                      }
                    }}
                  />
                  <span>{topic.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
