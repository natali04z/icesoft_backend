import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    enum: ["admin", "assistant", "employee"], 
    required: true, 
    unique: true 
  }
});

const Role = mongoose.model("Role", RoleSchema);
export default Role;