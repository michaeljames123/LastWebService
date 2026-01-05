import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Props) {
  const cls = ["btn", `btn-${variant}`, `btn-${size}`, className]
    .filter(Boolean)
    .join(" ");

  return <button className={cls} {...props} />;
}
