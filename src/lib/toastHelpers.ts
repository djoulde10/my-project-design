import { toast } from "@/hooks/use-toast";
import { translateError, SUCCESS_MESSAGES, type SuccessKey } from "@/lib/errorMessages";

/**
 * Show a success toast with a standardized message.
 */
export function showSuccess(key: SuccessKey, customDescription?: string) {
  toast({
    title: SUCCESS_MESSAGES[key],
    description: customDescription,
  });
}

/**
 * Show an error toast with an auto-translated user-friendly message.
 * The raw error is logged to console for admin debugging.
 */
export function showError(error: unknown, contextMessage?: string) {
  const userMessage = translateError(error);
  toast({
    title: contextMessage || "Erreur",
    description: userMessage,
    variant: "destructive",
  });
}

/**
 * Show an informational toast (non-error, non-success).
 */
export function showInfo(title: string, description?: string) {
  toast({ title, description });
}
