import {
  Product,
  ProductFiltersParams,
  useBestSellersProductsInfinite,
  BestSellersSort,
} from "@/api/products";
import ProductListingPage from "@/components/products/ProductListingPage";
import { SelectedFilters } from "@/components/deals/FiltersSidebar";
import SearchProductCard from "@/components/search/SearchProductCard";
import React from "react";

const BestSellersPage: React.FC = () => {
  const getFilterParams = (
    selectedFilters: SelectedFilters
  ): ProductFiltersParams => {
    const params: ProductFiltersParams = {
      minRating: 4, // Always require 4+ rating for best sellers
    };

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
    // Override rating filter to always be 4+
    if (selectedFilters.rating !== undefined && selectedFilters.rating >= 4) {
      params.minRating = Math.max(4, selectedFilters.rating);
    }

    if (Object.keys(selectedFilters.attributes || {}).length > 0) {
      params.attributes = selectedFilters.attributes;
    }

    return params;
  };

  // Create a function that returns the hook result
  // ProductListingPage calls this at the top level of its render, so hooks are called correctly
  // Note: While this appears to violate Rules of Hooks, it's safe because ProductListingPage
  // calls this function at the top level of its component render, not inside a callback
  const useProductsQuery = (sort?: string) => {
    const sortValue = (sort as BestSellersSort) || "relevance";
    return useBestSellersProductsInfinite({
      limit: 24,
      minRating: 4,
      sort: sortValue,
    });
  };

  return (
    <ProductListingPage<Product>
      title="Best Sellers"
      description="Discover our top-rated products loved by customers."
      emptyStateTitle="No best sellers found"
      emptyStateDescription="Check back soon for highly rated products or adjust your filters."
      useProductsQuery={useProductsQuery}
      getFilterParams={getFilterParams}
      initialFilters={{ rating: 4 }}
      renderProduct={(product: Product) => (
        <SearchProductCard key={product._id} product={product} />
      )}
      defaultSort="relevance"
    />
  );
};

export default BestSellersPage;
