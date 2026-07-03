import express from "express";
import Group from "../models/Group.js";
import { requireAuth } from "../middleware/auth.js";
import { buildSplits, calculateBalances, simplifyDebts } from "../utils/balances.js";
import { sendInviteEmail, sendReminderEmail } from "../utils/mailer.js";
import { storeReceipt } from "../utils/receipts.js";

const router = express.Router();
router.use(requireAuth);

function enrichGroup(group) {
  const raw = group.toObject();
  raw.balances = calculateBalances(group);
  raw.simplifiedDebts = simplifyDebts(group);
  raw.summary = {
    totalSpent: group.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    totalSettled: group.settlements.reduce((sum, settlement) => sum + Number(settlement.amount), 0),
    expenseCount: group.expenses.length,
    memberCount: group.members.length,
  };
  return raw;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function canAccessGroup(group, user) {
  return (
    String(group.owner) === String(user._id) ||
    group.members.some((member) => member.email === user.email && member.inviteStatus === "accepted")
  );
}

function isGroupOwner(group, user) {
  return String(group.owner) === String(user._id);
}

async function findAccessibleGroup(groupId, user) {
  const group = await Group.findById(groupId);
  if (!group) {
    throw Object.assign(new Error("Group not found."), { status: 404 });
  }
  if (!canAccessGroup(group, user)) {
    throw Object.assign(new Error("Group not found."), { status: 404 });
  }
  return group;
}

async function findOwnedGroup(groupId, user) {
  const group = await Group.findById(groupId);
  if (!group || !isGroupOwner(group, user)) {
    throw Object.assign(new Error("Group not found."), { status: 404 });
  }
  return group;
}

router.get("/", async (req, res, next) => {
  try {
    const groups = await Group.find({
      $or: [
        { owner: req.user._id },
        { members: { $elemMatch: { email: req.user.email, inviteStatus: "accepted" } } },
      ],
    }).sort({ updatedAt: -1 });
    res.json(groups.map(enrichGroup));
  } catch (error) {
    next(error);
  }
});

router.get("/invitations", async (req, res, next) => {
  try {
    const groups = await Group.find({
      members: { $elemMatch: { email: req.user.email, inviteStatus: "invited" } },
    }).sort({ updatedAt: -1 });

    res.json(
      groups.map((group) => {
        const member = group.members.find((item) => item.email === req.user.email && item.inviteStatus === "invited");
        return {
          _id: group._id,
          groupName: group.name,
          currency: group.currency,
          invitedAt: member?.createdAt || group.createdAt,
          owner: group.owner,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/invitations/:id/accept", async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      members: { $elemMatch: { email: req.user.email, inviteStatus: "invited" } },
    });

    if (!group) {
      throw Object.assign(new Error("Invitation not found."), { status: 404 });
    }

    const member = group.members.find((item) => item.email === req.user.email && item.inviteStatus === "invited");
    member.name = req.user.name;
    member.inviteStatus = "accepted";
    await group.save();

    res.json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const invitedMembers = (req.body.members || []).map((member) => ({
      ...member,
      email: normalizeEmail(member.email),
      inviteStatus: member.email ? "invited" : member.inviteStatus || "manual",
    }));
    const group = await Group.create({
      owner: req.user._id,
      name: req.body.name,
      currency: req.body.currency || "INR",
      members: [
        { name: req.user.name, email: req.user.email, inviteStatus: "accepted" },
        ...invitedMembers,
      ],
      expenses: [],
      settlements: [],
    });

    await Promise.all(
      invitedMembers
        .filter((member) => member.email)
        .map((member) => sendInviteEmail({ to: member.email, groupName: group.name, inviterName: req.user.name })),
    );

    res.status(201).json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/members", async (req, res, next) => {
  try {
    const group = await findOwnedGroup(req.params.id, req.user);
    const email = normalizeEmail(req.body.email);
    if (email && group.members.some((member) => member.email === email)) {
      throw Object.assign(new Error("This email is already a member or has a pending invite."), { status: 400 });
    }
    group.members.push({
      name: req.body.name,
      email,
      inviteStatus: email ? "invited" : "manual",
    });
    await group.save();

    if (email) {
      await sendInviteEmail({ to: email, groupName: group.name, inviterName: req.user.name });
    }

    res.status(201).json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/expenses", async (req, res, next) => {
  try {
    const group = await findAccessibleGroup(req.params.id, req.user);
    if (group.members.length < 2) {
      throw Object.assign(new Error("Add at least two members before creating an expense."), { status: 400 });
    }

    const method = req.body.splitMethod || "equal";
    const normalizedAmount = Number(req.body.amount) * Number(req.body.exchangeRate || 1);
    const splits = buildSplits(group.members, normalizedAmount, method, req.body.splitValues);

    const receiptImage = await storeReceipt(req.body.receiptImage);

    group.expenses.push({
      description: req.body.description,
      amount: Number(req.body.amount),
      currency: req.body.currency || group.currency,
      exchangeRate: Number(req.body.exchangeRate || 1),
      paidBy: req.body.paidBy,
      splitMethod: method,
      category: req.body.category || "General",
      expenseDate: req.body.expenseDate || new Date(),
      notes: req.body.notes || "",
      receiptImage,
      splits,
    });

    await group.save();
    res.status(201).json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/expenses/:expenseId", async (req, res, next) => {
  try {
    const group = await findAccessibleGroup(req.params.id, req.user);
    group.expenses.pull(req.params.expenseId);
    await group.save();
    res.json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/settlements", async (req, res, next) => {
  try {
    const group = await findAccessibleGroup(req.params.id, req.user);
    if (req.body.from === req.body.to) {
      throw Object.assign(new Error("Choose two different members for settlement."), { status: 400 });
    }

    group.settlements.push({
      from: req.body.from,
      to: req.body.to,
      amount: Number(req.body.amount),
      paymentStatus: req.body.paymentStatus || "completed",
      note: req.body.note || "",
    });

    await group.save();
    res.status(201).json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/settlements/:settlementId", async (req, res, next) => {
  try {
    const group = await findAccessibleGroup(req.params.id, req.user);
    group.settlements.pull(req.params.settlementId);
    await group.save();
    res.json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reminders", async (req, res, next) => {
  try {
    const group = await findAccessibleGroup(req.params.id, req.user);
    const transfers = simplifyDebts(group);
    const results = [];

    for (const transfer of transfers) {
      const debtor = group.members.id(transfer.from);
      const creditor = group.members.id(transfer.to);
      if (!debtor?.email) continue;

      const result = await sendReminderEmail({
        to: debtor.email,
        debtorName: debtor.name,
        creditorName: creditor?.name || "another member",
        amount: transfer.amount,
        currency: group.currency,
        groupName: group.name,
      });
      results.push({ to: debtor.email, ...result });
    }

    res.json({ sent: results.filter((result) => result.sent).length, results });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Group.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/demo/load", async (req, res, next) => {
  try {
    await Group.deleteMany({ owner: req.user._id });
    const group = new Group({
      owner: req.user._id,
      name: "Goa Trip",
      currency: "INR",
      members: [
        { name: "A", email: "a@example.com", inviteStatus: "accepted" },
        { name: "B", email: "b@example.com", inviteStatus: "invited" },
        { name: "C", email: "c@example.com", inviteStatus: "invited" },
      ],
      expenses: [],
      settlements: [],
    });

    const [a, b, c] = group.members;
    group.expenses.push(
      {
        description: "Dinner",
        amount: 1500,
        paidBy: a._id,
        splitMethod: "equal",
        category: "Food",
        expenseDate: new Date(),
        notes: "Dinner after beach visit",
        splits: buildSplits(group.members, 1500, "equal"),
      },
      {
        description: "Fuel",
        amount: 900,
        paidBy: b._id,
        splitMethod: "equal",
        category: "Travel",
        expenseDate: new Date(),
        notes: "Fuel for rental car",
        splits: buildSplits(group.members, 900, "equal"),
      },
      {
        description: "Snacks",
        amount: 600,
        paidBy: c._id,
        splitMethod: "equal",
        category: "Food",
        expenseDate: new Date(),
        notes: "Snacks and water",
        splits: buildSplits(group.members, 600, "equal"),
      },
    );

    await group.save();
    res.status(201).json(enrichGroup(group));
  } catch (error) {
    next(error);
  }
});

export default router;
