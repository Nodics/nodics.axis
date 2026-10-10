import type {
  MediaPublicationRequest,
  MediaPublicationResult,
} from '../mediaManagement/api/mediaPublicationClient';
import type { MediaPublicationDependency } from './mediaPublicationHandoff';

/** Called only by an explicit pack decision; Process still authorizes every individual task. */
export async function coordinatePublicationAssets(
  dependencies: readonly MediaPublicationDependency[],
  requestPublication: (
    input: MediaPublicationRequest,
  ) => Promise<MediaPublicationResult>,
  decideWorkflow: (workflowRef: string) => Promise<void>,
): Promise<void> {
  if (
    dependencies.length > 100 ||
    new Set(dependencies.map((item) => item.mediaCode)).size !== dependencies.length
  )
    throw new Error('Pack Media dependency boundary is incompatible');
  // Validate the entire selection before requesting any publication.
  const selected = dependencies
    .filter((item) => !item.qualified)
    .map((item) => {
      if (
        !item.publicationCode ||
        !/^cmsMedia_[a-f0-9]{64}$/.test(item.publicationCode) ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(item.mediaCode) ||
        item.versionId === undefined ||
        !Number.isSafeInteger(item.versionId) ||
        item.versionId < 0 ||
        !item.checksum ||
        !/^[a-f0-9]{64}$/.test(item.checksum)
      )
        throw new Error('Pack Media requires exact version and checksum evidence');
      return {
        publicationCode: item.publicationCode,
        mediaCode: item.mediaCode,
        versionId: item.versionId,
        expectedChecksum: item.checksum,
      };
    });
  for (const input of selected) {
    const result = await requestPublication(input);
    if (result.state === 'PENDING_APPROVAL') {
      if (!result.workflowRef)
        throw new Error('Media approval workflow is unavailable');
      await decideWorkflow(result.workflowRef);
    } else if (!['APPROVED', 'ACTIVATING', 'ONLINE'].includes(result.state)) {
      throw new Error('Media publication needs owner recovery');
    }
  }
}
