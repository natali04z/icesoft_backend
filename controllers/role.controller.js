import Role from "../models/role.js";

// Get all roles
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json({ roles });
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ message: "Error fetching roles" });
    }
};

// Create a new role
export const postRole = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !["admin", "assistant", "employee"].includes(name)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({ message: "Role already exists" });
        }

        const newRole = new Role({ name });
        await newRole.save();
        res.status(201).json({ message: "Role created successfully" });
    } catch (error) {
        console.error("Error creating role:", error);
        res.status(500).json({ message: "Error creating role" });
    }
};