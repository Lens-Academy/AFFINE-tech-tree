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
      // Swap db/index (libsql, node-only) for db/cf (D1) at CF build time so
      // the file tracer never sees @libsql/client and esbuild can bundle cleanly.
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        [path.resolve(__dirname, "src/server/db/index")]: path.resolve(
          __dirname,
          "src/server/db/cf.ts",
        ),
      };
    }
    return webpackConfig;
  },
};

export default config;
