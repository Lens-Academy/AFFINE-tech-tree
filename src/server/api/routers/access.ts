import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const accessRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    const sessionUser = ctx.session?.user;
    if (!sessionUser) {
      return {
        isSignedIn: false,
        isApproved: false,
        isPendingApproval: false,
        isAdmin: false,
        user: null,
      };
    }

    const dbUser = await ctx.db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, sessionUser.id),
      columns: {
        id: true,
        name: true,
        email: true,
        isApproved: true,
      },
      with: {
        roles: {
          columns: { id: true },
          where: (r, { eq }) => eq(r.role, "admin"),
        },
      },
    });

    const isAdmin = (dbUser?.roles.length ?? 0) > 0;

    const isApproved = dbUser?.isApproved ?? false;
    return {
      isSignedIn: true,
      isApproved,
      isPendingApproval: !isApproved,
      isAdmin,
      user: dbUser
        ? { id: dbUser.id, name: dbUser.name, email: dbUser.email }
        : {
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
          },
    };
  }),
});
