import { useEffect, useState } from "react";

import { createResidentPhotoUrls } from "./data";

/**
 * Resolves signed URLs for private resident photos, keyed by storage path.
 *
 * The effect is keyed on the *set* of paths rather than the array identity, so
 * re-renders that don't change the photos never trigger a fresh signing request.
 * Missing or unreadable photos simply resolve to no entry, and the avatar falls
 * back to the resident's initials.
 */
export function useResidentPhotoUrls(
  paths: Array<string | null | undefined>,
): Map<string, string> {
  const key = paths
    .filter((path): path is string => Boolean(path))
    .sort()
    .join("\n");

  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const wanted = key ? key.split("\n") : [];
    if (wanted.length === 0) {
      setUrls(new Map());
      return;
    }

    let active = true;
    void createResidentPhotoUrls(wanted).then((map) => {
      if (active) setUrls(map);
    });

    return () => {
      active = false;
    };
  }, [key]);

  return urls;
}
