// src/web/components/AvatarFallback.tsx
// Image components with graceful fallback for portraits and camera snapshots.
import { useState } from "react";
import { Camera } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function StudentAvatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Size mapping
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-base",
    xl: "h-24 w-24 text-xl",
  };

  // Remove diacritics
  const removeDiacritics = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  };

  // Get initials for placeholder
  const initials = name
    ? removeDiacritics(name)
        .trim()
        .split(" ")
        .map((n) => n[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "SV";

  if (!src || hasError) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-semibold text-primary select-none ${sizeClasses[size]} ${className}`}
        title={name}
      >
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className={`shrink-0 rounded-full object-cover border border-border/80 shadow-sm ${sizeClasses[size]} ${className}`}
    />
  );
}

interface SnapshotProps {
  src?: string | null;
  alt?: string;
  className?: string;
  label?: string;
  onClick?: () => void;
}

export function SnapshotImage({ src, alt = "Camera snapshot", className = "", label, onClick }: SnapshotProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground ${className}`}
      >
        <Camera className="mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="text-xs font-medium">{label || "Chưa có ảnh chụp từ camera"}</p>
        <p className="text-[10px] text-muted-foreground/70">Không tìm thấy ảnh trên Cloudinary</p>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-lg border border-border bg-black/40 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
      />
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
          {label}
        </span>
      )}
    </div>
  );
}
