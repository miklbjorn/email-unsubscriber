const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_BATCH_ENDPOINT = "https://gmail.googleapis.com/batch";
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

interface MessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageResponse {
  id: string;
  payload?: {
    headers?: GmailHeader[];
  };
}

export interface MessageHeaders {
  messageId: string;
  from: string | null;
  listUnsubscribe: string | null;
  listUnsubscribePost: string | null;
}

interface BatchFailure {
  messageId: string;
  status: number;
  bodySnippet: string;
}

interface BatchParseResult {
  results: MessageHeaders[];
  failures: BatchFailure[];
}

interface GmailProfileResponse {
  emailAddress: string;
}

/**
 * Fetch the authenticated user's email address from Gmail profile.
 */
export async function fetchUserEmail(token: string): Promise<string> {
  const response = await fetch(`${GMAIL_API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail profile API error (${response.status}): ${text}`);
  }

  const data: GmailProfileResponse = await response.json();
  return data.emailAddress;
}

/**
 * Fetch all message IDs matching a date range from Gmail.
 * Handles pagination automatically (Gmail returns max 500 per page).
 */
export async function fetchMessageIds(
  token: string,
  after: string,
  before: string,
): Promise<string[]> {
  const query = `after:${after} before:${before}`;
  const allIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "500");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gmail API error (${response.status}): ${text}`);
    }

    const data: MessageListResponse = await response.json();

    if (data.messages) {
      for (const msg of data.messages) {
        allIds.push(msg.id);
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return allIds;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function splitOnce(value: string, delimiter: string): [string, string] {
  const index = value.indexOf(delimiter);
  if (index === -1) {
    return [value, ""];
  }
  return [value.slice(0, index), value.slice(index + delimiter.length)];
}

function extractBoundary(contentType: string | null): string {
  if (!contentType) {
    throw new Error("Missing batch response Content-Type header");
  }
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match) {
    throw new Error(`Missing batch boundary in Content-Type: ${contentType}`);
  }
  return match[1].trim().replace(/^"|"$/g, "");
}

function parseContentIdIndex(contentId: string | null): number | null {
  if (!contentId) return null;
  const cleaned = contentId.replace(/^<|>$/g, "").replace(/^response-/, "");
  const match = cleaned.match(/item-(\d+)/);
  return match ? Number(match[1]) : null;
}

function getHeaderValue(headersText: string, name: string): string | null {
  const regex = new RegExp(`^${name}:\\s*(.+)$`, "im");
  const match = headersText.match(regex);
  return match ? match[1].trim() : null;
}

function buildBatchRequestBody(messageIds: string[]): {
  boundary: string;
  body: string;
} {
  const boundary =
    typeof crypto.randomUUID === "function"
      ? `batch_${crypto.randomUUID()}`
      : `batch_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [];

  for (let i = 0; i < messageIds.length; i += 1) {
    const messageId = messageIds[i];
    const path = `/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId,
    )}?format=metadata&metadataHeaders=From&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;

    lines.push(`--${boundary}`);
    lines.push("Content-Type: application/http");
    lines.push("Content-Transfer-Encoding: binary");
    lines.push(`Content-ID: <item-${i}>`);
    lines.push("");
    lines.push(`GET ${path} HTTP/1.1`);
    lines.push("");
  }

  lines.push(`--${boundary}--`);
  lines.push("");

  return { boundary, body: lines.join("\r\n") };
}

function parseBatchResponse(
  responseText: string,
  contentType: string | null,
  messageIds: string[],
): BatchParseResult {
  const boundary = extractBoundary(contentType);
  const normalized = responseText.replace(/\r\n/g, "\n");
  const parts = normalized.split(`--${boundary}`);
  const results: MessageHeaders[] = [];
  const failures: BatchFailure[] = [];
  const processed = new Set<number>();
  let fallbackIndex = 0;

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part || part === "--") continue;

    const [partHeaders, rest] = splitOnce(part, "\n\n");
    if (!rest) continue;

    const contentId = getHeaderValue(partHeaders, "Content-ID");
    let index = parseContentIdIndex(contentId);
    if (index === null) {
      index = fallbackIndex;
      fallbackIndex += 1;
    }
    if (index < 0 || index >= messageIds.length) {
      throw new Error(`Batch response index out of range: ${index}`);
    }
    processed.add(index);

    const [httpHeaders, body] = splitOnce(rest, "\n\n");
    if (!body) continue;

    const statusLine = httpHeaders.split("\n")[0] ?? "";
    const statusCode = Number(statusLine.split(" ")[1]);
    if (!Number.isFinite(statusCode)) {
      throw new Error(`Invalid batch response status line: ${statusLine}`);
    }

    if (statusCode < 200 || statusCode >= 300) {
      const messageId = messageIds[index] ?? "unknown";
      const snippet = body.trim().slice(0, 500);
      failures.push({ messageId, status: statusCode, bodySnippet: snippet });
      continue;
    }

    const data: GmailMessageResponse = JSON.parse(body);
    const headers = data.payload?.headers ?? [];
    const getHeader = (name: string): string | null =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
      null;

    results.push({
      messageId: messageIds[index],
      from: getHeader("From"),
      listUnsubscribe: getHeader("List-Unsubscribe"),
      listUnsubscribePost: getHeader("List-Unsubscribe-Post"),
    });
  }

  for (let i = 0; i < messageIds.length; i += 1) {
    if (!processed.has(i)) {
      failures.push({
        messageId: messageIds[i],
        status: 0,
        bodySnippet: "Missing batch response for item",
      });
    }
  }

  return { results, failures };
}

async function fetchMessageHeadersBatch(
  token: string,
  messageIds: string[],
): Promise<BatchParseResult> {
  const { boundary, body } = buildBatchRequestBody(messageIds);
  const response = await fetch(GMAIL_BATCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail batch API error (${response.status}): ${text}`);
  }

  const responseText = await response.text();
  return parseBatchResponse(
    responseText,
    response.headers.get("content-type"),
    messageIds,
  );
}

function shouldRetryFailure(failure: BatchFailure): boolean {
  if (failure.status === 0 || failure.status === 429) {
    return true;
  }
  if (failure.status === 403) {
    const body = failure.bodySnippet.toLowerCase();
    return (
      body.includes("ratelimitexceeded") ||
      body.includes("userratelimitexceeded") ||
      body.includes("backenderror")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch headers for all message IDs using Gmail batch requests.
 * Gmail supports up to 100 calls per batch; 50 is recommended to avoid rate limits.
 */
export async function fetchAllMessageHeaders(
  token: string,
  messageIds: string[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<MessageHeaders[]> {
  if (messageIds.length === 0) {
    return [];
  }

  const effectiveBatchSize = Math.max(
    1,
    Math.min(MAX_BATCH_SIZE, Math.floor(batchSize)),
  );
  const resultsById = new Map<string, MessageHeaders>();
  let pendingIds = [...messageIds];
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts && pendingIds.length > 0; attempt += 1) {
    const batches = chunkArray(pendingIds, effectiveBatchSize);
    pendingIds = [];

    for (const batch of batches) {
      const { results, failures } = await fetchMessageHeadersBatch(token, batch);

      for (const item of results) {
        resultsById.set(item.messageId, item);
      }

      const retryable = failures.filter(shouldRetryFailure);
      const nonRetryable = failures.filter((failure) => !shouldRetryFailure(failure));

      if (nonRetryable.length > 0) {
        const details = nonRetryable
          .map(
            (failure) =>
              `${failure.messageId} (${failure.status}): ${failure.bodySnippet}`,
          )
          .join("; ");
        throw new Error(`Gmail batch item error(s): ${details}`);
      }

      pendingIds.push(...retryable.map((failure) => failure.messageId));
    }

    if (pendingIds.length > 0 && attempt < maxAttempts) {
      const baseDelayMs = 500;
      const jitterMs = Math.floor(Math.random() * 250);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + jitterMs;
      await sleep(delayMs);
    }
  }

  if (pendingIds.length > 0) {
    throw new Error(
      `Gmail rate limit: failed to fetch ${pendingIds.length} messages after ${maxAttempts} attempts`,
    );
  }

  return messageIds.map((messageId) => {
    const value = resultsById.get(messageId);
    if (!value) {
      throw new Error(`Missing batch response for message ${messageId}`);
    }
    return value;
  });
}
