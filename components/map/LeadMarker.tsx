'use client'

const STATUS_COLORS: Record<string, string> = {
  new:       '#666666',
  contacted: '#7098c8',
  replied:   '#c8a84a',
  qualified: '#7eb88a',
  rejected:  '#c87070',
}

export function getLeadMarkerHtml(status: string): string {
  const color = STATUS_COLORS[status] ?? '#666'
  return `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid ${color};box-shadow:0 0 0 3px ${color}22;"></div>`
}
