import type { Metadata } from "next";
import { CareerPageClient } from "./career-page-client";

export const metadata: Metadata = {
  title: "Career Intelligence",
  description: "Grounded Career Intelligence for your target role, resume, and stored Parth Careers market data.",
  robots: { index: false, follow: false },
};

export default function CareerPage() {
  return <CareerPageClient />;
}
