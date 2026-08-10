import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddressFormData } from "@/types/address";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface AddressFormProps {
  defaultValues?: Partial<AddressFormData>;
  onSubmit: (data: AddressFormData, shouldSave: boolean) => void | Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  showSubmitButton?: boolean;
  onCancel?: () => void;
  isNewAddress?: boolean;
}

export const AddressForm = ({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Address",
  showSubmitButton = true,
  onCancel,
  isNewAddress = false,
}: AddressFormProps) => {
  const [shouldSave, setShouldSave] = useState(false);
  const form = useForm<AddressFormData>({
    defaultValues: {
      fullName: defaultValues?.fullName || "",
      phone: defaultValues?.phone || "",
      addressLine1: defaultValues?.addressLine1 || "",
      addressLine2: defaultValues?.addressLine2 || "",
      city: defaultValues?.city || "",
      state: defaultValues?.state || "",
      postalCode: defaultValues?.postalCode || "",
      country: defaultValues?.country || "India",
      isDefault: defaultValues?.isDefault || false,
      addressType: defaultValues?.addressType || "home",
      landmark: defaultValues?.landmark || "",
    },
    mode: "onChange",
  });

  const handleSubmit = async (data: AddressFormData) => {
    // When editing, always save (shouldSave = true)
    // When creating new, use the checkbox value
    const saveToDb = !isNewAddress || shouldSave;
    await onSubmit(data, saveToDb);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <FieldGroup>
        <Field>
          <FieldLabel>Full Name *</FieldLabel>
          <Input
            placeholder="Enter full name"
            {...form.register("fullName", {
              required: "Full name is required",
              minLength: {
                value: 2,
                message: "Name must be at least 2 characters",
              },
            })}
          />
          <FieldError errors={[form.formState.errors.fullName]} />
        </Field>

        <Field>
          <FieldLabel>Phone Number *</FieldLabel>
          <Input
            type="tel"
            placeholder="Enter phone number"
            {...form.register("phone", {
              required: "Phone number is required",
              pattern: {
                value: /^[6-9]\d{9}$/,
                message:
                  "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9",
              },
            })}
          />
          <FieldError errors={[form.formState.errors.phone]} />
        </Field>

        <Field>
          <FieldLabel>Address Line 1 *</FieldLabel>
          <Input
            placeholder="Street address, house number"
            {...form.register("addressLine1", {
              required: "Address line 1 is required",
              minLength: {
                value: 5,
                message: "Address must be at least 5 characters",
              },
            })}
          />
          <FieldError errors={[form.formState.errors.addressLine1]} />
        </Field>

        <Field>
          <FieldLabel>Address Line 2</FieldLabel>
          <Input
            placeholder="Apartment, suite, unit, building, floor, etc."
            {...form.register("addressLine2")}
          />
          <FieldError errors={[form.formState.errors.addressLine2]} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>City *</FieldLabel>
            <Input
              placeholder="Enter city"
              {...form.register("city", {
                required: "City is required",
              })}
            />
            <FieldError errors={[form.formState.errors.city]} />
          </Field>

          <Field>
            <FieldLabel>State *</FieldLabel>
            <Input
              placeholder="Enter state"
              {...form.register("state", {
                required: "State is required",
              })}
            />
            <FieldError errors={[form.formState.errors.state]} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Postal Code *</FieldLabel>
            <Input
              placeholder="Enter postal code"
              {...form.register("postalCode", {
                required: "Postal code is required",
                pattern: {
                  value: /^[0-9]{6}$/,
                  message: "Please enter a valid 6-digit postal code",
                },
              })}
            />
            <FieldError errors={[form.formState.errors.postalCode]} />
          </Field>

          <Field>
            <FieldLabel>Country *</FieldLabel>
            <Input
              placeholder="Enter country"
              {...form.register("country", {
                required: "Country is required",
              })}
            />
            <FieldError errors={[form.formState.errors.country]} />
          </Field>
        </div>

        <Field>
          <FieldLabel>Address Type</FieldLabel>
          <Select
            value={form.watch("addressType")}
            onValueChange={(value: "home" | "work" | "other") => {
              form.setValue("addressType", value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select address type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="work">Work</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <FieldError errors={[form.formState.errors.addressType]} />
        </Field>

        <Field>
          <FieldLabel>Landmark (Optional)</FieldLabel>
          <Input
            placeholder="Nearby landmark for easy identification"
            {...form.register("landmark")}
          />
          <FieldError errors={[form.formState.errors.landmark]} />
        </Field>

        <div className="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id="isDefault"
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            checked={form.watch("isDefault")}
            onChange={(e) => form.setValue("isDefault", e.target.checked)}
          />
          <Label
            htmlFor="isDefault"
            className="text-sm font-medium cursor-pointer"
          >
            Set as default address
          </Label>
        </div>

        {isNewAddress && (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="shouldSave"
              checked={shouldSave}
              onCheckedChange={(checked) => setShouldSave(checked === true)}
            />
            <Label
              htmlFor="shouldSave"
              className="text-sm font-medium cursor-pointer"
            >
              Save address for future use
            </Label>
          </div>
        )}
      </FieldGroup>

      {showSubmitButton && (
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
};
