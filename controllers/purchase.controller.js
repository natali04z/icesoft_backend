import mongoose from "mongoose";
import Purchase from "../models/purchase.js";
import Product from "../models/product.js";
import Provider from "../models/provider.js";
import { checkPermission } from "../utils/permissions.js";

// Function to generate purchase ID
async function generatePurchaseId() {
    const lastPurchase = await Purchase.findOne().sort({ createdAt: -1 });
    if (!lastPurchase || !/^Pu\d{2}$/.test(lastPurchase.id)) {
        return "Pu01";
    }

    const lastNumber = parseInt(lastPurchase.id.substring(2), 10);
    const nextNumber = (lastNumber + 1).toString().padStart(2, "0");
    return `Pu${nextNumber}`;
}

// Validate purchase data
function validatePurchaseData(data, isUpdate = false) {
    const errors = [];
    
    // Only validate required fields if it's not an update
    if (!isUpdate) {
        if (!data.product) errors.push("Product is required");
        if (!data.provider) errors.push("Provider is required");
        if (data.total === undefined) errors.push("Total is required");
        if (!data.details) errors.push("Details are required");
    }
    
    // Validate product ID if provided
    if (data.product && !mongoose.Types.ObjectId.isValid(data.product)) {
        errors.push("Invalid product ID format");
    }
    
    // Validate provider ID if provided
    if (data.provider && !mongoose.Types.ObjectId.isValid(data.provider)) {
        errors.push("Invalid provider ID format");
    }
    
    // Validate numeric fields
    if (data.total !== undefined) {
        if (typeof data.total !== "number") {
            errors.push("Total must be a number");
        } else if (data.total <= 0) {
            errors.push("Total must be a positive number");
        }
    }
    
    // Validate date if provided
    if (data.purchaseDate !== undefined) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;
        if (!dateRegex.test(data.purchaseDate) && !(data.purchaseDate instanceof Date)) {
            errors.push("Invalid date format. Use YYYY-MM-DD or ISO format");
        }
    }
    
    // Validate string fields
    if (data.details !== undefined && (typeof data.details !== "string" || data.details.trim() === "")) {
        errors.push("Details must be a non-empty string");
    }
    
    return errors;
}

// GET: Retrieve all purchases
export const getPurchases = async (req, res) => {
    try {        
        if (!checkPermission(req.user.role, "view_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const purchases = await Purchase.find()
            .select("id total details purchaseDate product provider")
            .populate("product", "name")
            .populate("provider", "name");

        // Format the date in the response
        const Purchases = purchases.map(purchase => {
            const purchaseObj = purchase.toObject();
            if (purchaseObj.purchaseDate) {
                purchaseObj.purchaseDate = new Date(purchaseObj.purchaseDate).toISOString().split('T')[0];
            }
            return purchaseObj;
        });

        res.status(200).json(Purchases);
    } catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET: Retrieve a single purchase by ID
export const getPurchaseById = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_purchases_id")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        const purchase = await Purchase.findById(id)
            .select("id total details purchaseDate")
            .populate("product", "name price")
            .populate("provider", "name contact_number");

        if (!purchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        // Format the date in the response
        const formattedPurchase = purchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }

        res.status(200).json(formattedPurchase);
    } catch (error) {
        console.error("Error fetching purchase:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// POST: Create new purchase
export const postPurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "create_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { product, provider, total, details, purchaseDate } = req.body;
        
        // Validate input data
        const validationErrors = validatePurchaseData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ message: "Validation failed", errors: validationErrors });
        }

        // Check if product exists
        const existingProduct = await Product.findById(product);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if provider exists
        const existingProvider = await Provider.findById(provider);
        if (!existingProvider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        const id = await generatePurchaseId();
        const newPurchase = new Purchase({
            id,
            product,
            purchaseDate: purchaseDate || new Date(),
            provider,
            total,
            details
        });

        await newPurchase.save();
        
        // Format the date in the response
        const formattedPurchase = newPurchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }
        
        res.status(201).json({ message: "Purchase created successfully", purchase: formattedPurchase });
    } catch (error) {
        console.error("Error creating purchase:", error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation failed", errors });
        }
        
        res.status(500).json({ message: "Server error" });
    }
};

// PUT: Update an existing purchase
export const updatePurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "edit_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;
        const { product, provider, purchaseDate, total, details } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        // Validate input data (with isUpdate flag)
        const validationErrors = validatePurchaseData(req.body, true);
        if (validationErrors.length > 0) {
            return res.status(400).json({ message: "Validation failed", errors: validationErrors });
        }

        let updateFields = {};

        // Check and update product if provided
        if (product) {
            const existingProduct = await Product.findById(product);
            if (!existingProduct) {
                return res.status(404).json({ message: "Product not found" });
            }
            updateFields.product = product;
        }

        // Check and update provider if provided
        if (provider) {
            const existingProvider = await Provider.findById(provider);
            if (!existingProvider) {
                return res.status(404).json({ message: "Provider not found" });
            }
            updateFields.provider = provider;
        }

        // Update other fields if provided
        if (purchaseDate !== undefined) updateFields.purchaseDate = purchaseDate;
        if (total !== undefined) updateFields.total = total;
        if (details !== undefined) updateFields.details = details;
        
        // Check if there are fields to update
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const updatedPurchase = await Purchase.findByIdAndUpdate(id, updateFields, {
            new: true,
            runValidators: true
        })
            .select("id product provider purchaseDate total details")
            .populate("product", "name")
            .populate("provider", "name");

        if (!updatedPurchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        // Format the date in the response
        const formattedPurchase = updatedPurchase.toObject();
        if (formattedPurchase.purchaseDate) {
            formattedPurchase.purchaseDate = new Date(formattedPurchase.purchaseDate).toISOString().split('T')[0];
        }

        res.status(200).json({ message: "Purchase updated successfully", purchase: formattedPurchase });
    } catch (error) {
        console.error("Error updating purchase:", error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: "Validation failed", errors });
        }
        
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE: Remove a purchase by ID
export const deletePurchase = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "delete_purchases")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid purchase ID format" });
        }

        const deletedPurchase = await Purchase.findByIdAndDelete(id);

        if (!deletedPurchase) {
            return res.status(404).json({ message: "Purchase not found" });
        }

        res.status(200).json({ message: "Purchase deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase:", error);
        res.status(500).json({ message: "Server error" });
    }
};