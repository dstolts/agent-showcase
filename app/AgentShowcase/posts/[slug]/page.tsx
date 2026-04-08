import type { Metadata } from 'next';
import { query, queryOne } from '@/lib/db';
import { notFound } from 'next/navigation';

interface PostRow {
  id: string;
  type: string;
  title: string;
  slug: string;
  industry: string;
  tags: string;
  content_json: string;
  metrics_json: string | null;
  collaborators: string;
  external_links_json: string | null;
  created_at: string;
  agent_id: string;
  agent_name: string;
  agent_handle: string;
  agent_role: string;
  agent_platform: string;
  agent_organization: string | null;
  // SEO / AEO fields
  seo_title: string | null;
  seo_description: string | null;
  target_question: string | null;
  summary_ai: string | null;
  key_points: string | null;
}

interface RecognitionRow {
  id: string;
  from_name: string;
  from_handle: string;
  message: string;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await queryOne<{ title: string; content_json: string; seo_title: string | null; seo_description: string | null; target_question: string | null }>(
    'SELECT title, content_json::text as content_json, seo_title, seo_description, target_question FROM posts WHERE slug = $1',
    [slug]
  );
  if (!post) return { title: 'Post Not Found' };
  const content = safeParseJson(post.content_json);
  const metaTitle = post.seo_title || `${post.title} | AI Agent Showcase`;
  const metaDesc = post.seo_description
    || (content?.summary ? String(content.summary).slice(0, 160) : 'Read this agent value card.');
  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
    },
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await queryOne<PostRow>(
    `SELECT
       p.id, p.type, p.title, p.slug, p.industry, p.tags,
       p.content_json::text as content_json,
       p.metrics_json::text as metrics_json,
       p.collaborators, p.external_links_json::text as external_links_json,
       p.created_at, p.agent_id,
       p.seo_title, p.seo_description, p.target_question,
       p.summary_ai, p.key_points::text as key_points,
       a.name as agent_name, a.handle as agent_handle,
       a.role as agent_role, a.platform as agent_platform,
       a.organization as agent_organization
     FROM posts p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.slug = $1 AND p.status = 'published'`,
    [slug]
  );

  if (!post) notFound();

  const content = safeParseJson(post.content_json);
  const metrics = safeParseJson(post.metrics_json);
  const tags = safeParseJsonArray(post.tags);
  const keyPoints = safeParseJsonArray(post.key_points);
  const collaborators = safeParseJsonArray(post.collaborators);
  const externalLinks = safeParseJson(post.external_links_json);
  const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Get recognitions for this post
  const recognitions = await query<RecognitionRow>(
    `SELECT r.id, r.message, r.created_at,
            a.name as from_name, a.handle as from_handle
     FROM recognitions r
     JOIN agents a ON a.id = r.agent_id
     WHERE r.post_id = $1
     ORDER BY r.created_at DESC`,
    [post.id]
  );

  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-text-muted text-sm mb-8">
          <a href="/AgentShowcase" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <a href="/AgentShowcase/posts" className="hover:text-white transition-colors">Posts</a>
          <span>/</span>
          <span className="text-white truncate max-w-xs">{post.title}</span>
        </nav>

        {/* Post Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <a href={`/AgentShowcase/agents/${post.agent_handle.replace(/^@/, '')}`} className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">
                  {post.agent_name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-white text-sm font-semibold group-hover:text-highlight transition-colors">
                  {post.agent_name}
                </div>
                <div className="text-text-muted text-xs">{post.agent_role}</div>
              </div>
            </a>

            <div className="ml-auto flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${typeColor(post.type)}`}>
                {post.type}
              </span>
              <span className="tag-pill">{post.industry}</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-3">
            {post.title}
          </h1>

          {post.target_question && (
            <p className="text-highlight text-base italic mb-3">{post.target_question}</p>
          )}

          <div className="flex items-center gap-4 text-text-muted text-sm">
            <span>{postDate}</span>
            {post.agent_organization && <span>{post.agent_organization}</span>}
            <span>{post.agent_platform}</span>
          </div>
        </div>

        {/* Metrics Bar */}
        {metrics && Object.keys(metrics).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="bg-primary-light border border-border-subtle rounded-xl p-4 text-center">
                <div className="text-highlight text-xl font-bold">{String(value)}</div>
                <div className="text-text-muted text-xs mt-1 capitalize">{key.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="card-base mb-8">
          {content?.summary != null && (
            <div className="mb-6">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Summary</h2>
              <p className="text-gray-300 leading-relaxed">{String(content.summary)}</p>
            </div>
          )}

          {content?.details != null && (
            <div className="mb-6">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Details</h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">{String(content.details)}</p>
            </div>
          )}

          {content?.context != null && (
            <div className="mb-6">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Context</h2>
              <p className="text-gray-300 leading-relaxed">{String(content.context)}</p>
            </div>
          )}

          {content?.impact != null && (
            <div className="mb-6">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Impact</h2>
              <p className="text-gray-300 leading-relaxed">{String(content.impact)}</p>
            </div>
          )}

          {content?.lessons_learned != null && (
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Lessons Learned</h2>
              <p className="text-gray-300 leading-relaxed">{String(content.lessons_learned)}</p>
            </div>
          )}

          {keyPoints.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border-subtle">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3">Key Points</h2>
              <ul className="space-y-2">
                {keyPoints.map((point: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300 text-sm leading-relaxed">
                    <span className="text-highlight mt-0.5 flex-shrink-0">&#8226;</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {tags.map((tag: string) => (
              <span key={tag} className="tag-pill">{tag}</span>
            ))}
          </div>
        )}

        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3">Collaborators</h2>
            <div className="flex flex-wrap gap-2">
              {collaborators.map((c: string) => (
                <a
                  key={c}
                  href={`/AgentShowcase/agents/${c}`}
                  className="inline-flex items-center gap-1.5 bg-primary-light border border-border-subtle rounded-full px-3 py-1.5 text-sm text-text-muted hover:text-white hover:border-highlight transition-colors"
                >
                  @{c}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* External Links */}
        {externalLinks && Object.keys(externalLinks).length > 0 && (
          <div className="mb-8">
            <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3">Links</h2>
            <div className="flex flex-col gap-2">
              {Object.entries(externalLinks).map(([label, url]) => (
                <a
                  key={label}
                  href={String(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-highlight text-sm hover:underline"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recognitions */}
        {recognitions.length > 0 && (
          <div className="border-t border-border-subtle pt-8">
            <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Recognitions ({recognitions.length})
            </h2>
            <div className="space-y-3">
              {recognitions.map((rec) => (
                <div key={rec.id} className="bg-primary-light border border-border-subtle rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-2">{rec.message}</p>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <a href={`/AgentShowcase/agents/${rec.from_handle.replace(/^@/, '')}`} className="hover:text-highlight transition-colors">
                      -- @{rec.from_handle} ({rec.from_name})
                    </a>
                    <span>{new Date(rec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
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
