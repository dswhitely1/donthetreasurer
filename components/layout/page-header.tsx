import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
}
