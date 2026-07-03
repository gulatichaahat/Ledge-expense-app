import express from "express";
import User from "../models/User.js";
import { createToken, revokeToken } from "../utils/tokens.js";
import { sendOtpEmail } from "../utils/mailer.js";

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      throw Object.assign(new Error("Enter name, email, and a password of at least 6 characters."), { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    if (user?.isEmailVerified) {
      throw Object.assign(new Error("An account already exists with this email."), { status: 409 });
    }

    if (!user) {
      user = new User({ name, email: normalizedEmail });
    } else {
      user.name = name;
    }

    user.setPassword(password);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.setEmailOtp(otp);
    await user.save();

    const emailResult = await sendOtpEmail({ to: user.email, name: user.name, otp });
    if (!emailResult.sent) {
      throw Object.assign(new Error(`OTP email could not be sent. ${emailResult.reason || "Check SMTP settings and restart the app."}`), { status: 500 });
    }

    res.status(201).json({
      message: "OTP sent to your email. Verify it to activate your account.",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase() });

    if (!user || !user.verifyEmailOtp(String(otp || "").trim())) {
      throw Object.assign(new Error("Invalid or expired OTP."), { status: 400 });
    }

    user.isEmailVerified = true;
    user.emailOtpHash = "";
    user.emailOtpExpiresAt = undefined;
    await user.save();

    res.json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase() });

    if (!user || !user.verifyPassword(password || "")) {
      throw Object.assign(new Error("Invalid email or password."), { status: 401 });
    }
    if (!user.isEmailVerified) {
      throw Object.assign(new Error("Please verify your email with OTP before signing in."), { status: 403 });
    }

    res.json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) revokeToken(token);
  res.status(204).end();
});

export default router;
