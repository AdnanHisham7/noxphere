// src/hooks/usePagination.ts
import { useState } from 'react';

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const scrollContainers = document.querySelectorAll<HTMLElement>(
    'main, .overflow-y-auto, [data-scroll-container]'
  );
  scrollContainers.forEach((container) => {
    container.scrollTop = 0;
  });
};

export const usePagination = (initialPage = 1, initialLimit = 20) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const nextPage = () => {
    setPage((p) => p + 1);
    scrollToTop();
  };
  const prevPage = () => {
    setPage((p) => Math.max(1, p - 1));
    scrollToTop();
  };
  const goToPage = (p: number) => {
    setPage(p);
    scrollToTop();
  };
  const reset = () => {
    setPage(1);
    scrollToTop();
  };

  return { page, limit, setLimit, nextPage, prevPage, goToPage, reset };
};