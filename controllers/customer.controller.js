import Customer from "../models/customer.js";
import mongoose from "mongoose";
import { checkPermission } from "../utils/permissions.js";

// Obtener todos los clientes
export const getCustomers = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_customers")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const customers = await Customer.find()
            .select("name email phone createdAt"); // Se incluye createdAt

        res.status(200).json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Obtener un cliente por ID
export const getCustomerById = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "view_customers_id")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        const customer = await Customer.findById(id)
            .select("id name email phone createdAt"); // Se incluye createdAt

        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        res.status(200).json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Crear un nuevo cliente
export const createCustomer = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "create_customers")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Verificar si el email ya existe
        const existingCustomer = await Customer.findOne({ email });
        if (existingCustomer) {
            return res.status(400).json({ message: "Customer with this email already exists" });
        }

        const newCustomer = new Customer({
            name,
            email,
            phone,
            createdAt: new Date(), // Se asigna explícitamente al crear
        });

        await newCustomer.save();
        res.status(201).json({ 
            message: "Customer created successfully", 
            customer: {
                id: newCustomer._id,
                name: newCustomer.name,
                email: newCustomer.email,
                phone: newCustomer.phone,
                createdAt: newCustomer.createdAt, // Se devuelve en la respuesta
            }
        });
    } catch (error) {
        console.error("Error creating customer:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Actualizar un cliente
export const updateCustomer = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "update_customers")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;
        const { name, email, phone } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        // Validar email si se proporciona
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: "Invalid email format" });
            }

            // Verificar si otro cliente ya tiene este email
            const existingCustomer = await Customer.findOne({ email, _id: { $ne: id } });
            if (existingCustomer) {
                return res.status(400).json({ message: "Email already in use by another customer" });
            }
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            id,
            { name, email, phone },
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        res.status(200).json({ 
            message: "Customer updated successfully", 
            customer: {
                id: updatedCustomer._id,
                name: updatedCustomer.name,
                email: updatedCustomer.email,
                phone: updatedCustomer.phone,
                createdAt: updatedCustomer.createdAt, // Se devuelve en la respuesta
            }
        });
    } catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Eliminar un cliente
export const deleteCustomer = async (req, res) => {
    try {
        if (!checkPermission(req.user.role, "delete_customers")) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid customer ID" });
        }

        const deletedCustomer = await Customer.findByIdAndDelete(id);

        if (!deletedCustomer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        res.status(200).json({ message: "Customer deleted successfully" });
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ message: "Server error" });
    }
};