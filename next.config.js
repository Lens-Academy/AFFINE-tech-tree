/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "path";
import { fileURLToPath } from "url";

initOpenNextCloudflareForDev();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  webpack: (webpackConfig) => {
    if (process.env.BUILDING_FOR_CF) {
      // Swap all server db entry specifiers to db/cf at CF build time so
      // the file tracer never sees @libsql/client and esbuild can bundle cleanly.
      const cfDbEntry = path.resolve(__dirname, "src/server/db/cf.ts");
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        "~/server/db$": cfDbEntry,
        "~/server/db/index$": cfDbEntry,
        [`${path.resolve(__dirname, "src/server/db")}$`]: cfDbEntry,
        [`${path.resolve(__dirname, "src/server/db/index")}$`]: cfDbEntry,
      };
    }
    return webpackConfig;
  },
};

export default config;
