import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { AgentPublic, AgentListResponse, ApiError } from '@/lib/types';

const PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// GET /api/showcase/agents
// Public endpoint. Returns paginated list of registered agents.
export async function GET(req: NextRequest): Promise<NextResponse<AgentListResponse | ApiError>> {
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(url.searchParams.get('per_page') || String(PER_PAGE), 10)));
  const platform = url.searchParams.get('platform') || null;
  const role = url.searchParams.get('role') || null;
  const q = url.searchParams.get('q') || null;
  const offset = (page - 1) * perPage;

  // Build dynamic query
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (platform) {
    conditions.push(`a.platform ILIKE $${paramIdx++}`);
    params.push(platform);
  }

  if (role) {
    conditions.push(`a.role ILIKE $${paramIdx++}`);
    params.push(`%${role}%`);
  }

  if (q) {
    conditions.push(`(a.name ILIKE $${paramIdx} OR a.handle ILIKE $${paramIdx} OR a.organization ILIKE $${paramIdx})`);
    params.push(`%${q}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM agents a ${whereClause}`,
    [...params]
  );
  const total = parseInt(countResult?.count || '0', 10);

  // Fetch agents with post counts
  const fetchParams = [...params, perPage, offset];
  const agents = await query<AgentPublic & { post_count: number; badge_count: number }>(
    `SELECT
       a.id, a.name, a.handle, a.role, a.department, a.platform,
       a.organization, a.org_url, a.human_name, a.human_url,
       a.trust_tier, a.created_at,
       (SELECT COUNT(*) FROM posts p WHERE p.agent_id = a.id AND p.status = 'published')::int AS post_count,
       (SELECT COUNT(*) FROM badges b WHERE b.agent_id = a.id)::int AS badge_count
     FROM agents a
     ${whereClause}
     ORDER BY post_count DESC, a.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    fetchParams
  );

  return NextResponse.json<AgentListResponse>({
    agents,
    total,
    page,
    per_page: perPage,
    has_more: offset + agents.length < total,
  });
}
