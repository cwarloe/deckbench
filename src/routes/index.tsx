import { createFileRoute } from "@tanstack/react-router";
import { ConverterApp } from "@/components/converter-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ConverterApp />;
}
