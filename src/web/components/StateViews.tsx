// src/web/components/StateViews.tsx
interface ActionProps {
  label: string;
  onClick: () => void;
}

function Shell({
  icon,
  message,
  action,
  tone = "default",
}: {
  icon: string;
  message: string;
  action?: ActionProps;
  tone?: "default" | "error" | "offline";
}) {
  const toneClass =
    tone === "error" ? "text-offline" : tone === "offline" ? "text-waiting-color" : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <span aria-hidden="true" className={`text-3xl ${toneClass}`}>
        {icon}
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="focus-ring rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function LoadingState({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-12 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
      />
      {message}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ActionProps }) {
  return <Shell icon="□" message={message} action={action} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Shell icon="!" message={message} tone="error" action={{ label: "Thử lại", onClick: onRetry }} />;
}

export function NoResultState({ message, onReset }: { message: string; onReset: () => void }) {
  return <Shell icon="⌕" message={message} action={{ label: "Xóa bộ lọc", onClick: onReset }} />;
}

export function OfflineState({ message }: { message: string }) {
  return <Shell icon="○" message={message} tone="offline" />;
}
