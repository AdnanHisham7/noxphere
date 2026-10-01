// src/components/common/ScrollToTop.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Automatically scrolls the browser window and all internal scrollable
 * layout containers (such as <main className="overflow-y-auto">) to the top
 * whenever the user navigates to a new page or URL route.
 */
export const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // 1. Reset standard browser window and document scroll
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }

    // 2. Reset any internal overflow containers (like MainLayout's <main>)
    const scrollContainers = document.querySelectorAll<HTMLElement>(
      "main, .overflow-y-auto, [data-scroll-container]"
    );
    scrollContainers.forEach((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
