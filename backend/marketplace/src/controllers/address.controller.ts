import { Request, Response } from "express";
import Address from "../models/Address";
import { checkUserAccess } from "../utils/checkUserAccess";

export const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await checkUserAccess(req, res, ["customer"]);

    if (!user) return;

    const addresses = await Address.find({ user: userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    res.json({ addresses });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAddressById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    res.json({ address });
  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
      addressType,
      landmark,
    } = req.body;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    if (
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode ||
      !country
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "fullName",
          "phone",
          "addressLine1",
          "city",
          "state",
          "postalCode",
          "country",
        ],
      });
    }

    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const address = await Address.create({
      user: userId,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault: isDefault || false,
      addressType: addressType || "home",
      landmark,
    });

    res.status(201).json({ message: "Address created successfully", address });
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
      addressType,
      landmark,
    } = req.body;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    if (fullName) address.fullName = fullName;
    if (phone) address.phone = phone;
    if (addressLine1) address.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
    if (city) address.city = city;
    if (state) address.state = state;
    if (postalCode) address.postalCode = postalCode;
    if (country) address.country = country;
    if (addressType) address.addressType = addressType;
    if (landmark !== undefined) address.landmark = landmark;

    if (isDefault !== undefined && isDefault !== address.isDefault) {
      address.isDefault = isDefault;
      if (isDefault) {
        await Address.updateMany(
          { user: userId, _id: { $ne: id } },
          { isDefault: false }
        );
      }
    }

    await address.save();

    res.json({ message: "Address updated successfully", address });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete an address
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    await Address.findByIdAndDelete(id);

    res.json({ message: "Address deleted successfully" });

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }
    await Address.updateMany({ user: userId }, { isDefault: false });
    address.isDefault = true;
    await address.save();

    res.json({ message: "Default address updated successfully", address });

  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getDefaultAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const user = await checkUserAccess(req, res, ["customer"]);
    if (!user) return;

    const address = await Address.findOne({ user: userId, isDefault: true });

    if (!address) {
      return res.status(404).json({ error: "No default address found" });
    }

    res.json({ address });
  } catch (error) {
    console.error("Error fetching default address:", error);
    res.status(500).json({ error: "Server error" });
  }
};
