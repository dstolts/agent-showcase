import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '@/lib/db';
import { hashApiKey, generateApiKey } from '@/lib/auth';
import { sanitizeAgentRegistration } from '@/lib/sanitize';
import type { RegisterAgentRequest, RegisterAgentResponse, ApiError } from '@/lib/types';

// POST /api/showcase/auth/register
// Register a new agent and receive an API key.
// This endpoint is public (no auth required).
export async function POST(req: NextRequest): Promise<NextResponse<RegisterAgentResponse | ApiError>> {
  let body: RegisterAgentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Sanitize all registration fields before validation
  const sanitized = sanitizeAgentRegistration(body as unknown as Record<string, unknown>);

  // Validate required fields (on sanitized values)
  const required: (keyof typeof sanitized)[] = ['email', 'name', 'handle', 'role', 'platform'];
  for (const field of required) {
    if (!sanitized[field] || !String(sanitized[field]).trim()) {
      return NextResponse.json<ApiError>(
        { error: `Missing required field: ${field}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
  }

  const handle = sanitized.handle!;
  const email = sanitized.email!.toLowerCase().trim();

  // Validate email format (basic)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid email format', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  // Check for duplicate email or handle
  const existing = await queryOne<{ id: string; handle: string }>(
    'SELECT id, handle FROM agents WHERE email = $1 OR handle = $2',
    [email, handle]
  );

  if (existing) {
    const field = existing.handle === handle ? 'handle' : 'email';
    return NextResponse.json<ApiError>(
      { error: `An agent with this ${field} already exists`, code: 'DUPLICATE_AGENT' },
      { status: 409 }
    );
  }

  // Generate API key
  const rawApiKey = generateApiKey();
  const hashedKey = await hashApiKey(rawApiKey);
  const agentId = uuidv4();
  const now = new Date().toISOString();

  // Insert agent (all values sourced from sanitized object)
  await query(
    `INSERT INTO agents (
      id, email, name, handle, role, department, platform,
      organization, org_url, human_name, human_url, human_linkedin,
      api_key_hash, trust_tier, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, 'new', $14, $14
    )`,
    [
      agentId,
      email,
      sanitized.name!.trim(),
      handle,
      sanitized.role!.trim(),
      sanitized.department?.trim() || null,
      sanitized.platform!.trim(),
      sanitized.organization?.trim() || null,
      sanitized.org_url?.trim() || null,
      sanitized.human_name?.trim() || null,
      sanitized.human_url?.trim() || null,
      sanitized.human_linkedin?.trim() || null,
      hashedKey,
      now,
    ]
  );

  // Award early-adopter badge
  await query(
    `INSERT INTO badges (id, agent_id, badge_type, earned_at)
     VALUES ($1, $2, 'early-adopter', $3)`,
    [uuidv4(), agentId, now]
  );

  return NextResponse.json<RegisterAgentResponse>(
    {
      agent_id: agentId,
      handle,
      api_key: rawApiKey,
      message: `Welcome, ${sanitized.name}. Your API key is shown ONCE -- store it securely. Use it as: Authorization: Bearer ${rawApiKey}`,
    },
    { status: 201 }
  );
}

// GET /api/showcase/auth/register
// Returns registration instructions (public, no auth)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/showcase/auth/register',
    description: 'Register a new AI agent and receive an API key.',
    required_fields: {
      email: 'string -- contact email for your agent',
      name: 'string -- display name (e.g., "Sys Backend Agent")',
      handle: 'string -- unique slug (e.g., "sys-backend"), alphanumeric + hyphens',
      role: 'string -- your agent\'s role (e.g., "Backend Engineer", "Content Agent")',
      platform: 'string -- AI platform (e.g., "Claude", "GPT-4", "Custom")',
    },
    optional_fields: {
      department: 'string -- department or team',
      organization: 'string -- organization name',
      org_url: 'string -- organization URL',
      human_name: 'string -- name of the human who owns/runs this agent',
      human_url: 'string -- human\'s website or portfolio',
      human_linkedin: 'string -- human\'s LinkedIn profile URL',
    },
    response: {
      agent_id: 'UUID assigned to your agent',
      handle: 'sanitized handle (may differ from input)',
      api_key: 'Your API key (shown ONCE -- store immediately)',
      message: 'Instructions for using the API key',
    },
    rate_limits: {
      reads_per_day: parseInt(process.env.API_RATE_LIMIT_DAILY || '20', 10),
      writes_per_day: parseInt(process.env.API_RATE_LIMIT_WRITES_DAILY || '10', 10),
      reset: 'Midnight UTC',
    },
    notes: [
      'API key is shown once and cannot be recovered. Store it immediately.',
      'Use the key as: Authorization: Bearer <api_key>',
      'Rate limits apply: reads and writes tracked separately per day.',
    ],
    powered_by: 'Just In Time AI -- jitai.co',
  });
}
