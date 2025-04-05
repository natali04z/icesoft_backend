import Sale from '../models/sales.js';
import Product from "../models/product.js";
import mongoose from "mongoose";
import { checkPermission } from "../utils/permissions.js";

async function generateSaleId() {
    const lastSale = await Sale.findOne().sort({ _id: -1 });

    if (!lastSale || !/^Sa\d{2}$/.test(lastSale.id)) {
        return "Sa01";
    }

    const lastNumber = parseInt(lastSale.id.substring(2), 10);
    const nextNumber = (lastNumber + 1).toString().padStart(2, "0");
    return `Sa${nextNumber}`;
}

// Get all sales
export const getSales = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const sales = await Sale.find()
            .select("id customer product quantity price totalAmount")
            .populate("product", "name price");

        res.status(200).json(sales);
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get sale by ID
export const getSaleById = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_sales_id")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID" });
        }

        const sale = await Sale.findById(id)
            .select("id customer product quantity price totalAmount")
            .populate("product", "name price");

        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        res.status(200).json(sale);
    } catch (error) {
        console.error("Error fetching sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Create a new sale
export const postSale = async (req, res) => {
  try {
      if (!checkPermission(req.user.role, "create_sales")) {
          return res.status(403).json({ message: "Unauthorized access" });
      }

      const { customer, product, quantity, price, totalAmount, date } = req.body;

      if (!customer || !product || quantity === undefined || price === undefined || totalAmount === undefined) {
          return res.status(400).json({ message: "All fields are required" });
      }

      if (!mongoose.Types.ObjectId.isValid(product)) {
          return res.status(400).json({ message: "Invalid product ID" });
      }

      const existingProduct = await Product.findById(product);
      if (!existingProduct) {
          return res.status(404).json({ message: "Product not found" });
      }

      if (typeof quantity !== "number" || quantity <= 0) {
          return res.status(400).json({ message: "Quantity must be a positive number" });
      }

      if (existingProduct.stock < quantity) {
          return res.status(400).json({ message: "Not enough stock available" });
      }

      // Reduce product stock
      existingProduct.stock -= quantity;
      await existingProduct.save();

      const id = await generateSaleId();
      const newSale = new Sale({
          id,
          customer,
          product,
          quantity,
          price,
          totalAmount,
          date: date || new Date()
      });

      await newSale.save();
      res.status(201).json({ message: "Sale created successfully", sale: newSale });
  } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: "Server error" });
  }
};


// Update a sale
// Update a sale
export const updateSale = async (req, res) => {
  try {
      if (!checkPermission(req.user.role, "update_sales")) {
          return res.status(403).json({ message: "Unauthorized access" });
      }

      const { id } = req.params;
      const { customer, product, quantity, price, totalAmount, date } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid sale ID" });
      }

      const sale = await Sale.findById(id);
      if (!sale) {
          return res.status(404).json({ message: "Sale not found" });
      }

      let stockDifference = 0;
      let newProductId = sale.product;

      // Manejar cambios en la cantidad
      if (quantity !== undefined && quantity !== sale.quantity) {
          const existingProduct = await Product.findById(sale.product);
          if (!existingProduct) {
              return res.status(404).json({ message: "Product not found" });
          }

          stockDifference = quantity - sale.quantity;

          if (stockDifference > 0 && existingProduct.stock < stockDifference) {
              return res.status(400).json({ message: "Not enough stock available" });
          }

          existingProduct.stock -= stockDifference;
          await existingProduct.save();
      }

      // Manejar cambios de producto
      if (product && sale?.product && product !== sale.product.toString()) {
          if (!mongoose.Types.ObjectId.isValid(product)) {
              return res.status(400).json({ message: "Invalid product ID" });
          }

          const newProduct = await Product.findById(product);
          if (!newProduct) {
              return res.status(404).json({ message: "New product not found" });
          }

          const oldProduct = await Product.findById(sale.product);
          if (oldProduct) {
              oldProduct.stock += sale.quantity;
              await oldProduct.save();
          }

          const quantityToUse = quantity !== undefined ? quantity : sale.quantity;
          if (newProduct.stock < quantityToUse) {
              return res.status(400).json({ message: "Not enough stock in new product" });
          }

          newProduct.stock -= quantityToUse;
          await newProduct.save();
          newProductId = newProduct._id;
      }

      const updatedSale = await Sale.findByIdAndUpdate(
          id,
          {
              customer: customer || sale.customer,
              product: newProductId,
              quantity: quantity !== undefined ? quantity : sale.quantity,
              price: price !== undefined ? price : sale.price,
              totalAmount: totalAmount !== undefined ? totalAmount : sale.totalAmount,
              date: date !== undefined ? date : sale.date
          },
          { new: true, runValidators: true }
      )
          .select("id customer product quantity price totalAmount date")
          .populate("product", "name price");

      res.status(200).json({ message: "Sale updated successfully", sale: updatedSale });
  } catch (error) {
      console.error("Error updating sale:", error);
      res.status(500).json({ message: "Server error" });
  }
};

// Delete a sale
export const deleteSale = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "delete_sales")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid sale ID" });
        }

        const sale = await Sale.findById(id);
        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Return stock to product
        const product = await Product.findById(sale.product);
        if (product) {
            product.stock += sale.quantity;
            await product.save();
        }

        await Sale.findByIdAndDelete(id);
        res.status(200).json({ message: "Sale deleted successfully" });
    } catch (error) {
        console.error("Error deleting sale:", error);
        res.status(500).json({ message: "Server error" });
    }
};