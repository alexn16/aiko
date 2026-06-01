/**
 * AÏKO Provider Catalog
 *
 * OpenClaw-style catalog of all supported (and planned) AI providers.
 * This is the single source of truth for what providers exist,
 * how to connect them, and what they support.
 */

export type ProviderCategory =
  | 'subscription_oauth'
  | 'direct_api'
  | 'gateway'
  | 'local'
  | 'custom'
  | 'media_special'

export type CompatibilityType =
  | 'openai_compatible'
  | 'anthropic_messages'
  | 'ollama_native'
  | 'google_gemini'
  | 'aws_bedrock'
  | 'not_implemented'

export type AuthType = 'api_key' | 'oauth' | 'none' | 'aws_credentials'

export type CatalogStatus = 'available' | 'planned' | 'not_available_in_this_build'

export type CapabilityTag = 'reasoning' | 'research' | 'writing' | 'coding' | 'vision' | 'local' | 'low_cost' | 'fast' | 'fallback'

export interface ProviderCatalogEntry {
  id: string
  display_name: string
  short_description: string
  category: ProviderCategory
  auth_type: AuthType
  compatibility: CompatibilityType
  default_base_url?: string
  docs_url?: string
  status: CatalogStatus
  requires_base_url: boolean
  requires_api_key: boolean
  supports_streaming: boolean
  supports_tools: boolean
  supports_chat: boolean
  model_suggestions?: string[]
  icon: string
  notes?: string
  capabilities?: CapabilityTag[]
}

export const CATALOG: ProviderCatalogEntry[] = [
  // ── Subscription / OAuth (not available in this build) ──────────────────────

  {
    id: 'chatgpt_oauth',
    display_name: 'ChatGPT / Codex',
    short_description: 'Connect via your ChatGPT account (OAuth)',
    category: 'subscription_oauth',
    auth_type: 'oauth',
    compatibility: 'openai_compatible',
    status: 'available',
    requires_base_url: false,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    icon: '🟢',
    notes: 'OAuth PKCE flow is implemented. Requires OPENAI_OAUTH_CLIENT_ID, OPENAI_OAUTH_AUTH_URL, OPENAI_OAUTH_TOKEN_URL env vars. If not configured, use OpenAI API key instead.',
    capabilities: ['reasoning', 'research', 'writing', 'coding', 'vision'],
  },
  {
    id: 'claude_oauth',
    display_name: 'Claude (Account)',
    short_description: 'Connect via your Claude.ai account (OAuth)',
    category: 'subscription_oauth',
    auth_type: 'oauth',
    compatibility: 'anthropic_messages',
    status: 'available',
    requires_base_url: false,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    icon: '🟠',
    notes: 'OAuth PKCE flow is implemented. Requires CLAUDE_OAUTH_CLIENT_ID, CLAUDE_OAUTH_AUTH_URL, CLAUDE_OAUTH_TOKEN_URL env vars. If not configured, use Anthropic API key instead.',
    capabilities: ['reasoning', 'research', 'writing', 'coding'],
  },

  // ── Direct API — OpenAI-compatible ──────────────────────────────────────────

  {
    id: 'openai_api',
    display_name: 'OpenAI API',
    short_description: 'GPT-4o, GPT-4 Turbo via API key',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.openai.com/v1',
    docs_url: 'https://platform.openai.com/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    icon: '⚡',
    capabilities: ['reasoning', 'research', 'writing', 'coding', 'vision'],
  },
  {
    id: 'mistral',
    display_name: 'Mistral AI',
    short_description: 'Mistral Large, Small, Codestral',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.mistral.ai/v1',
    docs_url: 'https://docs.mistral.ai',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    icon: '🌊',
    capabilities: ['reasoning', 'writing', 'coding', 'fast'],
  },
  {
    id: 'moonshot',
    display_name: 'Moonshot AI / Kimi',
    short_description: 'Kimi long-context models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.moonshot.cn/v1',
    docs_url: 'https://platform.moonshot.cn/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    icon: '🌙',
    capabilities: ['reasoning', 'research'],
  },
  {
    id: 'minimax',
    display_name: 'MiniMax',
    short_description: 'MiniMax text and multimodal models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.minimax.chat/v1',
    docs_url: 'https://www.minimax.io/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['abab6.5s-chat', 'abab5.5-chat'],
    icon: '✦',
    capabilities: ['writing'],
  },
  {
    id: 'stepfun',
    display_name: 'StepFun',
    short_description: 'Step-1 and Step-2 models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.stepfun.com/v1',
    docs_url: 'https://platform.stepfun.com/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['step-1-8k', 'step-1-32k', 'step-2-16k'],
    icon: '◎',
    capabilities: ['reasoning'],
  },
  {
    id: 'qwen',
    display_name: 'Qwen (Alibaba)',
    short_description: 'Qwen 2.5 and Qwen Max models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    docs_url: 'https://help.aliyun.com/zh/dashscope/',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
    icon: '🔷',
    capabilities: ['reasoning', 'coding', 'fast'],
  },
  {
    id: 'byteplus',
    display_name: 'BytePlus Model',
    short_description: 'Doubao and BytePlus hosted models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    docs_url: 'https://www.volcengine.com/docs/82379',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['doubao-pro-32k', 'doubao-lite-32k'],
    icon: '🔵',
    capabilities: ['fast', 'low_cost'],
  },
  {
    id: 'deepinfra',
    display_name: 'DeepInfra',
    short_description: 'Llama, Mistral, Qwen via DeepInfra',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.deepinfra.com/v1/openai',
    docs_url: 'https://deepinfra.com/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
    icon: '🔻',
    capabilities: ['low_cost', 'fast'],
  },
  {
    id: 'fireworks',
    display_name: 'Fireworks AI',
    short_description: 'Fast inference for open models',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.fireworks.ai/inference/v1',
    docs_url: 'https://docs.fireworks.ai',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [
      'accounts/fireworks/models/llama-v3p1-70b-instruct',
      'accounts/fireworks/models/mixtral-8x7b-instruct',
    ],
    icon: '🎆',
    capabilities: ['fast', 'low_cost'],
  },
  {
    id: 'chutes',
    display_name: 'Chutes AI',
    short_description: 'Open-source model hosting',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://llm.chutes.ai/v1',
    docs_url: 'https://chutes.ai/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['deepseek-ai/DeepSeek-V3-0324', 'Qwen/Qwen3-235B-A22B'],
    icon: '🔗',
    capabilities: ['low_cost'],
  },

  // ── Direct API — Anthropic Messages ─────────────────────────────────────────

  {
    id: 'anthropic_api',
    display_name: 'Anthropic API',
    short_description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'anthropic_messages',
    default_base_url: undefined,
    docs_url: 'https://docs.anthropic.com',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-3-5-sonnet-20241022',
    ],
    icon: '🔶',
    capabilities: ['reasoning', 'research', 'writing', 'coding'],
  },

  // ── Direct API — Google Gemini (planned) ────────────────────────────────────

  {
    id: 'google_gemini',
    display_name: 'Google Gemini',
    short_description: 'Gemini 1.5 Pro, Gemini Flash',
    category: 'direct_api',
    auth_type: 'api_key',
    compatibility: 'google_gemini',
    docs_url: 'https://ai.google.dev/docs',
    status: 'planned',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    icon: '♦',
    notes: 'Gemini adapter coming soon. API key required.',
    capabilities: ['reasoning', 'research', 'vision'],
  },

  // ── Gateway — available ──────────────────────────────────────────────────────

  {
    id: 'openrouter',
    display_name: 'OpenRouter',
    short_description: 'Route to 200+ models via one API key',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://openrouter.ai/api/v1',
    docs_url: 'https://openrouter.ai/docs',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    model_suggestions: [
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.1-70b-instruct',
      'google/gemini-flash-1.5',
    ],
    icon: '🔀',
    notes: 'OpenRouter is a gateway, not a model company. Supports any compatible model via one key.',
    capabilities: ['reasoning', 'research', 'writing', 'coding', 'vision'],
  },
  {
    id: 'synthetic',
    display_name: 'Synthetic',
    short_description: 'Synthetic AI platform',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://api.synthetic.new/v1',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [],
    icon: '🧬',
    capabilities: ['fast'],
  },
  {
    id: 'vercel_ai_gateway',
    display_name: 'Vercel AI Gateway',
    short_description: 'Route to multiple providers via Vercel',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    default_base_url: 'https://ai-gateway.vercel.sh/v1',
    docs_url: 'https://vercel.com/docs/ai-gateway',
    status: 'available',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [],
    icon: '▲',
    notes: 'Requires Vercel project with AI Gateway enabled.',
    capabilities: ['fast'],
  },

  // ── Gateway — planned ────────────────────────────────────────────────────────

  {
    id: 'aws_bedrock',
    display_name: 'Amazon Bedrock',
    short_description: 'Claude, Llama, Titan via AWS',
    category: 'gateway',
    auth_type: 'aws_credentials',
    compatibility: 'aws_bedrock',
    docs_url: 'https://docs.aws.amazon.com/bedrock/',
    status: 'planned',
    requires_base_url: false,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: true,
    supports_chat: true,
    icon: '☁',
    notes: 'AWS Bedrock adapter coming soon. Requires AWS credentials.',
  },
  {
    id: 'cloudflare_ai_gateway',
    display_name: 'Cloudflare AI Gateway',
    short_description: 'Route AI traffic via Cloudflare',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    docs_url: 'https://developers.cloudflare.com/ai-gateway/',
    status: 'planned',
    requires_base_url: true,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    icon: '🟧',
    notes: 'Cloudflare AI Gateway support coming soon.',
  },
  {
    id: 'alibaba_model_studio',
    display_name: 'Alibaba Model Studio',
    short_description: 'Alibaba Cloud hosted models',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    docs_url: 'https://www.alibabacloud.com/help/en/model-studio/',
    status: 'planned',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    icon: '🟥',
    notes: 'Alibaba Model Studio support coming soon.',
  },
  {
    id: 'qianfan',
    display_name: 'Qianfan (Baidu)',
    short_description: 'ERNIE Bot and open models via Baidu',
    category: 'gateway',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    docs_url: 'https://cloud.baidu.com/product/wenxinworkshop',
    status: 'planned',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    icon: '🐦',
    notes: 'Qianfan adapter coming soon.',
  },

  // ── Local ────────────────────────────────────────────────────────────────────

  {
    id: 'ollama',
    display_name: 'Ollama / Local',
    short_description: 'Run models locally — no API key needed',
    category: 'local',
    auth_type: 'none',
    compatibility: 'ollama_native',
    default_base_url: 'http://localhost:11434/v1',
    docs_url: 'https://ollama.ai/docs',
    status: 'available',
    requires_base_url: true,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: ['llama3.2', 'llama3.1', 'qwen2.5', 'mistral', 'gemma3', 'deepseek-r1'],
    icon: '🖥',
    capabilities: ['local', 'fallback'],
  },

  // ── Custom endpoints ─────────────────────────────────────────────────────────

  {
    id: 'custom_openai',
    display_name: 'Custom OpenAI-compatible',
    short_description: 'Any OpenAI-compatible endpoint',
    category: 'custom',
    auth_type: 'api_key',
    compatibility: 'openai_compatible',
    status: 'available',
    requires_base_url: true,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [],
    icon: '🔧',
    notes: 'Works with any server that speaks the OpenAI chat completions API.',
    capabilities: ['fallback'],
  },
  {
    id: 'custom_anthropic',
    display_name: 'Custom Anthropic-compatible',
    short_description: 'Any server speaking Anthropic Messages API',
    category: 'custom',
    auth_type: 'api_key',
    compatibility: 'anthropic_messages',
    status: 'available',
    requires_base_url: true,
    requires_api_key: false,
    supports_streaming: true,
    supports_tools: false,
    supports_chat: true,
    model_suggestions: [],
    icon: '🔩',
    notes: 'Works with any server that speaks the Anthropic Messages API.',
    capabilities: ['fallback'],
  },

  // ── Media / Specialized (not available in this build) ───────────────────────

  {
    id: 'comfyui',
    display_name: 'ComfyUI',
    short_description: 'Local/remote image generation',
    category: 'media_special',
    auth_type: 'none',
    compatibility: 'not_implemented',
    status: 'not_available_in_this_build',
    requires_base_url: false,
    requires_api_key: false,
    supports_streaming: false,
    supports_tools: false,
    supports_chat: false,
    icon: '🎨',
    notes: 'Image generation via ComfyUI. Not yet integrated.',
  },
  {
    id: 'fal',
    display_name: 'fal.ai',
    short_description: 'Fast image and video generation',
    category: 'media_special',
    auth_type: 'api_key',
    compatibility: 'not_implemented',
    status: 'not_available_in_this_build',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: false,
    supports_tools: false,
    supports_chat: false,
    icon: '⚡',
    notes: 'fal.ai image/video generation. Not yet integrated.',
  },
  {
    id: 'runway',
    display_name: 'Runway',
    short_description: 'AI video generation',
    category: 'media_special',
    auth_type: 'api_key',
    compatibility: 'not_implemented',
    status: 'not_available_in_this_build',
    requires_base_url: false,
    requires_api_key: true,
    supports_streaming: false,
    supports_tools: false,
    supports_chat: false,
    icon: '🎬',
    notes: 'Runway video generation. Not yet integrated.',
  },
]

export function getCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return CATALOG.find(e => e.id === id)
}

export function getCatalogByCategory(category: ProviderCategory): ProviderCatalogEntry[] {
  return CATALOG.filter(e => e.category === category)
}

export function getRecommendedProviderIds(tag: CapabilityTag): string[] {
  return CATALOG
    .filter(e => e.status === 'available' && e.capabilities?.includes(tag))
    .map(e => e.id)
}
