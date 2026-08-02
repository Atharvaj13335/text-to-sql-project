import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger.js";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ["admin", "analyst", "viewer"], default: "analyst" },
    region: { type: String, default: "" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

const inMemoryUsers = new Map();

export async function registerUser({ email, password, name, role = "analyst", region = "" }) {
  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(password, 10);

  if (mongoose.connection.readyState === 1) {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new Error("User already exists with this email address.");
    }
    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      name: name || normalizedEmail.split("@")[0],
      role,
      region,
    });
    await newUser.save();
    return { id: newUser._id.toString(), email: newUser.email, name: newUser.name, role: newUser.role, region: newUser.region };
  } else {
    if (inMemoryUsers.has(normalizedEmail)) {
      throw new Error("User already exists with this email address.");
    }
    const userObj = {
      id: "mem_" + Date.now(),
      email: normalizedEmail,
      password: hashedPassword,
      name: name || normalizedEmail.split("@")[0],
      role,
      region,
    };
    inMemoryUsers.set(normalizedEmail, userObj);
    return { id: userObj.id, email: userObj.email, name: userObj.name, role: userObj.role, region: userObj.region };
  }
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw new Error("Invalid email or password.");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, region: user.region };
  } else {
    const user = inMemoryUsers.get(normalizedEmail);
    if (!user) {
      throw new Error("Invalid email or password.");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password.");
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, region: user.region };
  }
}

export async function findOrCreateUser({ email, name }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const defaultPassword = await bcrypt.hash("ChangeMe123!", 10);
      user = new User({
        email: normalizedEmail,
        password: defaultPassword,
        name: name || normalizedEmail.split("@")[0],
        role: "analyst",
      });
      await user.save();
    }
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, region: user.region };
  } else {
    let user = inMemoryUsers.get(normalizedEmail);
    if (!user) {
      const defaultPassword = await bcrypt.hash("ChangeMe123!", 10);
      user = {
        id: "mem_" + Date.now(),
        email: normalizedEmail,
        password: defaultPassword,
        name: name || normalizedEmail.split("@")[0],
        role: "analyst",
        region: "",
      };
      inMemoryUsers.set(normalizedEmail, user);
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, region: user.region };
  }
}

export async function getUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ email: normalizedEmail }).lean();
    if (!user) return null;
    return { id: user._id.toString(), email: user.email, name: user.name, role: user.role, region: user.region };
  }
  const user = inMemoryUsers.get(normalizedEmail);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, region: user.region };
}
