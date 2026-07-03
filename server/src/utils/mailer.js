import dns from "node:dns/promises";
import nodemailer from "nodemailer";

function mailEnabled() {
  return Boolean(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

export function activeEmailProvider() {
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

function sendgridEnabled() {
  return Boolean(process.env.SENDGRID_API_KEY);
}

function resendEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
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

async function sendWithResend({ to, subject, text }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Ledge <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error?.message || "Resend email API request failed.");
    }

    return { sent: true, id: data.id };
  } catch (error) {
    const reason = error.name === "AbortError" ? "Resend email API timed out." : error.message;
    console.error("Resend email failed:", reason);
    return { sent: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseSender() {
  const from = process.env.MAIL_FROM || process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || "noreply@example.com";
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return {
      name: match[1].trim() || "Ledge",
      email: match[2].trim(),
    };
  }

  return {
    name: "Ledge",
    email: from.trim(),
  };
}

async function sendWithSendGrid({ to, subject, text }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const sender = parseSender();

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: sender,
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });

    const data = await response.text();
    if (!response.ok) {
      throw new Error(data || "SendGrid email API request failed.");
    }

    return { sent: true };
  } catch (error) {
    const reason = error.name === "AbortError" ? "SendGrid email API timed out." : error.message;
    console.error("SendGrid email failed:", reason);
    return { sent: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendMail({ to, subject, text }) {
  if (!to) return { sent: false, reason: "No recipient email provided." };

  if (sendgridEnabled()) {
    return sendWithSendGrid({ to, subject, text });
  }

  if (resendEnabled()) {
    return sendWithResend({ to, subject, text });
  }

  const client = await buildTransporter();
  if (!client) {
    console.log(`[email skipped] ${subject} -> ${to}\n${text}`);
    return { sent: false, reason: "Email provider is not configured. Add RESEND_API_KEY on Render." };
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
        return { sent: false, reason: `SMTP failed after retry: ${retryError.message}. Render is still using SMTP, not Resend. Add RESEND_API_KEY and redeploy.` };
      }
    }
    console.error("Email send failed:", error.message);
    return { sent: false, reason: `SMTP failed: ${error.message}. Render is still using SMTP, not Resend. Add RESEND_API_KEY and redeploy.` };
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
