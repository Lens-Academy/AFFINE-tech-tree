import { describe, expect, it, vi } from "vitest";

import { useAppMutation } from "./useAppMutation";

type FakeMutationOptions = {
  onSuccess?: (
    data: { ok: boolean },
    vars: { id: number },
    ctx: { previous: number[] } | undefined,
  ) => Promise<void> | void;
  onError?: (
    error: Error,
    vars: { id: number },
    ctx: { previous: number[] } | undefined,
  ) => Promise<void> | void;
  onSettled?: (
    data: { ok: boolean } | undefined,
    error: Error | null,
    vars: { id: number },
    ctx: { previous: number[] } | undefined,
  ) => Promise<void> | void;
  onMutate?: (vars: {
    id: number;
  }) => Promise<{ previous: number[] }> | { previous: number[] };
};

describe("useAppMutation", () => {
  it("runs refresh tasks on settled by default", async () => {
    const refresh = vi.fn();
    const opts = useAppMutation<FakeMutationOptions, FakeMutationOptions>(
      (options) => options,
      { refresh: [refresh] },
    );

    await opts.onSuccess?.({ ok: true }, { id: 1 }, undefined);
    expect(refresh).toHaveBeenCalledTimes(0);

    await opts.onSettled?.({ ok: true }, null, { id: 1 }, undefined);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("runs refresh tasks on success when refreshOn is success", async () => {
    const refresh = vi.fn();
    const opts = useAppMutation<FakeMutationOptions, FakeMutationOptions>(
      (options) => options,
      { refresh: [refresh], refreshOn: "success" },
    );

    await opts.onSuccess?.({ ok: true }, { id: 1 }, undefined);
    expect(refresh).toHaveBeenCalledTimes(1);

    await opts.onSettled?.({ ok: true }, null, { id: 1 }, undefined);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("forwards lifecycle handlers with args", async () => {
    const onMutate = vi.fn().mockResolvedValue({ previous: [1] });
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    const opts = useAppMutation<FakeMutationOptions, FakeMutationOptions>(
      (options) => options,
      { onMutate, onSuccess, onError, onSettled },
    );

    const vars = { id: 7 };
    const ctx = await opts.onMutate?.(vars);
    await opts.onSuccess?.({ ok: true }, vars, ctx);
    await opts.onError?.(new Error("boom"), vars, ctx);
    await opts.onSettled?.(undefined, null, vars, ctx);

    expect(onMutate).toHaveBeenCalledWith(vars);
    expect(onSuccess).toHaveBeenCalledWith({ ok: true }, vars, ctx);
    expect(onError).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(undefined, null, vars, ctx);
  });
});
