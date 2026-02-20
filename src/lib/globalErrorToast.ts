type ErrorToastListener = (message: string) => void;

let listener: ErrorToastListener | null = null;

export function registerGlobalErrorToast(next: ErrorToastListener) {
  listener = next;
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function showGlobalErrorToast(message: string) {
  listener?.(message);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
