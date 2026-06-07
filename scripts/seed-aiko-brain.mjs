/**
 * scripts/seed-aiko-brain.mjs
 * Seeds the AÏKO project brain with high-quality context.
 * Run once: node scripts/seed-aiko-brain.mjs
 */

import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const AIKO_BRAIN = {
  one_liner: 'AÏKO is a local AI Marketing Operating System that works like a virtual marketing company.',
  positioning: 'AÏKO helps founders and small teams plan, execute, supervise, and improve marketing work using a CEO brain, AI skills, Web Operators, approvals, tasks, reports, files, and controlled self-improvement — all running privately on your own machine.',
  target_audience: 'Founders, indie hackers, creators, small businesses, agencies, and AI builders who want a controlled AI assistant for marketing strategy and execution — not a random chatbot.',
  problem: 'People do not need more random chatbots. They need a controlled operating system that turns marketing ideas into supervised execution — one that plans, drafts, researches, and executes while the owner stays in control.',
  solution: 'AÏKO provides a command center where the CEO brain plans, AI Skills create drafts internally, the Web Operator Kevin uses Normal Chrome to do browser research, the owner approves risky external actions, and Intensive Work cycles keep making progress autonomously within safe boundaries.',
  key_features: [
    'CEO Chat for project creation, strategy, and daily command',
    'AI Skills for internal content and research drafts',
    'Web Operator Kevin using Normal Chrome for supervised browser work',
    'Approval-first safety: no auto-send/post/publish',
    'Intensive Work cycles for bounded autonomous progress',
    'Tasks, Daily Brief, and generated files',
    'Executive reports and project bundles',
    'Controlled self-improvement proposals',
    'Normal Chrome integration with existing logins',
    'Local/private — runs on your machine, not a cloud service',
  ],
  differentiators: [
    'Local/private MVP — your data stays on your machine',
    'ChatGPT/Codex Local and Ollama support for offline AI',
    'Normal Chrome Web Operator — Kevin uses your real browser profile',
    'Approval-first safety model — nothing sends without you',
    'Project Brain memory — context improves every AI output',
    'Intensive Work mode — bounded autonomous cycles with safety stops',
    'Owner-supervised: you control what Kevin does in the browser',
  ],
  tone_of_voice: 'Clear, premium, practical, calm, and founder-focused. Not hype. Not promises of full automation. Honest about what is safe and what needs human oversight.',
  proof_points: [
    'Runs fully offline with Ollama',
    'Kevin uses Normal Chrome — existing logins work',
    'Approval required before any send/post/publish',
    'v0.2.2 validated end-to-end in a real promotion session',
    'Tests confirm no browser opens during npm test or npm run build',
  ],
  forbidden_claims: [
    'Fully autonomous posting without owner approval',
    'Bypasses CAPTCHA, login, or security checkpoints',
    'Sends messages, emails, or posts without explicit approval',
    'Replaces all marketing teams or human judgment',
    'Guarantees leads, revenue, or marketing outcomes',
    'Works without any human setup or configuration',
  ],
  current_goal: 'Promote AÏKO as a safe, local, owner-supervised AI Marketing Operating System to developers, indie hackers, and founders who want controlled AI execution.',
  preferred_channels: [
    'LinkedIn',
    'Reddit (r/SideProject, r/Entrepreneur, r/MachineLearning)',
    'Hacker News (Show HN)',
    'Indie Hackers community',
    'AI builder communities',
    'X/Twitter (founder and AI builder audiences)',
  ],
  owner_notes: 'AÏKO is itself the demo. When promoting AÏKO, use AÏKO to create the drafts — but note that the CEO Chat plan text and the actual output file may reference context inconsistently because Ollama is a local model without fine-tuning on AÏKO specifics.',
  source_summary: 'Seeded from official v0.2.2 feature set and real-use session findings. Last verified 2026-06-07.',
}

async function seedAikoBrain() {
  const client = await pool.connect()
  try {
    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_brain_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL UNIQUE,
        one_liner TEXT, positioning TEXT, target_audience TEXT,
        problem TEXT, solution TEXT,
        key_features JSONB NOT NULL DEFAULT '[]'::jsonb,
        differentiators JSONB NOT NULL DEFAULT '[]'::jsonb,
        tone_of_voice TEXT,
        proof_points JSONB NOT NULL DEFAULT '[]'::jsonb,
        forbidden_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
        current_goal TEXT,
        preferred_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner_notes TEXT, source_summary TEXT,
        completeness_score INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Find AÏKO project
    const projectRes = await client.query(
      `SELECT id, name FROM projects WHERE lower(name) IN ('aïko', 'aiko') AND active=true ORDER BY created_at DESC LIMIT 1`
    )
    if (!projectRes.rows[0]) {
      console.log('No AÏKO/AIKO project found. Create one in the app first, then re-run this script.')
      return
    }
    const projectId = projectRes.rows[0].id
    const projectName = projectRes.rows[0].name
    console.log(`Found project: ${projectName} (${projectId})`)

    // Compute completeness
    const fields = ['one_liner','positioning','target_audience','problem','solution','differentiators','tone_of_voice','current_goal','preferred_channels','forbidden_claims']
    const filled = fields.filter(f => {
      const v = AIKO_BRAIN[f]
      return Array.isArray(v) ? v.length > 0 : !!v
    })
    const score = Math.round((filled.length / fields.length) * 100)

    await client.query(
      `INSERT INTO project_brain_documents
         (project_id, one_liner, positioning, target_audience, problem, solution,
          key_features, differentiators, tone_of_voice, proof_points, forbidden_claims,
          current_goal, preferred_channels, owner_notes, source_summary, completeness_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14,$15,$16)
       ON CONFLICT (project_id) DO UPDATE SET
         one_liner=$2, positioning=$3, target_audience=$4, problem=$5, solution=$6,
         key_features=$7::jsonb, differentiators=$8::jsonb, tone_of_voice=$9,
         proof_points=$10::jsonb, forbidden_claims=$11::jsonb, current_goal=$12,
         preferred_channels=$13::jsonb, owner_notes=$14, source_summary=$15,
         completeness_score=$16, updated_at=NOW()`,
      [
        projectId, AIKO_BRAIN.one_liner, AIKO_BRAIN.positioning, AIKO_BRAIN.target_audience,
        AIKO_BRAIN.problem, AIKO_BRAIN.solution,
        JSON.stringify(AIKO_BRAIN.key_features), JSON.stringify(AIKO_BRAIN.differentiators),
        AIKO_BRAIN.tone_of_voice, JSON.stringify(AIKO_BRAIN.proof_points),
        JSON.stringify(AIKO_BRAIN.forbidden_claims), AIKO_BRAIN.current_goal,
        JSON.stringify(AIKO_BRAIN.preferred_channels), AIKO_BRAIN.owner_notes,
        AIKO_BRAIN.source_summary, score,
      ]
    )
    console.log(`✓ AÏKO Project Brain seeded. Completeness: ${score}%`)
    console.log('  Open /projects/<id>/brain to view and edit.')
  } finally {
    client.release()
    await pool.end()
  }
}

seedAikoBrain().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
