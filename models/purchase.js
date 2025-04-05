import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    purchaseDate: { type: Date, required: true, default: Date.now },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    total: { type: Number, required: true },
    details: { type: String, required: true, trim: true }
});

export default mongoose.model("Purchase", purchaseSchema);
