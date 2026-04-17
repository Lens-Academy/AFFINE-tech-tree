import { useMutation } from "@tanstack/react-query";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { api } from "~/utils/api";

export function AvailabilityToggle() {
  const utils = api.useUtils();
  const { viewerUser } = useViewerAccess();
  const { data: status } = api.availability.getMyStatus.useQuery();
  const profileKey = viewerUser ? { userId: viewerUser.id } : undefined;

  const toggle = useMutation({
    mutationFn: async (available: boolean) =>
      utils.client.availability.setAvailable.mutate({ available }),
    onMutate: async (available) => {
      await utils.availability.getMyStatus.cancel();
      if (profileKey) {
        await utils.userProfile.get.cancel(profileKey);
      }
      const previous = utils.availability.getMyStatus.getData();
      const previousProfile = profileKey
        ? utils.userProfile.get.getData(profileKey)
        : undefined;

      utils.availability.getMyStatus.setData(undefined, { available });
      if (profileKey) {
        utils.userProfile.get.setData(profileKey, (old) =>
          old
            ? {
                ...old,
                user: {
                  ...old.user,
                  availableForTutoring: available,
                },
              }
            : old,
        );
      }

      return { previous, previousProfile };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        utils.availability.getMyStatus.setData(undefined, ctx.previous);
      }
      if (profileKey && ctx?.previousProfile) {
        utils.userProfile.get.setData(profileKey, ctx.previousProfile);
      }
    },
    onSettled: async () => {
      await utils.availability.getMyStatus.invalidate();
      if (profileKey) {
        await utils.userProfile.get.invalidate(profileKey);
      }
    },
  });

  const available = status?.available ?? false;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggle.mutate(!available)}
        disabled={toggle.isPending}
        className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
          available ? "bg-orange-400" : "bg-zinc-700"
        } ${toggle.isPending ? "opacity-50" : ""}`}
        role="switch"
        aria-checked={available}
        title={
          available
            ? "You're visible to learners"
            : "Toggle to let learners find you"
        }
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            available ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <button
        type="button"
        onClick={() => toggle.mutate(!available)}
        disabled={toggle.isPending}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        {available ? "Available" : "Unavailable"}
      </button>
      {toggle.error && (
        <span className="text-xs text-red-400">Could not update status</span>
      )}
    </div>
  );
}
