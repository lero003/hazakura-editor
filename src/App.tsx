import { useAppShellController } from "./hooks/app/useAppShellController";
import { AppShell } from "./components/app/AppShell";

export default function App() {
  return <AppShell {...useAppShellController()} />;
}
