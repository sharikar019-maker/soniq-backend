import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import AppError from "../utils/AppError.js";



export const getAllUsers = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    
    const match = {};
    if (req.query.status) match.status = req.query.status;
    if (req.query.role)   match.role   = req.query.role;
    if (req.query.search) {
      match.$or = [
        { name:  { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [result] = await User.aggregate([
      { $match: match },
      {
    
        $facet: {
          metadata: [{ $count: "total" }],
          users: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              
              $lookup: {
                from: "orders",
                let: { userId: "$_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$user", "$$userId"] } } },
                  { $count: "total" },
                ],
                as: "orderStats",
              },
            },
            {
              $project: {
                name:       1,
                email:      1,
                phone:      1,
                role:       1,
                status:     1,
                createdAt:  1,
                orderCount: { $ifNull: [{ $arrayElemAt: ["$orderStats.total", 0] }, 0] },
              },
            },
          ],
        },
      },
    ]);

    const total = result.metadata[0]?.total || 0;

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: result.users,
    });
  } catch (error) {
    next(error);
  }
};



export const getUserStats = async (req, res, next) => {
  try {
    const [stats] = await User.aggregate([
      {
        $facet: {
          total:   [{ $count: "count" }],
          active:  [{ $match: { status: "active"  } }, { $count: "count" }],
          blocked: [{ $match: { status: "blocked" } }, { $count: "count" }],
          
          newThisMonth: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            },
            { $count: "count" },
          ],
        },
      },
      {
        $project: {
          total:        { $ifNull: [{ $arrayElemAt: ["$total.count",        0] }, 0] },
          active:       { $ifNull: [{ $arrayElemAt: ["$active.count",       0] }, 0] },
          blocked:      { $ifNull: [{ $arrayElemAt: ["$blocked.count",      0] }, 0] },
          newThisMonth: { $ifNull: [{ $arrayElemAt: ["$newThisMonth.count", 0] }, 0] },
        },
      },
    ]);

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};



export const getUserById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return next(new AppError("Invalid user ID", 400));

    const [user] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $lookup: {
          from: "orders",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$user", "$$userId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $project: { items: 0 } }, 
          ],
          as: "recentOrders",
        },
      },
      {
        $project: {
          password:           0,
          refreshToken:       0,
          refreshTokenExpiry: 0,
        },
      },
    ]);

    if (!user) return next(new AppError("User not found", 404));

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};



export const updateUserStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return next(new AppError("Invalid user ID", 400));

    const { status } = req.body;
    if (!["active", "blocked"].includes(status))
      return next(new AppError("Status must be 'active' or 'blocked'", 400));

    
    if (req.params.id === req.user.id)
      return next(new AppError("You cannot change your own status", 400));

    const user = await User.findById(req.params.id).select("role").lean();
    if (!user) return next(new AppError("User not found", 404));

    
    if (user.role === "admin")
      return next(new AppError("Cannot change status of an admin account", 403));

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).select("name email role status").lean();

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};



export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password -refreshToken -refreshTokenExpiry")
      .lean();

    if (!user) return next(new AppError("User not found", 404));

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};



export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;

   
    const allowed = {
      ...(name  && { name  }),
      ...(phone && { phone }),
    };

    if (Object.keys(allowed).length === 0)
      return next(new AppError("Nothing to update", 400));

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: allowed },
      { new: true, runValidators: true }
    ).select("-password -refreshToken -refreshTokenExpiry").lean();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};



export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return next(new AppError("Current and new password are required", 400));

    if (currentPassword === newPassword)
      return next(new AppError("New password must be different from current", 400));

    
    const user = await User.findById(req.user.id).select("+password");
    if (!user) return next(new AppError("User not found", 404));

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return next(new AppError("Current password is incorrect", 401));

    user.password = newPassword; 
    await user.save();

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};



export const addAddress = async (req, res, next) => {
  try {
    const { street, city, state, postalCode, country, isDefault } = req.body;

    if (!street || !city || !state || !postalCode || !country)
      return next(new AppError("All address fields are required", 400));

    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User not found", 404));

    
    if (isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    
    const setAsDefault = isDefault || user.addresses.length === 0;
    user.addresses.push({ street, city, state, postalCode, country, isDefault: setAsDefault });

    await user.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};



export const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(addressId))
      return next(new AppError("Invalid address ID", 400));

    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User not found", 404));

    const address = user.addresses.id(addressId);
    if (!address) return next(new AppError("Address not found", 404));

    const { street, city, state, postalCode, country, isDefault } = req.body;

    
    if (isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    if (street)     address.street     = street;
    if (city)       address.city       = city;
    if (state)      address.state      = state;
    if (postalCode) address.postalCode = postalCode;
    if (country)    address.country    = country;
    if (isDefault !== undefined) address.isDefault = isDefault;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};



export const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(addressId))
      return next(new AppError("Invalid address ID", 400));

    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError("User not found", 404));

    const address = user.addresses.id(addressId);
    if (!address) return next(new AppError("Address not found", 404));

    const wasDefault = address.isDefault;
    address.deleteOne();

    
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};