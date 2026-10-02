/**
 * In-memory HTTP authentication signal to the App-owned employee lifecycle.
 * This private EventTarget is not window, storage, a credential registry or a
 * transport interceptor. The request token is used only to reject late signals
 * from an old session; never log, persist or forward it to navigation.
 */
const events = new EventTarget();
const expired = 'employee-session-expired';
export interface EmployeeSessionRequestIdentity {
  readonly accessToken: string;
  readonly generation: number;
}

/** Signals only an authenticated HTTP 401. Permission denials remain local. */
export function observeEmployeeSessionResponse(
  response: Pick<Response, 'status'>,
  accessToken?: string,
  generation?: number,
): boolean {
  if (response.status !== 401 || !accessToken) return false;
  if (generation !== undefined && Number.isSafeInteger(generation) && generation > 0)
    events.dispatchEvent(
      new CustomEvent<EmployeeSessionRequestIdentity>(expired, {
        detail: Object.freeze({ accessToken, generation }),
      }),
    );
  return true;
}

/** App remains the sole session authority; subscribers receive no request body. */
export function subscribeEmployeeSessionExpired(
  listener: (identity: EmployeeSessionRequestIdentity) => void,
): () => void {
  const handle = (event: Event) =>
    listener((event as CustomEvent<EmployeeSessionRequestIdentity>).detail);
  events.addEventListener(expired, handle);
  return () => events.removeEventListener(expired, handle);
}
