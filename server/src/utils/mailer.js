import dns from "node:dns/promises";
import nodemailer from "nodemailer";

function mailEnabled() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function transporter() {
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
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
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

export async function sendMail({ to, subject, text }) {
  if (!to) return { sent: false, reason: "No recipient email provided." };

  const client = await transporter();
  if (!client) {
    console.log(`[email skipped] ${subject} -> ${to}\n${text}`);
    return { sent: false, reason: "SMTP is not configured." };
  }

  try {
    await client.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (error) {
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
