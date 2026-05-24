import { CampaignDetailView } from '@/components/campaigns/CampaignDetailView'
import { getCampaign, listCampaignItems } from '@/lib/campaigns'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [campaign, items] = await Promise.all([
    getCampaign(params.id),
    listCampaignItems(params.id),
  ])

  if (!campaign) {
    notFound()
  }

  return <CampaignDetailView campaign={campaign} items={items} />
}
