import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export function useActivePath(): string {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onStart = (url: string) => setPending(url);
    const onDone = () => setPending(null);
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onDone);
    router.events.on("routeChangeError", onDone);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onDone);
      router.events.off("routeChangeError", onDone);
    };
  }, [router.events]);

  const raw = pending ?? router.asPath;
  return raw.split(/[?#]/, 1)[0]!;
}
