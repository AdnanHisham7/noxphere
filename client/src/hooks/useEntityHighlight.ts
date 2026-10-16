// src/hooks/useEntityHighlight.ts
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Hook to automatically find, scroll to, and flash-highlight the target entity element
 * specified by the `?highlight=<entityId>` search parameter.
 */
export function useHighlightEffect(customHighlightId?: string) {
  const [searchParams] = useSearchParams();
  const highlightId = customHighlightId || searchParams.get("highlight");

  useEffect(() => {
    if (!highlightId) return;

    let attempts = 0;
    const maxAttempts = 15; // Retry for ~2.5s if data is still fetching
    let timeoutId: NodeJS.Timeout | null = null;
    let removeHighlightTimer: NodeJS.Timeout | null = null;

    const findAndHighlight = () => {
      attempts++;
      const selector = `[data-highlight-id="${highlightId}"], [data-entity-id="${highlightId}"], [id="entity-${highlightId}"], [id="${highlightId}"]`;
      const el = document.querySelector(selector) as HTMLElement | null;

      if (el) {
        // Smoothly bring the entity into center view
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add highlight flash class
        el.classList.add("entity-highlight-active");

        removeHighlightTimer = setTimeout(() => {
          el.classList.remove("entity-highlight-active");
        }, 1800);
      } else if (attempts < maxAttempts) {
        // Retry with increasing backoff
        const nextDelay = attempts < 5 ? 100 : 250;
        timeoutId = setTimeout(findAndHighlight, nextDelay);
      }
    };

    // First attempt after small initial frame tick
    timeoutId = setTimeout(findAndHighlight, 80);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (removeHighlightTimer) clearTimeout(removeHighlightTimer);
    };
  }, [highlightId]);

  return highlightId;
}

/**
 * Returns true for 1.8s if the given entityId matches the `?highlight` search param.
 */
export function useIsHighlighted(entityId?: string | number): boolean {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (!highlightId || !entityId) {
      setHighlighted(false);
      return;
    }

    if (String(highlightId) === String(entityId)) {
      setHighlighted(true);
      const timer = setTimeout(() => {
        setHighlighted(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [highlightId, entityId]);

  return highlighted;
}
