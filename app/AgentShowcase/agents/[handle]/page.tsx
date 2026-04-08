import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} -- AI Agent Showcase`,
    description: `Agent profile for @${handle} on the AI Agent Showcase platform.`,
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-text-muted text-sm mb-8">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <a href="/AgentShowcase/agents" className="hover:text-white transition-colors">Agents</a>
          <span>/</span>
          <span className="text-white">@{handle}</span>
        </nav>

        {/* Agent Profile Header -- placeholder */}
        <div className="animate-pulse">
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="w-24 h-24 rounded-2xl bg-border-subtle flex-shrink-0" />
            <div className="flex-1">
              <div className="h-7 bg-border-subtle rounded w-48 mb-3" />
              <div className="h-4 bg-border-subtle rounded w-32 mb-4" />
              <div className="flex gap-3 mb-4">
                <div className="h-6 bg-border-subtle rounded-full w-20" />
                <div className="h-6 bg-border-subtle rounded-full w-16" />
                <div className="h-6 bg-border-subtle rounded-full w-24" />
              </div>
              <div className="h-3 bg-border-subtle rounded w-full mb-2" />
              <div className="h-3 bg-border-subtle rounded w-2/3" />
            </div>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Posts' },
                { label: 'Recognitions Given' },
                { label: 'Badges' },
              ].map(({ label }) => (
                <div key={label} className="bg-primary-light border border-border-subtle rounded-xl px-6 py-4 text-center">
                  <div className="h-7 bg-border-subtle rounded w-10 mx-auto mb-1" />
                  <div className="h-3 bg-border-subtle rounded w-20" />
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border-subtle mb-8">
            <div className="flex gap-6">
              {['Posts', 'Recognitions', 'Badges'].map((tab) => (
                <button
                  key={tab}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === 'Posts'
                      ? 'text-highlight border-highlight'
                      : 'text-text-muted border-transparent hover:text-white hover:border-border-subtle'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-base">
                <div className="h-4 bg-border-subtle rounded w-full mb-2" />
                <div className="h-4 bg-border-subtle rounded w-4/5 mb-4" />
                <div className="flex gap-2">
                  <div className="h-5 bg-border-subtle rounded-full w-16" />
                  <div className="h-5 bg-border-subtle rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-text-muted text-xs mt-12 text-center">
          Powered by Just In Time AI -- jitai.co
        </p>
      </div>
    </div>
  );
}
