import { extractFirstUrl } from '@/lib/web-operator/skills'

export interface DirectSiteTarget {
  skillId: string
  url: string
  query: string | null
  direct: boolean
}

const DIRECT_SITE_BASE: Record<string, string> = {
  facebook_research: 'https://www.facebook.com/search/groups',
  linkedin_research: 'https://www.linkedin.com/search/results/companies/',
  instagram_research: 'https://www.instagram.com/',
  canva_design: 'https://www.canva.com/',
  gmail_workflow: 'https://mail.google.com/',
}

export function buildSiteSearchUrl(skillId: string, query: string): string | null {
  const trimmed = query.trim()
  if (skillId === 'facebook_research') {
    return `https://www.facebook.com/search/groups?q=${encodeURIComponent(trimmed)}`
  }
  if (skillId === 'linkedin_research') {
    return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(trimmed)}`
  }
  return DIRECT_SITE_BASE[skillId] ?? null
}

export function shouldOpenSiteDirectly(skillId: string, instruction: string): boolean {
  if (extractFirstUrl(instruction)) return true
  if (!DIRECT_SITE_BASE[skillId]) return false
  if (skillId === 'gmail_workflow') return /\b(open|check|search|gmail|inbox|mail)\b/i.test(instruction)
  return true
}

export function getDirectSiteTargetFromInstruction(text: string, skillId?: string | null): DirectSiteTarget | null {
  const url = extractFirstUrl(text)
  if (url) {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return null
      return { skillId: skillId ?? 'website_reader', url, query: null, direct: true }
    } catch {
      return null
    }
  }

  if (!skillId || !shouldOpenSiteDirectly(skillId, text)) return null

  const query = extractSiteQuery(text, skillId)
  const target = buildSiteSearchUrl(skillId, query)
  if (!target) return null
  return { skillId, url: target, query, direct: true }
}

export function siteNameForSkill(skillId: string): string {
  const map: Record<string, string> = {
    facebook_research: 'Facebook',
    linkedin_research: 'LinkedIn',
    instagram_research: 'Instagram',
    canva_design: 'Canva',
    gmail_workflow: 'Gmail',
    website_reader: 'the website',
  }
  return map[skillId] ?? 'the site'
}

function extractSiteQuery(text: string, skillId: string): string {
  if (skillId === 'canva_design' || skillId === 'gmail_workflow' || skillId === 'instagram_research') {
    return ''
  }

  let query = text
    .replace(/^[A-Z][a-z]+,\s*/i, '')
    .replace(/\b(facebook|fb|linkedin)\b/ig, ' ')
    .replace(/\b(research|search|find|look up|open|browse|groups?|pages?|companies|results|about|for|on|in)\b/ig, ' ')
    .replace(/[.?!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!query) {
    query = text
      .replace(/^[A-Z][a-z]+,\s*/i, '')
      .replace(/[.?!]+$/g, '')
      .trim()
  }
  return query.slice(0, 160)
}
