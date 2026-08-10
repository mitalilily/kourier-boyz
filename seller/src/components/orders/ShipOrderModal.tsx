import {
  App,
  Button,
  Form,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { useEffect, useMemo, useState } from "react";
import type {
  CourierRateOption,
  SellerOrder,
  SellerShipment,
} from "../../api/orders";
import { useCreateShipment, useShipmentRates } from "../../api/orderQueries";

const { Text } = Typography;

interface ShipOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  order?: SellerOrder;
  shipment?: SellerShipment;
  pickupAddresses?: Array<{
    _id?: string;
    warehouseName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    contactName?: string;
    contactPhone?: string;
    isDefault?: boolean;
  }>;
}

const defaultFormValues = {
  weight: 500,
  length: 20,
  width: 15,
  height: 10,
};

type PickupAddress = NonNullable<
  ShipOrderModalProps["pickupAddresses"]
>[number];

const formatAddress = (address?: PickupAddress) => {
  if (!address) return "";
  return `${address.addressLine1 || ""}${
    address.addressLine2 ? `, ${address.addressLine2}` : ""
  }, ${address.city || ""}, ${address.state || ""} ${address.postalCode || ""}`;
};

const ShipOrderModal = ({
  open,
  onClose,
  onSuccess,
  order,
  shipment,
  pickupAddresses = [],
}: ShipOrderModalProps) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const ratesMutation = useShipmentRates();
  const createShipment = useCreateShipment();
  const [rates, setRates] = useState<CourierRateOption[]>([]);
  const [selectedCourier, setSelectedCourier] =
    useState<CourierRateOption | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<
    string | undefined
  >();

  const defaultPickup = useMemo(() => {
    if (!pickupAddresses.length) return undefined;
    return pickupAddresses.find((addr) => addr.isDefault) || pickupAddresses[0];
  }, [pickupAddresses]);

  useEffect(() => {
    if (open) {
      setRates([]);
      setSelectedCourier(null);
      form.setFieldsValue(defaultFormValues);
      setSelectedPickupId(defaultPickup?._id);
    } else {
      form.resetFields();
    }
  }, [open, form, defaultPickup]);

  if (!order || !shipment) {
    return null;
  }

  const paymentTag =
    order.paymentMethod === "cod" ? (
      <Tag color="orange">COD</Tag>
    ) : (
      <Tag color="green">Prepaid</Tag>
    );

  const handleFetchRates = async (formInstance: FormInstance) => {
    try {
      const values = await formInstance.validateFields([
        "weight",
        "length",
        "width",
        "height",
      ]);
      const response = await ratesMutation.mutateAsync({
        orderId: order._id,
        payload: {
          weight: values.weight,
          dimensions: {
            length: values.length,
            width: values.width,
            height: values.height,
          },
        },
      });
      setRates(response.data?.rates || []);
      setSelectedCourier(null);
      if (!selectedPickupId && response.data?.pickupAddress?._id) {
        setSelectedPickupId(response.data.pickupAddress._id as string);
      }
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error(
        (error as Error)?.message || "Failed to fetch courier rates"
      );
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedCourier) {
        message.error("Select a courier option before confirming shipping");
        return;
      }

      await createShipment.mutateAsync({
        orderId: order._id,
        payload: {
          package: {
            weight: values.weight,
            length: values.length,
            width: values.width,
            height: values.height,
          },
          courierId: selectedCourier.courier_id,
          pickupAddressId: selectedPickupId,
          estimatedCharge: selectedCourier.rate,
        },
      });

      message.success("Shipment created successfully");
      onSuccess?.();
      onClose();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error((error as Error)?.message || "Failed to create shipment");
    }
  };

  return (
    <Modal
      title="Ship Order"
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnClose
      confirmLoading={createShipment.isPending}
      onOk={handleSubmit}
      okText="Confirm Shipping"
    >
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-center justify-between">
          <div>
            <Text strong>Order Total: </Text>
            <Text>₹{order.total.toFixed(2)}</Text>
          </div>
          <div>
            <Text strong>Payment: </Text>
            {paymentTag}
          </div>
        </div>

        <Form
          layout="vertical"
          form={form}
          initialValues={defaultFormValues}
          requiredMark={false}
        >
          <Form.Item label="Pickup address">
            <Select
              placeholder="Select pickup address"
              value={selectedPickupId}
              onChange={(value) => setSelectedPickupId(value)}
              options={pickupAddresses.map((addr) => ({
                label: (
                  <div>
                    <div className="font-medium">
                      {addr.warehouseName || addr.addressLine1}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatAddress(addr)}
                    </div>
                  </div>
                ),
                value: addr._id,
              }))}
              disabled={pickupAddresses.length === 0}
              notFoundContent="No pickup addresses configured"
            />
          </Form.Item>

          <Space size="large">
            <Form.Item
              label="Package weight (grams)"
              name="weight"
              rules={[{ required: true, message: "Enter package weight" }]}
            >
              <InputNumber min={100} max={50000} addonAfter="g" />
            </Form.Item>
            <Form.Item
              label="Length (cm)"
              name="length"
              rules={[{ required: true, message: "Enter length" }]}
            >
              <InputNumber min={5} max={200} />
            </Form.Item>
            <Form.Item
              label="Width (cm)"
              name="width"
              rules={[{ required: true, message: "Enter width" }]}
            >
              <InputNumber min={5} max={200} />
            </Form.Item>
            <Form.Item
              label="Height (cm)"
              name="height"
              rules={[{ required: true, message: "Enter height" }]}
            >
              <InputNumber min={3} max={200} />
            </Form.Item>
          </Space>

          <Button
            type="dashed"
            onClick={() => handleFetchRates(form)}
            loading={ratesMutation.isPending}
            disabled={pickupAddresses.length === 0}
          >
            Check Courier Rates
          </Button>
        </Form>

        {rates.length > 0 ? (
          <div>
            <Text strong>Select courier</Text>
            <Radio.Group
              onChange={(e) => {
                const rate = rates.find(
                  (option) => option.courier_id === e.target.value
                );
                setSelectedCourier(rate || null);
              }}
              value={selectedCourier?.courier_id}
              className="w-full"
            >
              <Space direction="vertical" className="w-full">
                {rates.map((rate) => (
                  <Radio key={rate.courier_id} value={rate.courier_id}>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="font-medium">{rate.courier_name}</div>
                        <div className="text-xs text-gray-500">
                          ETA:{" "}
                          {rate.estimated_delivery_date ||
                            rate.estimated_delivery_days ||
                            "NA"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          ₹{rate.rate ?? "NA"}
                        </div>
                        {rate.cod_available && <Tag color="gold">COD</Tag>}
                      </div>
                    </div>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </div>
        ) : null}
      </Space>
    </Modal>
  );
};

export default ShipOrderModal;
