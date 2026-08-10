import {
  Product,
  ProductFiltersParams,
  useProductFilters,
} from "@/api/products";
import FiltersSidebar, {
  SelectedFilters,
} from "@/components/deals/FiltersSidebar";
import { InfiniteScrollContainer } from "@/components/ui/InfiniteScrollContainer";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface ProductListingPageProps<T extends Product = Product> {
  // Page configuration
  title: string;
  description?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;

  // Data fetching
  useProductsQuery: (sort?: string) => {
    data?: { pages?: Array<{ products?: T[] }>; products?: T[] };
    isLoading: boolean;
    isFetchingNextPage?: boolean;
    hasNextPage?: boolean;
    fetchNextPage?: () => void;
  };

  // Filter configuration
  getFilterParams: (selectedFilters: SelectedFilters) => ProductFiltersParams;
  initialFilters?: Partial<SelectedFilters>;

  // Product rendering
  renderProduct: (product: T, index: number) => React.ReactNode;
  productGridClassName?: string;

  // Sort options
  sortOptions?: Array<{ label: string; value: string }>;
  defaultSort?: string;
  onSortChange?: (sort: string) => void;

  // Additional props
  showFilters?: boolean;
  pageSize?: number;
}

const createInitialFiltersState = (
  initial?: Partial<SelectedFilters>
): SelectedFilters => ({
  categories: initial?.categories ?? [],
  brands: initial?.brands ?? [],
  sellers: initial?.sellers ?? [],
  tags: initial?.tags ?? [],
  attributes: initial?.attributes ?? {},
  availability: initial?.availability ?? [],
  price: initial?.price,
  discount: initial?.discount,
  rating: initial?.rating,
});

export default function ProductListingPage<T extends Product = Product>({
  title,
  description,
  emptyStateTitle = "No products found",
  emptyStateDescription = "Try adjusting your filters to find what you're looking for.",
  useProductsQuery,
  getFilterParams,
  initialFilters,
  renderProduct,
  productGridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
  sortOptions = [
    { label: "Relevance", value: "relevance" },
    { label: "Price -- Low to High", value: "price_asc" },
    { label: "Price -- High to Low", value: "price_desc" },
    { label: "Newest First", value: "newest" },
  ],
  defaultSort = "relevance",
  onSortChange,
  showFilters = true,
}: ProductListingPageProps<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [sort, setSort] = useState<string>(defaultSort);
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(
    () => {
      const searchParams = new URLSearchParams(location.search);
      const parseArrayParam = (param: string) =>
        searchParams.getAll(param).flatMap((entry) =>
          entry
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        );

      const categories = parseArrayParam("category");
      const brands = parseArrayParam("brand");
      const sellers = parseArrayParam("seller");
      const tags = parseArrayParam("tag");
      const availabilityParams = parseArrayParam("availability").map((value) =>
        value.toLowerCase()
      );
      const includeOutOfStock = availabilityParams.some((value) =>
        ["include_out_of_stock", "out_of_stock"].includes(value)
      );

      const priceMin = searchParams.get("minPrice");
      const priceMax = searchParams.get("maxPrice");
      const discountMin = searchParams.get("minDiscount");
      const discountMax = searchParams.get("maxDiscount");
      const rating = searchParams.get("minRating");

      const attributes: Record<string, string[]> = {};
      searchParams.forEach((value, key) => {
        if (key.startsWith("attr:")) {
          const attributeName = decodeURIComponent(key.slice(5));
          attributes[attributeName] = value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);
        }
      });

      return {
        categories,
        brands,
        sellers,
        tags,
        attributes,
        availability: includeOutOfStock ? ["include_out_of_stock"] : [],
        rating: rating ? Number(rating) : initialFilters?.rating,
        price:
          priceMin || priceMax
            ? {
                min: priceMin ? Number(priceMin) : undefined,
                max: priceMax ? Number(priceMax) : undefined,
              }
            : initialFilters?.price,
        discount:
          discountMin || discountMax
            ? {
                min: discountMin ? Number(discountMin) : undefined,
                max: discountMax ? Number(discountMax) : undefined,
              }
            : initialFilters?.discount,
      };
    }
  );

  const filterParams = useMemo<ProductFiltersParams>(() => {
    return getFilterParams(selectedFilters);
  }, [selectedFilters, getFilterParams]);

  // Sync URL params with filters
  useEffect(() => {
    const params = new URLSearchParams();
    const appendArrayParam = (key: string, values: string[]) => {
      if (values.length === 0) return;
      params.set(key, values.join(","));
    };

    appendArrayParam("category", selectedFilters.categories);
    appendArrayParam("brand", selectedFilters.brands);
    appendArrayParam("seller", selectedFilters.sellers);
    appendArrayParam("tag", selectedFilters.tags);
    appendArrayParam("availability", selectedFilters.availability);

    Object.entries(selectedFilters.attributes).forEach(([key, values]) => {
      if (values.length === 0) return;
      params.set(`attr:${encodeURIComponent(key)}`, values.join(","));
    });

    if (selectedFilters.price?.min !== undefined) {
      params.set("minPrice", String(selectedFilters.price.min));
    }
    if (selectedFilters.price?.max !== undefined) {
      params.set("maxPrice", String(selectedFilters.price.max));
    }

    if (selectedFilters.discount?.min !== undefined) {
      params.set("minDiscount", String(selectedFilters.discount.min));
    }
    if (selectedFilters.discount?.max !== undefined) {
      params.set("maxDiscount", String(selectedFilters.discount.max));
    }

    if (selectedFilters.rating !== undefined) {
      params.set("minRating", String(selectedFilters.rating));
    }

    if (sort && sort !== defaultSort) {
      params.set("sort", sort);
    }

    const newSearch = params.toString();
    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;
    if (newSearch !== currentSearch) {
      navigate({ search: newSearch ? `?${newSearch}` : "" }, { replace: true });
    }
  }, [selectedFilters, sort, location.search, navigate, defaultSort]);

  const { data: filtersData, isLoading: filtersLoading } =
    useProductFilters(filterParams);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useProductsQuery(sort);

  const pages = useMemo<Array<{ products: T[] }>>(() => {
    if (data?.pages) {
      return data.pages as Array<{ products: T[] }>;
    }
    if (data?.products) {
      return [{ products: data.products as T[] }];
    }
    return [];
  }, [data]);

  const products = useMemo<T[]>(() => {
    return pages.flatMap((page) => page.products ?? []);
  }, [pages]);

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    onSortChange?.(newSort);
  };

  const totalResults = products.length;
  const showingLimit = products.length;

  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="mt-24 mx-auto w-full px-4 py-10 lg:px-5">
        <div className="mb-6 space-y-3 rounded-3xl border border-slate-200/80 bg-white/95 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-2xl font-semibold text-slate-900">{title}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Showing
              </span>
              <span className="font-semibold text-slate-800">
                {showingLimit}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                of
              </span>
              <span className="font-semibold text-slate-800">
                {totalResults.toLocaleString()}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                products
              </span>
            </div>
          </div>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
              <span className="uppercase tracking-wide text-slate-400">
                Sort by
              </span>
              {sortOptions.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleSortChange(value)}
                  className={`rounded-full border px-3 py-1 transition ${
                    sort === value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
              {showFilters && (
                <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="secondary"
                      className="flex w-full justify-center rounded-full border border-slate-200 bg-white/60 text-indigo-600 shadow-sm hover:border-indigo-300 hover:bg-white lg:hidden"
                      aria-label="Open filters"
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      Refine Results
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="h-[85vh] w-full rounded-t-3xl bg-white border-t p-0"
                  >
                    <SheetHeader className="border-b px-6 pb-4 pt-6">
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="px-6 py-4">
                      <FiltersSidebar
                        filters={filtersData}
                        isLoading={filtersLoading}
                        selected={selectedFilters}
                        onChange={(value) => setSelectedFilters(value)}
                        onReset={() =>
                          setSelectedFilters(
                            createInitialFiltersState(initialFilters)
                          )
                        }
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {showFilters && (
            <div className="hidden lg:block">
              <div className="sticky top-28">
                <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                  <FiltersSidebar
                    filters={filtersData}
                    isLoading={filtersLoading}
                    selected={selectedFilters}
                    height="calc(100vh - 160px)"
                    onChange={(value) => setSelectedFilters(value)}
                    onReset={() =>
                      setSelectedFilters(
                        createInitialFiltersState(initialFilters)
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-[60vh]">
            {isLoading && !pages.length ? (
              <div className={productGridClassName}>
                {[...Array(8)].map((_, index) => (
                  <div
                    key={index}
                    className="flex h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm"
                    aria-label="Loading product"
                  >
                    <div className="h-2/3 animate-pulse bg-indigo-100/50" />
                    <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                      <div className="h-5 w-3/4 animate-pulse rounded-full bg-indigo-100/80" />
                      <div className="h-5 w-1/2 animate-pulse rounded-full bg-indigo-100/60" />
                      <div className="mt-auto flex gap-2">
                        <div className="h-9 flex-1 animate-pulse rounded-full bg-indigo-100/40" />
                        <div className="h-9 w-9 animate-pulse rounded-full bg-indigo-100/40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-8 py-12 shadow-sm">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {emptyStateTitle}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {emptyStateDescription}
                    </p>
                  </div>
                  {showFilters && (
                    <Button
                      variant="secondary"
                      className="rounded-full md:hidden flex border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                      onClick={() => setIsFiltersOpen(true)}
                    >
                      Review filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <InfiniteScrollContainer
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                onLoadMore={fetchNextPage}
                threshold={200}
                className="pr-2"
                contentClassName="pr-2 sm:pr-4"
                loadingIndicator={
                  <div className="flex items-center justify-center py-6 text-slate-500">
                    <span className="text-sm">Loading more products…</span>
                  </div>
                }
                endIndicator={
                  <div className="py-6 text-center text-sm text-slate-400">
                    You've reached the end.
                  </div>
                }
              >
                <div className={productGridClassName}>
                  {products.map((product, index) =>
                    renderProduct(product, index)
                  )}
                </div>
              </InfiniteScrollContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
