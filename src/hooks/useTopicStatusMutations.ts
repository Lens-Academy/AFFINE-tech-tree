import { useToasts } from "~/hooks/useToastStore";
import { useAppMutation } from "~/hooks/useAppMutation";
import { api, type RouterInputs, type RouterOutputs } from "~/utils/api";

type RemoveStatusInput = RouterInputs["userStatus"]["remove"];
type StatusRow = RouterOutputs["userStatus"]["getAll"][number];
type SetStatusInput = RouterInputs["userStatus"]["set"];
type SetStatusMutationOptions = Exclude<
  Parameters<typeof api.userStatus.set.useMutation>[0],
  undefined
>;
type RemoveStatusMutationOptions = Exclude<
  Parameters<typeof api.userStatus.remove.useMutation>[0],
  undefined
>;

export function useTopicStatusMutations(
  getTopicName: (topicId: number) => string | undefined,
) {
  const utils = api.useUtils();
  const { addToast } = useToasts();

  const setStatus = useAppMutation(
    (opts: SetStatusMutationOptions) => api.userStatus.set.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as SetStatusInput;
        await utils.userStatus.getAll.cancel();
        const previous = utils.userStatus.getAll.getData();

        utils.userStatus.getAll.setData(undefined, (old) => {
          const rows = old ? [...old] : [];
          const existingIndex = rows.findIndex(
            (s) => s.topicId === input.topicId,
          );
          if (existingIndex >= 0) {
            rows[existingIndex] = {
              ...rows[existingIndex]!,
              level: input.level,
            };
          } else {
            rows.push({
              id: -input.topicId,
              userId: "",
              topicId: input.topicId,
              level: input.level,
              createdAt: new Date(),
              updatedAt: null,
            });
          }
          return rows;
        });

        return { previous };
      },
      onSuccess: (data, vars) => {
        const result = data as { isFirstSet: boolean };
        const input = vars as SetStatusInput;
        if (result.isFirstSet) return;
        const name = getTopicName(input.topicId);
        if (name) {
          addToast({ topicId: input.topicId, topicName: name });
        }
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as { previous?: StatusRow[] } | undefined;
        if (context?.previous) {
          utils.userStatus.getAll.setData(undefined, context.previous);
        }
      },
      refresh: [
        () => utils.userStatus.getAll.invalidate(),
        () => utils.feedback.getRecentTransitions.invalidate(),
        () => utils.feedback.getTransitionsByTopic.invalidate(),
      ],
    },
  );

  const removeStatus = useAppMutation(
    (opts: RemoveStatusMutationOptions) =>
      api.userStatus.remove.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as RemoveStatusInput;
        await utils.userStatus.getAll.cancel();
        const previous = utils.userStatus.getAll.getData();
        utils.userStatus.getAll.setData(undefined, (old) =>
          (old ?? []).filter((s) => s.topicId !== input.topicId),
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as { previous?: StatusRow[] } | undefined;
        if (context?.previous) {
          utils.userStatus.getAll.setData(undefined, context.previous);
        }
      },
      refresh: [
        () => utils.userStatus.getAll.invalidate(),
        () => utils.feedback.getRecentTransitions.invalidate(),
        () => utils.feedback.getTransitionsByTopic.invalidate(),
      ],
    },
  );

  return { setStatus, removeStatus };
}
