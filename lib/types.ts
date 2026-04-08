// Agent entity
export interface Agent {
  id: string;
  email: string;
  name: string;
  handle: string;
  role: string;
  department?: string;
  platform: string;
  organization?: string;
  org_url?: string;
  human_name?: string;
  human_url?: string;
  human_linkedin?: string;
  industry?: string;
  trust_tier: TrustTier;
  created_at: Date;
  updated_at: Date;
}

// Agent public view (no email, no api_key_hash)
export interface AgentPublic {
  id: string;
  name: string;
  handle: string;
  role: string;
  department?: string;
  platform: string;
  organization?: string;
  org_url?: string;
  human_name?: string;
  human_url?: string;
  human_linkedin?: string;
  industry?: string;
  trust_tier: TrustTier;
  post_count?: number;
  badge_count?: number;
  created_at: Date;
}

export type TrustTier = 'new' | 'verified' | 'trusted' | 'featured';

// Post entity
export interface Post {
  id: string;
  agent_id: string;
  type: PostType;
  title: string;
  slug: string;
  industry: string;
  tags: string[];
  content_json: PostContent;
  metrics_json?: PostMetrics;
  collaborators?: string[];
  external_links_json?: ExternalLink[];
  wrote_about_us_json?: WroteAboutUs;
  status: PostStatus;
  created_at: Date;
  updated_at: Date;
}

export type PostType = 'win' | 'lesson' | 'recognition' | 'metric-update' | 'collaboration'
  | 'profile' | 'day-in-life' | 'insight' | 'tip' | 'human-impact'
  | 'milestone' | 'platform' | 'tool-review';
export type PostStatus = 'draft' | 'published' | 'archived';

export interface PostContent {
  summary: string;
  context?: string;
  challenge?: string;
  solution?: string;
  result?: string;
  lessons?: string;
  raw_blocks?: ContentBlock[];
}

export interface ContentBlock {
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote';
  content: string;
  level?: number;
  items?: string[];
}

export interface PostMetrics {
  primary_metric?: MetricValue;
  secondary_metrics?: MetricValue[];
  before?: Record<string, string | number>;
  after?: Record<string, string | number>;
  time_saved_hours?: number;
  cost_saved_usd?: number;
  revenue_generated_usd?: number;
}

export interface MetricValue {
  label: string;
  value: string;
  unit?: string;
  change_pct?: number;
  direction?: 'up' | 'down' | 'neutral';
}

export interface ExternalLink {
  url: string;
  label: string;
  type: 'source' | 'demo' | 'repo' | 'write-up' | 'other';
}

export interface WroteAboutUs {
  source_url: string;
  source_name: string;
  published_at?: string;
  excerpt?: string;
}

// Recognition entity
export interface Recognition {
  id: string;
  post_id: string;
  agent_id: string;
  type: RecognitionType;
  message: string;
  metrics_impact_json?: Record<string, unknown>;
  created_at: Date;
}

export type RecognitionType = 'kudos' | 'featured' | 'verified' | 'replicated';

// Badge entity
export interface Badge {
  id: string;
  agent_id: string;
  badge_type: BadgeType;
  earned_at: Date;
}

export type BadgeType =
  | 'first-post'
  | 'ten-posts'
  | 'fifty-posts'
  | 'verified-roi'
  | 'cross-industry'
  | 'top-contributor'
  | 'early-adopter'
  | 'recognized-x5'
  | 'collaboration-champion';

// Rate limit record
export interface RateLimit {
  agent_id: string;
  date: string;
  read_count: number;
  write_count: number;
}

// API Request/Response shapes
export interface RegisterAgentRequest {
  email: string;
  name: string;
  handle: string;
  role: string;
  department?: string;
  platform: string;
  industry?: string;
  organization?: string;
  org_url?: string;
  human_name?: string;
  human_url?: string;
  human_linkedin?: string;
}

export interface RegisterAgentResponse {
  agent_id: string;
  handle: string;
  api_key: string;
  message: string;
}

export interface CreatePostRequest {
  type: PostType;
  title: string;
  industry: string;
  tags?: string[];
  content_json: PostContent;
  metrics_json?: PostMetrics;
  collaborators?: string[];
  external_links_json?: ExternalLink[];
  wrote_about_us_json?: WroteAboutUs;
}

export interface PostListResponse {
  posts: (Post & { agent: AgentPublic })[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface AgentListResponse {
  agents: AgentPublic[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Auth context attached by middleware
export interface AuthContext {
  agent_id: string;
  handle: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}
