import {
  loadWasteReviewPage,
  type WasteReviewClientConfiguration,
  type WasteReviewFilters,
  type WasteReviewSubmission,
} from './api/wasteReviewClient';

/** Encodes untrusted business text as CSV and prevents spreadsheet formula execution. */
function cell(value: string | number | undefined) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
/** Downloads every matching authorized page. No partial file is emitted after a failed or changing result set. */
export async function exportWasteSubmissions(
  configuration: WasteReviewClientConfiguration,
  filters: WasteReviewFilters,
  labels: Record<string, string>,
) {
  const rows: WasteReviewSubmission[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  let page = 1;
  do {
    const result = await loadWasteReviewPage(configuration, {
      ...filters,
      page,
      dashboard: false,
    });
    if (
      (total !== undefined && result.total !== total) ||
      result.page !== page ||
      !Number.isSafeInteger(result.limit) ||
      result.limit < 1
    )
      throw new Error(
        labels.exportChanged || 'Submissions changed during export. Please retry.',
      );
    total = result.total;
    for (const record of result.items) {
      if (seen.has(record.code))
        throw new Error(
          labels.exportChanged || 'Submissions changed during export. Please retry.',
        );
      seen.add(record.code);
      rows.push(record);
    }
    if (rows.length > total || (!result.items.length && rows.length < total))
      throw new Error(
        labels.exportChanged || 'Submissions changed during export. Please retry.',
      );
    page++;
  } while (rows.length < total);
  const header = [
    labels.reference || 'Reference',
    labels.itemName || 'Item name',
    labels.itemType || 'Item type',
    labels.status || 'Status',
    labels.customer || 'Customer',
    labels.centre || 'Collection centre',
    labels.submittedAt || 'Submitted at',
    labels.quantity || 'Quantity',
    labels.condition || 'Condition',
    labels.feedback || 'Review feedback',
  ];
  const content = [
    header,
    ...rows.map((record) => {
      const facts =
        record.metadata.reviewedFacts ||
        record.metadata.verifiedFacts ||
        record.confirmedFacts ||
        record.submittedFacts;
      return [
        record.code,
        facts.name,
        facts.itemTypeCode,
        record.submissionStatus,
        record.submitterRef.code,
        facts.preferredCollectionPointCode,
        record.metadata.submittedAt,
        facts.quantity,
        facts.conditionGrade,
        record.metadata.publicReason,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
