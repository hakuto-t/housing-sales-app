"use client";

import * as React from "react";

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...props }, ref) => {
    if (React.isValidElement<Record<string, unknown>>(children)) {
      const childProps = children.props as Record<string, unknown>;
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        ...props,
        ...(childProps as object),
        ref: ref,
        style: {
          ...(props.style as object),
          ...(childProps.style as object),
        },
        className: `${props.className ?? ""} ${(childProps.className as string) ?? ""}`.trim(),
      });
    }

    if (React.Children.count(children) > 1) {
      React.Children.only(null);
    }

    return null;
  }
);
Slot.displayName = "Slot";

export { Slot };
