import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { loginAdmin } from "../../services/auth.service";
import { useAuthStore } from "../../store/useAuthStore";
import { LOGISTICS_ADMIN_STORAGE } from "../../config/authStorage";

const isTokenValid = (token) => {
  try {
    return jwtDecode(token).exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const history = useHistory();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const accessToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.accessToken);
    const refreshToken = localStorage.getItem(LOGISTICS_ADMIN_STORAGE.refreshToken);
    if (accessToken && refreshToken && isTokenValid(refreshToken))
      history.replace("/admin/dashboard");
  }, [history]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await loginAdmin(email.trim().toLowerCase(), password);
      login(data.token, data?.user?.id, data.refreshToken);
      history.push("/admin/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description:
          error.response?.data?.error || "Unable to connect to Kourier Boyz Admin",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid
      minH="100vh"
      w="100%"
      maxW="100vw"
      overflow="hidden"
      templateColumns={{ base: "minmax(0, 1fr)", lg: "55% 45%" }}
      bg="#FFFAF2"
    >
      <GridItem
        display={{ base: "none", lg: "block" }}
        position="relative"
        minH="100vh"
        overflow="hidden"
        borderRight="1px solid"
        borderColor="#EEE5D8"
        bg="#FFFAF2"
      >
        <Box
          position="absolute"
          inset={0}
          bgImage="url('/logistics/brand/kourier-boyz-network-auth.webp')"
          bgSize="cover"
          bgPosition="center center"
          bgRepeat="no-repeat"
        />
        <VStack
          position="relative"
          zIndex={1}
          h="100%"
          align="stretch"
          px={{ lg: 12, xl: 16 }}
          py={10}
        >
          <Box
            as="img"
            src="/logistics/brand/kourier-boyz-logo.png"
            alt="Kourier Boyz"
            w={{ lg: "240px", xl: "280px" }}
            h="auto"
          />
          <Box mt={{ lg: 16, xl: 20 }} maxW="510px">
            <HStack spacing={3} mb={5}>
              <Box w="36px" h="2px" bg="#555D61" />
              <Text
                color="brand.500"
                fontSize="xs"
                fontWeight="800"
                letterSpacing="0.16em"
              >
                OPERATIONS CONTROL
              </Text>
            </HStack>
            <Heading
              color="#202321"
              fontSize={{ lg: "4xl", xl: "5xl" }}
              lineHeight="1.04"
              letterSpacing="0"
            >
              Every shipment.
              <Text as="span" display="block" color="#555D61">
                In clear view.
              </Text>
            </Heading>
          </Box>
        </VStack>
      </GridItem>

      <GridItem minW={0} bg="#FFFDF8">
        <Flex
          minH="100vh"
          w="100%"
          minW={0}
          align="center"
          justify="center"
          px={{ base: 6, md: 12, xl: 16 }}
          py={10}
        >
          <Box as="form" onSubmit={handleSubmit} w="100%" minW={0} maxW="430px">
            <VStack w="100%" minW={0} align="stretch" spacing={6}>
              <Box
                as="img"
                display={{ base: "block", lg: "none" }}
                src="/logistics/brand/kourier-boyz-logo.png"
                alt="Kourier Boyz"
                w="230px"
                h="auto"
              />
              <Box>
                <Text
                  color="brand.500"
                  fontSize="xs"
                  fontWeight="800"
                  letterSpacing="0.14em"
                >
                  ADMIN CONSOLE
                </Text>
                <Heading
                  mt={3}
                  color="#202321"
                  fontSize={{ base: "3xl", md: "4xl" }}
                  letterSpacing="0"
                >
                  Welcome back
                </Heading>
                <Text mt={3} color="#65708A" fontSize="sm" lineHeight="1.7">
                  Sign in to manage shipments, rates, couriers, and operations.
                </Text>
              </Box>

              <FormControl isRequired>
                <FormLabel color="#202321" fontSize="sm" fontWeight="700">
                  Email address
                </FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@kourier-boyz.com"
                  h="52px"
                  w="100%"
                  boxSizing="border-box"
                  borderRadius="6px"
                  bg="white"
                  borderColor="#E7D8C5"
                  _hover={{ borderColor: "brand.300" }}
                  _focus={{
                    borderColor: "brand.500",
                    boxShadow: "0 0 0 3px rgba(49,2,118,0.12)",
                  }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="#202321" fontSize="sm" fontWeight="700">
                  Password
                </FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    h="52px"
                    w="100%"
                    boxSizing="border-box"
                    pr="48px"
                    borderRadius="6px"
                    bg="white"
                    borderColor="#E7D8C5"
                    _hover={{ borderColor: "brand.300" }}
                    _focus={{
                      borderColor: "brand.500",
                      boxShadow: "0 0 0 3px rgba(49,2,118,0.12)",
                    }}
                  />
                  <InputRightElement h="52px" pr={2}>
                    <IconButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      color="brand.500"
                      onClick={() => setShowPassword((current) => !current)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <Button
                type="submit"
                h="52px"
                w="100%"
                boxSizing="border-box"
                color="white"
                bg="brand.500"
                borderRadius="6px"
                isLoading={loading}
                loadingText="Signing in"
                _hover={{ bg: "brand.600", transform: "translateY(-1px)" }}
                _active={{ bg: "brand.700", transform: "none" }}
              >
                Sign in
              </Button>
              <Text textAlign="center" color="#65708A" fontSize="xs">
                Secure access for authorized Kourier Boyz administrators
              </Text>
            </VStack>
          </Box>
        </Flex>
      </GridItem>
    </Grid>
  );
}

export default SignIn;
