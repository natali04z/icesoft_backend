// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import Role from "../models/role.js";
import { checkPermissionSync } from "../utils/permissions.js";

// Middleware para autenticar al usuario
export const authenticateUser = async (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decodificado:", decoded);

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Buscar el rol en la base de datos para incluir toda la información
    const role = await Role.findById(decoded.role);
    
    if (!role) {
      console.error(`Rol no encontrado: ${decoded.role}`);
      return res.status(403).json({ message: "Role not found" });
    }

    req.user = {
      id: decoded.id,
      roleId: decoded.role,
      role: role // Incluir el objeto de rol completo
    };

    console.log(`Usuario autenticado: ${req.user.id}, Rol: ${role.name}`);
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Token error" });
  }
};

// Middleware para autorizar permisos
export const authorizePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      console.log(`Verificando permiso: ${permission} para rol: ${req.user.role.name}`);
      
      // Usar checkPermissionSync directamente con el objeto de rol
      const hasPermission = checkPermissionSync(req.user.role, permission);
      
      console.log(`¿Tiene permiso? ${hasPermission}`);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          required: permission,
          role: req.user.role.name
        });
      }
      
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(403).json({ message: "Authorization failed" });
    }
  };
};