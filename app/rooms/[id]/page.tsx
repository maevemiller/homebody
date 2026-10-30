import RoomView from "@/components/RoomView";

export default async function RoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dev?: string }> }) {
  const { id } = await params;
  // ?dev=1 shows the build tools; never in production
  const dev = process.env.NODE_ENV !== "production" && (await searchParams).dev === "1";
  return <RoomView id={id} dev={dev} />;
}
