import { useMutation } from "@tanstack/react-query";

import { ToggleSwitch } from "~/components/ToggleSwitch";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { api } from "~/utils/api";

export function AvailabilityToggle() {
  const utils = api.useUtils();
  const { viewerUser } = useViewerAccess();
  const { data: status, isPending } = api.availability.getMyStatus.useQuery();
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

  if (isPending) return null;
  const available = status?.available ?? false;

  return (
    <div className="flex items-center gap-2">
      <ToggleSwitch
        checked={available}
        disabled={toggle.isPending}
        label="Available"
        onClick={() => toggle.mutate(!available)}
        title={
          available
            ? "You're visible to learners"
            : "Toggle to let learners find you"
        }
      />
      {toggle.error && (
        <span className="text-xs text-red-400">Could not update status</span>
      )}
    </div>
  );
}
