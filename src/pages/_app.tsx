import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { useEffect, useRef, useState } from "react";

import { registerGlobalErrorToast } from "~/lib/globalErrorToast";
import { api } from "~/utils/api";

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const hideToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const unregister = registerGlobalErrorToast((message) => {
      setErrorToast(message);
      if (hideToastTimeoutRef.current) {
        clearTimeout(hideToastTimeoutRef.current);
      }
      hideToastTimeoutRef.current = setTimeout(() => {
        setErrorToast(null);
        hideToastTimeoutRef.current = null;
      }, 4500);
    });
    return () => {
      unregister();
      if (hideToastTimeoutRef.current) {
        clearTimeout(hideToastTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={geist.className}>
      <Component {...pageProps} />
      {errorToast && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-100">
          <div className="max-w-sm rounded border border-red-500/40 bg-zinc-900 px-3 py-2 text-sm text-red-300 shadow-lg">
            {errorToast}
          </div>
        </div>
      )}
    </div>
  );
};

export default api.withTRPC(MyApp);
