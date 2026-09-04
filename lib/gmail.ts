import { google } from "googleapis";

/**
 * Gmail API — Phase 1 only sends the weekly digest (gmail.send scope).
 * gmail.compose (drafting outreach without ever sending) is Phase 5's
 * concern, not this one — see the main Domestique brief's Settled list.
 *
 * `account` picks whose OAuth grant + refresh token to use. Each of
 * Francis's and Bailey's Google accounts needs its own one-time OAuth
 * consent (this is not something to script blind — walk through Google's
 * consent screen with them, then store the resulting refresh token as a
 * Vercel Sensitive env var).
 */
export function getGmailClient(account: "francis" | "bailey") {
  const refreshToken =
    account === "francis"
      ? process.env.GMAIL_REFRESH_TOKEN_FRANCIS
      : process.env.GMAIL_REFRESH_TOKEN_BAILEY;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/** Sends a plain digest email. Called once per recipient — Francis and
 * Bailey both get their own send, not a single email with two `To`
 * addresses, so either can be added/removed independently later. */
export async function sendDigest(params: {
  from: "francis" | "bailey";
  to: string;
  subject: string;
  html: string;
}) {
  const gmail = getGmailClient(params.from);
  const raw = buildRawMessage(params);
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

function buildRawMessage({ to, subject, html }: { to: string; subject: string; html: string }) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\n");
  return Buffer.from(message).toString("base64url");
}
