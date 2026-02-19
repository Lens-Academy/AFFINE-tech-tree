import { useToasts } from "~/hooks/useToastStore";
import { api, type RouterInputs } from "~/utils/api";

type RemoveStatusInput = RouterInputs["userStatus"]["remove"];

export function useTopicStatusMutations(
  clearPending: (topicId: number) => void,
  getTopicName: (topicId: number) => string | undefined,
) {
  const utils = api.useUtils();
  const { addToast } = useToasts();

  const setStatus = api.userStatus.set.useMutation({
    onSuccess: (data, vars) => {
      if (data.isFirstSet) return;
      const name = getTopicName(vars.topicId);
      if (name) {
        addToast({ topicId: vars.topicId, topicName: name });
      }
    },
    onError: (_err, vars) => {
      clearPending(vars.topicId);
    },
    onSettled: () => {
      void utils.userStatus.getAll.invalidate();
      void utils.feedback.getRecentTransitions.invalidate();
      void utils.feedback.getTransitionsByTopic.invalidate();
    },
  });

  const removeStatus = api.userStatus.remove.useMutation({
    onError: (_err, vars: RemoveStatusInput) => {
      clearPending(vars.topicId);
    },
    onSettled: () => {
      void utils.userStatus.getAll.invalidate();
      void utils.feedback.getRecentTransitions.invalidate();
      void utils.feedback.getTransitionsByTopic.invalidate();
    },
  });

  return { setStatus, removeStatus };
}
