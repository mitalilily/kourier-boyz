import { Request, Response } from "express";
import Product from "../models/Product";
import SizeChart from "../models/SizeChart";
import { uploadToR2 } from "../utils/r2Upload";

// --------------------
// GET products with their size charts (optimized endpoint)
// --------------------
export const getProductsWithSizeCharts = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const { limit = 100, search } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Build product query
    const productQuery: any = {
      seller: userId,
    };

    if (search && typeof search === "string") {
      productQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch products
    const products = await Product.find(productQuery)
      .select("name sku mainImage slug")
      .limit(Number(limit))
      .lean();

    if (products.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Get all product IDs
    const productIds = products.map((p) => p._id.toString());

    // Fetch size charts for these products in one query
    const sizeCharts = await SizeChart.find({
      chartType: "product",
      product: { $in: productIds },
      seller: userId,
      isActive: true,
    })
      .select(
        "title description measurementType measurements rows image isActive product"
      )
      .lean();

    // Create a map of productId -> sizeChart
    const sizeChartMap = new Map<string, any>();
    sizeCharts.forEach((chart) => {
      const productId = chart.product?.toString();
      if (productId) {
        sizeChartMap.set(productId, chart);
      }
    });

    // Combine products with their size charts
    const productsWithCharts = products
      .map((product) => {
        const sizeChart = sizeChartMap.get(product._id.toString());
        if (sizeChart) {
          return {
            ...product,
            sizeChart,
          };
        }
        return null;
      })
      .filter((item) => item !== null); // Only return products that have size charts

    return res.json({
      success: true,
      data: productsWithCharts,
    });
  } catch (error) {
    console.error("Error fetching products with size charts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch products with size charts",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// Helper function to get size chart for a product (checks product-level, then category-level, then brand-level)
// Returns lean document (plain object) for performance
export const getSizeChartForProduct = async (
  productId: string
): Promise<any | null> => {
  const product = await Product.findById(productId).populate("category").lean();

  if (!product) {
    return null;
  }

  // Priority 1: Product-level size chart
  const productChart = await SizeChart.findOne({
    chartType: "product",
    product: productId,
    isActive: true,
  })
    .sort({ sortOrder: 1 })
    .lean();

  if (productChart) {
    return productChart;
  }

  // Only product-level charts are supported
  return null;
};

// --------------------
// GET size chart for a product (public endpoint)
// --------------------
export const getProductSizeChart = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const sizeChart = await getSizeChartForProduct(productId);

    if (!sizeChart) {
      return res
        .status(404)
        .json({ error: "Size chart not found for this product" });
    }

    return res.json({
      success: true,
      data: sizeChart,
    });
  } catch (error) {
    console.error("Error fetching product size chart:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch size chart",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// --------------------
// GET size charts (for sellers/admins)
// --------------------
export const getSizeCharts = async (req: Request, res: Response) => {
  try {
    const { productId, sellerId } = req.query;
    const userId = req.user?.userId;

    const query: any = {
      chartType: "product", // Only product-level charts are supported
    };

    if (productId) {
      query.product = productId;
    }

    // For sellers, only show their own product-level charts
    if (req.user?.role === "seller") {
      query.seller = userId;
    }

    if (sellerId && req.user?.role === "admin") {
      query.seller = sellerId;
    }

    const sizeCharts = await SizeChart.find(query)
      .populate("product", "name slug")
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: sizeCharts,
    });
  } catch (error) {
    console.error("Error fetching size charts:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch size charts",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// --------------------
// GET single size chart
// --------------------
export const getSizeChart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const sizeChart = await SizeChart.findById(id)
      .populate("product", "name slug")
      .populate("seller", "name email")
      .lean();

    if (!sizeChart) {
      return res.status(404).json({ error: "Size chart not found" });
    }

    // Sellers can only access their own product-level charts
    if (req.user?.role === "seller") {
      if (
        sizeChart.chartType === "product" &&
        sizeChart.seller?.toString() !== userId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (sizeChart.chartType !== "product") {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    return res.json({
      success: true,
      data: sizeChart,
    });
  } catch (error) {
    console.error("Error fetching size chart:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch size chart",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// --------------------
// CREATE size chart
// --------------------
export const createSizeChart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    let {
      title,
      description,
      product,
      measurementType,
      measurements,
      rows,
      image,
      isActive,
      sortOrder,
    } = req.body;

    // Parse JSON strings from FormData if they are strings
    if (typeof measurements === "string") {
      try {
        measurements = JSON.parse(measurements);
      } catch (e) {
        return res.status(400).json({
          error: "Invalid measurements format",
        });
      }
    }
    if (typeof rows === "string") {
      try {
        rows = JSON.parse(rows);
      } catch (e) {
        return res.status(400).json({
          error: "Invalid rows format",
        });
      }
    }

    // Validation - only product-level charts are supported
    if (!title || !product || !measurementType || !measurements || !rows) {
      return res.status(400).json({
        error:
          "Title, product, measurement type, measurements, and rows are required",
      });
    }

    // Verify seller owns the product
    const productDoc = await Product.findById(product);
    if (!productDoc) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Sellers can only create charts for their own products
    if (
      req.user?.role === "seller" &&
      productDoc.seller.toString() !== userId
    ) {
      return res.status(403).json({
        error: "You can only create size charts for your own products",
      });
    }

    // Handle image upload - prioritize uploaded file over URL
    let imageUrl = image;
    const uploadedFile = req.file;
    if (uploadedFile) {
      try {
        imageUrl = await uploadToR2(
          uploadedFile.buffer,
          `size-charts/${userId}/${Date.now()}-${uploadedFile.originalname}`,
          uploadedFile.mimetype,
          "size-charts"
        );
      } catch (uploadError) {
        console.error("Error uploading size chart image:", uploadError);
        return res.status(500).json({
          success: false,
          error: "Failed to upload size chart image",
          message: (uploadError as Error)?.message || "Upload error",
        });
      }
    }

    const sizeChart = new SizeChart({
      title,
      description,
      chartType: "product",
      product: product,
      seller: userId,
      measurementType,
      measurements,
      rows,
      image: imageUrl,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
    });

    await sizeChart.save();

    const populatedChart = await SizeChart.findById(sizeChart._id)
      .populate("product", "name slug")
      .populate("seller", "name email")
      .lean();

    return res.status(201).json({
      success: true,
      data: populatedChart,
    });
  } catch (error) {
    console.error("Error creating size chart:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create size chart",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// --------------------
// UPDATE size chart
// --------------------
export const updateSizeChart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const updateData: any = { ...req.body };

    // Parse JSON strings from FormData if they are strings
    if (
      updateData.measurements &&
      typeof updateData.measurements === "string"
    ) {
      try {
        updateData.measurements = JSON.parse(updateData.measurements);
      } catch (e) {
        return res.status(400).json({
          error: "Invalid measurements format",
        });
      }
    }
    if (updateData.rows && typeof updateData.rows === "string") {
      try {
        updateData.rows = JSON.parse(updateData.rows);
      } catch (e) {
        return res.status(400).json({
          error: "Invalid rows format",
        });
      }
    }

    const sizeChart = await SizeChart.findById(id);

    if (!sizeChart) {
      return res.status(404).json({ error: "Size chart not found" });
    }

    // Sellers can only update their own product-level charts
    if (req.user?.role === "seller") {
      if (
        sizeChart.chartType !== "product" ||
        sizeChart.seller?.toString() !== userId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Prevent changing chart type
    if (updateData.chartType && updateData.chartType !== sizeChart.chartType) {
      return res.status(400).json({ error: "Cannot change chart type" });
    }

    // For product-level charts, verify seller owns the product if product is being changed
    if (sizeChart.chartType === "product" && updateData.product) {
      const productDoc = await Product.findById(updateData.product);
      if (!productDoc) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (
        req.user?.role === "seller" &&
        productDoc.seller.toString() !== userId
      ) {
        return res
          .status(403)
          .json({ error: "You can only update charts for your own products" });
      }
    }

    // Handle image upload - prioritize uploaded file over URL
    const uploadedFile = req.file;
    if (uploadedFile) {
      try {
        const imageUrl = await uploadToR2(
          uploadedFile.buffer,
          `size-charts/${userId}/${Date.now()}-${uploadedFile.originalname}`,
          uploadedFile.mimetype,
          "size-charts"
        );
        updateData.image = imageUrl;
      } catch (uploadError) {
        console.error("Error uploading size chart image:", uploadError);
        return res.status(500).json({
          success: false,
          error: "Failed to upload size chart image",
          message: (uploadError as Error)?.message || "Upload error",
        });
      }
    }

    Object.assign(sizeChart, updateData);
    await sizeChart.save();

    const populatedChart = await SizeChart.findById(sizeChart._id)
      .populate("product", "name slug")
      .populate("seller", "name email")
      .lean();

    return res.json({
      success: true,
      data: populatedChart,
    });
  } catch (error) {
    console.error("Error updating size chart:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update size chart",
      message: (error as Error)?.message || "Server error",
    });
  }
};

// --------------------
// DELETE size chart
// --------------------
export const deleteSizeChart = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const sizeChart = await SizeChart.findById(id);

    if (!sizeChart) {
      return res.status(404).json({ error: "Size chart not found" });
    }

    // Sellers can only delete their own product-level charts
    if (req.user?.role === "seller") {
      if (
        sizeChart.chartType !== "product" ||
        sizeChart.seller?.toString() !== userId
      ) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    await SizeChart.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Size chart deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting size chart:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete size chart",
      message: (error as Error)?.message || "Server error",
    });
  }
};
