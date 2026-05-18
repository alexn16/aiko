import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH ?? './screenshots'

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = path.join(process.cwd(), SCREENSHOT_PATH, ...params.path)

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' },
  })
}
