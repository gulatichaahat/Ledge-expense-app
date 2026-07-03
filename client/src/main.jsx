import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeIndianRupee,
  BarChart3,
  Bell,
  HandCoins,
  LayoutDashboard,
  Moon,
  Plus,
  ReceiptText,
  Sun,
  Trash2,
  UsersRound,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
const TOKEN_KEY = "ledge-token";
const USER_KEY = "ledge-user";
const THEME_KEY = "ledge-theme";
const LEGACY_TOKEN_KEY = "balancebuddy-token";
const LEGACY_USER_KEY = "balancebuddy-user";
const categories = ["Food", "Travel", "Rent", "Utilities", "Shopping", "Entertainment", "General"];
const currencies = ["INR", "USD", "EUR", "GBP"];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || "");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY) || "null"));
  const [authMode, setAuthMode] = useState("login");
  const [pendingEmail, setPendingEmail] = useState("");
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const activeGroup = useMemo(
    () => groups.find((group) => group._id === activeGroupId) || groups[0],
    [groups, activeGroupId],
  );

  const currency = activeGroup?.currency || "INR";
  const totalSpent = activeGroup?.summary?.totalSpent ?? activeGroup?.expenses.reduce((sum, expense) => sum + expense.amount, 0) ?? 0;
  const openBalance = activeGroup
    ? Object.values(activeGroup.balances || {}).reduce((sum, balance) => sum + Math.max(0, balance), 0)
    : 0;
  const filteredExpenses = useMemo(() => {
    if (!activeGroup) return [];
    const needle = query.trim().toLowerCase();
    return [...activeGroup.expenses]
      .reverse()
      .filter((expense) => {
        if (!needle) return true;
        return [expense.description, expense.category, expense.notes, memberName(activeGroup, expense.paidBy)]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [activeGroup, query]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (token) {
      loadGroups();
      loadInvitations();
      const invitationTimer = window.setInterval(loadInvitations, 15000);
      return () => window.clearInterval(invitationTimer);
    } else {
      setGroups([]);
      setInvitations([]);
      setLoading(false);
    }
  }, [token]);

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch {
      throw new Error(`Backend is not reachable at ${API_URL}. Check the deployed backend URL, Vercel VITE_API_URL, and Render CORS settings.`);
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "The request could not be completed.");
    return data;
  }

  async function runAction(action, label = "Working") {
    try {
      setBusy(label);
      setNotice("");
      await action();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function loadGroups({ silent = false } = {}) {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      const data = await request("/groups");
      setGroups(data);
      setActiveGroupId((current) => current || data[0]?._id || "");
      return data;
    } catch (error) {
      if (!silent) setNotice(error.message);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadInvitations() {
    if (!token) return;
    try {
      const data = await request("/groups/invitations");
      setInvitations(data);
    } catch (error) {
      console.warn("Could not refresh invitations", error);
    }
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleAuth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      const data = await request(`/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (authMode === "register") {
        setPendingEmail(data.email);
        setAuthMode("verify");
        setNotice("OTP sent to your email.");
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
      setToken(data.token);
      setUser(data.user);
      setNotice("");
    }, authMode === "login" ? "Signing in" : "Creating account");
  }

  async function verifyOtp(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const otp = String(form.get("otp") || "").trim();
    if (!/^\d{6}$/.test(otp)) {
      setNotice("Enter the 6-digit OTP sent to your email.");
      return;
    }

    await runAction(async () => {
      const data = await request("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmail || form.get("email"),
          otp,
        }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_USER_KEY);
      setToken(data.token);
      setUser(data.user);
      setPendingEmail("");
      setNotice("");
    }, "Verifying OTP");
  }

  async function logout() {
    await runAction(async () => {
      await request("/auth/logout", { method: "POST" });
    }, "Signing out");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    setToken("");
    setUser(null);
    setGroups([]);
    setInvitations([]);
    setActiveGroupId("");
  }

  function replaceGroup(updatedGroup) {
    setGroups((current) => {
      const exists = current.some((group) => group._id === updatedGroup._id);
      if (!exists) return [updatedGroup, ...current];
      return current.map((group) => (group._id === updatedGroup._id ? updatedGroup : group));
    });
    setActiveGroupId(updatedGroup._id);
  }

  async function createGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runAction(async () => {
      const group = await request("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          currency: form.get("currency"),
          members: form
            .get("members")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
            .map((email) => ({ name: email.split("@")[0], email, inviteStatus: "invited" })),
        }),
      });
      formElement.reset();
      replaceGroup(group);
      setView("dashboard");
    }, "Creating group");
  }

  async function addMember(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/members`, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
        }),
      });
      formElement.reset();
      replaceGroup(group);
    }, "Sending invite");
  }

  async function acceptInvitation(invitation) {
    try {
      setBusy("Accepting invite");
      setNotice("");
      const group = await request(`/groups/invitations/${invitation._id}/accept`, { method: "POST" });
      replaceGroup(group);
      setInvitations((current) => current.filter((item) => item._id !== invitation._id));
      setNotificationsOpen(false);
      setView("dashboard");
      setNotice(`Joined ${group.name}.`);
      loadGroups({ silent: true });
      loadInvitations();
    } catch (error) {
      const refreshedGroups = await loadGroups();
      await loadInvitations();
      const alreadyJoined = refreshedGroups.some((group) => group._id === invitation._id);
      if (alreadyJoined) {
        setNotificationsOpen(false);
        setNotice("");
        setActiveGroupId(invitation._id);
        setView("dashboard");
      } else {
        setNotice(error.message);
      }
    } finally {
      setBusy("");
    }
  }

  async function addExpense(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const splitMethod = form.get("splitMethod");
    const splitValues = {};
    activeGroup.members.forEach((member) => {
      splitValues[member._id] = Number(form.get(`split-${member._id}`) || 0);
    });

    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: form.get("description"),
          amount: Number(form.get("amount")),
          currency: form.get("currency"),
          exchangeRate: Number(form.get("exchangeRate") || 1),
          paidBy: form.get("paidBy"),
          splitMethod,
          splitValues,
          category: form.get("category"),
          expenseDate: form.get("expenseDate"),
          notes: form.get("notes"),
          receiptImage: await readReceipt(form.get("receipt")),
        }),
      });
      formElement.reset();
      replaceGroup(group);
    }, "Saving expense");
  }

  async function addSettlement(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          from: form.get("from"),
          to: form.get("to"),
          amount: Number(form.get("amount")),
          note: form.get("note"),
        }),
      });
      formElement.reset();
      replaceGroup(group);
    }, "Recording payment");
  }

  async function payNow(debt) {
    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          from: debt.from,
          to: debt.to,
          amount: debt.amount,
          paymentStatus: "completed",
          note: "Paid using Pay Now",
        }),
      });
      replaceGroup(group);
      setView("dashboard");
    }, "Recording payment");
  }

  async function sendReminders() {
    await runAction(async () => {
      const result = await request(`/groups/${activeGroup._id}/reminders`, { method: "POST" });
      setNotice(result.sent ? `${result.sent} reminder email sent.` : "No reminder emails were sent. Add member emails or configure SMTP.");
    }, "Sending reminders");
  }

  async function deleteExpense(expenseId) {
    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/expenses/${expenseId}`, { method: "DELETE" });
      replaceGroup(group);
    }, "Deleting expense");
  }

  async function deleteSettlement(settlementId) {
    await runAction(async () => {
      const group = await request(`/groups/${activeGroup._id}/settlements/${settlementId}`, { method: "DELETE" });
      replaceGroup(group);
    }, "Deleting settlement");
  }

  async function deleteGroup(groupId) {
    await runAction(async () => {
      await request(`/groups/${groupId}`, { method: "DELETE" });
      const nextGroups = groups.filter((group) => group._id !== groupId);
      setGroups(nextGroups);
      setActiveGroupId(nextGroups[0]?._id || "");
    }, "Deleting group");
  }

  function exportCsv() {
    if (!activeGroup) return;
    const rows = [
      ["Description", "Amount", "Paid By", "Category", "Date", "Split Method", "Notes"],
      ...activeGroup.expenses.map((expense) => [
        expense.description,
        expense.amount,
        memberName(activeGroup, expense.paidBy),
        expense.category || "General",
        formatDate(expense.expenseDate),
        expense.splitMethod,
        expense.notes || "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeGroup.name.replaceAll(" ", "-").toLowerCase()}-expenses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className="loading">Loading Ledge...</main>;

  if (!token) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <ThemeButton theme={theme} onToggle={toggleTheme} compact />
          <div className="auth-brand">
            <BadgeIndianRupee />
            <div>
              <h1>Ledge</h1>
              <p>Split clean. Settle fast. Stay sharp.</p>
            </div>
          </div>
          {notice && <p className="auth-error">{notice}</p>}
          {authMode === "verify" ? (
            <form className="form" onSubmit={verifyOtp}>
              <div className="auth-step">
                <strong>Verify your email</strong>
                <span>Enter the 6-digit OTP sent to your inbox.</span>
              </div>
              <label className="field-label">
                Email address
                <input name="email" required readOnly type="email" value={pendingEmail} onChange={(event) => setPendingEmail(event.target.value)} placeholder="Email address" />
              </label>
              <label className="field-label">
                OTP code
                <input name="otp" required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="6-digit OTP" />
              </label>
              <button disabled={Boolean(busy)}>{busy || "Verify OTP"}</button>
            </form>
          ) : (
            <form className="form" onSubmit={handleAuth}>
              {authMode === "register" && <input name="name" required placeholder="Full name" />}
              <input name="email" required type="email" placeholder="Email address" />
              <input name="password" required type="password" minLength="6" placeholder="Password" />
              <button disabled={Boolean(busy)}>{busy || (authMode === "login" ? "Sign in" : "Send OTP")}</button>
            </form>
          )}
          <button className="auth-switch" onClick={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setPendingEmail("");
            setNotice("");
          }}>
            {authMode === "login" ? "Create a new account" : "I already have an account"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <BadgeIndianRupee />
          <h1>Ledge</h1>
        </div>

        <NavButton active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<LayoutDashboard size={18} />} label="Dashboard" />
        <NavButton active={view === "groups"} onClick={() => setView("groups")} icon={<UsersRound size={18} />} label="Groups" />
        <NavButton active={view === "expenses"} onClick={() => setView("expenses")} icon={<ReceiptText size={18} />} label="Expenses" />
        <NavButton active={view === "settlements"} onClick={() => setView("settlements")} icon={<HandCoins size={18} />} label="Settlements" />
        <NavButton active={view === "analytics"} onClick={() => setView("analytics")} icon={<BarChart3 size={18} />} label="Analytics" />

        {activeGroup && (
          <div className="side-summary">
            <span>Unsettled total</span>
            <strong>{money(openBalance, currency)}</strong>
            <p>{activeGroup.simplifiedDebts.length || "No"} pending transfer{activeGroup.simplifiedDebts.length === 1 ? "" : "s"}</p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="side-groups">
            <span>Groups</span>
            {groups.slice(0, 6).map((group) => (
              <button
                className={group._id === activeGroup?._id ? "selected-group" : ""}
                key={group._id}
                onClick={() => {
                  setActiveGroupId(group._id);
                  setView("dashboard");
                }}
              >
                <i>{group.name.slice(0, 1).toUpperCase()}</i>
                <span>{group.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{view[0].toUpperCase() + view.slice(1)}</h2>
            {activeGroup && <p>{activeGroup.name} - {activeGroup.members.length} members</p>}
          </div>
          <div className="topbar-actions">
            <NotificationsMenu
              invitations={invitations}
              open={notificationsOpen}
              busy={busy}
              onToggle={() => setNotificationsOpen((current) => !current)}
              onAccept={acceptInvitation}
            />
            <ThemeButton theme={theme} onToggle={toggleTheme} />
            <span className="user-chip">{user?.name || user?.email}</span>
            <select value={activeGroup?._id || ""} onChange={(event) => setActiveGroupId(event.target.value)} aria-label="Active group">
              {groups.length ? (
                groups.map((group) => (
                  <option key={group._id} value={group._id}>
                    {group.name}
                  </option>
                ))
              ) : (
                <option value="">No groups yet</option>
              )}
            </select>
            <button className="secondary" disabled={Boolean(busy)} onClick={logout}>{busy === "Signing out" ? busy : "Logout"}</button>
          </div>
        </header>

        {notice && <Notice message={notice} onRetry={loadGroups} />}
        {!activeGroup && <Empty title="No group yet" body="Create a group to begin tracking shared expenses." />}

        {activeGroup && view === "dashboard" && (
          <section className="dashboard-shell">
            <div className="dashboard-focus">
              <SummaryBand
                group={activeGroup}
                totalSpent={totalSpent}
                openBalance={openBalance}
                onAddExpense={() => setView("expenses")}
                onSettle={() => setView("settlements")}
                onRemind={sendReminders}
                busy={busy}
              />

              <section className="stats compact-stats">
                <Stat label="Total spent" value={money(totalSpent, currency)} />
                <Stat label="Open" value={money(openBalance, currency)} />
                <Stat label="Settled" value={money(activeGroup.summary?.totalSettled || 0, currency)} />
              </section>

              <Panel title="Simplified debts">
                {activeGroup.simplifiedDebts.length ? (
                  activeGroup.simplifiedDebts.map((debt) => <Transfer key={`${debt.from}-${debt.to}`} debt={debt} group={activeGroup} onPayNow={payNow} />)
                ) : (
                  <Empty title="All settled" body="No one owes anyone in this group." />
                )}
              </Panel>
            </div>

            <aside className="dashboard-rail">
              <div className="quick-panel">
                <button className="bill-button" onClick={() => setView("expenses")}>Add expense</button>
                <button className="settle-button" onClick={() => setView("settlements")}>Settle up</button>
                <button className="settle-button" disabled={Boolean(busy)} onClick={sendReminders}>
                  {busy === "Sending reminders" ? busy : "Remind"}
                </button>
              </div>

              <Panel title="Members">
                {activeGroup.members.map((member) => {
                  const balance = activeGroup.balances?.[member._id] || 0;
                  return (
                    <div className="row member-row" key={member._id}>
                      <i>{member.name.slice(0, 1).toUpperCase()}</i>
                      <div>
                        <strong>{member.name}</strong>
                        <span>{balance >= 0 ? "Gets back" : "Owes"}</span>
                      </div>
                      <span className={balance >= 0 ? "positive" : "negative"}>{money(Math.abs(balance), currency)}</span>
                    </div>
                  );
                })}
              </Panel>

              <Panel title="Recent">
                {recentActivity(activeGroup).slice(0, 4).map((item) => (
                  <Activity key={item.id} title={item.title} subtitle={item.subtitle} meta={formatDate(item.date)} />
                ))}
              </Panel>
            </aside>
          </section>
        )}

        {view === "groups" && (
          <section className="grid">
            <Panel title="Create group">
              <form className="form" onSubmit={createGroup}>
                <input name="name" required placeholder="Group name" />
                <input name="members" placeholder="Friend emails, comma separated" />
                <select name="currency" defaultValue="INR">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <button disabled={Boolean(busy)}><Plus size={18} /> {busy === "Creating group" ? busy : "Create group"}</button>
              </form>
            </Panel>

            <Panel title="Manage groups">
              {groups.map((group) => (
                <div className="row" key={group._id}>
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.members.length} members - {group.expenses.length} expenses - {group.currency}</span>
                  </div>
                  <button className="icon-danger" onClick={() => deleteGroup(group._id)} aria-label={`Delete ${group.name}`}>
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <form className="form compact" onSubmit={addMember}>
                <input name="name" required placeholder="Add member to selected group" />
                <input name="email" type="email" placeholder="Invite email" />
                <button disabled={!activeGroup || Boolean(busy)}><Plus size={18} /> {busy === "Sending invite" ? busy : "Add member"}</button>
              </form>
            </Panel>
          </section>
        )}

        {activeGroup && view === "expenses" && (
          <section className="grid">
            <Panel title="Add expense">
              <ExpenseForm group={activeGroup} onSubmit={addExpense} />
            </Panel>
            <Panel title="Expense history">
              <div className="toolbar">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" />
                <button className="secondary" onClick={exportCsv}>Export CSV</button>
              </div>
              {filteredExpenses.length ? (
                filteredExpenses.map((expense) => (
                  <Activity
                    key={expense._id}
                    title={`${expense.description} - ${money(expense.amount, expense.currency || currency)}`}
                    subtitle={`${expense.category || "General"} - paid by ${memberName(activeGroup, expense.paidBy)} - ${formatDate(expense.expenseDate)}${expense.receiptImage?.data ? " - receipt attached" : ""}`}
                    action={<button className="icon-danger" onClick={() => deleteExpense(expense._id)}><Trash2 size={17} /></button>}
                  />
                ))
              ) : (
                <Empty title="No expenses found" body="Try another search or add your first expense." />
              )}
            </Panel>
          </section>
        )}

        {activeGroup && view === "settlements" && (
          <section className="grid">
            <Panel title="Record payment">
              <form className="form" onSubmit={addSettlement}>
                <select name="from">{memberOptions(activeGroup)}</select>
                <select name="to">{memberOptions(activeGroup)}</select>
                <input name="amount" required min="1" step="0.01" type="number" placeholder="Amount" />
                <input name="note" placeholder="Payment note" />
                <button disabled={Boolean(busy)}>{busy === "Recording payment" ? busy : "Record payment"}</button>
              </form>
            </Panel>
            <Panel title="Settlement history">
              {activeGroup.settlements.length ? (
                [...activeGroup.settlements].reverse().map((payment) => (
                  <Activity
                    key={payment._id}
                    title={`${memberName(activeGroup, payment.from)} paid ${memberName(activeGroup, payment.to)}`}
                    subtitle={`${money(payment.amount, currency)} - ${payment.paymentStatus || "completed"}${payment.note ? ` - ${payment.note}` : ""}`}
                    action={<button className="icon-danger" onClick={() => deleteSettlement(payment._id)}><Trash2 size={17} /></button>}
                  />
                ))
              ) : (
                <Empty title="No settlements yet" body="Payments will appear here after someone settles up." />
              )}
            </Panel>
          </section>
        )}

        {activeGroup && view === "analytics" && (
          <>
            <section className="stats">
              <Stat label="Average expense" value={money(averageExpense(activeGroup), currency)} />
              <Stat label="Largest category" value={categoryTotals(activeGroup)[0]?.category || "None"}/>
              <Stat label="Top payer" value={topPayer(activeGroup)?.member || "None"} />
              <Stat label="Open transfers" value={activeGroup.simplifiedDebts.length} />
            </section>

            <section className="grid">
              <Panel title="Category breakdown">
                {categoryTotals(activeGroup).length ? (
                  categoryTotals(activeGroup).map((item) => (
                    <div className="metric-row" key={item.category}>
                      <span>{item.category}</span>
                      <div className="meter"><i style={{ width: `${item.percent}%` }} /></div>
                      <strong>{money(item.amount, currency)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty title="No spending yet" body="Add expenses to see category analytics." />
                )}
              </Panel>
              <Panel title="Member contribution">
                {memberContribution(activeGroup).length ? (
                  memberContribution(activeGroup).map((item) => (
                    <div className="metric-row" key={item.member}>
                      <span>{item.member}</span>
                      <div className="meter"><i style={{ width: `${item.percent}%` }} /></div>
                      <strong>{money(item.amount, currency)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty title="No contribution yet" body="Add expenses to compare member contributions." />
                )}
              </Panel>
            </section>

            <section className="grid analytics-grid">
              <Panel title="Monthly trend">
                {monthlyTrend(activeGroup).length ? (
                  monthlyTrend(activeGroup).map((item) => (
                    <div className="metric-row" key={item.month}>
                      <span>{item.month}</span>
                      <div className="meter"><i style={{ width: `${item.percent}%` }} /></div>
                      <strong>{money(item.amount, currency)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty title="No trend yet" body="Add expenses across dates to see monthly movement." />
                )}
              </Panel>
              <Panel title="Financial insights">
                <InsightGrid group={activeGroup} totalSpent={totalSpent} openBalance={openBalance} />
              </Panel>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ExpenseForm({ group, onSubmit }) {
  const [method, setMethod] = useState("equal");

  return (
    <form className="form" onSubmit={onSubmit}>
      <input name="description" required placeholder="Dinner, rent, tickets" />
      <div className="form-grid">
        <input name="amount" required min="1" step="0.01" type="number" placeholder="Amount" />
        <select name="paidBy">{memberOptions(group)}</select>
      </div>
      <div className="form-grid">
        <select name="currency" defaultValue={group.currency}>
          {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <input name="exchangeRate" required min="0.0001" step="0.0001" type="number" defaultValue="1" placeholder={`Rate to ${group.currency}`} />
      </div>
      <div className="form-grid">
        <select name="category" defaultValue="Food">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <select name="splitMethod" value={method} onChange={(event) => setMethod(event.target.value)}>
        <option value="equal">Equal</option>
        <option value="exact">Exact amounts</option>
        <option value="percentage">Percentages</option>
        <option value="shares">Shares</option>
      </select>

      {method !== "equal" && (
        <div className="split-box">
          {group.members.map((member) => (
            <label key={member._id}>
              {member.name}
              <input name={`split-${member._id}`} min="0" step="0.01" type="number" placeholder={method} />
            </label>
          ))}
        </div>
      )}

      <textarea name="notes" placeholder="Notes or bill details" rows="3" />
      <input name="receipt" type="file" accept="image/*" />
      <button disabled={group.members.length < 2}>Add expense</button>
    </form>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} title={label} aria-label={label}>
      {icon} <span>{label}</span>
    </button>
  );
}

function ThemeButton({ theme, onToggle, compact = false }) {
  const isDark = theme === "dark";
  return (
    <button className={`theme-toggle ${compact ? "auth-theme" : ""}`} type="button" onClick={onToggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Light mode" : "Dark mode"}>
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function NotificationsMenu({ invitations, open, busy, onToggle, onAccept }) {
  return (
    <div className="notifications">
      <button className="notification-button" type="button" onClick={onToggle} aria-label="Notifications">
        <Bell size={17} />
        {invitations.length > 0 && <b>{invitations.length}</b>}
      </button>
      {open && (
        <div className="notification-menu">
          <strong>Notifications</strong>
          {invitations.length ? (
            invitations.map((invitation) => (
              <div className="notification-item" key={invitation._id}>
                <div>
                  <span>Group invite</span>
                  <p>{invitation.groupName}</p>
                  <small>{invitation.currency}</small>
                </div>
                <button disabled={busy === "Accepting invite"} onClick={() => onAccept(invitation)}>
                  {busy === "Accepting invite" ? "Joining" : "Accept"}
                </button>
              </div>
            ))
          ) : (
            <p className="notification-empty">No pending invites.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Notice({ message, onRetry }) {
  return (
    <div className="notice">
      <strong>Action needed</strong>
      <p>{message}</p>
      <button className="secondary" onClick={onRetry}>Retry</button>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Transfer({ debt, group, onPayNow }) {
  return (
    <div className="transfer">
      <div>
        <strong>{memberName(group, debt.from)} owes {memberName(group, debt.to)}</strong>
        <span>Simplified settlement</span>
      </div>
      <b>{money(debt.amount, group.currency)}</b>
      {onPayNow && <button className="settle-button" onClick={() => onPayNow(debt)}>Pay now</button>}
    </div>
  );
}

function Activity({ title, subtitle, action, meta }) {
  return (
    <article className="activity">
      {meta && <time>{meta}</time>}
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {action}
    </article>
  );
}

function Empty({ title, body }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function SummaryBand({ group, totalSpent, openBalance, onAddExpense, onSettle, onRemind, busy }) {
  const isSettled = openBalance <= 0.01;

  return (
    <section className="summary-band">
      <div>
        <span className="overline">Current group</span>
        <h2>{group.name}</h2>
        <p>
          {isSettled
            ? "Everyone is settled up."
            : `${money(openBalance, group.currency)} is still open across ${group.simplifiedDebts.length} simplified transfer${group.simplifiedDebts.length === 1 ? "" : "s"}.`}
        </p>
      </div>
      <div className="summary-meta">
        <div>
          <span>Total spent</span>
          <strong>{money(totalSpent, group.currency)}</strong>
        </div>
        <div>
          <span>Members</span>
          <strong>{group.members.length}</strong>
        </div>
        <div className="member-stack" aria-label="Group members">
          {group.members.slice(0, 5).map((member) => (
            <i key={member._id}>{member.name.slice(0, 1).toUpperCase()}</i>
          ))}
        </div>
      </div>
      <div className="summary-actions">
        <button className="bill-button" onClick={onAddExpense}>Add expense</button>
        <button className="settle-button" onClick={onSettle}>Settle up</button>
        <button className="settle-button" disabled={Boolean(busy)} onClick={onRemind}>
          {busy === "Sending reminders" ? busy : "Send reminders"}
        </button>
      </div>
    </section>
  );
}

function InsightGrid({ group, totalSpent, openBalance }) {
  const highestExpense = [...group.expenses].sort((a, b) => b.amount - a.amount)[0];
  const payerTotals = group.expenses.reduce((acc, expense) => {
    const paidBy = memberName(group, expense.paidBy);
    acc[paidBy] = (acc[paidBy] || 0) + Number(expense.amount);
    return acc;
  }, {});
  const topPayer = Object.entries(payerTotals).sort((a, b) => b[1] - a[1])[0];
  const settledAmount = group.summary?.totalSettled || 0;
  const settlementRate = totalSpent ? Math.min(100, Math.round((settledAmount / totalSpent) * 100)) : 0;

  return (
    <div className="insight-grid">
      <div className="insight-card">
        <span>Highest expense</span>
        <strong>{highestExpense ? money(highestExpense.amount, group.currency) : money(0, group.currency)}</strong>
        <p>{highestExpense?.description || "No expenses added"}</p>
      </div>
      <div className="insight-card">
        <span>Top payer</span>
        <strong>{topPayer?.[0] || "No payer yet"}</strong>
        <p>{money(topPayer?.[1] || 0, group.currency)}</p>
      </div>
      <div className="insight-card">
        <span>Settlement progress</span>
        <strong>{settlementRate}%</strong>
        <p>{money(settledAmount, group.currency)} settled</p>
      </div>
      <div className="insight-card">
        <span>Amount still open</span>
        <strong>{money(openBalance, group.currency)}</strong>
        <p>{group.simplifiedDebts.length} simplified transfers</p>
      </div>
    </div>
  );
}

function recentActivity(group) {
  const expenses = group.expenses.map((expense) => ({
    id: `expense-${expense._id}`,
    date: expense.createdAt,
    title: `${expense.description} - ${money(expense.amount, group.currency)}`,
    subtitle: `${expense.category || "General"} expense by ${memberName(group, expense.paidBy)}`,
  }));
  const settlements = group.settlements.map((settlement) => ({
    id: `settlement-${settlement._id}`,
    date: settlement.createdAt,
    title: `${memberName(group, settlement.from)} paid ${memberName(group, settlement.to)}`,
    subtitle: money(settlement.amount, group.currency),
  }));
  return [...expenses, ...settlements]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
}

function readReceipt(file) {
  if (!file || !file.size) return null;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        data: reader.result,
      });
    };
    reader.onerror = () => reject(new Error("Receipt image could not be read."));
    reader.readAsDataURL(file);
  });
}

function categoryTotals(group) {
  const totals = group.expenses.reduce((acc, expense) => {
    const category = expense.category || "General";
    acc[category] = (acc[category] || 0) + Number(expense.amount);
    return acc;
  }, {});
  const max = Math.max(...Object.values(totals), 1);
  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount, percent: Math.max(8, (amount / max) * 100) }))
    .sort((a, b) => b.amount - a.amount);
}

function memberContribution(group) {
  const totals = group.expenses.reduce((acc, expense) => {
    const payer = memberName(group, expense.paidBy);
    acc[payer] = (acc[payer] || 0) + Number(expense.amount) * Number(expense.exchangeRate || 1);
    return acc;
  }, {});
  const max = Math.max(...Object.values(totals), 1);
  return Object.entries(totals)
    .map(([member, amount]) => ({ member, amount, percent: Math.max(8, (amount / max) * 100) }))
    .sort((a, b) => b.amount - a.amount);
}

function monthlyTrend(group) {
  const totals = group.expenses.reduce((acc, expense) => {
    const month = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(expense.expenseDate || expense.createdAt));
    acc[month] = (acc[month] || 0) + Number(expense.amount) * Number(expense.exchangeRate || 1);
    return acc;
  }, {});
  const max = Math.max(...Object.values(totals), 1);
  return Object.entries(totals).map(([month, amount]) => ({ month, amount, percent: Math.max(8, (amount / max) * 100) }));
}

function averageExpense(group) {
  if (!group.expenses.length) return 0;
  const total = group.expenses.reduce((sum, expense) => sum + Number(expense.amount) * Number(expense.exchangeRate || 1), 0);
  return total / group.expenses.length;
}

function topPayer(group) {
  return memberContribution(group)[0];
}

function memberOptions(group) {
  return group.members.map((member) => (
    <option key={member._id} value={member._id}>{member.name}</option>
  ));
}

function memberName(group, id) {
  return group.members.find((member) => member._id === id)?.name || "Someone";
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function money(amount, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

createRoot(document.getElementById("root")).render(<App />);
