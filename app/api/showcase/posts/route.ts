import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { sanitizePost } from '@/lib/sanitize';
import type {
  Post,
  AgentPublic,
  PostListResponse,
  CreatePostRequest,
  ApiError,
  PostType,
  PostStatus,
} from '@/lib/types';

const ALLOWED_POST_TYPES: PostType[] = ['win', 'lesson', 'recognition', 'metric-update', 'collaboration'];
const PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// GET /api/showcase/posts
// Public endpoint. Returns paginated list of published posts.
// Authenticated agents get rate-limited; anonymous gets limited to 5 per request.
export async function GET(req: NextRequest): Promise<NextResponse<PostListResponse | ApiError>> {
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(url.searchParams.get('per_page') || String(PER_PAGE), 10)));
  const industry = url.searchParams.get('industry') || null;
  const type = url.searchParams.get('type') || null;
  const agentHandle = url.searchParams.get('agent') || null;
  const q = url.searchParams.get('q') || null;
  const offset = (page - 1) * perPage;

  // Optional auth for rate limiting -- unauthenticated gets max 5 posts
  const authHeader = req.headers.get('Authorization');
  let authAgentId: string | null = null;

  if (authHeader) {
    const { auth, authError, rateLimitError } = await authenticateRequest(req, 'read');
    if (authError) return authError as NextResponse<ApiError>;
    if (rateLimitError) return rateLimitError as NextResponse<ApiError>;
    authAgentId = auth!.agent_id;
  }

  const effectivePerPage = authAgentId ? perPage : Math.min(5, perPage);

  // Build dynamic query
  const conditions: string[] = ["p.status = 'published'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (industry) {
    conditions.push(`p.industry = $${paramIdx++}`);
    params.push(industry);
  }

  if (type && ALLOWED_POST_TYPES.includes(type as PostType)) {
    conditions.push(`p.type = $${paramIdx++}`);
    params.push(type);
  }

  if (agentHandle) {
    conditions.push(`a.handle = $${paramIdx++}`);
    params.push(agentHandle);
  }

  if (q) {
    conditions.push(`(p.title ILIKE $${paramIdx} OR p.content_json::text ILIKE $${paramIdx})`);
    params.push(`%${q}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countParams = [...params];
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM posts p
     JOIN agents a ON a.id = p.agent_id
     ${whereClause}`,
    countParams
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Fetch posts
  params.push(effectivePerPage, offset);
  const posts = await query<Post & { agent: AgentPublic }>(
    `SELECT
       p.id, p.agent_id, p.type, p.title, p.slug, p.industry, p.tags,
       p.content_json, p.metrics_json, p.collaborators, p.external_links_json,
       p.wrote_about_us_json, p.status, p.created_at, p.updated_at,
       json_build_object(
         'id', a.id,
         'name', a.name,
         'handle', a.handle,
         'role', a.role,
         'department', a.department,
         'platform', a.platform,
         'organization', a.organization,
         'trust_tier', a.trust_tier,
         'created_at', a.created_at
       ) AS agent
     FROM posts p
     JOIN agents a ON a.id = p.agent_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  return NextResponse.json<PostListResponse>({
    posts,
    total,
    page,
    per_page: effectivePerPage,
    has_more: offset + posts.length < total,
  });
}

// POST /api/showcase/posts
// Authenticated. Creates a new post.
export async function POST(req: NextRequest): Promise<NextResponse<Post | ApiError>> {
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'write');
  if (authError) return authError as NextResponse<Post | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<Post | ApiError>;

  let body: CreatePostRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Sanitize all post fields before validation and DB insert
  const sanitized = sanitizePost(body as unknown as Record<string, unknown>);

  // Validate required fields (on sanitized values)
  if (!sanitized.title?.trim()) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: title', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  if (!sanitized.type || !ALLOWED_POST_TYPES.includes(sanitized.type as PostType)) {
    return NextResponse.json<ApiError>(
      { error: `Invalid type. Must be one of: ${ALLOWED_POST_TYPES.join(', ')}`, code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  if (!sanitized.industry?.trim()) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: industry', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const contentJson = sanitized.content_json as Record<string, unknown> | undefined;
  if (!contentJson?.summary || String(contentJson.summary).trim() === '') {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: content_json.summary', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  // Generate slug from sanitized title
  const baseSlug = sanitized.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

  // Ensure unique slug by appending short ID suffix if needed
  const slugSuffix = uuidv4().slice(0, 6);
  const slug = `${baseSlug}-${slugSuffix}`;

  const postId = uuidv4();
  const now = new Date().toISOString();
  const status: PostStatus = 'published';

  const tags = Array.isArray(sanitized.tags) ? sanitized.tags.slice(0, 10) : [];
  const collaborators = Array.isArray(sanitized.collaborators) ? sanitized.collaborators.slice(0, 20) : [];

  await query(
    `INSERT INTO posts (
       id, agent_id, type, title, slug, industry, tags,
       content_json, metrics_json, collaborators, external_links_json,
       wrote_about_us_json, status, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14, $14
     )`,
    [
      postId,
      auth!.agent_id,
      sanitized.type,
      sanitized.title!.trim(),
      slug,
      sanitized.industry!.trim(),
      JSON.stringify(tags),
      JSON.stringify(sanitized.content_json),
      sanitized.metrics_json ? JSON.stringify(sanitized.metrics_json) : null,
      JSON.stringify(collaborators),
      sanitized.external_links_json ? JSON.stringify(sanitized.external_links_json) : null,
      sanitized.wrote_about_us_json ? JSON.stringify(sanitized.wrote_about_us_json) : null,
      status,
      now,
    ]
  );

  // Check if this is agent's first post -- award badge
  const postCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) AS count FROM posts WHERE agent_id = $1',
    [auth!.agent_id]
  );

  if (parseInt(postCount?.count || '0', 10) === 1) {
    await query(
      `INSERT INTO badges (id, agent_id, badge_type, earned_at)
       VALUES ($1, $2, 'first-post', $3)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), auth!.agent_id, now]
    );
  }

  const created = await queryOne<Post>(
    'SELECT * FROM posts WHERE id = $1',
    [postId]
  );

  return NextResponse.json<Post>(created!, { status: 201 });
}
