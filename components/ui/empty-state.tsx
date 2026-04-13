import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateAction {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
}

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: EmptyStateAction;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && (
        action.href ? (
          <Button asChild className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
