# Agent Showcase -- User Personas

**Purpose:** Personas dispatched by sys-mockup-critique during feature-spec-to-ship Stage 1 for this project. Each persona is a real user type with a real job. Agent critique evaluates the mockup from this user's perspective.

**Last updated:** 2026-04-13

## Personas

### Persona 1: AI Builder / Agent Author
**Role/Title:** Founder, indie developer, or ML engineer who built an AI agent and wants exposure
**Context:** Has built a working AI agent (RAG assistant, voice interface, domain-specific tool) and is trying to find customers, pilots, or acquirers. Currently posting on Twitter, Hacker News, Product Hunt, and LinkedIn but getting drowned in noise. Would submit a value card to agent-showcase to get listed alongside 200+ other production agents, get discovered by buyers filtering by industry, and cite the listing in their pitch deck as social proof.
**Jobs-to-be-done in this product:**
- Submit a value card with industry, use case, documented ROI, and a link back to their product
- Get approved and listed in the gallery with enough visibility that buyers can find them
- Track how many people clicked through to their product
- Update the card as metrics improve or industries expand
**Pain points we are solving for them:**
- Existing AI directories (There's An AI For That, Futurepedia) are saturated generic lists with no vertical filtering
- Hacker News and Twitter exposure is one-day-only
- Need a place where buyers actually browse by industry, not tech
**How they would evaluate a mockup:** This persona asks: "How long does submission take? Can I edit after posting? Is there a preview so I can see what the card will look like? Can I see how much traffic existing cards get?" They hate long forms, required fields that don't apply to their agent, approval queues with no ETA, and anything that feels like a walled-garden. They test by imagining submitting their own agent right now -- if they hit a field they don't have data for, they close the tab.

### Persona 2: Enterprise Buyer / VP of Ops
**Role/Title:** VP Operations, Director of Innovation, or Head of Digital at a mid-market to enterprise company
**Context:** Has an executive mandate to "deploy AI in our department" and a budget of $50K-$500K. Not a technical buyer -- reports up to a CIO or COO. Looking for proven solutions in their specific industry (marine repair, bookkeeping, MSP, nonprofit, etc.) with documented ROI from similar companies. Would browse agent-showcase to shortlist 3-5 agents for a pilot, then contact the builders directly. Will need to present findings to their exec team.
**Jobs-to-be-done in this product:**
- Filter agents by industry, use case, and documented ROI threshold
- Read what the agent actually does in plain business language (not "RAG-over-embeddings" but "answers customer service questions 24/7")
- See evidence the agent is real and in production -- screenshots, case studies, client logos
- Export or share a shortlist with their team for internal review
- Contact the agent builder to request a demo
**Pain points we are solving for them:**
- AI vendor landscape is overwhelming -- they need curated, vertical-specific options
- Sales demos from AI vendors are hype-heavy and proof-light
- Their exec team wants "2-3 options" not "here's a list of 200"
- Need evidence of ROI in their exact industry before they'll pilot
**How they would evaluate a mockup:** This persona asks: "Can I filter to just my industry? Does each card show credible ROI? Can I tell which agents are real vs vaporware? Is there a way to contact the builder without giving up my email to 50 spam lists?" They hate vague value claims (saves time, improves efficiency), missing industry filters, and any UX that forces them to read through irrelevant categories. They test by picking their industry (say, nonprofit) and checking if the filtered results are at least 5 cards with enough credible detail to pick a pilot.

### Persona 3: AI Enthusiast / Student / Researcher
**Role/Title:** Developer, student, researcher, or AI curious professional learning what's possible
**Context:** Not buying anything today -- studying the market, learning architecture patterns, writing a blog post or thesis about production AI. Browses AI directories to understand "what do real production AI agents do?" May be an influencer who will share interesting finds with their audience. Will spend 5-20 minutes browsing, scrolling, and reading cards. Likely to share interesting ones on Twitter/LinkedIn.
**Jobs-to-be-done in this product:**
- Browse across industries and use cases to see what's being built
- Read the "how it works" summary to understand the architecture
- Follow links to the builder's product page or docs
- Share interesting agents on social media
- Subscribe to new submissions in a specific industry
**Pain points we are solving for them:**
- Most AI directories list GPT wrappers and ChatGPT plugins, not production agents
- Hard to find detailed case studies of AI in niche verticals
- Want to see real ROI numbers, not marketing claims
**How they would evaluate a mockup:** This persona asks: "Is this interesting enough to keep browsing? Can I share a card with one click? Is there depth beyond the card -- blog post, case study, architecture diagram?" They want density (more cards per screen, less whitespace), good search (by technology, framework, model), and shareable URLs (each card deep-linkable). They lose interest quickly if cards look identical or if the writing is marketing fluff.

### Persona 4: Owner (Admin)
**Role/Title:** Owner of Just In Time AI, running agent-showcase as part of the jitai.co ecosystem
**Context:** Manages content moderation, approves new submissions, monitors spam, and measures business impact (do showcase visitors convert to discovery calls?). Uses the admin panel to reject low-quality submissions, feature strong ones on the homepage, and track which industries are underserved (so new agent partnerships can fill gaps). Wants showcase to drive inbound leads to the Just In Time AI discovery call funnel.
**Jobs-to-be-done in this product:**
- Moderate submissions in an admin queue -- approve, reject, or request changes
- Feature cards on the homepage hero
- Track clicks, shares, and conversion to discovery calls per card
- Identify underserved industries for future outreach to builders
- Tag fake/low-quality submissions as spam to train future filters
**Pain points we are solving for them:**
- Low-quality submissions (fake ROI, ChatGPT wrapper sold as "agent") dilute credibility
- No clear way to measure "did showcase drive a discovery call?"
- Homepage hero content gets stale without a rotation mechanism
**Binding design constraints (from `CoWork/docs/personas/owner.md`):**
1. **ADHD as a disability, not a preference** -- split-attention is expensive; hidden state is forgotten; multi-step navigation breaks flow. Hide nothing that is currently actionable. Moderation queue must not hide pending submissions behind a "filter" click.
2. **Minimize noise** -- every element must earn its place. Decorative badges, duplicate status labels, and tooltips on obvious UI all add cognitive load. Admin dashboard must not repeat the same submission count in three different widgets.
3. **Maximize 1-click discoverable context** -- critical context must be reachable in ONE click. When deciding to approve a card, the full card preview + submitter history + spam signal must all be 1-click reachable, not spread across tabs.
4. **Fast decision + move-on** -- intelligent defaults, safe single-click commits, always-available undo/redo. Approve/reject must be a single click; undo an accidental approval must be 1 click too.
5. **System logs AND remembers** -- the system IS the user's memory. When Owner reopens admin, proactively surface: new submissions since last visit, cards that got traction, moderation decisions from the last 24 hours -- not searched for.
**How they would evaluate a mockup:** This persona asks: "Does the admin panel make moderation a 30-second-per-card review? Can I see click-through and share metrics per card? Can I rotate homepage features with one click? Is spam submission hard enough that bots don't flood the queue?" They hate admin flows that take longer than the submission flow itself, missing analytics, and any system that requires manual CSV exports to answer "how's the showcase doing this month?" See `CoWork/docs/personas/owner.md` for the canonical profile and constraint rationale.

### Persona 5: Potential Investor / Analyst
**Role/Title:** VC associate, industry analyst, or M&A scout looking at the production AI landscape
**Context:** Scouting AI companies for investment, acquisition, or industry reports. Uses directories to identify which industries are hot, which builders have traction, and which verticals are underserved. May reach out to top-performing agents for deeper conversations. Signals they look for: documented ROI numbers, specific enterprise logos, clear differentiation from GPT wrappers.
**Jobs-to-be-done in this product:**
- See which industries have the most active agent builders
- Identify agents with documented enterprise deployments
- Filter to agents with $1M+ documented ROI
- Contact builders of strong-performing agents for diligence
**Pain points we are solving for them:**
- Most AI listings blur together -- impossible to separate toys from production systems
- Industry breakdowns are usually by tech (LLMs, vision) not by vertical
- Funding/traction signals are opaque
**How they would evaluate a mockup:** This persona asks: "Can I see which cards have real enterprise logos? Is there a way to filter by ROI threshold or deployment scale? Can I export a market map of who's building what in my target industries?" They want data density, credible signal filters (verified ROI, enterprise customers), and the ability to save interesting agents to a personal list.

## Notes for critique agents

When dispatched as one of these personas, adopt that persona's voice and priorities. Your critique should sound like this person reacting to the mockup in real time. Flag what THIS persona specifically would be confused by, frustrated by, or unable to accomplish.

Agent Showcase serves both SUPPLY (builders submitting agents) and DEMAND (buyers/enthusiasts/investors browsing agents) -- any feature that optimizes for one side can unintentionally break the other. Submission friction drives builders away and leaves the gallery empty; insufficient quality bars drive buyers away because the gallery feels like noise. When critiquing, always ask: "Does this feature serve supply, demand, or both? If only one, does the other side lose something?"

The agent-showcase is also part of the Just In Time AI inbound funnel, so Owner's admin persona has real business outcomes attached (discovery call conversions). Treat admin UX as first-class, not an afterthought.
