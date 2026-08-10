import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';

interface EngagementDomain {
  readonly id: string;
  readonly label: string;
  readonly items: readonly AxisNavigationItem[];
}

const DOMAIN_ORDER = [
  'contact',
  'testimonials',
  'reviews',
  'feedback',
  'work',
  'governance',
] as const;

const DOMAIN_LABELS: Readonly<Record<(typeof DOMAIN_ORDER)[number], string>> = {
  contact: 'Contact',
  testimonials: 'Testimonials',
  reviews: 'Reviews & ratings',
  feedback: 'Feedback',
  work: 'Work management',
  governance: 'Governance & automation',
};

/**
 * Maps a backend-owned Engagement navigation item into a presentation-only
 * domain. The item remains the authority for route, label, permission, state,
 * workbench target, and lifecycle actions.
 */
export function engagementDomainId(
  item: AxisNavigationItem,
): (typeof DOMAIN_ORDER)[number] {
  if (item.id.startsWith('contact-')) return 'contact';
  if (item.id.startsWith('testimonial-')) return 'testimonials';
  if (item.id === 'customer-reviews' || item.id.startsWith('review-')) return 'reviews';
  if (item.id === 'customer-feedback' || item.id.startsWith('feedback-')) {
    return 'feedback';
  }
  if (
    item.id === 'engagement-unified-queue' ||
    item.id === 'engagement-dashboards' ||
    item.id === 'engagement-exports'
  ) {
    return 'work';
  }
  return 'governance';
}

const engagementItems = (
  items: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] =>
  items
    .filter(
      (item) =>
        item.id !== 'customer-engagement' &&
        item.route.startsWith('/engagement') &&
        item.featureState !== 'HIDDEN',
    )
    .sort((left, right) => left.order - right.order);

/** Builds the six stable presentation domains from authorized backend items. */
export function engagementDomains(
  items: readonly AxisNavigationItem[],
): readonly EngagementDomain[] {
  const authorizedItems = engagementItems(items);
  return DOMAIN_ORDER.map((id) => ({
    id,
    label: DOMAIN_LABELS[id],
    items: authorizedItems.filter((item) => engagementDomainId(item) === id),
  })).filter((domain) => domain.items.length > 0);
}
