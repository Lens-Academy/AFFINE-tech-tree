import { useEffect, useState } from "react";

const CHANGE_EVENT = "affine:local-storage-boolean-change";
const memoryValues = new Map<string, boolean>();

function readBoolean(key: string, defaultValue: boolean) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // Fall back to the in-memory value below when storage is blocked.
  }
  return memoryValues.get(key) ?? defaultValue;
}

export function useLocalStorageBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const syncValue = () => {
      setValue(readBoolean(key, defaultValue));
      setIsLoaded(true);
    };

    syncValue();
    window.addEventListener("storage", syncValue);
    window.addEventListener(CHANGE_EVENT, syncValue);

    return () => {
      window.removeEventListener("storage", syncValue);
      window.removeEventListener(CHANGE_EVENT, syncValue);
    };
  }, [defaultValue, key]);

  function updateValue(nextValue: boolean) {
    memoryValues.set(key, nextValue);
    setValue(nextValue);
    setIsLoaded(true);
    try {
      window.localStorage.setItem(key, String(nextValue));
    } catch {
      // Keep the in-memory preference for the current page if storage is blocked.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return [value, updateValue, isLoaded] as const;
}
