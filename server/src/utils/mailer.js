import dns from "node:dns/promises";
import nodemailer from "nodemailer";

function mailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function buildTransporter(overrides = {}) {
  if (!mailEnabled()) return null;

  const smtpHost = process.env.SMTP_HOST;
  let host = smtpHost;
  let tls;

  try {
    const [ipv4Address] = await dns.resolve4(smtpHost);
    if (ipv4Address) {
      host = ipv4Address;
      tls = { servername: smtpHost };
    }
  } catch (error) {
    console.warn(`SMTP IPv4 lookup failed for ${smtpHost}: ${error.message}`);
  }

  return nodemailer.createTransport({
    host,
    port: Number(overrides.port || process.env.SMTP_PORT || 587),
    secure: overrides.secure ?? String(process.env.SMTP_SECURE || "false") === "true",
    family: 4,
    tls,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function shouldRetryGmailSsl(error) {
  const host = String(process.env.SMTP_HOST || "").toLowerCase();
  const port = Number(process.env.SMTP_PORT || 587);
  const message = String(error?.message || "").toLowerCase();
  return host === "smtp.gmail.com" && port === 587 && (message.includes("timeout") || error?.code === "ETIMEDOUT");
}

async function sendWithClient(client, { to, subject, text }) {
  await client.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

export async function sendMail({ to, subject, text }) {
  if (!to) return { sent: false, reason: "No recipient email provided." };

  const client = await buildTransporter();
  if (!client) {
    console.log(`[email skipped] ${subject} -> ${to}\n${text}`);
    return { sent: false, reason: "SMTP is not configured." };
  }

  try {
    await sendWithClient(client, { to, subject, text });
  } catch (error) {
    if (shouldRetryGmailSsl(error)) {
      try {
        console.warn("Gmail SMTP 587 timed out. Retrying with port 465 over SSL.");
        const sslClient = await buildTransporter({ port: 465, secure: true });
        await sendWithClient(sslClient, { to, subject, text });
        return { sent: true };
      } catch (retryError) {
        console.error("Email send failed after Gmail SSL retry:", retryError.message);
        return { sent: false, reason: retryError.message };
      }
    }
    console.error("Email send failed:", error.message);
    return { sent: false, reason: error.message };
  }

  return { sent: true };
}

export async function sendInviteEmail({ to, groupName, inviterName }) {
  return sendMail({
    to,
    subject: `You were invited to ${groupName} on Ledge`,
    text: `${inviterName} invited you to join "${groupName}" on Ledge.\n\nOpen the app, create an account with this email, and ask the group owner to share access.`,
  });
}

export async function sendReminderEmail({ to, debtorName, creditorName, amount, currency, groupName }) {
  return sendMail({
    to,
    subject: `Reminder: ${debtorName} owes ${creditorName} in ${groupName}`,
    text: `Ledge reminder: ${debtorName} owes ${creditorName} ${currency} ${amount.toFixed(2)} in "${groupName}".`,
  });
}

export async function sendOtpEmail({ to, name, otp }) {
  return sendMail({
    to,
    subject: "Verify your Ledge account",
    text: `Hi ${name},\n\nYour Ledge verification OTP is ${otp}.\n\nThis OTP expires in 10 minutes.`,
  });
}
