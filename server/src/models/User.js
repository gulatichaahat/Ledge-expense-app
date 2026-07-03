import crypto from "crypto";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailOtpHash: {
      type: String,
      default: "",
    },
    emailOtpExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = function setPassword(password) {
  this.passwordSalt = crypto.randomBytes(16).toString("hex");
  this.passwordHash = crypto.pbkdf2Sync(password, this.passwordSalt, 100000, 64, "sha512").toString("hex");
};

userSchema.methods.verifyPassword = function verifyPassword(password) {
  const hash = crypto.pbkdf2Sync(password, this.passwordSalt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(this.passwordHash, "hex"));
};

userSchema.methods.setEmailOtp = function setEmailOtp(otp) {
  this.emailOtpHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  this.emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
};

userSchema.methods.verifyEmailOtp = function verifyEmailOtp(otp) {
  if (!this.emailOtpHash || !this.emailOtpExpiresAt || this.emailOtpExpiresAt < new Date()) {
    return false;
  }

  const hash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(this.emailOtpHash));
};

export default mongoose.model("User", userSchema);
