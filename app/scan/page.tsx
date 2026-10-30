import { redirect } from "next/navigation";

// Capture now starts from the home page, one question at a time
export default function ScanPage() {
  redirect("/");
}
