import {
  Product,
  ProductFiltersParams,
  useDealsProductsInfinite,
  useProductFilters,
  type DealsSort,
} from "@/api/products";
import DealProductCard from "@/components/deals/DealProductCard";
import FiltersSidebar, {
  SelectedFilters,
} from "@/components/deals/FiltersSidebar";
import ProductDrawer from "@/components/deals/ProductDrawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter, Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const createInitialFiltersState = (): SelectedFilters => ({
  categories: [],
  brands: [],
  sellers: [],
  tags: [],
  attributes: {},
  availability: [],
  price: undefined,
  discount: undefined,
  rating: undefined,
});

const computeDiscountPercent = (product: Product): number => {
  if (typeof product.discountPercent === "number") {
    return product.discountPercent;
  }
  const effectivePrice = product.effectivePrice ?? product.price;
  if (
    typeof product.comparePrice === "number" &&
    typeof effectivePrice === "number" &&
    product.comparePrice > effectivePrice
  ) {
    return Math.round(
      ((product.comparePrice - effectivePrice) / product.comparePrice) * 100
    );
  }
  return 0;
};

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  sleeve: "Sleeve Length",
  sleeves: "Sleeve Length",
  "sleeve length": "Sleeve Length",
  length: "Length",
  "dress length": "Length",
  "skirt length": "Length",
};

const normalizeAttributeName = (raw: string): string => {
  const lower = raw.trim().toLowerCase();
  if (!lower) return "Specifications";
  if (ATTRIBUTE_NAME_MAP[lower]) return ATTRIBUTE_NAME_MAP[lower];
  if (lower.includes("sleeve")) return "Sleeve Length";
  if (lower.includes("length")) return "Length";
  if (lower.includes("material")) return "Material";
  if (lower.includes("size")) return "Size";
  if (lower.includes("color") || lower.includes("colour")) return "Color";
  if (lower.includes("fit")) return "Fit";
  if (lower.includes("neck")) return "Neck Style";
  if (lower.includes("style")) return "Style";
  return raw.trim();
};

type NormalizedAttributeValue = { label: string; hex?: string };

const extractAttributeValues = (raw: string): NormalizedAttributeValue[] => {
  const segments = raw
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const results: NormalizedAttributeValue[] = [];

  segments.forEach((segment) => {
    let workingSegment = segment;
    const hexMatch = workingSegment.match(/#[0-9a-fA-F]{3,8}/);
    const hex = hexMatch ? hexMatch[0].toLowerCase() : undefined;
    if (hex) {
      workingSegment = workingSegment.replace(/#[0-9a-fA-F]{3,8}/g, " ");
    }

    const candidates = workingSegment
      .split("|")
      .map((entry) => entry.replace(/[()]/g, "").trim())
      .filter((entry) => entry.length > 0);

    if (candidates.length === 0 && hex) {
      candidates.push(hex);
    }

    if (candidates.length === 0) {
      return;
    }

    candidates.forEach((label, index) => {
      results.push({
        label,
        hex: index === 0 ? hex : undefined,
      });
    });
  });

  return results;
};

const normalizeKeyValuePairs = (rawKey: string, rawValue: string) => {
  const keys = rawKey
    .split("|")
    .map((key) => normalizeAttributeName(key))
    .filter((key) => key.length > 0);

  const values = extractAttributeValues(rawValue);

  if (keys.length === 0) {
    keys.push(normalizeAttributeName("Specifications"));
  }

  if (values.length === 0) {
    const trimmed = rawValue.trim();
    if (trimmed) {
      values.push({ label: trimmed });
    }
  }

  return { keys, values };
};

const DealsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [sort, setSort] = useState<DealsSort>("relevance");
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
        rating: rating ? Number(rating) : undefined,
        price:
          priceMin || priceMax
            ? {
                min: priceMin ? Number(priceMin) : undefined,
                max: priceMax ? Number(priceMax) : undefined,
              }
            : undefined,
        discount:
          discountMin || discountMax
            ? {
                min: discountMin ? Number(discountMin) : undefined,
                max: discountMax ? Number(discountMax) : undefined,
              }
            : undefined,
      };
    }
  );
  const DEALS_PAGE_SIZE = 24;
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useDealsProductsInfinite({
    scope: "all-deals",
    take: DEALS_PAGE_SIZE,
    sort,
  });
  const pages = useMemo<Array<{ products: Product[] }>>(
    () => (data?.pages ?? []) as Array<{ products: Product[] }>,
    [data]
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const baseProducts = useMemo<Product[]>(() => {
    const products = pages.flatMap((page) => {
      if (!page || typeof page !== "object") return [];
      if (Array.isArray(page.products)) return page.products;
      // Handle case where page might be the products array directly
      if (Array.isArray(page)) return page;
      return [];
    });
    return products;
  }, [pages]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage]);
  const filterParams = useMemo<ProductFiltersParams>(() => {
    const params: ProductFiltersParams = {};
    if (selectedFilters.categories.length > 0) {
      params.category = selectedFilters.categories[0];
    }
    if (selectedFilters.brands.length > 0) {
      params.brand = selectedFilters.brands;
    }
    if (selectedFilters.sellers.length > 0) {
      params.seller = selectedFilters.sellers;
    }
    if (selectedFilters.tags.length > 0) {
      params.tag = selectedFilters.tags;
    }
    if (selectedFilters.availability.length > 0) {
      params.availability = selectedFilters.availability;
    }
    if (selectedFilters.availability.includes("include_out_of_stock")) {
      params.includeOutOfStock = true;
    }
    if (selectedFilters.price?.min !== undefined) {
      params.minPrice = selectedFilters.price.min;
    }
    if (selectedFilters.price?.max !== undefined) {
      params.maxPrice = selectedFilters.price.max;
    }
    if (selectedFilters.discount?.min !== undefined) {
      params.minDiscount = selectedFilters.discount.min;
    }
    if (selectedFilters.discount?.max !== undefined) {
      params.maxDiscount = selectedFilters.discount.max;
    }
    if (selectedFilters.rating !== undefined) {
      params.minRating = selectedFilters.rating;
    }
    params.event = "deals";
    return params;
  }, [selectedFilters]);

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

    const newSearch = params.toString();
    const currentSearch = location.search.startsWith("?")
      ? location.search.slice(1)
      : location.search;
    if (newSearch !== currentSearch) {
      navigate({ search: newSearch ? `?${newSearch}` : "" }, { replace: true });
    }
  }, [selectedFilters, location.search, navigate]);

  const { data: filtersData, isLoading: filtersLoading } =
    useProductFilters(filterParams);

  const attributeFilters = useMemo<[string, string[]][]>(
    () =>
      Object.entries(selectedFilters.attributes).filter(([, values]) =>
        Array.isArray(values) ? (values as string[]).length > 0 : false
      ) as [string, string[]][],
    [selectedFilters.attributes]
  );

  const filteredProducts = useMemo(() => {
    if (!baseProducts.length) return [];
    return baseProducts.filter((product) => {
      if (
        selectedFilters.categories.length > 0 &&
        !selectedFilters.categories.includes(product.category?._id ?? "")
      ) {
        return false;
      }

      if (
        selectedFilters.brands.length > 0 &&
        (!product.brand || !selectedFilters.brands.includes(product.brand))
      ) {
        return false;
      }

      if (
        selectedFilters.tags.length > 0 &&
        (!product.tags ||
          !product.tags.some((tag) => selectedFilters.tags.includes(tag)))
      ) {
        return false;
      }

      if (
        selectedFilters.rating !== undefined &&
        (product.rating ?? 0) < selectedFilters.rating
      ) {
        return false;
      }

      if (
        selectedFilters.sellers.length > 0 &&
        (!product.seller ||
          !selectedFilters.sellers.includes(
            (() => {
              if (!product.seller || typeof product.seller !== "object")
                return "";
              if ("_id" in product.seller && product.seller._id) {
                return String(product.seller._id);
              }
              if (
                "id" in product.seller &&
                (product.seller as { id?: string }).id
              ) {
                return String((product.seller as { id?: string }).id);
              }
              return "";
            })()
          ))
      ) {
        return false;
      }

      if (attributeFilters.length > 0) {
        const specificationMap = new Map<string, Set<string>>();

        if (product.attributeMetadata) {
          Object.entries(product.attributeMetadata).forEach(
            ([rawKey, values]) => {
              const normalizedKey = rawKey.trim().toLowerCase();
              if (!normalizedKey) return;
              if (!specificationMap.has(normalizedKey)) {
                specificationMap.set(normalizedKey, new Set<string>());
              }
              values.forEach(({ label }) => {
                const normalizedValue = label.trim().toLowerCase();
                if (!normalizedValue) return;
                specificationMap.get(normalizedKey)!.add(normalizedValue);
              });
            }
          );
        }

        if (Array.isArray(product.specifications)) {
          product.specifications.forEach((spec) => {
            if (!spec) return;
            const rawKey = spec?.key?.toString() ?? "";
            const rawValue = spec?.value?.toString() ?? "";
            const { keys, values } = normalizeKeyValuePairs(rawKey, rawValue);
            keys.forEach((key) => {
              const normalizedKey = key.trim().toLowerCase();
              if (!normalizedKey) return;
              if (!specificationMap.has(normalizedKey)) {
                specificationMap.set(normalizedKey, new Set<string>());
              }
              values.forEach((value) => {
                specificationMap
                  .get(normalizedKey)!
                  .add(value.label.trim().toLowerCase());
              });
            });
          });
        }

        if (Array.isArray(product.features)) {
          product.features.forEach((feature) => {
            if (typeof feature !== "string") return;
            const featureText = feature.trim();
            if (!featureText) return;
            const [rawKey, rawValue] = featureText.includes(":")
              ? featureText.split(":", 2)
              : ["Specifications", featureText];
            const { keys, values } = normalizeKeyValuePairs(rawKey, rawValue);
            keys.forEach((key) => {
              const normalizedKey = key.trim().toLowerCase();
              if (!normalizedKey) return;
              if (!specificationMap.has(normalizedKey)) {
                specificationMap.set(normalizedKey, new Set<string>());
              }
              values.forEach((value) => {
                specificationMap
                  .get(normalizedKey)!
                  .add(value.label.trim().toLowerCase());
              });
            });
          });
        }

        const matchesAllAttributes = attributeFilters.every(
          ([attribute, values]) => {
            const normalizedAttribute = attribute.trim().toLowerCase();
            const availableValues = specificationMap.get(normalizedAttribute);
            if (!availableValues || availableValues.size === 0) {
              return false;
            }
            return values.some((value) =>
              availableValues.has(value.trim().toLowerCase())
            );
          }
        );

        if (!matchesAllAttributes) {
          return false;
        }
      }

      const includeOutOfStockSelection = selectedFilters.availability.includes(
        "include_out_of_stock"
      );
      if (!includeOutOfStockSelection) {
        // Check stock: prioritize stock over totalStock, but use totalStock if stock is not available
        const availableStock = product.stock ?? product.totalStock ?? 0;
        const isOutOfStock =
          product.status === "out_of_stock" || availableStock <= 0;
        if (isOutOfStock) {
          return false;
        }
      }

      const effectivePrice = product.effectivePrice ?? product.price;
      if (
        selectedFilters.price?.min !== undefined &&
        (effectivePrice ?? Number.POSITIVE_INFINITY) < selectedFilters.price.min
      ) {
        return false;
      }

      if (
        selectedFilters.price?.max !== undefined &&
        (effectivePrice ?? 0) > selectedFilters.price.max
      ) {
        return false;
      }

      const discountPercent = computeDiscountPercent(product);

      if (
        selectedFilters.discount?.min !== undefined &&
        discountPercent < selectedFilters.discount.min
      ) {
        return false;
      }

      if (
        selectedFilters.discount?.max !== undefined &&
        discountPercent > selectedFilters.discount.max
      ) {
        return false;
      }

      // Attribute-level filtering can be added once product payloads include structured attributes
      return true;
    });
  }, [attributeFilters, baseProducts, selectedFilters]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    // Delay clearing product to allow drawer animation to complete
    setTimeout(() => {
      setSelectedProduct(null);
    }, 300);
  };

  const totalResults = filteredProducts.length;
  const showingLimit = filteredProducts.length;

  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="mt-24 mx-auto w-full px-4 py-10 lg:px-5">
        <div className="mb-6 space-y-3 rounded-3xl border border-slate-200/80 bg-white/95 px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-2xl font-semibold text-slate-900">
              Deals & Offers
            </div>
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
                deals
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-slate-500">
              Discover curated price drops, flash discounts, and limited-time
              bundles across categories you love. Fresh offers update throughout
              the day.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
              <span className="uppercase tracking-wide text-slate-400">
                Sort by
              </span>
              {[
                { label: "Relevance", value: "relevance" as DealsSort },
                {
                  label: "Price -- Low to High",
                  value: "price_asc" as DealsSort,
                },
                {
                  label: "Price -- High to Low",
                  value: "price_desc" as DealsSort,
                },
                { label: "Newest First", value: "newest" as DealsSort },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setSort(value)}
                  className={`rounded-full border px-3 py-1 transition ${
                    sort === value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
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
                        setSelectedFilters(createInitialFiltersState())
                      }
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
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
                    setSelectedFilters(createInitialFiltersState())
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[60vh]">
            <ScrollArea className="h-[calc(200vh-120px)] pr-2">
              <div className="pr-2 sm:pr-4">
                {isLoading && !pages.length ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-8 py-12 shadow-sm">
                      <Sparkles className="h-10 w-10 text-indigo-400" />
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          No deals at the moment
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Fresh offers drop regularly. Check back soon or adjust
                          your filters to explore more products.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        className="rounded-full md:hidden flex border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                        onClick={() => setIsFiltersOpen(true)}
                      >
                        Review filters
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                      {filteredProducts.map((product) => (
                        <DealProductCard
                          key={product._id}
                          product={product}
                          onClick={() => handleProductClick(product)}
                        />
                      ))}
                    </div>
                    <div ref={sentinelRef} className="h-8 w-full" />
                    {isFetchingNextPage && (
                      <div className="flex items-center justify-center py-6 text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading more deals…
                      </div>
                    )}
                    {!hasNextPage && filteredProducts.length > 0 && (
                      <div className="py-6 text-center text-sm text-slate-400">
                        You’ve reached the end of today’s offers.
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  );
};

export default DealsPage;
