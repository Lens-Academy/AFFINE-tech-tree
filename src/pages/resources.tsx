import Head from "next/head";
import Link from "next/link";
import { useState, useMemo } from "react";
import { PageLayout } from "~/components/PageLayout";
import { api } from "~/utils/api";

type ResourceRow = {
  id: number;
  title: string;
  url: string | null;
  author: string | null;
  topic: { id: number; name: string };
};

type GroupedResource = {
  title: string;
  url: string | null;
  authors: string[];
  topics: { id: number; name: string }[];
};

function groupResources(rows: ResourceRow[]): GroupedResource[] {
  const map = new Map<string, GroupedResource>();
  for (const row of rows) {
    const key = row.title;
    // Parse individual authors from author field (split by comma or newline)
    const authors = row.author
      ? row.author
          .split(/[,\n]/)
          .map((a) => a.trim())
          .filter(Boolean)
      : [];
    const existing = map.get(key);
    if (existing) {
      if (!existing.topics.some((t) => t.id === row.topic.id)) {
        existing.topics.push(row.topic);
      }
      for (const author of authors) {
        if (!existing.authors.includes(author)) {
          existing.authors.push(author);
        }
      }
    } else {
      map.set(key, {
        title: row.title,
        url: row.url,
        authors,
        topics: [row.topic],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

export default function ResourcesPage() {
  const { data: rows, isLoading } = api.topic.listResources.useQuery();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => groupResources(rows ?? []), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.authors.some((a) => a.toLowerCase().includes(q)) ||
        r.topics.some((t) => t.name.toLowerCase().includes(q)),
    );
  }, [grouped, query]);

  return (
    <>
      <Head>
        <title>Resources — AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <div>
          <input
            type="search"
            placeholder="Search by title, author, or topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
          />

          {isLoading && <p className="text-zinc-500">Loading resources…</p>}

          {!isLoading && filtered.length === 0 && (
            <p className="text-zinc-500">No resources found.</p>
          )}

          <ul className="space-y-4">
            {filtered.map((r) => (
              <li
                key={r.title}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-orange-400 hover:underline"
                    >
                      {r.title}
                    </a>
                  ) : (
                    <span className="font-medium text-zinc-100">{r.title}</span>
                  )}
                  {r.authors.length > 0 && (
                    <span className="text-sm text-zinc-500">
                      {r.authors.join(", ")}
                    </span>
                  )}
                </div>
                {r.topics.length > 0 && (
                  <div className="mt-1 text-sm text-zinc-400">
                    {r.topics.map((t, idx) => (
                      <span key={t.id}>
                        {idx > 0 && ", "}
                        <Link
                          href={`/topic/${t.id}`}
                          className="hover:text-zinc-200 hover:underline"
                        >
                          {t.name}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {!isLoading && filtered.length > 0 && (
            <p className="mt-6 text-sm text-zinc-600">
              {filtered.length} resource{filtered.length !== 1 ? "s" : ""}
              {query ? " matching your search" : ""}
            </p>
          )}
        </div>
      </PageLayout>
    </>
  );
}
