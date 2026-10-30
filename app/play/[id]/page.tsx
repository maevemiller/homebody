import PlayEditor from "@/components/play/PlayEditor";

export const metadata = { title: "Plug & Play · Homebody" };

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayEditor id={id} />;
}
