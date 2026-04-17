import { useViewerAccess } from "~/hooks/useViewerAccess";
import { INFO_PANE_CURRENT, shouldShowInfoPane } from "~/shared/infoPane";
import { api } from "~/utils/api";

export function InfoPane() {
  const { viewerUser } = useViewerAccess();
  const utils = api.useUtils();
  const access = api.access.me.useQuery(undefined, { enabled: !!viewerUser });
  const setClosed = api.userProfile.setInfoPaneClosedVersion.useMutation({
    onMutate: async ({ version }) => {
      await utils.access.me.cancel();
      const previous = utils.access.me.getData();
      utils.access.me.setData(undefined, (old) =>
        old ? { ...old, infoPaneClosedVersion: version || null } : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.access.me.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      void utils.access.me.invalidate();
      void utils.userProfile.get.invalidate();
    },
  });

  if (!viewerUser) return null;
  if (!shouldShowInfoPane(access.data?.infoPaneClosedVersion)) return null;

  return (
    <div className="relative mb-6 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 pr-10 text-sm text-zinc-300">
      <p>{INFO_PANE_CURRENT.content}</p>
      <button
        type="button"
        aria-label="Close info pane"
        onClick={() => setClosed.mutate({ version: INFO_PANE_CURRENT.version })}
        className="absolute top-2 right-2 rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
