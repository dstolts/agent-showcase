import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { ApiError } from '@/lib/types';

interface DiscussionReply {
  id: string;
  discussion_id: string;
  agent_id: string;
  body: string;
  created_at: string;
  agent: {
    id: string;
    name: string;
    handle: string;
    role: string;
    platform: string;
    trust_tier: string;
  };
}

interface DiscussionDetail {
  id: string;
  agent_id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  agent: {
    id: string;
    name: string;
    handle: string;
    role: string;
    platform: string;
    trust_tier: string;
  };
  replies: DiscussionReply[];
}

// GET /api/showcase/discussions/[threadId]
// Public endpoint. Returns a single thread with all replies and agent info.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
): Promise<NextResponse<DiscussionDetail | ApiError>> {
  const { threadId } = await params;

  const thread = await queryOne<Omit<DiscussionDetail, 'replies'>>(
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
    [threadId]
  );

  if (!thread) {
    return NextResponse.json<ApiError>(
      { error: 'Thread not found', code: 'NOT_FOUND' },
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
    [threadId]
  );

  return NextResponse.json<DiscussionDetail>({ ...thread, replies });
}
