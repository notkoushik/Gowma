import React from "react"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "rounded"
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({
  variant = "rounded",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-none",
    rounded: "rounded-md",
  }[variant]

  const inlineStyle: React.CSSProperties = {
    ...(width !== undefined
      ? { width: typeof width === "number" ? `${width}px` : width }
      : {}),
    ...(height !== undefined
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  }

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-paper-deep/90 dark:bg-card-border/40 ${variantStyles} ${className}`}
      style={inlineStyle}
      {...props}
    />
  )
}

/**
 * Standard Header/Profile Skeleton for navigation bars and sidebars
 */
export function ProfileSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton variant="text" className="h-3.5 w-24" />
        <Skeleton variant="text" className="h-2.5 w-16 opacity-70" />
      </div>
    </div>
  )
}

/**
 * Standard Card Skeleton for grid views and dashboards
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-4 rounded-lg border border-line bg-card space-y-3 ${className}`}
    >
      <Skeleton variant="text" className="h-5 w-1/3" />
      <Skeleton variant="rectangular" className="h-24 w-full rounded" />
      <div className="flex gap-2">
        <Skeleton variant="text" className="h-4 w-1/4" />
        <Skeleton variant="text" className="h-4 w-1/4" />
      </div>
    </div>
  )
}

/**
 * Standard Table Row Skeleton
 */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-line animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton
            variant="text"
            className={`h-4 ${i === 0 ? "w-28" : "w-20"}`}
          />
        </td>
      ))}
    </tr>
  )
}

export default Skeleton
