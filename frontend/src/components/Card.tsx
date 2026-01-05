import React from "react";

type Variant = "default" | "strong";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
};

export default function Card({ variant = "default", className, ...props }: Props) {
  const cls = [
    "surface",
    variant === "strong" ? "surface-strong" : "",
    "card",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls} {...props} />;
}
