import { getErrorMessage, showGlobalErrorToast } from "~/lib/globalErrorToast";

type MaybePromise<T> = T | Promise<T>;

type MutationCallbacks<TData, TError, TVariables, TContext> = {
  onMutate?: (variables: TVariables) => MaybePromise<TContext | undefined>;
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext,
  ) => MaybePromise<void>;
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined,
  ) => MaybePromise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => MaybePromise<void>;
};

type RefreshTask = () => MaybePromise<unknown>;

type AppMutationConfig<TData, TError, TVariables, TContext> = MutationCallbacks<
  TData,
  TError,
  TVariables,
  TContext
> & {
  refresh?: RefreshTask[];
  refreshOn?: "success" | "settled";
  disableDefaultErrorToast?: boolean;
};

async function runRefreshTasks(tasks: RefreshTask[] | undefined) {
  if (!tasks || tasks.length === 0) return;
  await Promise.all(tasks.map((task) => Promise.resolve(task())));
}

type DataOf<TMutationOptions> = TMutationOptions extends {
  onSuccess?: (
    data: infer TData,
    variables: unknown,
    context: unknown,
  ) => unknown;
}
  ? TData
  : unknown;

type VariablesOf<TMutationOptions> = TMutationOptions extends {
  onMutate?: (variables: infer TVariables, ...args: unknown[]) => unknown;
}
  ? TVariables
  : TMutationOptions extends {
        onSuccess?: (
          data: unknown,
          variables: infer TVariables,
          context: unknown,
        ) => unknown;
      }
    ? TVariables
    : unknown;

type ErrorOf<TMutationOptions> = TMutationOptions extends {
  onError?: (
    error: infer TError,
    variables: unknown,
    context: unknown,
  ) => unknown;
}
  ? TError
  : unknown;

type ContextOf<TMutationOptions> = TMutationOptions extends {
  onSuccess?: (
    data: unknown,
    variables: unknown,
    context: infer TContext,
  ) => unknown;
}
  ? TContext
  : TMutationOptions extends {
        onError?: (
          error: unknown,
          variables: unknown,
          context: infer TContext,
        ) => unknown;
      }
    ? TContext
    : unknown;

type MutationFactory<TOptions, TReturn> = (opts: TOptions) => TReturn;

/**
 * Thin wrapper to keep mutation lifecycle callbacks consistent across the app.
 * It centralizes invalidate/refetch orchestration while preserving per-mutation custom logic.
 */
export function useAppMutation<TOptions, TReturn>(
  createMutation: MutationFactory<TOptions, TReturn>,
  config: AppMutationConfig<
    DataOf<Exclude<TOptions, undefined>>,
    ErrorOf<Exclude<TOptions, undefined>>,
    VariablesOf<Exclude<TOptions, undefined>>,
    ContextOf<Exclude<TOptions, undefined>>
  > = {},
): TReturn {
  type TResolvedOptions = Exclude<TOptions, undefined>;
  type TData = DataOf<TResolvedOptions>;
  type TError = ErrorOf<TResolvedOptions>;
  type TVariables = VariablesOf<TResolvedOptions>;
  type TContext = ContextOf<TResolvedOptions>;

  const refreshOn = config.refreshOn ?? "settled";

  const callbacks = {
    onMutate: async (vars: TVariables) => {
      return config.onMutate?.(vars);
    },
    onSuccess: async (data: TData, vars: TVariables, ctx: TContext) => {
      await config.onSuccess?.(data, vars, ctx);
      if (refreshOn === "success") {
        await runRefreshTasks(config.refresh);
      }
    },
    onError: async (
      error: TError,
      vars: TVariables,
      ctx: TContext | undefined,
    ) => {
      await config.onError?.(error, vars, ctx);
      if (!config.onError && !config.disableDefaultErrorToast) {
        showGlobalErrorToast(getErrorMessage(error, "Something went wrong."));
      }
    },
    onSettled: async (
      data: TData | undefined,
      error: TError | null,
      vars: TVariables,
      ctx: TContext | undefined,
    ) => {
      await config.onSettled?.(data, error, vars, ctx);
      if (refreshOn === "settled") {
        await runRefreshTasks(config.refresh);
      }
    },
  };

  return createMutation(callbacks as unknown as TOptions);
}
