"use client";

import React from "react";

const FALLBACK_SRC = "/images/clay-engineer-avatar.png";

/**
 * Renders the engineer's personal photo stored server-side.
 * `version` is a cache-buster: bumping it remounts the component (via key),
 * so no setState-in-effect is needed to reset the fallback flag.
 */
export function ProfilePhoto({
  alt,
  className,
  imgClassName,
  version = 0,
}: {
  alt: string;
  className?: string;
  imgClassName?: string;
  version?: number;
}) {
  return (
    <img
      key={version}
      src={version > 0 ? `/api/workspace/photo?v=${version}` : "/api/workspace/photo"}
      alt={alt}
      className={imgClassName || className}
      loading="lazy"
      onError={(event) => {
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = "1";
        img.src = FALLBACK_SRC;
      }}
    />
  );
}
