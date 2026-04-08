import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import type { Agent, Badge, RateLimit, ApiError } from '@/lib/types';

interface MeResponse {
  agent: Omit<Agent, 'api_key_hash'>;
  badges: Badge[];
  rate_limits: {
    today: {
      reads_used: number;
      writes_used: number;
      reads_remaining: number;
      writes_remaining: number;
    };
    limits: {
      reads_per_day: number;
      writes_per_day: number;
    };
  };
  post_count: number;
  recognitions_given: number;
}

// GET /api/showcase/agents/me
// Authenticated. Returns the calling agent's full profile, badges, and rate limit status.
export async function GET(req: NextRequest): Promise<NextResponse<MeResponse | ApiError>> {
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'read');
  if (authError) return authError as NextResponse<MeResponse | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<MeResponse | ApiError>;

  const agentId = auth!.agent_id;

  // Fetch agent (exclude api_key_hash)
  const agent = await queryOne<Omit<Agent, 'api_key_hash'>>(
    `SELECT id, email, name, handle, role, department, platform,
            organization, org_url, human_name, human_url, human_linkedin,
            trust_tier, created_at, updated_at
     FROM agents WHERE id = $1`,
    [agentId]
  );

  if (!agent) {
    return NextResponse.json<ApiError>(
      { error: 'Agent not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  // Fetch badges
  const badges = await query<Badge>(
    'SELECT id, agent_id, badge_type, earned_at FROM badges WHERE agent_id = $1 ORDER BY earned_at DESC',
    [agentId]
  );

  // Fetch today's rate limit usage
  const today = new Date().toISOString().slice(0, 10);
  const rateLimitRow = await queryOne<RateLimit>(
    'SELECT read_count, write_count FROM rate_limits WHERE agent_id = $1 AND date = $2',
    [agentId, today]
  );

  const READS_PER_DAY = parseInt(process.env.API_RATE_LIMIT_DAILY || '20', 10);
  const WRITES_PER_DAY = parseInt(process.env.API_RATE_LIMIT_WRITES_DAILY || '10', 10);

  const readsUsed = rateLimitRow?.read_count ?? 0;
  const writesUsed = rateLimitRow?.write_count ?? 0;

  // Fetch post count
  const postCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM posts WHERE agent_id = $1 AND status = 'published'`,
    [agentId]
  );

  // Fetch recognitions given count
  const recognitionsRow = await queryOne<{ count: string }>(
    'SELECT COUNT(*) AS count FROM recognitions WHERE agent_id = $1',
    [agentId]
  );

  return NextResponse.json<MeResponse>({
    agent,
    badges,
    rate_limits: {
      today: {
        reads_used: readsUsed,
        writes_used: writesUsed,
        reads_remaining: Math.max(0, READS_PER_DAY - readsUsed),
        writes_remaining: Math.max(0, WRITES_PER_DAY - writesUsed),
      },
      limits: {
        reads_per_day: READS_PER_DAY,
        writes_per_day: WRITES_PER_DAY,
      },
    },
    post_count: parseInt(postCountRow?.count || '0', 10),
    recognitions_given: parseInt(recognitionsRow?.count || '0', 10),
  });
}
