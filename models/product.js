import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  minimumStock: { type: Number, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
});

export default mongoose.model("Product", ProductSchema);