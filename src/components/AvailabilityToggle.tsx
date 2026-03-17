import { useMutation } from "@tanstack/react-query";
import { api, type RouterOutputs } from "~/utils/api";

type AvailabilityStatus = RouterOutputs["availability"]["getMyStatus"];

function getPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export function AvailabilityToggle() {
  const utils = api.useUtils();
  const { data: status } = api.availability.getMyStatus.useQuery();

  const toggle = useMutation({
    mutationFn: async (available: boolean) => {
      if (!available) {
        await utils.client.availability.setAvailable.mutate({
          available: false,
          latitude: null,
          longitude: null,
        });
        return;
      }

      const pos = await getPosition();
      await utils.client.availability.setAvailable.mutate({
        available: true,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
    },
    onMutate: async (available) => {
      await utils.availability.getMyStatus.cancel();
      const previous = utils.availability.getMyStatus.getData();

      utils.availability.getMyStatus.setData(undefined, (old) => ({
        available,
        latitude: old?.latitude ?? null,
        longitude: old?.longitude ?? null,
        locationUpdatedAt: old?.locationUpdatedAt ?? null,
      }));

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { previous?: AvailabilityStatus } | undefined;
      if (context?.previous) {
        utils.availability.getMyStatus.setData(undefined, context.previous);
      }
    },
    onSettled: () => utils.availability.getMyStatus.invalidate(),
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
      <span className="text-xs text-zinc-500">
        {available ? "Available" : "Unavailable"}
      </span>
      {toggle.error && (
        <span className="text-xs text-red-400">
          {toggle.error instanceof GeolocationPositionError &&
          toggle.error.code === toggle.error.PERMISSION_DENIED
            ? "Location permission denied"
            : "Could not get location"}
        </span>
      )}
    </div>
  );
}
