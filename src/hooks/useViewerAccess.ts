import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";

export function useViewerAccess() {
  const session = authClient.useSession();
  const access = api.access.me.useQuery();

  const rawUser = session.data?.user ?? null;
  const isApproved = rawUser ? (access.data?.isApproved ?? false) : false;
  const viewerUser = rawUser && isApproved ? rawUser : null;
  const isPendingApproval = !!rawUser && !isApproved;

  return {
    rawUser,
    viewerUser,
    isPending: session.isPending || (!!rawUser && access.isLoading),
    isPendingApproval,
    isAdmin: access.data?.isAdmin ?? false,
  };
}
