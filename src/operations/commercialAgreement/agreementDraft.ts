import type { AgreementTerms } from './agreementClient';

/** Empty business selections: no automatic model, renewal consent, price, date or benefit selection. */
export function emptyAgreementTerms(): AgreementTerms {
  return {
    model: '',
    paymentTerms: '',
    packageRef: { module: 'product', schema: 'product', code: '' },
    priceRef: { module: 'pricing', schema: 'priceRow', code: '' },
    services: '',
    allowances: '',
    effectiveFrom: '',
    serviceStart: '',
    paymentSchedule: '',
    renewal: { mode: '' },
    terminationTerms: '',
    financialTreatment: '',
    evidenceRef: '',
    benefits: [],
    financialReferences: [],
  };
}
/** Normalizes only transport representation; the owner still rejects invalid models, timing, prices and targets. */
export function prepareAgreementTerms(input: AgreementTerms): AgreementTerms {
  const terms = structuredClone(input);
  const date = (value: string) => new Date(value).toISOString();
  terms.effectiveFrom = date(terms.effectiveFrom);
  terms.serviceStart = date(terms.serviceStart);
  if (terms.effectiveTo) terms.effectiveTo = date(terms.effectiveTo);
  else delete terms.effectiveTo;
  if (!terms.billingPeriod) delete terms.billingPeriod;
  for (const ref of [terms.packageRef, terms.priceRef, ...terms.financialReferences]) {
    if (!ref.catalogVersion) delete ref.catalogVersion;
  }
  if (
    !Number.isSafeInteger(terms.packageRef.versionId) ||
    !Number.isSafeInteger(terms.priceRef.versionId)
  )
    throw new Error();
  for (const key of ['period', 'noticeTerms', 'evidenceRef'] as const)
    if (!terms.renewal[key]) delete terms.renewal[key];
  terms.benefits = terms.benefits.map((benefit) => {
    const value = {
      ...benefit,
      validFrom: date(benefit.validFrom),
      validTo: date(benefit.validTo),
      productCodes: [...benefit.productCodes].sort(),
    };
    if (!value.additionalBenefitTerms) delete value.additionalBenefitTerms;
    return value;
  });
  return terms;
}
