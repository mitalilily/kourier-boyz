import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
}
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface UseInfiniteScrollOptions<TData, TQueryFnData> {
 
  queryKey: QueryKey;
  queryFn: (params: { page: number; limit: number }) => Promise<TQueryFnData>;
  getItems: (data: TQueryFnData) => TData[];
  getPagination: (data: TQueryFnData) => PaginationMeta | undefined;
  limit?: number;
  enabled?: boolean;
  threshold?: number;
  staleTime?: number;
}

export interface UseInfiniteScrollReturn<TData> {
  items: TData[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  total: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number
  ) => void;
  refetch: () => void;
  isSuccess: boolean;
}

export function useInfiniteScroll<TData, TQueryFnData = unknown>({
  queryKey,
  queryFn,
  getItems,
  getPagination,
  limit = 20,
  enabled = true,
  threshold = 200,
  staleTime = 5 * 60 * 1000, // 5 minutes default
}: UseInfiniteScrollOptions<
  TData,
  TQueryFnData
>): UseInfiniteScrollReturn<TData> {
  const scrollRef = useRef<HTMLDivElement>(null);

  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      return queryFn({ page, limit });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = getPagination(lastPage);
      if (!pagination) return undefined;
      return pagination.hasMore ? pagination.page + 1 : undefined;
    },
    enabled,
    staleTime,
  });

  // Flatten all pages into a single array
  const items = infiniteQuery.data?.pages.flatMap(getItems) ?? [];

  // Get total from the last page's pagination
  const lastPage =
    infiniteQuery.data?.pages[infiniteQuery.data.pages.length - 1];
  const total = lastPage ? getPagination(lastPage)?.total ?? 0 : 0;

  // Handle scroll events
  const handleScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (infiniteQuery.isFetchingNextPage || !infiniteQuery.hasNextPage)
        return;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < threshold) {
        infiniteQuery.fetchNextPage();
      }
    },
    [infiniteQuery, threshold]
  );

  // Auto-attach scroll listener to scrollRef
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const onScroll = () => {
      handleScroll(
        scrollElement.scrollTop,
        scrollElement.scrollHeight,
        scrollElement.clientHeight
      );
    };

    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", onScroll);
  }, [handleScroll]);

  return {
    items,
    isLoading: infiniteQuery.isLoading,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: infiniteQuery.hasNextPage ?? false,
    error: infiniteQuery.error as Error | null,
    fetchNextPage: infiniteQuery.fetchNextPage,
    total,
    scrollRef,
    handleScroll,
    refetch: infiniteQuery.refetch,
    isSuccess: infiniteQuery.isSuccess,
  };
}

export function useInfiniteScrollHandler({
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  threshold = 200,
}: {
  onLoadMore: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  threshold?: number;
}) {
  const handleScroll = useCallback(
    (scrollTop: number, scrollHeight: number, clientHeight: number) => {
      if (isFetchingNextPage || !hasNextPage) return;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < threshold) {
        onLoadMore();
      }
    },
    [onLoadMore, hasNextPage, isFetchingNextPage, threshold]
  );

  return { handleScroll };
}

export default useInfiniteScroll;
