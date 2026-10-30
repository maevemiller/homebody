"use client";

import { usePathname } from "next/navigation";

// The capture flow at "/" and Taste Builder at "/taste" have their own progress bar, and Plug & Play is full-screen; site chrome would only compete
export default function HideOnFlow({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/" || path === "/taste" || path.startsWith("/play/") ? null : <>{children}</>;
}
