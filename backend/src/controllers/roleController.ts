import { Request, Response } from 'express'
import Role, { IModulePermissions, Permission } from '../models/Role'
import UserRole from '../models/UserRole'

// Get all roles
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 })
    res.json(roles)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
}

// Get single role by ID
export const getRoleById = async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id)
    if (!role) {
      return res.status(404).json({ error: 'Role not found' })
    }
    res.json(role)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch role' })
  }
}

// Create new role
export const createRole = async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' })
    }

    // Check if role with same name exists
    const existingRole = await Role.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
    if (existingRole) {
      return res.status(400).json({ error: 'Role with this name already exists' })
    }

    const role = new Role({
      name,
      description,
      permissions: permissions || {},
      isSystemRole: false,
    })

    await role.save()
    res.status(201).json(role)
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Role with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create role' })
  }
}

// Update role
export const updateRole = async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body
    const role = await Role.findById(req.params.id)

    if (!role) {
      return res.status(404).json({ error: 'Role not found' })
    }

    // Prevent updating system roles
    if (role.isSystemRole) {
      return res.status(403).json({ error: 'Cannot modify system roles' })
    }

    // Check if new name conflicts with existing role
    if (name && name !== role.name) {
      const existingRole = await Role.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id },
      })
      if (existingRole) {
        return res.status(400).json({ error: 'Role with this name already exists' })
      }
      role.name = name
    }

    if (description !== undefined) role.description = description
    if (permissions) role.permissions = permissions

    await role.save()
    res.json(role)
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Role with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to update role' })
  }
}

// Delete role
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id)

    if (!role) {
      return res.status(404).json({ error: 'Role not found' })
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return res.status(403).json({ error: 'Cannot delete system roles' })
    }

    // Check if role is assigned to any users
    const userRoles = await UserRole.find({ roleId: role._id })
    if (userRoles.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete role. It is assigned to one or more users.',
        assignedUsersCount: userRoles.length,
      })
    }

    await Role.findByIdAndDelete(req.params.id)
    res.json({ message: 'Role deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete role' })
  }
}

// Get users with a specific role
export const getRoleUsers = async (req: Request, res: Response) => {
  try {
    const roleId = req.params.id
    const userRoles = await UserRole.find({ roleId }).populate('userId', 'name email')
    res.json(userRoles)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch role users' })
  }
}



