import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import type { SourceStatus } from "@/types/library";

const statusConfig = {
  queued: {
    label: "Queued",
    className: "bg-amber-brand/20 text-amber-900",
    icon: Clock3,
  },
  processing: {
    label: "Reading",
    className: "bg-ink/8 text-moss",
    icon: LoaderCircle,
  },
  ready: {
    label: "Ready",
    className: "bg-lime text-ink",
    icon: CheckCircle2,
  },
  failed: {
    label: "Needs attention",
    className: "bg-clay/15 text-clay",
    icon: AlertCircle,
  },
} satisfies Record<
  SourceStatus,
  { label: string; className: string; icon: typeof Clock3 }
>;

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      <Icon
        size={12}
        className={status === "processing" ? "animate-spin" : undefined}
      />
      {config.label}
    </span>
  );
}
