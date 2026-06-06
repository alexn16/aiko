import { NextResponse } from 'next/server'
import { listAISkills } from '@/lib/ai-skills'

export async function GET() {
  const skills = await listAISkills()
  return NextResponse.json({ skills })
}
