import { AppProvider } from "@/components/sites/ai-explore-poker-820d0558/app-context";
import { AppShell } from "@/components/sites/ai-explore-poker-820d0558/shell";

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
