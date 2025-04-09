import User from "../models/user.js";
import Role from "../models/role.js";
import mongoose from "mongoose";

// Get all users
export const getUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password").populate("role", "name");
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
};

// Get user by ID
export const getOneUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const user = await User.findById(id).select("-password").populate("role", "name");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
};

// putUser.js
export const putUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, lastname, contact_number, email, role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }
        
        // Verificar si req.user existe
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }
        
        // Verificar formato del ID del usuario actual
        let currentUserId;
        if (req.user._id) {
            currentUserId = req.user._id.toString ? req.user._id.toString() : String(req.user._id);
        } else if (req.user.id) {
            currentUserId = req.user.id.toString ? req.user.id.toString() : String(req.user.id);
        } else {
            return res.status(401).json({ message: "User ID not found in authentication token" });
        }
        
        // Verificar rol de usuario
        let isAdmin = false;
        if (typeof req.user.role === 'string') {
            isAdmin = req.user.role === 'admin';
        } else if (req.user.role && typeof req.user.role === 'object') {
            isAdmin = req.user.role.name === 'admin';
        } else if (req.user.role && req.user.role._id) {
            // Si role es un ObjectId, necesitamos comparar con el documento Role
            const roleDoc = await Role.findById(req.user.role);
            isAdmin = roleDoc && roleDoc.name === 'admin';
        }

        // Verificación de autorización
        if (currentUserId !== id && !isAdmin) {
            return res.status(403).json({ message: "Unauthorized to edit this user" });
        }

        let updateData = { name, lastname, contact_number, email };

        // Verificar si el usuario es admin y quiere cambiar el rol
        if (isAdmin && role) {
            const roleDoc = await Role.findById(role);
            if (!roleDoc) {
                return res.status(400).json({ message: "Invalid role ID" });
            }
            updateData.role = role;
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select("-password").populate("role", "name");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
};

// Delete a user
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
};
