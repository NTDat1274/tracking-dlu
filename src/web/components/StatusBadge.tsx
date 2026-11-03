// src/web/components/StatusBadge.tsx
// Standardized DLU Brand Status Badges:
// 1. Served (Đã phục vụ - Xanh DLU #9ABE26)
// 2. Waiting (Đang chờ - Cam DLU #FFA12D)
// 3. Unattended (Chưa phục vụ / Quá hạn - Đỏ DLU #E2231A)

import type { VisitStatus, CameraStatus } from "../../data/types";

export type NormalizedStatus = "Served" | "Waiting" | "Unattended" | CameraStatus;

interface StatusConfig {
  icon: React.ReactNode;
  className: string;
  label: string;
}

const CONFIG: Record<string, StatusConfig> = {
  Served: {
    icon: <CheckCircle2 size={14} className="shrink-0" />,
    className: "bg-primary/15 text-primary border-primary/40",
    label: "Đã tiếp nhận",
  },
  Waiting: {
    icon: <Clock size={14} className="shrink-0" />,
    className: "bg-secondary/15 text-secondary border-secondary/40",
    label: "Đang chờ",
  },
  Unattended: {
    icon: <XCircle size={14} className="shrink-0" />,
    className: "bg-offline/15 text-offline border-offline/40",
    label: "Chưa tiếp nhận",
  },
  Connected: {
    icon: <HelpCircle size={14} className="shrink-0" />,
    className: "bg-primary/15 text-primary border-primary/40",
    label: "Đã kết nối",
  },
  Offline: {
    icon: <Circle size={14} className="shrink-0" />,
    className: "bg-offline/15 text-offline border-offline/40",
    label: "Mất kết nối",
  },
};

import { CheckCircle2, Clock, XCircle, HelpCircle, Circle } from "lucide-react";

export default function StatusBadge({ status }: { status: VisitStatus | CameraStatus | string }) {
  // Normalize any legacy status values into one of the 3 standard DLU statuses
  let normalized = status;
  if (status === "Exited" || status === "Unknown") {
    normalized = "Waiting";
  }

  const cfg = CONFIG[normalized] || CONFIG.Waiting;

  return (
    <span
      role="status"
      aria-label={cfg.label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-xs select-none whitespace-nowrap shrink-0 transition-all duration-200 hover:scale-[1.03] cursor-default shadow-2xs ${cfg.className}`}
    >
      <span aria-hidden="true" className="font-bold transition-transform duration-200">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
