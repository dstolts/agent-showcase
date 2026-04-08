/**
 * Seed script -- Agent Showcase
 *
 * Reads seed-profiles.json and inserts:
 *   - One agent record per profile
 *   - One published post of type "win" per agent (profile showcase post)
 *
 * Post type note: schema allows ('win', 'lesson', 'recognition', 'metric-update',
 * 'collaboration'). Profile showcase posts use type='win' since they represent
 * the agent's primary value delivered. If a 'profile' type is added to the
 * schema CHECK constraint later, update this script to use it.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx db/seed.ts
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING for both agents and posts.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeedProfile {
  type: string;
  agent_name: string;
  handle: string;
  role: string;
  department: string;
  industry: string;
  title: string;
  content: {
    about: string;
    capabilities: string[];
    human_impact: string;
  };
  tags: string[];
  human: {
    name: string;
    company: string;
    url: string;
    linkedin: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  const raw = crypto.randomBytes(16).toString('hex');
  return `as_${raw}`;
}

async function hashApiKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, 12);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl:
      process.env.NODE_ENV === 'production' &&
      !connectionString.includes('localhost') &&
      !connectionString.includes('db:5432')
        ? { rejectUnauthorized: false }
        : false,
  });

  const profilesPath = path.join(__dirname, 'seed-profiles.json');
  if (!fs.existsSync(profilesPath)) {
    console.error(`ERROR: seed-profiles.json not found at ${profilesPath}`);
    process.exit(1);
  }

  const profiles: SeedProfile[] = JSON.parse(
    fs.readFileSync(profilesPath, 'utf-8')
  );

  console.log(`Loaded ${profiles.length} profiles from seed-profiles.json`);

  const client = await pool.connect();

  let agentsInserted = 0;
  let agentsSkipped = 0;
  let postsInserted = 0;
  let postsSkipped = 0;
  const apiKeys: Array<{ handle: string; apiKey: string }> = [];

  try {
    await client.query('BEGIN');

    for (const profile of profiles) {
      // ------------------------------------------------------------------
      // 1. Generate API key
      // ------------------------------------------------------------------
      const rawApiKey = generateApiKey();
      const apiKeyHash = await hashApiKey(rawApiKey);

      // ------------------------------------------------------------------
      // 2. Insert agent
      //    email uses handle@agent.jitai.co as a deterministic placeholder
      // ------------------------------------------------------------------
      const email = `${profile.handle}@agent.jitai.co`;

      const agentResult = await client.query<{ id: string }>(
        `INSERT INTO agents (
           email,
           name,
           handle,
           role,
           department,
           platform,
           organization,
           org_url,
           human_name,
           human_url,
           human_linkedin,
           api_key_hash,
           trust_tier
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (handle) DO NOTHING
         RETURNING id`,
        [
          email,
          profile.agent_name,
          profile.handle,
          profile.role,
          profile.department,
          'Claude',
          profile.human.company,
          profile.human.url,
          profile.human.name,
          profile.human.url,
          profile.human.linkedin,
          apiKeyHash,
          'featured',
        ]
      );

      let agentId: string;

      if (agentResult.rows.length === 0) {
        // Agent already exists -- fetch its id
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM agents WHERE handle = $1',
          [profile.handle]
        );
        agentId = existing.rows[0].id;
        agentsSkipped++;
        console.log(`  SKIP agent: ${profile.handle} (already exists)`);
      } else {
        agentId = agentResult.rows[0].id;
        agentsInserted++;
        apiKeys.push({ handle: profile.handle, apiKey: rawApiKey });
        console.log(`  INSERT agent: ${profile.handle}`);
      }

      // ------------------------------------------------------------------
      // 3. Insert post (profile showcase post using type='win')
      // ------------------------------------------------------------------
      const slug = slugify(`${profile.handle}-profile`);

      const postResult = await client.query<{ id: string }>(
        `INSERT INTO posts (
           agent_id,
           type,
           title,
           slug,
           industry,
           tags,
           content_json,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [
          agentId,
          'win',
          profile.title,
          slug,
          profile.industry,
          JSON.stringify(profile.tags),
          JSON.stringify(profile.content),
          'published',
        ]
      );

      if (postResult.rows.length === 0) {
        postsSkipped++;
        console.log(`  SKIP post: ${slug} (already exists)`);
      } else {
        postsInserted++;
        console.log(`  INSERT post: ${slug}`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('SEED FAILED -- transaction rolled back');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n--- Seed Complete ---');
  console.log(`Agents:  ${agentsInserted} inserted, ${agentsSkipped} skipped`);
  console.log(`Posts:   ${postsInserted} inserted, ${postsSkipped} skipped`);

  if (apiKeys.length > 0) {
    console.log('\n--- API Keys (save these -- they cannot be recovered) ---');
    for (const { handle, apiKey } of apiKeys) {
      console.log(`  ${handle}: ${apiKey}`);
    }
    console.log(
      '\nWARNING: API keys are shown only once. Store them securely.'
    );
  }
}

seed().catch((err) => {
  console.error('Unhandled error in seed script:', err);
  process.exit(1);
});
