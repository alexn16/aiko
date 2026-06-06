import { NextRequest, NextResponse } from 'next/server'
import { executeAISkill, recommendAISkillForPrompt } from '@/lib/ai-skills'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const skillId = typeof body.skill_id === 'string' && body.skill_id.trim()
      ? body.skill_id.trim()
      : recommendAISkillForPrompt(prompt)

    const output = await executeAISkill(skillId, {
      prompt,
      project_id: typeof body.project_id === 'string' ? body.project_id : null,
      save_as_file: Boolean(body.save_as_file),
    })

    return NextResponse.json({
      output,
      recommended_skill_id: skillId,
      created_web_operator_action: false,
      external_action_executed: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not execute AI skill.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
