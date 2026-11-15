import PlayEditor from "@/components/play/PlayEditor";

export const metadata = { title: "Plug & Play · Homebody" };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  return <PlayEditor id={id} fromBrief={from === "brief"} />;
}
