// src/data/types.ts
export type UserRole = "admin" | "lecturer" | "student";

export interface AccountRecord {
  id: string;
  email: string;
  role: UserRole;
  student_id: string | null;
  created_at?: string;
  updated_at?: string;
}

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

/**
 * Lecturer record stored in Supabase `lecturers` table.
 * Vector 512-D embedding is computed by Desktop AI pipeline and updated separately.
 */
export interface Lecturer {
  id: string;
  lecturer_code: string;
  full_name: string;
  department?: string | null;
  avatar_url?: string | null;
  embedding?: number[] | null;
  created_at?: string;
}

/**
 * Pending student record stored in the `pending_students` Supabase table.
 * Used by Task 4.1 — the student self-service portal submits a webcam
 * snapshot together with MSSV / Họ tên / Lớp and an admin must Approve
 * (or Reject) the record before it is promoted to the main `students` table.
 */
export type PendingStudentStatus = "pending" | "approved" | "rejected";

export interface PendingStudentRecord {
  id: string;
  student_id: string;
  full_name: string;
  class_name?: string | null;
  email?: string | null;
  portrait_url: string;
  status: PendingStudentStatus;
  submitted_by?: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
  created_at?: string;
  updated_at?: string;
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
  iso?: string,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (isNaN(time)) return false;

  if (dateFrom && dateFrom.trim() !== "") {
    const from = new Date(`${dateFrom}T00:00:00+07:00`).getTime();
    if (!isNaN(from) && time < from) return false;
  }

  if (dateTo && dateTo.trim() !== "") {
    const to = new Date(`${dateTo}T23:59:59.999+07:00`).getTime();
    if (!isNaN(to) && time > to) return false;
  }

  return true;
}
