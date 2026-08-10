import express from "express";
import {
  createAddress,
  deleteAddress,
  getAddressById,
  getAddresses,
  getDefaultAddress,
  setDefaultAddress,
  updateAddress,
} from "../controllers/address.controller";
import { authorize, protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(protect);
router.use(authorize(["customer"]));

router.get("/", getAddresses);

router.get("/default", getDefaultAddress);

router.get("/:id", getAddressById);

router.post("/", createAddress);

router.put("/:id", updateAddress);

router.patch("/:id/default", setDefaultAddress);

router.delete("/:id", deleteAddress);

export default router;
