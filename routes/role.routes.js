import { Router } from "express";
import { getRoles, postRole } from "../controllers/role.controller.js";
import { authenticateUser, authorizePermission } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticateUser, authorizePermission("view_roles"), getRoles);
router.post("/", authenticateUser, authorizePermission("create_roles"), postRole);

export default router;