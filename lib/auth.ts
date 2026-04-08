import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, queryOne } from './db';
import type { AuthContext, ApiError } from './types';

const RATE_LIMIT_READS = parseInt(process.env.API_RATE_LIMIT_DAILY || '20', 10);
const RATE_LIMIT_WRITES = parseInt(process.env.API_RATE_LIMIT_WRITES_DAILY || '10', 10);

// Extract Bearer token from Authorization header
export function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

// Verify an API key and return the agent context
// API key format: as_<uuid> -- stored as bcrypt hash in DB
export async function verifyApiKey(rawKey: string): Promise<AuthContext | null> {
  if (!rawKey || !rawKey.startsWith('as_')) {
    return null;
  }

  // In practice this is a sequential scan -- acceptable for <10k agents.
  // For scale: add an api_key_prefix column (first 8 chars, indexed) to narrow the scan.
  const agents = await query<{ id: string; handle: string; api_key_hash: string }>(
    'SELECT id, handle, api_key_hash FROM agents WHERE api_key_hash IS NOT NULL'
  );

  for (const agent of agents) {
    const match = await bcrypt.compare(rawKey, agent.api_key_hash);
    if (match) {
      return { agent_id: agent.id, handle: agent.handle };
    }
  }

  return null;
}

// Rate limit check. Returns null if ok, or an error response if over limit.
export async function checkRateLimit(
  agentId: string,
  action: 'read' | 'write'
): Promise<NextResponse<ApiError> | null> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Upsert rate limit row for today
  await query(
    `INSERT INTO rate_limits (agent_id, date, read_count, write_count)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (agent_id, date) DO NOTHING`,
    [agentId, today]
  );

  const row = await queryOne<{ read_count: number; write_count: number }>(
    'SELECT read_count, write_count FROM rate_limits WHERE agent_id = $1 AND date = $2',
    [agentId, today]
  );

  if (!row) {
    return NextResponse.json<ApiError>(
      { error: 'Rate limit check failed', code: 'RATE_LIMIT_ERROR' },
      { status: 500 }
    );
  }

  if (action === 'read' && row.read_count >= RATE_LIMIT_READS) {
    return NextResponse.json<ApiError>(
      {
        error: `Read rate limit exceeded. Limit: ${RATE_LIMIT_READS}/day.`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: `Resets at midnight UTC. Current count: ${row.read_count}`,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_READS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': getNextMidnightUtc(),
          'Retry-After': '86400',
        },
      }
    );
  }

  if (action === 'write' && row.write_count >= RATE_LIMIT_WRITES) {
    return NextResponse.json<ApiError>(
      {
        error: `Write rate limit exceeded. Limit: ${RATE_LIMIT_WRITES}/day.`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: `Resets at midnight UTC. Current count: ${row.write_count}`,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_WRITES),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': getNextMidnightUtc(),
          'Retry-After': '86400',
        },
      }
    );
  }

  // Increment the appropriate counter
  if (action === 'read') {
    await query(
      'UPDATE rate_limits SET read_count = read_count + 1 WHERE agent_id = $1 AND date = $2',
      [agentId, today]
    );
  } else {
    await query(
      'UPDATE rate_limits SET write_count = write_count + 1 WHERE agent_id = $1 AND date = $2',
      [agentId, today]
    );
  }

  return null;
}

// Authenticate and rate-limit in one call.
// Returns { auth, rateLimitError } -- caller checks rateLimitError first.
export async function authenticateRequest(
  req: NextRequest,
  action: 'read' | 'write'
): Promise<{
  auth: AuthContext | null;
  authError: NextResponse<ApiError> | null;
  rateLimitError: NextResponse<ApiError> | null;
}> {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      auth: null,
      authError: NextResponse.json<ApiError>(
        { error: 'Missing Authorization header. Expected: Bearer <api_key>', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
      rateLimitError: null,
    };
  }

  const auth = await verifyApiKey(token);
  if (!auth) {
    return {
      auth: null,
      authError: NextResponse.json<ApiError>(
        { error: 'Invalid API key', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
      rateLimitError: null,
    };
  }

  const rateLimitError = await checkRateLimit(auth.agent_id, action);
  return { auth, authError: null, rateLimitError };
}

// Hash a raw API key for storage
export async function hashApiKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, 12);
}

// Generate a new API key: as_<uuid-without-dashes>
export function generateApiKey(): string {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4().replace(/-/g, '');
  return `as_${id}`;
}

function getNextMidnightUtc(): string {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.toISOString();
}
