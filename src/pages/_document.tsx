import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    // avoids flash of white background
    <Html lang="en" style={{ backgroundColor: "#09090b" }}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
