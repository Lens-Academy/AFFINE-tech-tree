import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { bookmarkRouter } from "~/server/api/routers/bookmark";
import { feedbackRouter } from "~/server/api/routers/feedback";
import { topicRouter } from "~/server/api/routers/topic";
import { userStatusRouter } from "~/server/api/routers/userStatus";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  bookmark: bookmarkRouter,
  feedback: feedbackRouter,
  topic: topicRouter,
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
