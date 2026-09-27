import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Fintrox", description: "Accounting platform" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="bg"><body>{children}</body></html>;
}
