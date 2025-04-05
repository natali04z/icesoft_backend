import User from "../models/user.js";
import Role from "../models/role.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Register user

export const registerUser = async (req, res) => {
    try {
        const { name, lastname, contact_number, email, password, role } = req.body;

        // Validate required fields
        if (!name || !lastname || !contact_number || !email || !password || !role) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Find role by name
        const roleDoc = await Role.findOne({ name: role });
        if (!roleDoc) {
            return res.status(400).json({ message: "Invalid role name" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create and save user
        const newUser = new User({
            name,
            lastname,
            contact_number,
            email,
            password: hashedPassword,
            role: roleDoc._id
        });

        await newUser.save();
        await newUser.populate("role", "name");

        // Generate JWT
        const token = jwt.sign(
            { name: newUser.name, role: newUser.role.name },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        // Respond
        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                name: newUser.name,
                lastname: newUser.lastname,
                contact_number: newUser.contact_number,
                email: newUser.email,
                role: newUser.role.name
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// LOGIN USER
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email }).populate("role"); // ← Esto es CLAVE
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            {id: user._id, role: user.role.name  }, // ← ¡Esto es incorrecto!
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
          );

        res.json({ token });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// GET AUTHENTICATED USER
export const getAuthenticatedUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// RESET/CHANGE PASSWORD (without email link)
export const changeOwnPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required" });
        }

        const user = await User.findById(req.user.id); // Solo el usuario logueado

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
};