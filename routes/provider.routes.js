import { Router } from "express";
import { getProviders, getOneProvider, postProvider, putProvider, deleteProvider } from "../controllers/provider.controller.js";
import { authenticateUser, authorizePermission } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticateUser, authorizePermission("view_providers"),getProviders);
router.get("/:id",authenticateUser, authorizePermission("view_providers_id"), getOneProvider);
router.post("/", authenticateUser, authorizePermission("create_providers"),postProvider);
router.put("/:id", authenticateUser, authorizePermission("update_providers"),putProvider);
router.delete("/:id", authenticateUser, authorizePermission("delete_providers"), deleteProvider);

export default router