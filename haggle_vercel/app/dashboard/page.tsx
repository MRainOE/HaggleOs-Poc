import type { Metadata } from "next";
import DashboardClient from "./dashboard_client";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "HaggleOS Dashboard",
  description: "Deal analysis + negotiation coach for eBay listings.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
