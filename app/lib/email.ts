import { getSecret } from "./server-platform";

// Sends email via Resend. Returns false when no provider key is configured or
// the request fails, so callers can degrade gracefully instead of breaking.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = getSecret("RESEND_API_KEY");
  if (!apiKey) return false;
  const from = getSecret("RESEND_FROM") || "PromptHub <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function emailConfigured(): boolean {
  return Boolean(getSecret("RESEND_API_KEY"));
}
