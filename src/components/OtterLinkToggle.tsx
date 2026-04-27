import { ToggleSwitch } from "~/components/ToggleSwitch";
import { useLocalStorageBoolean } from "~/hooks/useLocalStorageBoolean";
import { OTTER_LINK_VISIBLE_STORAGE_KEY } from "~/shared/devicePreferences";

export function OtterLinkToggle() {
  const [visible, setVisible, loaded] = useLocalStorageBoolean(
    OTTER_LINK_VISIBLE_STORAGE_KEY,
    true,
  );

  if (!loaded) return null;

  return (
    <ToggleSwitch
      checked={visible}
      label="Show Otter"
      onClick={() => setVisible(!visible)}
      title={
        visible
          ? "Hide the Otter header button on this device"
          : "Show the Otter header button on this device"
      }
    />
  );
}
