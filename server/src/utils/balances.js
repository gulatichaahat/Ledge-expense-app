export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function buildSplits(members, amount, method, splitValues = {}) {
  const totalAmount = Number(amount);

  if (method === "equal") {
    const base = roundMoney(totalAmount / members.length);
    const splits = members.map((member) => ({
      member: member._id,
      amount: base,
    }));
    const total = splits.reduce((sum, split) => sum + split.amount, 0);
    splits[0].amount = roundMoney(splits[0].amount + totalAmount - total);
    return splits;
  }

  if (method === "exact") {
    const splits = members.map((member) => ({
      member: member._id,
      amount: roundMoney(splitValues[String(member._id)] || 0),
    }));
    const total = roundMoney(splits.reduce((sum, split) => sum + split.amount, 0));
    if (Math.abs(total - totalAmount) > 0.01) {
      throw Object.assign(new Error("Exact amounts must add up to the expense total."), { status: 400 });
    }
    return splits;
  }

  if (method === "percentage") {
    const totalPercent = roundMoney(
      members.reduce((sum, member) => sum + Number(splitValues[String(member._id)] || 0), 0),
    );
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw Object.assign(new Error("Percentages must add up to 100."), { status: 400 });
    }
    return members.map((member) => ({
      member: member._id,
      amount: roundMoney((totalAmount * Number(splitValues[String(member._id)] || 0)) / 100),
    }));
  }

  const totalShares = members.reduce((sum, member) => sum + Number(splitValues[String(member._id)] || 0), 0);
  if (totalShares <= 0) {
    throw Object.assign(new Error("Shares must add up to more than 0."), { status: 400 });
  }

  return members.map((member) => ({
    member: member._id,
    amount: roundMoney((totalAmount * Number(splitValues[String(member._id)] || 0)) / totalShares),
  }));
}

export function calculateBalances(group) {
  const balances = Object.fromEntries(group.members.map((member) => [String(member._id), 0]));

  group.expenses.forEach((expense) => {
    const normalizedAmount = roundMoney(Number(expense.amount) * Number(expense.exchangeRate || 1));
    balances[String(expense.paidBy)] += normalizedAmount;
    expense.splits.forEach((split) => {
      balances[String(split.member)] -= Number(split.amount);
    });
  });

  group.settlements.forEach((settlement) => {
    balances[String(settlement.from)] += Number(settlement.amount);
    balances[String(settlement.to)] -= Number(settlement.amount);
  });

  Object.keys(balances).forEach((memberId) => {
    balances[memberId] = roundMoney(balances[memberId]);
  });

  return balances;
}

export function simplifyDebts(group) {
  const balances = calculateBalances(group);
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([memberId, balance]) => {
    if (balance < -0.01) debtors.push({ memberId, amount: roundMoney(Math.abs(balance)) });
    if (balance > 0.01) creditors.push({ memberId, amount: roundMoney(balance) });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));

    if (amount > 0.01) {
      transfers.push({ from: debtor.memberId, to: creditor.memberId, amount });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount <= 0.01) debtorIndex += 1;
    if (creditor.amount <= 0.01) creditorIndex += 1;
  }

  return transfers;
}
