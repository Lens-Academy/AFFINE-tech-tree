import { z } from "zod";

export const USER_SEGMENTS = ["sas", "online_sas", "barycenter"] as const;

export const userSegmentSchema = z.enum(USER_SEGMENTS);

export type UserSegment = z.infer<typeof userSegmentSchema>;

export const USER_SEGMENT_LABELS: Record<UserSegment, string> = {
  sas: "SAS",
  online_sas: "Online SAS",
  barycenter: "BARYCENTER",
};

export function getSegmentLabel(segment: string | null | undefined): string {
  if (!segment) return "Unassigned";
  return segment in USER_SEGMENT_LABELS
    ? USER_SEGMENT_LABELS[segment as UserSegment]
    : segment;
}
