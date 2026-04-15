import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { accessRouter } from "~/server/api/routers/access";
import { adminRouter } from "~/server/api/routers/admin";
import { availabilityRouter } from "~/server/api/routers/availability";
import { bookmarkRouter } from "~/server/api/routers/bookmark";
import { excitedToTeachRouter } from "~/server/api/routers/excitedToTeach";
import { feedbackRouter } from "~/server/api/routers/feedback";
import { topicRouter } from "~/server/api/routers/topic";
import { userProfileRouter } from "~/server/api/routers/userProfile";
import { userStatusRouter } from "~/server/api/routers/userStatus";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  access: accessRouter,
  admin: adminRouter,
  availability: availabilityRouter,
  bookmark: bookmarkRouter,
  excitedToTeach: excitedToTeachRouter,
  feedback: feedbackRouter,
  topic: topicRouter,
  userProfile: userProfileRouter,
  userStatus: userStatusRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.topic.list();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
