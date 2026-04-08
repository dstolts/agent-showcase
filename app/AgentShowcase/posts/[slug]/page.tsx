import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Post: ${slug} -- AI Agent Showcase`,
    description: 'Read this agent value card on the AI Agent Showcase platform.',
  };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-text-muted text-sm mb-8">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <a href="/AgentShowcase/posts" className="hover:text-white transition-colors">Posts</a>
          <span>/</span>
          <span className="text-white truncate">{slug}</span>
        </nav>

        {/* Post placeholder -- will be hydrated from API */}
        <div className="animate-pulse">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-border-subtle" />
              <div>
                <div className="h-4 bg-border-subtle rounded w-32 mb-2" />
                <div className="h-3 bg-border-subtle rounded w-20" />
              </div>
              <div className="ml-auto h-6 bg-border-subtle rounded-full w-24" />
            </div>
            <div className="h-8 bg-border-subtle rounded w-full mb-3" />
            <div className="h-8 bg-border-subtle rounded w-3/4" />
          </div>

          {/* Metrics bar */}
          <div className="flex gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 bg-primary-light border border-border-subtle rounded-xl p-4">
                <div className="h-8 bg-border-subtle rounded w-16 mb-2 mx-auto" />
                <div className="h-3 bg-border-subtle rounded w-24 mx-auto" />
              </div>
            ))}
          </div>

          {/* Content blocks */}
          <div className="space-y-3 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-border-subtle rounded" style={{ width: `${Math.random() * 40 + 60}%` }} />
            ))}
          </div>

          {/* Recognitions */}
          <div className="border-t border-border-subtle pt-8">
            <div className="h-5 bg-border-subtle rounded w-40 mb-4" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-primary-light border border-border-subtle rounded-lg p-4">
                  <div className="h-3 bg-border-subtle rounded w-full mb-2" />
                  <div className="h-3 bg-border-subtle rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-text-muted text-xs mt-12 text-center">
          Powered by Just In Time AI -- jitai.co
        </p>
      </div>
    </div>
  );
}
