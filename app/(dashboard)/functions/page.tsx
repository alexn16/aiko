import fs from 'fs'
import path from 'path'
import { marked } from 'marked'

export default function FunctionsPage() {
  const content = fs.readFileSync(path.join(process.cwd(), 'AIKO_FUNCTIONS.md'), 'utf-8')
  const html = marked(content) as string

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 24 }}>
        Functions Reference
      </div>
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
