// src/data/types.ts
export type VisitStatus =
  | "Served"
  | "Waiting"
  | "Unattended"
  | "Exited"
  | "Unknown";

export type CameraStatus = "Connected" | "Offline";

export interface VisitRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  status: VisitStatus;
  cameraId: string;
  enteredAt: string; // ISO 8601, +07:00
  servedAt?: string;
  exitedAt?: string;
  durationSeconds: number;
  waitSeconds: number;
  avatarUrl?: string;
}

export interface StudentSummary {
  studentId: string;
  name: string;
  className: string;
  totalVisits: number;
  servedCount: number;
  avgWaitSecs: number;
  lastSeen: string; // ISO
  lastCameraId: string;
  currentlyInArea: boolean;
  currentStatus?: VisitStatus;
  currentWaitSeconds?: number;
}

export interface CameraOption {
  id: string;
  label: string;
  fps: number;
  status: CameraStatus;
}

export type VisitSortKey =
  | "studentId"
  | "studentName"
  | "className"
  | "cameraId"
  | "enteredAt"
  | "exitedAt"
  | "waitSeconds"
  | "durationSeconds"
  | "status";

export type StudentSortKey =
  | "totalVisits"
  | "lastSeen"
  | "avgWaitSecs"
  | "servedRate";

export type SortDirection = "asc" | "desc";

export interface Insight {
  title: string;
  value: string;
  description: string;
}

export function isWaitingTooLong(
  status: VisitStatus | undefined,
  waitSeconds: number | undefined,
  thresholdSeconds = 300,
): boolean {
  return status === "Waiting" && (waitSeconds ?? 0) > thresholdSeconds;
}

export function fmtDuration(totalSeconds: number): string {
  const total = Math.floor(totalSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${seconds}s`;
}

export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const d = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${d} ${fmtTime(iso)}`;
}


export function isWithinDateRange(
  iso: string,
  dateFrom: string,
  dateTo: string,
): boolean {
  const time = new Date(iso).getTime();
  const from = new Date(`${dateFrom}T00:00:00+07:00`).getTime();
  const to = new Date(`${dateTo}T23:59:59.999+07:00`).getTime();
  return time >= from && time <= to;
}
