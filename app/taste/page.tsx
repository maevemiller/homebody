"use client";

import dynamic from "next/dynamic";
import { use } from "react";

// The scripted conversation resumes from this browser and reads what Space Capture left there, so it renders client-side only
const TasteConversation = dynamic(() => import("@/components/TasteConversation"), { ssr: false });
// The screen-per-question flow, kept at /taste?mode=screens to compare
const TasteFlow = dynamic(() => import("@/components/TasteFlow"), { ssr: false });
// The designer's intake interview with the live dossier: the default
const TasteStudio = dynamic(() => import("@/components/taste/TasteStudio"), { ssr: false });

export default function Taste({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { mode } = use(searchParams);
  // ?mode=classic keeps the scripted Phase 0 conversation to compare
  return mode === "screens" ? <TasteFlow /> : mode === "classic" ? <TasteConversation /> : <TasteStudio />;
}
