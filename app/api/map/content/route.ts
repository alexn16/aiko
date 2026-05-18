import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const mapContent = fs.readFileSync(path.join(process.cwd(), 'AIKO_MAP.md'), 'utf-8')
  const fnContent = fs.readFileSync(path.join(process.cwd(), 'AIKO_FUNCTIONS.md'), 'utf-8')
  return NextResponse.json({ map: mapContent, functions: fnContent })
}
