import mongoose from "mongoose";

const SaleSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, trim: true },
  customer: { type: String, required: true, trim: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

export default mongoose.model("Sale", SaleSchema);