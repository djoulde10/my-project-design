import { ReactNode } from "react";
import AIAssistant from "@/components/AIAssistant";
import FloatingRecordingWidget from "@/components/FloatingRecordingWidget";
import { RecordingProvider } from "@/contexts/RecordingContext";

export default function AuthenticatedAppShell({ children }: { children: ReactNode }) {
  return (
    <RecordingProvider>
      {children}
      <AIAssistant />
      <FloatingRecordingWidget />
    </RecordingProvider>
  );
}