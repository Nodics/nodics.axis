import type { WasteDashboardData } from './api/wasteReviewClient';
/** One presentation catalogue shared by Waste dashboard fields and submission search summaries. */
export function wasteFilterChoices(
  data: WasteDashboardData | null,
  labels: Record<string, string>,
) {
  return [
    { key: 'familyCode', label: labels.family, items: data?.families || [] },
    { key: 'collectionPointCode', label: labels.centre, items: data?.centres || [] },
    {
      key: 'area',
      label: labels.area,
      items: [
        ...new Set((data?.centres || []).map((point) => point.city).filter(Boolean)),
      ].map((city) => ({ code: city!, name: city! })),
    },
    {
      key: 'channel',
      label: labels.channel,
      items: ['WEB', 'TELEGRAM', 'WHATSAPP'].map((code) => ({
        code,
        name: code === 'WEB' ? 'Web' : code === 'TELEGRAM' ? 'Telegram' : 'WhatsApp',
      })),
    },
    {
      key: 'sizeClass',
      label: labels.size,
      items: ['SMALL', 'MEDIUM', 'LARGE', 'BULKY', 'HEAVY', 'UNKNOWN'].map((code) => ({
        code,
        name: code.toLowerCase(),
      })),
    },
  ];
}
