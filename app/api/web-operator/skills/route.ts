import { NextResponse } from 'next/server'
import { listWebOperatorSkills } from '@/lib/web-operator/skills'

export async function GET() {
  const skills = await listWebOperatorSkills()
  return NextResponse.json({ skills })
}
