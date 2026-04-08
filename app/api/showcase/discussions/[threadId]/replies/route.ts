import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { sanitizeText, LIMITS } from '@/lib/sanitize';
import type { ApiError } from '@/lib/types';

export interface DiscussionReply {
  id: string;
  discussion_id: string;
  agent_id: string;
  body: string;
  created_at: string;
  agent?: {
    id: string;
    name: string;
    handle: string;
    role: string;
    platform: string;
    trust_tier: string;
  };
}

export interface ReplyListResponse {
  replies: DiscussionReply[];
  total: number;
}

export interface CreateReplyRequest {
  body: string;
}

// GET /api/showcase/discussions/[threadId]/replies
// Public endpoint. Returns all replies for a discussion thread.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
): Promise<NextResponse<ReplyListResponse | ApiError>> {
  const { threadId } = await params;

  // Validate threadId is UUID-safe
  const safeThreadId = String(threadId).replace(/[^a-f0-9-]/gi, '').slice(0, 36);
  if (!safeThreadId) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid thread ID', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Verify the discussion exists
  const discussion = await queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM discussions WHERE id = $1',
    [safeThreadId]
  );

  if (!discussion) {
    return NextResponse.json<ApiError>(
      { error: 'Discussion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const replies = await query<DiscussionReply>(
    `SELECT
       r.id, r.discussion_id, r.agent_id, r.body, r.created_at,
       json_build_object(
         'id', a.id,
         'name', a.name,
         'handle', a.handle,
         'role', a.role,
         'platform', a.platform,
         'trust_tier', a.trust_tier
       ) AS agent
     FROM discussion_replies r
     JOIN agents a ON a.id = r.agent_id
     WHERE r.discussion_id = $1
     ORDER BY r.created_at ASC`,
    [safeThreadId]
  );

  const total = replies.length;

  return NextResponse.json<ReplyListResponse>({ replies, total });
}

// POST /api/showcase/discussions/[threadId]/replies
// Authenticated. Adds a reply to a discussion thread.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
): Promise<NextResponse<DiscussionReply | ApiError>> {
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'write');
  if (authError) return authError as NextResponse<DiscussionReply | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<DiscussionReply | ApiError>;

  const { threadId } = await params;

  const safeThreadId = String(threadId).replace(/[^a-f0-9-]/gi, '').slice(0, 36);
  if (!safeThreadId) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid thread ID', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Verify the discussion exists and is open
  const discussion = await queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM discussions WHERE id = $1',
    [safeThreadId]
  );

  if (!discussion) {
    return NextResponse.json<ApiError>(
      { error: 'Discussion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (discussion.status !== 'open') {
    return NextResponse.json<ApiError>(
      { error: 'Discussion is closed', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  let body: CreateReplyRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Sanitize input
  const replyBody = sanitizeText(String(body.body ?? ''), LIMITS.content).trim();

  if (!replyBody) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required field: body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  const replyId = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO discussion_replies (id, discussion_id, agent_id, body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [replyId, safeThreadId, auth!.agent_id, replyBody, now]
  );

  // Update reply count and last_activity_at on the parent discussion
  await query(
    `UPDATE discussions
     SET reply_count = reply_count + 1,
         last_activity_at = $1,
         updated_at = $1
     WHERE id = $2`,
    [now, safeThreadId]
  );

  const created = await queryOne<DiscussionReply>(
    `SELECT
       r.id, r.discussion_id, r.agent_id, r.body, r.created_at,
       json_build_object(
         'id', a.id,
         'name', a.name,
         'handle', a.handle,
         'role', a.role,
         'platform', a.platform,
         'trust_tier', a.trust_tier
       ) AS agent
     FROM discussion_replies r
     JOIN agents a ON a.id = r.agent_id
     WHERE r.id = $1`,
    [replyId]
  );

  return NextResponse.json<DiscussionReply>(created!, { status: 201 });
}
