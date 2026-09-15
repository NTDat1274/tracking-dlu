// src/web/components/StatusBadge.tsx
// Standardized DLU Brand Status Badges:
// 1. Served (Đã phục vụ - Xanh DLU #9ABE26)
// 2. Waiting (Đang chờ - Cam DLU #FFA12D)
// 3. Unattended (Chưa phục vụ / Quá hạn - Đỏ DLU #E2231A)

import type { VisitStatus, CameraStatus } from "../../data/types";

export type NormalizedStatus = "Served" | "Waiting" | "Unattended" | CameraStatus;

interface StatusConfig {
  icon: string;
  className: string;
  label: string;
}

const CONFIG: Record<string, StatusConfig> = {
  Served: {
    icon: "✓",
    className: "bg-[#9ABE26]/15 text-[#9ABE26] border-[#9ABE26]/40",
    label: "Served",
  },
  Waiting: {
    icon: "⏱",
    className: "bg-[#FFA12D]/15 text-[#FFA12D] border-[#FFA12D]/40",
    label: "Waiting",
  },
  Unattended: {
    icon: "✗",
    className: "bg-[#E2231A]/15 text-[#E2231A] border-[#E2231A]/40",
    label: "Unattended",
  },
  Connected: {
    icon: "●",
    className: "bg-[#9ABE26]/15 text-[#9ABE26] border-[#9ABE26]/40",
    label: "Connected",
  },
  Offline: {
    icon: "○",
    className: "bg-[#E2231A]/15 text-[#E2231A] border-[#E2231A]/40",
    label: "Offline",
  },
};

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-xs select-none ${cfg.className}`}
    >
      <span aria-hidden="true" className="font-bold">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
