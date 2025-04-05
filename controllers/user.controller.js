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

        // Solo admin puede editar otros usuarios
        if (req.user.id !== id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Unauthorized to edit this user" });
        }

        let updateData = { name, lastname, contact_number, email };

        if (req.user.role === "admin" && role) {
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
