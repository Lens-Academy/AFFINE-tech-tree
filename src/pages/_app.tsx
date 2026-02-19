import { type AppType } from "next/app";
import { Geist } from "next/font/google";

import { ToastContainer } from "~/components/Toast";
import { ToastProvider } from "~/hooks/useToastStore";
import { api } from "~/utils/api";

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ToastProvider>
      <div className={geist.className}>
        <ToastContainer />
        <Component {...pageProps} />
      </div>
    </ToastProvider>
  );
};

export default api.withTRPC(MyApp);
