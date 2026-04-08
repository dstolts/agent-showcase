import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { sanitizeText, LIMITS } from '@/lib/sanitize';
import type { ApiError } from '@/lib/types';

const ALLOWED_CATEGORIES = ['gtm-strategy', 'product-launch', 'technical', 'industry-insights', 'general'] as const;
type DiscussionCategory = typeof ALLOWED_CATEGORIES[number];

const PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export interface Discussion {
  id: string;
  agent_id: string;
  title: string;
  body: string;
  category: DiscussionCategory;
  status: 'open' | 'closed';
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  agent?: {
    id: string;
    name: string;
    handle: string;
    role: string;
    platform: string;
    trust_tier: string;
  };
}

export interface DiscussionListResponse {
  discussions: Discussion[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface CreateDiscussionRequest {
  title: string;
  body: string;
  category?: string;
}

// GET /api/showcase/discussions
// Public endpoint. Returns paginated list of open discussions.
// Filterable by category via ?category=<slug>
export async function GET(req: NextRequest): Promise<NextResponse<DiscussionListResponse | ApiError>> {
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(url.searchParams.get('per_page') || String(PER_PAGE), 10)));
  const categoryParam = url.searchParams.get('category') || null;
  const offset = (page - 1) * perPage;

  const conditions: string[] = ["d.status = 'open'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (categoryParam && ALLOWED_CATEGORIES.includes(categoryParam as DiscussionCategory)) {
    conditions.push(`d.category = $${paramIdx++}`);
    params.push(categoryParam);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countParams = [...params];
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM discussions d
     ${whereClause}`,
    countParams
  );
  const total = parseInt(countResult?.count || '0', 10);

  params.push(perPage, offset);
  const discussions = await query<Discussion>(
    `SELECT
       d.id, d.agent_id, d.title, d.body, d.category, d.status,
       d.reply_count, d.last_activity_at, d.created_at, d.updated_at,
       json_build_object(
         'id', a.id,
         'name', a.name,
         'handle', a.handle,
         'role', a.role,
         'platform', a.platform,
         'trust_tier', a.trust_tier
       ) AS agent
     FROM discussions d
     JOIN agents a ON a.id = d.agent_id
     ${whereClause}
     ORDER BY d.last_activity_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return NextResponse.json<DiscussionListResponse>({
    discussions,
    total,
    page,
    per_page: perPage,
    has_more: offset + discussions.length < total,
  });
}

// POST /api/showcase/discussions
// Authenticated. Creates a new discussion thread.
export async function POST(req: NextRequest): Promise<NextResponse<Discussion | ApiError>> {
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'write');
  if (authError) return authError as NextResponse<Discussion | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<Discussion | ApiError>;

  let body: CreateDiscussionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Sanitize all text input
  const title = sanitizeText(String(body.title ?? ''), LIMITS.title).trim();
  const bodyText = sanitizeText(String(body.body ?? ''), LIMITS.content).trim();
  const categoryRaw = sanitizeText(String(body.category ?? 'general'), LIMITS.short)
    .toLowerCase()
    .replace(/\s+/g, '-');

  // Validate required fields
  if (!title) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: title', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  if (!bodyText) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const category: DiscussionCategory = ALLOWED_CATEGORIES.includes(categoryRaw as DiscussionCategory)
    ? (categoryRaw as DiscussionCategory)
    : 'general';

  const discussionId = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO discussions (id, agent_id, title, body, category, status, reply_count, last_activity_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'open', 0, $6, $6, $6)`,
    [discussionId, auth!.agent_id, title, bodyText, category, now]
  );

  const created = await queryOne<Discussion>(
    `SELECT
       d.id, d.agent_id, d.title, d.body, d.category, d.status,
       d.reply_count, d.last_activity_at, d.created_at, d.updated_at,
       json_build_object(
         'id', a.id,
         'name', a.name,
         'handle', a.handle,
         'role', a.role,
         'platform', a.platform,
         'trust_tier', a.trust_tier
       ) AS agent
     FROM discussions d
     JOIN agents a ON a.id = d.agent_id
     WHERE d.id = $1`,
    [discussionId]
  );

  return NextResponse.json<Discussion>(created!, { status: 201 });
}
