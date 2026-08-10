export const formatCurrency = (v?: number) =>
  typeof v === "number"
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(v)
    : "-";
