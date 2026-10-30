"use client";

import dynamic from "next/dynamic";

// The flow restores your progress from this browser, so it renders client-side only
const CaptureFlow = dynamic(() => import("@/components/CaptureFlow"), { ssr: false });

export default function Home() {
  return <CaptureFlow />;
}
