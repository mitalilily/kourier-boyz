import User, { IUser, UserRole } from "../models/User";
import { Request, Response } from "express";

export const checkUserAccess = async (
  req: Request,
  res: Response,
  allowedRoles: UserRole[]
): Promise<IUser | null> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: "User not authenticated" });
    return null;
  }

  const user = await User.findById(userId);
  if (!user || !allowedRoles.includes(user.role)) {
    res
      .status(403)
      .json({ error: `Access denied. ${allowedRoles.join("/")} access only.` });
    return null;
  }

  return user;
};
