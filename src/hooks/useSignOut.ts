import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "~/server/better-auth/client";

/**
 * Signs out and drops all cached query data so stale authenticated
 * responses (e.g. the profile page you were viewing) disappear
 * immediately instead of lingering until navigation.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
  };
}
