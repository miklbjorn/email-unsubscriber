import type { MessageHeaders } from "./gmail";

// --- Types ---

export interface ParsedFrom {
  name: string;
  email: string;
}

export type UnsubscribeLinkType = "http" | "mailto" | "one-click";

export interface ParsedUnsubscribe {
  httpUrl: string | null;
  mailtoUrl: string | null;
}

export interface SenderSummary {
  name: string;
  email: string;
  messageCount: number;
  unsubscribeUrl: string;
  linkType: UnsubscribeLinkType;
  clickedAt?: string | null;
}

export interface AnalysisResult {
  totalEmails: number;
  unsubscribableEmails: number;
  percentage: number;
  uniqueSenders: number;
  senders: SenderSummary[];
}

// --- Parsing ---

/**
 * Parse a From header into display name and email.
 * Handles formats like:
 *   "Display Name" <email@example.com>
 *   Display Name <email@example.com>
 *   <email@example.com>
 *   email@example.com
 */
export function parseFromHeader(from: string): ParsedFrom {
  // Try "Name" <email> or Name <email>
  const angleMatch = from.match(/^(.*?)\s*<([^>]+)>/);
  if (angleMatch) {
    const rawName = angleMatch[1].replace(/^["']|["']$/g, "").trim();
    const email = angleMatch[2].trim().toLowerCase();
    return { name: rawName || email, email };
  }

  // Bare email address
  const trimmed = from.trim().toLowerCase();
  return { name: trimmed, email: trimmed };
}

/**
 * Parse a List-Unsubscribe header into HTTP and mailto URLs.
 * RFC 2369 format: comma-separated URLs in angle brackets.
 * e.g. "<https://example.com/unsub>, <mailto:unsub@example.com>"
 */
export function parseListUnsubscribe(header: string): ParsedUnsubscribe {
  const urls = Array.from(header.matchAll(/<([^>]+)>/g), (m) => m[1]);

  let httpUrl: string | null = null;
  let mailtoUrl: string | null = null;

  for (const url of urls) {
    if (!httpUrl && (url.startsWith("https://") || url.startsWith("http://"))) {
      httpUrl = url;
    } else if (!mailtoUrl && url.startsWith("mailto:")) {
      mailtoUrl = url;
    }
  }

  return { httpUrl, mailtoUrl };
}

/**
 * Determine the unsubscribe link type.
 * "one-click" if HTTP URL exists and List-Unsubscribe-Post is present.
 * "http" if HTTP URL exists without one-click support.
 * "mailto" if only mailto is available.
 */
function determineLinkType(
  parsed: ParsedUnsubscribe,
  hasUnsubscribePost: boolean,
): UnsubscribeLinkType {
  if (parsed.httpUrl && hasUnsubscribePost) return "one-click";
  if (parsed.httpUrl) return "http";
  return "mailto";
}

// --- Analysis ---

/**
 * Process fetched message headers into a full analysis result.
 * Groups by sender, computes stats, and picks the best unsubscribe link per sender.
 */
export function analyzeMessages(messages: MessageHeaders[]): AnalysisResult {
  const totalEmails = messages.length;

  // Intermediate map: sender email → accumulated data
  const senderMap = new Map<
    string,
    {
      name: string;
      email: string;
      count: number;
      httpUrl: string | null;
      mailtoUrl: string | null;
      hasOneClick: boolean;
    }
  >();

  let unsubscribableEmails = 0;

  for (const msg of messages) {
    if (!msg.listUnsubscribe) continue;

    unsubscribableEmails++;

    const from = parseFromHeader(msg.from ?? "unknown");
    const unsub = parseListUnsubscribe(msg.listUnsubscribe);
    const hasPost = msg.listUnsubscribePost !== null;

    const existing = senderMap.get(from.email);
    if (existing) {
      existing.count++;
      // Keep first non-null values found
      if (!existing.httpUrl && unsub.httpUrl) existing.httpUrl = unsub.httpUrl;
      if (!existing.mailtoUrl && unsub.mailtoUrl)
        existing.mailtoUrl = unsub.mailtoUrl;
      if (hasPost) existing.hasOneClick = true;
    } else {
      senderMap.set(from.email, {
        name: from.name,
        email: from.email,
        count: 1,
        httpUrl: unsub.httpUrl,
        mailtoUrl: unsub.mailtoUrl,
        hasOneClick: hasPost,
      });
    }
  }

  // Convert map to sorted sender list
  const senders: SenderSummary[] = Array.from(senderMap.values())
    .map((s) => {
      const parsed: ParsedUnsubscribe = {
        httpUrl: s.httpUrl,
        mailtoUrl: s.mailtoUrl,
      };
      const linkType = determineLinkType(parsed, s.hasOneClick);
      // Prefer HTTP over mailto
      const unsubscribeUrl = s.httpUrl ?? s.mailtoUrl ?? "";

      return {
        name: s.name,
        email: s.email,
        messageCount: s.count,
        unsubscribeUrl,
        linkType,
      };
    })
    .sort((a, b) => b.messageCount - a.messageCount);

  const percentage =
    totalEmails > 0
      ? Math.round((unsubscribableEmails / totalEmails) * 100)
      : 0;

  return {
    totalEmails,
    unsubscribableEmails,
    percentage,
    uniqueSenders: senders.length,
    senders,
  };
}
