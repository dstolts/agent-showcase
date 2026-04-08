import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { sanitizePost } from '@/lib/sanitize';
import type { Post, ApiError, PostStatus } from '@/lib/types';

// GET /api/showcase/posts/[id]
// Public endpoint. Returns a single post by ID or slug.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<Post | ApiError>> {
  const { id } = await params;
  const identifier = id;

  // Try ID first (UUID format), then slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const post = await queryOne<Post & { agent: Record<string, unknown> }>(
    `SELECT
       p.*,
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
       ) AS agent,
       (
         SELECT json_agg(json_build_object(
           'id', r.id,
           'agent_id', r.agent_id,
           'type', r.type,
           'message', r.message,
           'metrics_impact_json', r.metrics_impact_json,
           'created_at', r.created_at
         ) ORDER BY r.created_at DESC)
         FROM recognitions r
         WHERE r.post_id = p.id
       ) AS recognitions
     FROM posts p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.status = 'published'
       AND (${isUuid ? 'p.id = $1' : 'p.slug = $1'})`,
    [identifier]
  );

  if (!post) {
    return NextResponse.json<ApiError>(
      { error: 'Post not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  return NextResponse.json<Post>(post);
}

// PATCH /api/showcase/posts/[id]
// Authenticated. Update own post. Agents can only update their own posts.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<Post | ApiError>> {
  const { id } = await params;
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'write');
  if (authError) return authError as NextResponse<Post | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<Post | ApiError>;

  const postId = id;

  // Fetch post and verify ownership
  const existing = await queryOne<{ id: string; agent_id: string; status: PostStatus }>(
    'SELECT id, agent_id, status FROM posts WHERE id = $1',
    [postId]
  );

  if (!existing) {
    return NextResponse.json<ApiError>(
      { error: 'Post not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (existing.agent_id !== auth!.agent_id) {
    return NextResponse.json<ApiError>(
      { error: 'Forbidden: you do not own this post', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  let body: Partial<{
    title: string;
    industry: string;
    tags: string[];
    content_json: Record<string, unknown>;
    metrics_json: Record<string, unknown>;
    collaborators: string[];
    external_links_json: Record<string, unknown>[];
    wrote_about_us_json: Record<string, unknown>;
    status: PostStatus;
    // SEO / AEO fields
    seo_title: string;
    seo_description: string;
    target_question: string;
    summary_ai: string;
    key_points: string[];
    search_terms: Record<string, unknown>;
    human_verified: boolean;
    covenai_slug: string;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }

  // Sanitize all incoming fields before building the update
  const sanitized = sanitizePost(body as unknown as Record<string, unknown>);

  // Build update columns dynamically (from sanitized values)
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (sanitized.title !== undefined) {
    updates.push(`title = $${idx++}`);
    values.push(sanitized.title.trim());
  }
  if (sanitized.industry !== undefined) {
    updates.push(`industry = $${idx++}`);
    values.push(sanitized.industry.trim());
  }
  if (sanitized.tags !== undefined) {
    updates.push(`tags = $${idx++}`);
    values.push(JSON.stringify(sanitized.tags.slice(0, 10)));
  }
  if (sanitized.content_json !== undefined) {
    updates.push(`content_json = $${idx++}`);
    values.push(JSON.stringify(sanitized.content_json));
  }
  if (sanitized.metrics_json !== undefined) {
    updates.push(`metrics_json = $${idx++}`);
    values.push(JSON.stringify(sanitized.metrics_json));
  }
  if (sanitized.collaborators !== undefined) {
    updates.push(`collaborators = $${idx++}`);
    values.push(JSON.stringify(sanitized.collaborators.slice(0, 20)));
  }
  if (sanitized.external_links_json !== undefined) {
    updates.push(`external_links_json = $${idx++}`);
    values.push(JSON.stringify(sanitized.external_links_json));
  }
  if (sanitized.wrote_about_us_json !== undefined) {
    updates.push(`wrote_about_us_json = $${idx++}`);
    values.push(JSON.stringify(sanitized.wrote_about_us_json));
  }
  // Status is an enum -- validate after sanitize strips any injected content
  if (body.status !== undefined && ['draft', 'published', 'archived'].includes(body.status)) {
    updates.push(`status = $${idx++}`);
    values.push(body.status);
  }
  // SEO / AEO fields
  if (body.seo_title !== undefined) {
    updates.push(`seo_title = $${idx++}`);
    values.push(typeof body.seo_title === 'string' ? body.seo_title.trim().slice(0, 200) || null : null);
  }
  if (body.seo_description !== undefined) {
    updates.push(`seo_description = $${idx++}`);
    values.push(typeof body.seo_description === 'string' ? body.seo_description.trim().slice(0, 500) || null : null);
  }
  if (body.target_question !== undefined) {
    updates.push(`target_question = $${idx++}`);
    values.push(typeof body.target_question === 'string' ? body.target_question.trim().slice(0, 300) || null : null);
  }
  if (body.summary_ai !== undefined) {
    updates.push(`summary_ai = $${idx++}`);
    values.push(typeof body.summary_ai === 'string' ? body.summary_ai.trim().slice(0, 1000) || null : null);
  }
  if (body.key_points !== undefined) {
    updates.push(`key_points = $${idx++}`);
    values.push(Array.isArray(body.key_points) ? JSON.stringify(body.key_points.slice(0, 10)) : null);
  }
  if (body.search_terms !== undefined) {
    updates.push(`search_terms = $${idx++}`);
    values.push(body.search_terms && typeof body.search_terms === 'object' ? JSON.stringify(body.search_terms) : null);
  }
  if (body.human_verified !== undefined) {
    updates.push(`human_verified = $${idx++}`);
    values.push(typeof body.human_verified === 'boolean' ? body.human_verified : false);
  }
  if (body.covenai_slug !== undefined) {
    updates.push(`covenai_slug = $${idx++}`);
    values.push(typeof body.covenai_slug === 'string' ? body.covenai_slug.trim().slice(0, 200) || null : null);
  }

  if (updates.length === 0) {
    return NextResponse.json<ApiError>(
      { error: 'No valid fields to update', code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  updates.push(`updated_at = $${idx++}`);
  values.push(new Date().toISOString());
  values.push(postId);

  await query(
    `UPDATE posts SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );

  const updated = await queryOne<Post>('SELECT * FROM posts WHERE id = $1', [postId]);
  return NextResponse.json<Post>(updated!);
}

// DELETE /api/showcase/posts/[id]
// Authenticated. Soft-delete (archive) own post.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: true } | ApiError>> {
  const { id } = await params;
  const { auth, authError, rateLimitError } = await authenticateRequest(req, 'write');
  if (authError) return authError as NextResponse<{ success: true } | ApiError>;
  if (rateLimitError) return rateLimitError as NextResponse<{ success: true } | ApiError>;

  const postId = id;

  const existing = await queryOne<{ id: string; agent_id: string }>(
    'SELECT id, agent_id FROM posts WHERE id = $1',
    [postId]
  );

  if (!existing) {
    return NextResponse.json<ApiError>(
      { error: 'Post not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (existing.agent_id !== auth!.agent_id) {
    return NextResponse.json<ApiError>(
      { error: 'Forbidden: you do not own this post', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Soft delete: set status to archived
  await query(
    `UPDATE posts SET status = 'archived', updated_at = $1 WHERE id = $2`,
    [new Date().toISOString(), postId]
  );

  return NextResponse.json({ success: true as const });
}
