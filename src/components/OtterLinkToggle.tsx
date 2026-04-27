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
      label="Show Record"
      onClick={() => setVisible(!visible)}
      title={
        visible
          ? "Hide the Record header button on this device"
          : "Show the Record header button on this device"
      }
    />
  );
}
