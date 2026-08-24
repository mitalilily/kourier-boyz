import { Grid, Stack, Typography } from "@mui/material";
import CardCheckbox from "../UI/inputs/CardCheckBoxes";

type businessCategories = "d2c" | "b2b" | "b2c";
interface BusinessType {
  label: string;
  imageSrc?: string;
  description?: string;
  value: businessCategories;
}

interface BusinessTypeSelectorProps {
  selected: string[];
  error: string;
  onChange: (selected: string[]) => void;
}

const businessTypes: BusinessType[] = [
  {
    label: "I sell to other businesses",
    value: "b2b",
    imageSrc: "/images/wholesale.png",
    description:
      "You sell products in bulk to shops, retailers, or other companies.",
  },
  {
    label: "I sell on online marketplaces",
    value: "b2c",
    imageSrc: "/images/marketplace.png",
    description:
      "You sell your products on sites like Amazon, Flipkart, or Meesho.",
  },
  {
    label: "I sell on my website or social media",
    value: "d2c",
    imageSrc: "/images/website-illustration.png",
    description:
      "You sell directly to customers through your own website/ social media or shopify/woocommerce.",
  },
];

export default function BusinessTypeSelector({
  selected,
  onChange,
  error,
}: BusinessTypeSelectorProps) {
  // Toggle selection of an item in multi-select
  const toggleSelection = (value: string) => {
    if (selected?.includes(value)) {
      onChange(selected?.filter((item) => item !== value));
    } else {
      onChange([...(selected ?? []), value]);
    }
  };

  return (
    <Stack spacing={1.5}>
      {error && (
        <Typography color="error" variant="body2" mt={1} ml={1}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} justifyContent="center">
        {businessTypes.map(({ label, imageSrc, description, value }) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={value}>
            {" "}
            <CardCheckbox
              description={description}
              key={label}
              value={value}
              label={label}
              imageSrc={imageSrc}
              checked={selected?.includes(value)}
              onChange={() => toggleSelection(value)}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
