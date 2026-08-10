import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ children, title, className }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);

    if (!title) {
      return <>{children}</>;
    }

    return (
      <div
        ref={ref}
        className={cn("relative inline-block", className)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        {isVisible && (
          <div
            className="absolute z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none"
            style={{
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {title}
            <div
              className="absolute top-full left-1/2 transform -translate-x-1/2"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid rgb(17 24 39)",
              }}
            />
          </div>
        )}
      </div>
    );
  }
);

Tooltip.displayName = "Tooltip";

