import {
  Box,
  Flex,
  HStack,
  Select,
  Stack,
  Tab,
  TabList,
  Tabs,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useShippingRates } from "hooks/useCouriers";
import { useZones } from "hooks/useZones";
import { fetchAllCouriersList } from "services/courier.service";
import { PlansService } from "services/plan.service";
import ZoneRateMatrix from "views/B2B/ZoneRateMatrix";
import B2CPlanRateEditor from "./B2CPlanRateEditor";
import InternationalRateCardWorkspace from "./InternationalRateCardWorkspace";

export const RateCardContainer = ({
  forceBusinessType = null,
  forcePlanId = "",
  embedded = false,
}) => {
  const businessTypes = ["B2B", "B2C", "INTERNATIONAL"];
  const forcedIndex = forceBusinessType
    ? businessTypes.indexOf(forceBusinessType.toUpperCase())
    : -1;
  const [businessTypeIndex, setBusinessTypeIndex] = useState(
    forcedIndex >= 0 ? forcedIndex : 0
  );
  const [selectedPlanId, setSelectedPlanId] = useState(forcePlanId);
  const selectedBusinessType = businessTypes[businessTypeIndex].toLowerCase();
  const isB2BSelected = selectedBusinessType === "b2b";
  const isInternationalSelected = selectedBusinessType === "international";

  useEffect(() => {
    if (forcedIndex >= 0) setBusinessTypeIndex(forcedIndex);
  }, [forcedIndex]);

  const { data: courierList = [] } = useQuery({
    queryKey: ["all-couriers", selectedBusinessType],
    queryFn: () => fetchAllCouriersList({ businessType: selectedBusinessType }),
  });
  const { data: plans = [] } = useQuery({
    queryKey: [
      "plans",
      { businessType: selectedBusinessType, status: "active" },
    ],
    queryFn: () =>
      PlansService.getPlans({
        businessType: selectedBusinessType,
        status: "active",
      }),
  });
  const { zones = [] } = useZones(businessTypes[businessTypeIndex]);

  useEffect(() => {
    if (forcePlanId) {
      setSelectedPlanId(forcePlanId);
      return;
    }
    if (
      selectedBusinessType === "b2c" &&
      plans.length &&
      !plans.some((plan) => plan.id === selectedPlanId)
    ) {
      setSelectedPlanId(plans[0].id);
    }
  }, [forcePlanId, plans, selectedBusinessType, selectedPlanId]);

  const filters = useMemo(
    () => ({
      businessType: selectedBusinessType,
      ...(selectedPlanId ? { planId: selectedPlanId } : {}),
    }),
    [selectedBusinessType, selectedPlanId]
  );
  const { data: rates = [], isLoading } = useShippingRates(filters);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  return (
    <Flex
      direction="column"
      pt={embedded ? 0 : { base: "120px", md: "75px" }}
      gap={4}
    >
      {!forceBusinessType && (
        <Tabs
          variant="solid-rounded"
          colorScheme="brand"
          index={businessTypeIndex}
          onChange={setBusinessTypeIndex}
        >
          <TabList gap={2}>
            {businessTypes.map((type) => (
              <Tab
                key={type}
                flex={1}
                px={6}
                py={4}
                borderRadius="md"
                _selected={{ bg: "white", shadow: "sm", color: "brand.600" }}
              >
                <Stack spacing={1} align="flex-start" width="100%">
                  <HStack>
                    <Tag colorScheme={type === "B2B" ? "blue" : type === "INTERNATIONAL" ? "purple" : "orange"}>
                      {type}
                    </Tag>
                    <Text fontWeight="semibold">
                      {type === "B2B"
                        ? "Enterprise Rate Card"
                        : type === "INTERNATIONAL"
                          ? "International Rate Card"
                        : "Retail Rate Card"}
                    </Text>
                  </HStack>
                </Stack>
              </Tab>
            ))}
          </TabList>
        </Tabs>
      )}

      {isInternationalSelected ? (
        <Box pt={4}>
          <InternationalRateCardWorkspace planName={selectedPlan?.name || "International"} />
        </Box>
      ) : isB2BSelected ? (
        <Box pt={4}>
          <ZoneRateMatrix embedded />
        </Box>
      ) : (
        <>
          {!forcePlanId && plans.length > 0 && (
            <HStack bg="white" p={4} border="1px solid" borderColor="gray.100">
              <Text fontSize="sm" fontWeight="600">
                Rate Card Plan
              </Text>
              <Select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                maxW="320px"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
            </HStack>
          )}
          <B2CPlanRateEditor
            couriers={courierList}
            zones={zones}
            rates={rates}
            planId={selectedPlanId}
            planName={selectedPlan?.name || "B2C"}
            loading={isLoading}
          />
        </>
      )}
    </Flex>
  );
};
