const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface MessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
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
