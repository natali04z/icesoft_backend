import mongoose from 'mongoose';

const SaleSchema = new mongoose.Schema({
  id: { 
    type: String,
    required: true,
    unique: true 
  },
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Customer", 
    required: true 
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product", 
    required: true 
  },
  date: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  price: { 
    type: Number, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  total: { 
    type: Number, 
    required: true 
  }
});

// Middleware para calcular el total antes de guardar
SaleSchema.pre('save', function(next) {
  this.total = this.price * this.quantity;
  next();
});

const Sale = mongoose.model('Sale', SaleSchema);

export default Sale;