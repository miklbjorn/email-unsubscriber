const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

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

/**
 * Fetch metadata headers for a single message.
 * Uses format=metadata to avoid downloading full message bodies.
 */
async function fetchMessageMetadata(
  token: string,
  messageId: string,
): Promise<MessageHeaders> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "From");
  url.searchParams.append("metadataHeaders", "List-Unsubscribe");
  url.searchParams.append("metadataHeaders", "List-Unsubscribe-Post");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${text}`);
  }

  const data: GmailMessageResponse = await response.json();
  const headers = data.payload?.headers ?? [];

  const getHeader = (name: string): string | null =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    null;

  return {
    messageId,
    from: getHeader("From"),
    listUnsubscribe: getHeader("List-Unsubscribe"),
    listUnsubscribePost: getHeader("List-Unsubscribe-Post"),
  };
}

/**
 * Fetch headers for all message IDs with concurrency control.
 * Limits parallel requests to avoid Gmail API rate limits (~50 req/sec).
 */
export async function fetchAllMessageHeaders(
  token: string,
  messageIds: string[],
  concurrency: number = 25,
): Promise<MessageHeaders[]> {
  const results: MessageHeaders[] = [];
  let index = 0;

  async function worker() {
    while (index < messageIds.length) {
      const currentIndex = index++;
      results[currentIndex] = await fetchMessageMetadata(
        token,
        messageIds[currentIndex],
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, messageIds.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
