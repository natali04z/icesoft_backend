import { Router } from "express";
import { getCategories, getOneCategory, postCategory, putCategory, deleteCategory } from "../controllers/category.controller.js";
import { authenticateUser, authorizePermission } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", authenticateUser, authorizePermission("view_categories"), getCategories);
router.get("/:id", authenticateUser, authorizePermission("view_categories_id"), getOneCategory);
router.post("/", authenticateUser, authorizePermission("create_categories"), postCategory);
router.put("/:id", authenticateUser, authorizePermission("update_categories"), putCategory);
router.delete("/:id", authenticateUser, authorizePermission("delete_categories"), deleteCategory);

export default router;