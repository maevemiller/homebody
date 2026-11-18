import PlayEditor from "@/components/play/PlayEditor";

export const metadata = { title: "Plug & Play · Homebody" };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  // ?from=brief: arriving from the confirmed brief, so the three-step walkthrough shows (once, skippable)
  return <PlayEditor id={id} fromBrief={from === "brief"} />;
}
