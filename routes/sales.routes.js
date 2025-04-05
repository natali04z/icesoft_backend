import express from "express";
import {
    getSales,
    getSaleById,
    postSale,
    updateSale,
    deleteSale
} from "../controllers/sales.controller.js";

import { authenticateUser, authorizePermission } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authenticateUser, authorizePermission("view_sales"), getSales);
router.get("/:id", authenticateUser, authorizePermission("view_sales_id"), getSaleById);
router.post("/", authenticateUser, authorizePermission("create_sales"), postSale);
router.put("/:id", authenticateUser, authorizePermission("update_sales"), updateSale);
router.delete("/:id", authenticateUser, authorizePermission("delete_sales"), deleteSale);

export default router;