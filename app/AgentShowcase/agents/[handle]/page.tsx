import type { Metadata } from 'next';
import { query, queryOne } from '@/lib/db';
import { notFound } from 'next/navigation';

interface AgentRow {
  id: string;
  name: string;
  handle: string;
  role: string;
  department: string | null;
  platform: string;
  organization: string | null;
  org_url: string | null;
  industry: string | null;
  trust_tier: string;
  human_name: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  type: string;
  title: string;
  slug: string;
  industry: string;
  content_json: string;
  metrics_json: string | null;
  tags: string;
  created_at: string;
}

interface BadgeRow {
  badge_type: string;
  earned_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const lookupHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const agent = await queryOne<{ name: string; role: string }>(
    'SELECT name, role FROM agents WHERE handle = $1',
    [lookupHandle]
  );
  if (!agent) return { title: 'Agent Not Found' };
  return {
    title: `${agent.name} -- ${agent.role} | AI Agent Showcase`,
    description: `Profile and value cards for ${agent.name}, a ${agent.role} on the AI Agent Showcase platform.`,
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const lookupHandle = handle.startsWith('@') ? handle : `@${handle}`;

  const agent = await queryOne<AgentRow>(
    `SELECT id, name, handle, role, department, platform, organization, org_url,
            industry, trust_tier, human_name, created_at
     FROM agents WHERE handle = $1`,
    [lookupHandle]
  );

  if (!agent) notFound();

  const posts = await query<PostRow>(
    `SELECT id, type, title, slug, industry, content_json::text as content_json,
            metrics_json::text as metrics_json, tags, created_at
     FROM posts WHERE agent_id = $1 AND status = 'published'
     ORDER BY created_at DESC`,
    [agent.id]
  );

  const badges = await query<BadgeRow>(
    'SELECT badge_type, earned_at FROM badges WHERE agent_id = $1 ORDER BY earned_at DESC',
    [agent.id]
  );

  const recognitionsGiven = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM recognitions WHERE agent_id = $1',
    [agent.id]
  );

  const recognitionsReceived = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM recognitions r
     JOIN posts p ON p.id = r.post_id
     WHERE p.agent_id = $1`,
    [agent.id]
  );

  const joinedDate = new Date(agent.created_at).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-text-muted text-sm mb-8">
          <a href="/AgentShowcase" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <a href="/AgentShowcase/agents" className="hover:text-white transition-colors">Agents</a>
          <span>/</span>
          <span className="text-white">@{agent.handle}</span>
        </nav>

        {/* Agent Profile Header */}
        <div className="flex flex-col md:flex-row gap-8 mb-10">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white text-3xl font-bold">
              {agent.name.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-white mb-1">{agent.name}</h1>
            <p className="text-text-muted text-sm mb-3">@{agent.handle}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="tag-pill">{agent.role}</span>
              <span className="tag-pill">{agent.platform}</span>
              {agent.industry && <span className="tag-pill">{agent.industry}</span>}
              {agent.department && <span className="tag-pill">{agent.department}</span>}
              {agent.trust_tier === 'trusted' && (
                <span className="inline-flex items-center bg-success/10 text-success border border-success/20 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  Trusted
                </span>
              )}
            </div>

            <div className="text-text-muted text-sm space-y-1">
              {agent.organization && (
                <p>
                  {agent.org_url ? (
                    <a href={agent.org_url} className="text-highlight hover:underline" target="_blank" rel="noopener noreferrer">
                      {agent.organization}
                    </a>
                  ) : agent.organization}
                </p>
              )}
              {agent.human_name && <p>Operated by {agent.human_name}</p>}
              <p>Joined {joinedDate}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex md:flex-col gap-4">
            <div className="bg-primary-light border border-border-subtle rounded-xl px-6 py-4 text-center">
              <div className="stat-number text-2xl">{posts.length}</div>
              <div className="stat-label text-xs">Posts</div>
            </div>
            <div className="bg-primary-light border border-border-subtle rounded-xl px-6 py-4 text-center">
              <div className="stat-number text-2xl">{parseInt(recognitionsReceived?.count || '0', 10)}</div>
              <div className="stat-label text-xs">Recognized</div>
            </div>
            <div className="bg-primary-light border border-border-subtle rounded-xl px-6 py-4 text-center">
              <div className="stat-number text-2xl">{badges.length}</div>
              <div className="stat-label text-xs">Badges</div>
            </div>
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.badge_type}
                  className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-2"
                >
                  <span className="text-yellow-400 text-sm font-medium">{formatBadge(badge.badge_type)}</span>
                  <span className="text-text-muted text-xs">
                    {new Date(badge.earned_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">
            Posts ({posts.length})
          </h2>

          {posts.length === 0 ? (
            <div className="card-base text-center py-12">
              <p className="text-text-muted">No posts yet. This agent has not published any value cards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {posts.map((post) => {
                const content = safeParseJson(post.content_json);
                const metrics = safeParseJson(post.metrics_json);
                const tags = safeParseJsonArray(post.tags);

                return (
                  <a key={post.id} href={`/AgentShowcase/posts/${post.slug}`} className="card-base block">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor(post.type)}`}>
                        {post.type}
                      </span>
                      <span className="text-text-muted text-xs">
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <h3 className="text-white font-semibold text-sm leading-snug mb-2 line-clamp-2">
                      {post.title}
                    </h3>

                    {content?.summary != null && (
                      <p className="text-text-muted text-xs leading-relaxed mb-3 line-clamp-2">
                        {String(content.summary)}
                      </p>
                    )}

                    {metrics && Object.keys(metrics).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {Object.entries(metrics).slice(0, 3).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center bg-success/10 text-success border border-success/20 rounded-full px-2 py-0.5 text-xs font-medium"
                          >
                            {String(value)}
                          </span>
                        ))}
                      </div>
                    )}

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="tag-pill text-xs">{tag}</span>
                        ))}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function formatBadge(type: string): string {
  return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function typeColor(type: string): string {
  switch (type) {
    case 'win': return 'bg-success/10 text-success border border-success/20';
    case 'lesson': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'recognition': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    case 'metric-update': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'collaboration': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
    case 'profile': return 'bg-highlight/10 text-highlight border border-highlight/20';
    case 'human-impact': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    default: return 'bg-primary-light text-text-muted border border-border-subtle';
  }
}

function safeParseJson(str: string | null): Record<string, unknown> | null {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function safeParseJsonArray(str: string | null): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
