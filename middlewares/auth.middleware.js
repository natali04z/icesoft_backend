// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import Role from "../models/role.js";
import mongoose from "mongoose";
import { checkPermissionSync, getDefaultPermissions } from "../utils/permissions.js";

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

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    let role;
    
    // Comprobar si decoded.role es un ObjectId o un nombre
    if (mongoose.Types.ObjectId.isValid(decoded.role)) {
      // Es un ObjectId, buscar por ID
      role = await Role.findById(decoded.role);
    } else {
      // Es un nombre (string), buscar por nombre
      role = await Role.findOne({ name: decoded.role });
    }
    
    if (!role) {
      return res.status(403).json({ message: "Role not found" });
    }

    req.user = {
      id: decoded.id,
      roleId: role._id,
      role: role
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token error" });
  }
};

export const authorizePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const roleName = req.user.role.name;
      
      // Caso 1: Si es admin, permitir todo
      if (roleName === 'admin') {
        return next();
      }
      
      // Caso 2: Verificar en configuración predefinida si existe
      const defaultRoles = ["admin", "assistant", "employee"];
      if (defaultRoles.includes(roleName)) {
        // Obtener los permisos predefinidos para este rol
        const defaultPermissions = getDefaultPermissions(roleName);
        const hasDefaultPermission = defaultPermissions.includes(permission);
        
        if (hasDefaultPermission) {
          return next();
        }
      }
      
      // Caso 3: Verificar en los permisos almacenados
      if (req.user.role.permissions && req.user.role.permissions.length > 0) {
        const hasStoredPermission = req.user.role.permissions.some(p => 
          typeof p === 'string' ? p === permission : p.name === permission
        );
        
        if (hasStoredPermission) {
          return next();
        }
      }
      
      // Si llegamos aquí, no tiene permiso
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: permission,
        role: roleName
      });
      
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(403).json({ message: "Authorization failed" });
    }
  };
};