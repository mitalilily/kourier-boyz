import { Box, useStyleConfig } from "@chakra-ui/react";
function Card(props) {
  const { variant, children, className = "", ...rest } = props;
  const styles = useStyleConfig("Card", { variant });
  return (
    <Box __css={styles} className={`kb-logistics-card ${className}`.trim()} {...rest}>
      {children}
    </Box>
  );
}

export default Card;
