import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    inviteStatus: {
      type: String,
      enum: ["manual", "invited", "accepted"],
      default: "manual",
    },
  },
  { timestamps: true },
);

const splitSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR", "GBP"],
    },
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    splitMethod: {
      type: String,
      enum: ["equal", "exact", "percentage", "shares"],
      default: "equal",
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    receiptImage: {
      name: String,
      type: String,
      data: String,
      publicId: String,
    },
    splits: [splitSchema],
  },
  { timestamps: true },
);

const settlementSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

const groupSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR", "GBP"],
    },
    members: [memberSchema],
    expenses: [expenseSchema],
    settlements: [settlementSchema],
  },
  { timestamps: true },
);

export default mongoose.model("Group", groupSchema);
