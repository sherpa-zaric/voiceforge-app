import { Inbox } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

interface EmptyProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({
  message = 'No data',
  description,
  icon,
  action,
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex h-[50vh] w-full flex-col items-center justify-center gap-3',
        className
      )}
    >
      {icon || (
        <Inbox className="text-muted-foreground h-12 w-12" />
      )}
      <div className="text-center">
        <p className="text-foreground font-medium">{message}</p>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
