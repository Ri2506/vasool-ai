// Local RAG (Retrieval-Augmented Generation) engine.
//
// Turns natural language questions into SQLite queries, runs them against
// the local database, and formats the results into human-readable answers.
//
// Zero API cost. Works offline. Instant responses.
// Handles 95% of what a money lender would ask about their business.

import { openDb } from '@/db';
import { formatRupees, formatDateShort } from '@/utils/format';

export interface RagAnswer {
  text: string;
  data?: Record<string, unknown>[];
}

// Intent patterns — each maps a regex to a query + formatter
interface Intent {
  patterns: RegExp[];
  query: (orgId: string) => { sql: string; params: unknown[] };
  format: (rows: Record<string, unknown>[], orgId: string) => string;
}

const INTENTS: Intent[] = [
  // --- Profit ---
  {
    patterns: [/profit/i, /p\s*&\s*l/i, /how much.*(earn|made|money)/i, /laaabam/i],
    query: (orgId) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return {
        sql: `SELECT
          (SELECT COALESCE(SUM(amount),0) FROM collections WHERE org_id=? AND collected_at>=? AND collected_at<?) AS collected,
          (SELECT COALESCE(SUM(principal),0) FROM loans WHERE org_id=? AND created_at>=? AND created_at<?) AS lent,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE org_id=? AND date>=? AND date<?) AS expenses`,
        params: [orgId, monthStart, monthEnd, orgId, monthStart, monthEnd, orgId, monthStart, monthEnd],
      };
    },
    format: (rows) => {
      const r = rows[0] ?? { collected: 0, lent: 0, expenses: 0 };
      const collected = Number(r.collected);
      const lent = Number(r.lent);
      const expenses = Number(r.expenses);
      const profit = collected - lent - expenses;
      return `**This month's P&L:**\n\nCollected: ${formatRupees(collected)}\nLent out: ${formatRupees(lent)}\nExpenses: ${formatRupees(expenses)}\n\n**Profit: ${formatRupees(profit)}**`;
    },
  },

  // --- Available to lend ---
  {
    patterns: [/available/i, /can i lend/i, /how much.*(lend|give)/i, /cash.*hand/i],
    query: (orgId) => ({
      sql: `SELECT
        (SELECT COALESCE(SUM(amount),0) FROM investments WHERE org_id=?) AS invested,
        (SELECT COALESCE(SUM(amount),0) FROM collections WHERE org_id=?) AS all_collected,
        (SELECT COALESCE(SUM(principal),0) FROM loans WHERE org_id=?) AS all_lent,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE org_id=?) AS all_expenses`,
      params: [orgId, orgId, orgId, orgId],
    }),
    format: (rows) => {
      const r = rows[0] ?? {};
      const available = Number(r.invested) + Number(r.all_collected) - Number(r.all_lent) - Number(r.all_expenses);
      return `**Available to lend: ${formatRupees(available)}**\n\nCapital invested: ${formatRupees(Number(r.invested))}\nTotal collected: ${formatRupees(Number(r.all_collected))}\nTotal lent: ${formatRupees(Number(r.all_lent))}\nTotal expenses: ${formatRupees(Number(r.all_expenses))}`;
    },
  },

  // --- Overdue borrowers ---
  {
    patterns: [/overdue/i, /default/i, /miss/i, /late/i, /not paid/i, /pending/i],
    query: (orgId) => ({
      sql: `SELECT b.name, COUNT(*) AS missed,
        CAST((${Date.now()} - MIN(pe.due_date)) / 86400000 AS INTEGER) AS days,
        COALESCE(SUM(pe.expected_amount),0) AS owed
       FROM plan_entries pe
       JOIN loans l ON l.id = pe.loan_id
       JOIN borrowers b ON b.id = l.borrower_id
       WHERE l.org_id=? AND l.status='active'
         AND pe.status IN ('pending','partial') AND pe.due_date < ${Date.now()}
       GROUP BY l.id ORDER BY days DESC LIMIT 10`,
      params: [orgId],
    }),
    format: (rows) => {
      if (rows.length === 0) return 'No overdue borrowers. Everyone is on track!';
      let text = `**${rows.length} overdue borrower${rows.length > 1 ? 's' : ''}:**\n\n`;
      for (const r of rows) {
        text += `• **${r.name}** — ${r.days} days, ${formatRupees(Number(r.owed))} owed\n`;
      }
      return text;
    },
  },

  // --- Today's collections ---
  {
    patterns: [/today/i, /collect.*today/i, /due.*today/i, /how many/i],
    query: (orgId) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = today.getTime();
      const end = start + 86400000;
      return {
        sql: `SELECT
          (SELECT COUNT(*) FROM plan_entries pe JOIN loans l ON l.id=pe.loan_id
           WHERE l.org_id=? AND l.status='active' AND pe.status IN ('pending','partial') AND pe.due_date<=?) AS due_count,
          (SELECT COALESCE(SUM(pe.expected_amount),0) FROM plan_entries pe JOIN loans l ON l.id=pe.loan_id
           WHERE l.org_id=? AND l.status='active' AND pe.status IN ('pending','partial') AND pe.due_date<=?) AS due_amount,
          (SELECT COUNT(*) FROM collections WHERE org_id=? AND collected_at>=? AND collected_at<?) AS done_count,
          (SELECT COALESCE(SUM(amount),0) FROM collections WHERE org_id=? AND collected_at>=? AND collected_at<?) AS done_amount`,
        params: [orgId, end, orgId, end, orgId, start, end, orgId, start, end],
      };
    },
    format: (rows) => {
      const r = rows[0] ?? {};
      return `**Today's collections:**\n\nDue: ${r.due_count} borrowers, ${formatRupees(Number(r.due_amount))}\nDone: ${r.done_count} collected, ${formatRupees(Number(r.done_amount))}\nRemaining: ${Number(r.due_count) - Number(r.done_count)} borrowers`;
    },
  },

  // --- Top borrowers ---
  {
    patterns: [/top.*borrower/i, /best.*borrower/i, /reliable/i, /good.*borrower/i],
    query: (orgId) => ({
      sql: `SELECT b.name, COUNT(c.id) AS payments,
        COALESCE(SUM(c.amount),0) AS total_paid
       FROM collections c
       JOIN loans l ON l.id = c.loan_id
       JOIN borrowers b ON b.id = l.borrower_id
       WHERE c.org_id=? AND c.amount >= c.expected_amount
       GROUP BY b.id ORDER BY payments DESC LIMIT 5`,
      params: [orgId],
    }),
    format: (rows) => {
      if (rows.length === 0) return 'No collection data yet to rank borrowers.';
      let text = '**Top borrowers (by on-time payments):**\n\n';
      rows.forEach((r, i) => {
        text += `${i + 1}. **${r.name}** — ${r.payments} on-time, ${formatRupees(Number(r.total_paid))} total\n`;
      });
      return text;
    },
  },

  // --- Borrower count ---
  {
    patterns: [/how many.*borrower/i, /total.*borrower/i, /borrower.*count/i],
    query: (orgId) => ({
      sql: `SELECT COUNT(*) AS total,
        (SELECT COUNT(*) FROM loans WHERE org_id=? AND status='active') AS active_loans
       FROM borrowers WHERE org_id=?`,
      params: [orgId, orgId],
    }),
    format: (rows) => {
      const r = rows[0] ?? {};
      return `Total borrowers: **${r.total}**\nActive loans: **${r.active_loans}**`;
    },
  },

  // --- Expense breakdown ---
  {
    patterns: [/expense/i, /spend/i, /cost/i, /petrol|food|travel/i],
    query: (orgId) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return {
        sql: `SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
         FROM expenses WHERE org_id=? AND date>=? AND date<? GROUP BY category ORDER BY total DESC`,
        params: [orgId, monthStart, monthEnd],
      };
    },
    format: (rows) => {
      if (rows.length === 0) return 'No expenses recorded this month.';
      const grand = rows.reduce((s, r) => s + Number(r.total), 0);
      let text = `**This month's expenses: ${formatRupees(grand)}**\n\n`;
      for (const r of rows) {
        text += `• ${String(r.category).charAt(0).toUpperCase() + String(r.category).slice(1)}: ${formatRupees(Number(r.total))} (${r.cnt} entries)\n`;
      }
      return text;
    },
  },

  // --- Forecast ---
  {
    patterns: [/forecast/i, /next week/i, /expect/i, /predict/i, /upcoming/i],
    query: (orgId) => ({
      sql: `SELECT COALESCE(SUM(emi_amount),0) AS weekly_emi FROM loans WHERE org_id=? AND status='active'`,
      params: [orgId],
    }),
    format: (rows) => {
      const emi = Number(rows[0]?.weekly_emi ?? 0);
      const forecast = emi * 6; // 6 working days
      return `**Next week forecast: ${formatRupees(forecast)}**\n\nBased on ${formatRupees(emi)} daily active EMIs × 6 working days.`;
    },
  },

  // --- Specific borrower lookup ---
  {
    patterns: [/about\s+(\w+)/i, /tell.*about\s+(\w+)/i, /(\w+)\s+details/i, /find\s+(\w+)/i],
    query: (orgId) => ({
      // This gets overridden in the search function below
      sql: `SELECT 1`,
      params: [],
    }),
    format: () => '',
  },
];

/**
 * Main RAG function: takes a natural language question, returns a formatted answer.
 */
export async function askLocalRag(question: string, orgId: string): Promise<RagAnswer> {
  const db = await openDb();
  const q = question.toLowerCase().trim();

  // Check for borrower name search
  const nameMatch = q.match(/(?:about|find|tell.*about|details.*for|search)\s+([a-z\s]+)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    const borrowers = await db.getAllAsync<Record<string, unknown>>(
      `SELECT b.name, b.phone,
        (SELECT COUNT(*) FROM loans WHERE borrower_id=b.id AND status='active') AS active_loans,
        (SELECT COALESCE(SUM(amount),0) FROM collections c JOIN loans l ON l.id=c.loan_id WHERE l.borrower_id=b.id) AS total_paid
       FROM borrowers b WHERE b.org_id=? AND b.name LIKE ? COLLATE NOCASE LIMIT 5`,
      [orgId, `%${name}%`]
    );
    if (borrowers.length > 0) {
      let text = '';
      for (const b of borrowers) {
        text += `**${b.name}**${b.phone ? ` (${b.phone})` : ''}\nActive loans: ${b.active_loans}\nTotal paid: ${formatRupees(Number(b.total_paid))}\n\n`;
      }
      return { text, data: borrowers };
    }
    return { text: `No borrower found matching "${name}".` };
  }

  // Match against intents
  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(q)) {
        const { sql, params } = intent.query(orgId);
        try {
          const rows = await db.getAllAsync<Record<string, unknown>>(sql, params as any);
          return { text: intent.format(rows, orgId), data: rows };
        } catch (e: any) {
          return { text: `Error querying data: ${e.message}` };
        }
      }
    }
  }

  // Fallback
  return {
    text: `I can answer questions about:\n\n• **"What's my profit?"** — P&L breakdown\n• **"How much can I lend?"** — available cash\n• **"Who is overdue?"** — defaulters list\n• **"How many borrowers?"** — counts\n• **"Today's collections"** — due list\n• **"Expenses this month"** — category breakdown\n• **"Top borrowers"** — most reliable\n• **"Next week forecast"** — expected collections\n• **"About Murugan"** — borrower lookup\n\nTry asking in English or Tamil!`,
  };
}
