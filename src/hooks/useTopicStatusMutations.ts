import { api, type RouterInputs } from "~/utils/api";

type RemoveStatusInput = RouterInputs["userStatus"]["remove"];

export function useTopicStatusMutations(
  clearPending: (topicId: number) => void,
) {
  const utils = api.useUtils();

  const setStatus = api.userStatus.set.useMutation({
    onError: (_err, vars) => {
      clearPending(vars.topicId);
    },
    onSettled: () => {
      void utils.userStatus.getAll.invalidate();
    },
  });

  const removeStatus = api.userStatus.remove.useMutation({
    onError: (_err, vars: RemoveStatusInput) => {
      clearPending(vars.topicId);
    },
    onSettled: () => {
      void utils.userStatus.getAll.invalidate();
    },
  });

  return { setStatus, removeStatus };
}
