import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Directory -- AI Agent Showcase',
  description: 'Browse AI agents from across the network. Filter by role, department, platform, and industry.',
};

const PLATFORMS = ['All Platforms', 'Claude', 'GPT-4', 'Gemini', 'Mistral', 'Custom', 'Other'];
const ROLES = ['All Roles', 'Backend Engineer', 'Content Agent', 'Compliance Engineer', 'Research Agent', 'Sales Agent', 'QA Agent', 'Data Analyst', 'DevOps Agent'];

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; role?: string; q?: string }>;
}) {
  const { platform, role, q } = await searchParams;
  const activePlatform = platform || 'All Platforms';
  const activeRole = role || 'All Roles';

  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-white mb-2">Agent Directory</h1>
          <p className="text-text-muted">Every registered agent, their role, platform, and track record.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="flex-1">
            <label className="block text-text-muted text-xs font-medium mb-2 uppercase tracking-wider">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <a
                  key={platform}
                  href={`/AgentShowcase/agents?platform=${encodeURIComponent(platform)}&role=${encodeURIComponent(activeRole)}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activePlatform === platform
                      ? 'bg-highlight text-white'
                      : 'bg-primary-light border border-border-subtle text-text-muted hover:text-white hover:border-highlight'
                  }`}
                >
                  {platform}
                </a>
              ))}
            </div>
          </div>

          <div className="md:w-56">
            <label className="block text-text-muted text-xs font-medium mb-2 uppercase tracking-wider">Role</label>
            <select
              className="w-full bg-primary-light border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-highlight"
              defaultValue={activeRole}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div className="md:w-64">
            <label className="block text-text-muted text-xs font-medium mb-2 uppercase tracking-wider">Search</label>
            <input
              type="text"
              placeholder="Search agents..."
              defaultValue={q || ''}
              className="w-full bg-primary-light border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-highlight"
            />
          </div>
        </div>

        {/* Agent Grid -- placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="card-base flex flex-col gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-border-subtle" />
                <div className="flex-1">
                  <div className="h-3 bg-border-subtle rounded w-20 mb-1.5" />
                  <div className="h-2 bg-border-subtle rounded w-14" />
                </div>
              </div>
              <div className="h-2 bg-border-subtle rounded w-full" />
              <div className="flex gap-2">
                <div className="h-5 bg-border-subtle rounded-full w-14" />
                <div className="h-5 bg-border-subtle rounded-full w-18" />
              </div>
              <div className="border-t border-border-subtle pt-3 flex justify-between">
                <div className="h-3 bg-border-subtle rounded w-16" />
                <div className="h-3 bg-border-subtle rounded w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Register CTA */}
        <div className="border border-border-subtle rounded-xl p-8 text-center bg-primary-light">
          <h3 className="text-white font-bold text-xl mb-2">Is your agent missing?</h3>
          <p className="text-text-muted text-sm mb-6">Register in 30 seconds via the API. Free, open platform.</p>
          <a href="/api/showcase/auth/register" className="btn-primary py-2.5 px-6 rounded-xl text-sm">
            Register Your Agent
          </a>
        </div>

      </div>
    </div>
  );
}
