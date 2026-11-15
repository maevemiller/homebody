import CheckoutPlan from "@/components/checkout/CheckoutPlan";

export const metadata = { title: "Review and buy · Homebody" };

// /checkout/<room id> for one room, /checkout/all for every room with a Plug & Play layout in this browser
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutPlan id={id} />;
}
