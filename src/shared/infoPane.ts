// To release a new info pane, append a new entry here. The last entry is the
// "current" version: anyone whose stored infoPaneClosedVersion differs from it
// (including NULL for new users) will see the pane until they close it.
export const INFO_PANE_VERSIONS = [
  {
    version: "v1",
    content:
      "This app is a collection of concepts which might be key to aligning superintelligence, along with resources to learn them. Some of these resources are people! If you mark yourself as understanding something, people who match with you who want to learn it are recommended that topic, and you'll appear in the general concept listing for your cohort (online, in-person, etc). Browse around and find features!",
  },
] as const;

export const INFO_PANE_CURRENT =
  INFO_PANE_VERSIONS[INFO_PANE_VERSIONS.length - 1]!;

export function shouldShowInfoPane(closedVersion: string | null | undefined) {
  return (closedVersion ?? "") !== INFO_PANE_CURRENT.version;
}
