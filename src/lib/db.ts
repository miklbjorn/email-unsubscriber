import type { AnalysisResult, SenderSummary, UnsubscribeLinkType } from "./analysis";

// --- Types ---

export interface SavedAnalysis {
  id: string;
  userEmail: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  totalEmails: number;
  unsubscribableEmails: number;
  percentage: number;
  uniqueSenders: number;
  createdAt: string;
}

export interface SavedAnalysisWithSenders extends SavedAnalysis {
  senders: SenderSummary[];
}

// --- Operations ---

export async function saveAnalysis(
  db: D1Database,
  params: {
    userEmail: string;
    dateRangeStart: string;
    dateRangeEnd: string;
    analysis: AnalysisResult;
  },
): Promise<string> {
  const id = crypto.randomUUID();

  const analysisStmt = db
    .prepare(
      `INSERT INTO analyses (id, user_email, date_range_start, date_range_end, total_emails, unsubscribable_emails, percentage, unique_senders)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.userEmail,
      params.dateRangeStart,
      params.dateRangeEnd,
      params.analysis.totalEmails,
      params.analysis.unsubscribableEmails,
      params.analysis.percentage,
      params.analysis.uniqueSenders,
    );

  const senderStmts = params.analysis.senders.map((sender) =>
    db
      .prepare(
        `INSERT INTO analysis_senders (analysis_id, sender_name, sender_email, email_count, unsubscribe_url, unsubscribe_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        sender.name,
        sender.email,
        sender.messageCount,
        sender.unsubscribeUrl,
        sender.linkType,
      ),
  );

  await db.batch([analysisStmt, ...senderStmts]);

  return id;
}

export async function listAnalyses(
  db: D1Database,
  userEmail: string,
): Promise<SavedAnalysis[]> {
  const result = await db
    .prepare(
      `SELECT id, user_email, date_range_start, date_range_end, total_emails, unsubscribable_emails, percentage, unique_senders, created_at
       FROM analyses WHERE user_email = ? ORDER BY created_at DESC`,
    )
    .bind(userEmail)
    .all();

  return result.results.map((row) => ({
    id: row.id as string,
    userEmail: row.user_email as string,
    dateRangeStart: row.date_range_start as string,
    dateRangeEnd: row.date_range_end as string,
    totalEmails: row.total_emails as number,
    unsubscribableEmails: row.unsubscribable_emails as number,
    percentage: row.percentage as number,
    uniqueSenders: row.unique_senders as number,
    createdAt: row.created_at as string,
  }));
}

export async function getAnalysis(
  db: D1Database,
  id: string,
  userEmail: string,
): Promise<SavedAnalysisWithSenders | null> {
  const analysisRow = await db
    .prepare(
      `SELECT id, user_email, date_range_start, date_range_end, total_emails, unsubscribable_emails, percentage, unique_senders, created_at
       FROM analyses WHERE id = ? AND user_email = ?`,
    )
    .bind(id, userEmail)
    .first();

  if (!analysisRow) return null;

  const sendersResult = await db
    .prepare(
      `SELECT sender_name, sender_email, email_count, unsubscribe_url, unsubscribe_type, clicked_at
       FROM analysis_senders WHERE analysis_id = ? ORDER BY email_count DESC`,
    )
    .bind(id)
    .all();

  const senders: SenderSummary[] = sendersResult.results.map((row) => ({
    name: row.sender_name as string,
    email: row.sender_email as string,
    messageCount: row.email_count as number,
    unsubscribeUrl: row.unsubscribe_url as string,
    linkType: row.unsubscribe_type as UnsubscribeLinkType,
    clickedAt: (row.clicked_at as string) ?? null,
  }));

  return {
    id: analysisRow.id as string,
    userEmail: analysisRow.user_email as string,
    dateRangeStart: analysisRow.date_range_start as string,
    dateRangeEnd: analysisRow.date_range_end as string,
    totalEmails: analysisRow.total_emails as number,
    unsubscribableEmails: analysisRow.unsubscribable_emails as number,
    percentage: analysisRow.percentage as number,
    uniqueSenders: analysisRow.unique_senders as number,
    createdAt: analysisRow.created_at as string,
    senders,
  };
}

export async function markSenderClicked(
  db: D1Database,
  analysisId: string,
  senderEmail: string,
  userEmail: string,
): Promise<boolean> {
  // Verify ownership: the analysis must belong to this user
  const analysis = await db
    .prepare(`SELECT id FROM analyses WHERE id = ? AND user_email = ?`)
    .bind(analysisId, userEmail)
    .first();

  if (!analysis) return false;

  const result = await db
    .prepare(
      `UPDATE analysis_senders SET clicked_at = datetime('now')
       WHERE analysis_id = ? AND sender_email = ? AND clicked_at IS NULL`,
    )
    .bind(analysisId, senderEmail)
    .run();

  return result.meta.changes > 0;
}
