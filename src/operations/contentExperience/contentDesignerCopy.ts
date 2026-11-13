import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import type { AxisLocalizationState } from '../../localization/localizationContracts';

// Exact source-copy matching preserves custom owner labels and never translates record identities.
const keys: Readonly<Record<string, string>> = {
  'Replace image': 'designer.copy.fcedcb5edd38a849',
  'Attach image': 'designer.copy.2eacc5e02758c0b0',
  'Choose a ready image from this enterprise’s Staged Media. Save the page to keep the change.':
    'designer.copy.290bb8ff80b270b1',
  'No other eligible images on this page.': 'designer.copy.e4ba9885161724e4',
  'Staged image': 'designer.copy.83c4e2f49cc08345',
  'Alternative text': 'designer.copy.b53f3ff91b5b7904',
  'Describe the image for people using a screen reader.':
    'designer.copy.a233c1b293af9001',
  'Use replacement': 'designer.copy.ede9db7dbebfe229',
  'Use image': 'designer.copy.a4f1c009e958256a',
  Cancel: 'designer.copy.19766ed6ccb2f4a3',
  'Previous images': 'designer.copy.fa96cc95351c426a',
  'More images': 'designer.copy.abd7532494afb81b',
  ' · Inside {parent}': 'designer.copy.c3bd4a3a227c4fd2',
  'Saved composition opened. Publication remains a separate action.':
    'designer.copy.a5a6ca4611c609d5',
  'This exact composition is valid.': 'designer.copy.84383c58d5de3be2',
  'Draft saved. Reopen the saved page to inspect the result and continue.':
    'designer.copy.e10507bf7757a340',
  'Publication requested. Inspect the request in Publishing before taking another action.':
    'designer.copy.348807313fe48117',
  'Local changes discarded. The saved page is unchanged.':
    'designer.copy.79818e9d1f5faf30',
  'Saved version selected. Local page edits were explicitly discarded; validate again before another command.':
    'designer.copy.a22e25b5cc267f7e',
  'New block added locally. Complete its content before validating.':
    'designer.copy.a814dc5e5dc57243',
  Step: 'designer.copy.8e6a6cca7aae1d1e',
  'Authoring contract': 'designer.copy.d70fe0751e3f7b9c',
  'Loading CMS Designer authoring contract': 'designer.copy.52e84e55ace2ab35',
  'Check content access for this enterprise, then retry. Your draft entries remain available.':
    'designer.copy.51bb66115a04169c',
  'Retry content setup': 'designer.copy.a33902c134b0dc90',
  'Supported operations:': 'designer.copy.19482abdd39713af',
  'Generated catalog-first preview': 'designer.copy.13127b6217e7bbb1',
  'Catalog:': 'designer.copy.35ef0314cf88dae2',
  'Site:': 'designer.copy.c9aa3fe9cc2efad7',
  'Template:': 'designer.copy.3c8938774eb83dc5',
  'Page:': 'designer.copy.a7c0b8328e8f9e71',
  'Route:': 'designer.copy.8ccda3046529c2ba',
  'Slot:': 'designer.copy.6ade7afbc2f37e11',
  '· Section': 'designer.copy.002a2d6f852ad71e',
  'Components:': 'designer.copy.749dd93ddca49867',
  Locale: 'designer.copy.ca3dc612f47e3913',
  'Validate first. Save will unlock only after WCMS confirms this exact draft.':
    'designer.copy.998a88148db89cd0',
  'CMS publishing readiness and impact': 'designer.copy.e7605fc99fc330f1',
  'Validate dependencies before submit. Publishing impact is the saved Staged draft plus route, component, template, media, and layout evidence that approvers should inspect before Online movement.':
    'designer.copy.e68652b59dc1ae56',
  'Approval impact summary: approvers should compare the saved Staged draft, route intent, template slots, components, media references, and target site before approving the publication request.':
    'designer.copy.935103d512b8dcdd',
  'Content setup notes': 'designer.copy.cdf88ac84d85101e',
  'Save will create only the draft records. Publishing still checks:':
    'designer.copy.1fa88692c515c7cc',
  'Create pages, arrange content, and review drafts before publishing.':
    'designer.copy.85f65586fb26fc66',
  'Open an existing page': 'designer.copy.e1e32fb79c798707',
  'An existing page has local changes or a command awaiting inspection. Open the existing-page panel to continue.':
    'designer.copy.c0be85e44bb16c3b',
  'Choose a website, add your page content, then validate and save.':
    'designer.copy.250b09c67952858f',
  'The content authoring workspace is currently unavailable. Your page entries remain here while availability is refreshed.':
    'designer.copy.8cfc950bfdd3bbc2',
  'Refresh workspace availability': 'designer.copy.8fbe5392dffdf8db',
  'Refresh content setup': 'designer.copy.6f34d059fb0dc4d5',
  'Content setup details': 'designer.copy.b7caf3d3e2d62fd2',
  'Saving creates a draft version. Submit the saved version for approval when it is ready to publish.':
    'designer.copy.632586e2da327cf6',
  'Content Catalog': 'designer.copy.346ffc53508d50cf',
  Website: 'designer.copy.b5a229ac8becc603',
  'Page template': 'designer.copy.86b531798d5dea64',
  'Page code': 'designer.copy.edd802cf988b9d41',
  'Page sections': 'designer.copy.783dc516d32b36e8',
  'Use a clean URL. If you omit the leading slash, Axis adds it for you.':
    'designer.copy.7e4afca0c27c2958',
  'Web address': 'designer.copy.45099c5588497157',
  'Controls whether this route is publicly delivered or requires an authenticated CMS request.':
    'designer.copy.2c3d22d568e0dc6e',
  'Delivery access': 'designer.copy.12dbc75e826639b3',
  'Content type': 'designer.copy.6f51cb0403204b19',
  'Authoring language': 'designer.copy.38656cbc3d95606b',
  'Enter content in each language you need. Fields marked as shared keep the same value in every language. Blank translations use the default language.':
    'designer.copy.4acaa72ce90cb502',
  'Complete the required headings, card details, and default language content before validating.':
    'designer.copy.2bc0b30bbeea761c',
  Mark: 'designer.copy.d7cda0ca2c8586e5',
  'content ready': 'designer.copy.acee35a9fde727e4',
  'All entered translations must be reviewed and marked ready before publication. You can save unfinished content as a draft.':
    'designer.copy.238f5e7418b7a130',
  'Draft preview and publication checks': 'designer.copy.7e716613a935dfc0',
  'Inspect publication request': 'designer.copy.ce6fec951e77262b',
  'Publication:': 'designer.copy.19c6f2442ee98584',
  'Inspect this request': 'designer.copy.9d02566cee219d00',
  'Review this approval': 'designer.copy.e008054bd62544bb',
  'Validate draft': 'designer.copy.5711358b949d1d31',
  'Save draft': 'designer.copy.3de100106dd4e52e',
  'Submit for approval': 'designer.copy.beec6c108c0009ae',
  'Reset defaults': 'designer.copy.4542d49a520543f9',
  'Choose media': 'designer.copy.4bb1e6c61420ccd5',
  'Review publication requests': 'designer.copy.0ef0852f5a38d5b6',
  'Verify Online status': 'designer.copy.b635b4c21ed064d2',
  'Manage existing content': 'designer.copy.e7e3d1f0914f4a1c',
  'Website setup and reference workspaces': 'designer.copy.c70acf282c8e0912',
  'Use these reference workspaces to manage reusable content and website settings. Create and validate your page in the draft above.':
    'designer.copy.f982c55af33394df',
  'Content inventory': 'designer.copy.6a9f3591fbeab050',
  'Loading content inventory': 'designer.copy.55fc448e0db27c62',
  'Content inventory could not be checked. The content authoring commands remain independently validated by CMS.':
    'designer.copy.bc058f7e637dd348',
  'Readiness snapshot': 'designer.copy.0f6e3c590d9391d6',
  'These counts come from live workbench contracts. If one is unavailable, the designer can still explain the flow, but save actions must stay inside the owning workspace.':
    'designer.copy.7b32735609538522',
  'CMS Online verification card: after a publication request is approved, confirm Online status, deployment history, audit evidence, and browser rendering for':
    'designer.copy.378435b062fa29e1',
  'before closing the content task.': 'designer.copy.ce29c305829bb6b7',
  'Content workspace could not be checked.': 'designer.copy.32958ab3a0b9f983',
  'Catalog first': 'designer.copy.c1ed96e3c8767fc2',
  'Catalog rule unknown': 'designer.copy.18b85a39503555f9',
  'Template Slots: any number': 'designer.copy.3b887da22412704e',
  'Slot flexibility unknown': 'designer.copy.8e598b95bfc529e4',
  'Backend persistence only': 'designer.copy.a779822cece0fcec',
  'Persistence rule unknown': 'designer.copy.5de8ddc086d65c98',
  'Content Catalog → Site → Template → Page → Slots → Sections → Components → Media → Route → Navigation':
    'designer.copy.95985fac42ae421d',
  None: 'designer.copy.dc937b59892604f5',
  'loading from WCMS': 'designer.copy.90956b430c39b2df',
  'This draft is validated and ready to save.': 'designer.copy.7d27f08551993e86',
  'The draft changed after validation. Revalidate before saving.':
    'designer.copy.91fc7469a6d2188b',
  'Content workspace readiness': 'designer.copy.43985024837bdbed',
  'WCMS validated this exact draft.': 'designer.copy.98efffde8d582609',
  'Validate this exact draft before save or submit.': 'designer.copy.2de276553d14aba3',
  'Template dependency': 'designer.copy.a84bfd76f65fa2ff',
  'Select a page template.': 'designer.copy.56fb129bf29b5b17',
  'Component dependency': 'designer.copy.33bb7365bfaecdd2',
  'Every section has a component with a selected type.':
    'designer.copy.45bc89eb257d7e2e',
  'Choose a component type for each section.': 'designer.copy.a493d611387a3ce2',
  'Route dependency': 'designer.copy.a89a689f072fa641',
  'Web address must start with a slash.': 'designer.copy.64773de9264fdf8d',
  'Media dependency': 'designer.copy.bd3d59c5fc2c68dc',
  'Linked assets will be checked by CMS before publication.':
    'designer.copy.a3ad8d7df86074ca',
  'No assets are linked to this draft. CMS checks required media before publication.':
    'designer.copy.c6e9a61f528012a5',
  'Layout-slot dependency': 'designer.copy.b96d86640ad183dd',
  'Draft slots match the selected template.': 'designer.copy.8ed28bcc6c0cc9f3',
  'Choose a template with defined slots and match each section to a slot.':
    'designer.copy.372988efb6db25d0',
  'Preview before submit': 'designer.copy.d513a1ce4d25df11',
  'Draft preview has been validated and saved before publication submit.':
    'designer.copy.9d3b52339c8df0c0',
  'Save the validated draft before submitting for publication.':
    'designer.copy.7942cbbe24e29fc7',
  'Required parts: WCMS default': 'designer.copy.e1d089e1bf241c14',
  'Media folders not loaded yet': 'designer.copy.eb765127a3c59ecd',
  'Media types pending': 'designer.copy.cdddbb69c8e85d56',
  'Navigation parents optional': 'designer.copy.79b3209642f1bbf4',
  'WCMS readiness': 'designer.copy.739ac134b979820d',
  'CMS connection is not available': 'designer.copy.2aca45526372e6ea',
  'CMS did not authorize this operation': 'designer.copy.15c0bc55a36afb55',
  'Choose the configured authoring references before validating a draft':
    'designer.copy.c5f06439c412f4bd',
  'Content Designer': 'designer.copy.4a23e50bce98db41',
  'Page Designer': 'designer.copy.45bb5b77eb9eb108',
  'Page draft': 'designer.copy.dfa251e47d2a11da',
  'Choose your website and template, then enter the page details. Validate the complete draft before saving.':
    'designer.copy.9608da453f82099d',
  'Content setup can be checked after the authoring workspace reconnects.':
    'designer.copy.d5788de9546d4c52',
  'Content setup is incomplete. An editable website, template, and component types are required for this enterprise before a draft can be validated.':
    'designer.copy.1fb8839f4b5378e4',
  'Choose the content boundary first. Sites are filtered by this catalog.':
    'designer.copy.6aeffc98031a5953',
  'Only sites available for the selected catalog are shown.':
    'designer.copy.421cef39ed9b25cd',
  'Selecting a template updates the suggested slot list below.':
    'designer.copy.7c67175f2966cd1a',
  'Use up to 128 letters, numbers, hyphens or underscores, starting with a letter or number.':
    'designer.copy.98c9330621a71044',
  'Enter a unique page code. The web address is suggested from this code.':
    'designer.copy.b199a7c651282082',
  'One slot per line or comma. Designer supports any template-defined slots.':
    'designer.copy.28cacf51a53c6a3e',
  'Validation result:': 'designer.copy.bc301c7a8ef5b4df',
  'Earlier draft validation:': 'designer.copy.9b34dcf380cfc48c',
  'CMS validation completed': 'designer.copy.6da468b6906a3822',
  'Save result:': 'designer.copy.f8075ba21b52a0bc',
  'Earlier draft save:': 'designer.copy.cf8ab132ce114c61',
  'Continue in the saved-page editor to change this saved page.':
    'designer.copy.095fe7c2a2b647c2',
  'The form changed after its saved version. These entries remain here while the saved copy is inspected.':
    'designer.copy.d00045d39ccabc40',
  'Open saved page': 'designer.copy.092dd5adac38fbab',
  'The publication request was not confirmed. Inspect Publishing before another command.':
    'designer.copy.877168e1b3b8f26f',
  'Publishing result:': 'designer.copy.3151a4d984348fdb',
  'Earlier draft publishing result:': 'designer.copy.e1ca5f35e0da20f2',
  'CMS publication request submitted': 'designer.copy.f3de26614fce1b80',
  Available: 'designer.copy.e674447337e83c13',
  Unavailable: 'designer.copy.ca184496974204a0',
  'No component types are configured for this authoring application.':
    'designer.copy.e46fa44ff4b6e7f2',
  'CMS draft saved as governed Staged records.': 'designer.copy.6842722165f7e88d',
  'not assigned': 'designer.copy.18a74de6b24ceffb',
  'Validate the draft to see backend evidence.': 'designer.copy.3a7f9a96cb7be213',
  'Validation evidence could not be rendered as text.':
    'designer.copy.4fbc6f490fc0e190',
  'Heading not entered': 'designer.copy.62ca76648d716d4a',
  'New page': 'designer.copy.40126b0e9d2e5f2f',
  'Page name': 'designer.copy.25f322d147d35f80',
  'Use a name your team will recognise in the page library.':
    'designer.copy.f7fe3de76dceb607',
  'Page draft saved. Continue with the saved page to edit it and prepare it for publication.':
    'designer.copy.68185199c8c96f20',
  'Continue with saved page': 'designer.copy.3a78663884acd537',
  'This form has edits after the saved version. These entries remain here while you inspect the saved copy.':
    'designer.copy.6954329ce794e4a8',
  'The publication outcome is unconfirmed. Inspect the original request in Publishing before taking another action.':
    'designer.copy.5453bbb3566dbc12',
  'Enter the content for {name} below. Your changes remain a draft until approved.':
    'designer.copy.c6f3b3293cfa35cd',
  'One slot per line or comma. Selected template exposes: {slots}.':
    'designer.copy.f1c88cf3b8a93035',
  'CMS draft saved as immutable Staged version {version}.':
    'designer.copy.b3ba244fb4b30532',
  'Template {template} is selected for this draft.': 'designer.copy.5add8ad3d20b87b7',
  'Web address {route} is browser-addressable.': 'designer.copy.2753a339a65b6ba0',
  'Catalog: {catalog}': 'designer.copy.e66d86405e33a0ca',
  'Site: {site}': 'designer.copy.37a69f69700812fd',
  'Template: {template}': 'designer.copy.5e7f094206851964',
  'Route: {route}': 'designer.copy.f00059023e686da4',
  'Required parts: {parts}': 'designer.copy.b31ae22213109b0c',
  '{count, number} media folders available': 'designer.copy.a5efb5a1b8bcb84d',
  'Media types: {types}': 'designer.copy.eab7790190b40e4c',
  '{count, number} navigation parents': 'designer.copy.3cb7754c9156ba78',
  'Content catalogs': 'designer.copy.4f95a172591fdee1',
  'Catalog containers that sit above sites, templates, and pages.':
    'designer.copy.4512dec79b0c0bac',
  Sites: 'designer.copy.9d7690937436d9e3',
  'Website containers available for page composition.':
    'designer.copy.b6386f72da35173d',
  Templates: 'designer.copy.56b564b75c7fdb48',
  'Reusable page structures and allowed dynamic slots.':
    'designer.copy.beee7b9b58f0052d',
  Pages: 'designer.copy.9046da16aea909ba',
  'Authorable pages that connect catalog, site, template, slots, and components.':
    'designer.copy.e55f32a065c3e34d',
  Components: 'designer.copy.a150ce2216025931',
  'Reusable content blocks with text, media, and renderer data.':
    'designer.copy.a99b4a64af9e341f',
  'Media links': 'designer.copy.dc600f6490d8f08c',
  'Governed links from components to media records.': 'designer.copy.14934e91f423363a',
  Routes: 'designer.copy.2c5b669bcdeb51bf',
  'Browser paths mapped to governed CMS pages.': 'designer.copy.f98ac281734050b9',
  'Choose catalog': 'designer.copy.97ac9e582b5d6d51',
  'Start with the content catalog. A site, template, page, route, and component composition must belong to a catalog boundary.':
    'designer.copy.779784fc36eb9e9f',
  'Manage catalogs': 'designer.copy.e751756eca3f3991',
  'Choose or create site': 'designer.copy.28f33bc46a568a76',
  'Pick the business site: brand portal, documentation site, storefront, or internal workspace.':
    'designer.copy.888e8f884385eeb8',
  'Manage sites': 'designer.copy.ef6b688f0247af5a',
  'Select template': 'designer.copy.8e56330b72291e92',
  'Pick the page structure and its governed dynamic slots before adding page-specific sections.':
    'designer.copy.6e6934059662d8e5',
  'Manage templates': 'designer.copy.cb930c763b0b9428',
  'Create page': 'designer.copy.29a809193ae613aa',
  'Create the page record, connect it with catalog/site/template, and keep lifecycle state visible.':
    'designer.copy.e6c180b632feea40',
  'Manage pages': 'designer.copy.102cd0c01bbdcea6',
  'Arrange sections and slots': 'designer.copy.bb3c3e76cd177ad8',
  'Use any allowed template slot to arrange hero, body, gallery, call-to-action, or documentation sections.':
    'designer.copy.e3d727d3089c8dca',
  'Manage slots': 'designer.copy.2a703283ee4b9da3',
  'Add text/components': 'designer.copy.5434570a72a8145f',
  'Create reusable components for titles, rich text, cards, banners, documentation blocks, and dashboard widgets.':
    'designer.copy.97ae7265bd5ec9f1',
  'Manage components': 'designer.copy.2a49994007509daa',
  'Associate media': 'designer.copy.87ed88d550924900',
  'Select governed media records or upload new assets through nMedia before linking them to components.':
    'designer.copy.1de8aab518000e05',
  'Open media': 'designer.copy.de81e912dbeb435b',
  'Publish route intent': 'designer.copy.69f0a2ca070e1252',
  'Map clean browser routes and navigation nodes after the page structure is ready.':
    'designer.copy.a40d6ab98edcc9d9',
  'Manage routes': 'designer.copy.a77172d32a69c57a',
  'Content in {locale} is marked ready. Editing it requires another review.':
    'designer.copy.2bcddf74bd6bc2fe',
  'Review the content in {locale}, then mark it ready before submitting for publication.':
    'designer.copy.fbf9451f4fbb38b9',
  'Retire content': 'designer.copy.577b4bffe68c9264',
  'Record kind': 'designer.copy.5f6934824c3e9323',
  'Record code': 'designer.copy.23b720ffa7c23c7a',
  Catalog: 'designer.copy.3877d14889a9909b',
  Site: 'designer.copy.fa7955814e32aed3',
  Enterprise: 'designer.copy.3fbe5ed156f14993',
  'Review retirement': 'designer.copy.5580a46b38ab0651',
  'Review content retirement': 'designer.copy.7d1e79ce3431cde6',
  'Confirm retirement': 'designer.copy.b0550ce6f88daa24',
  'Close review': 'designer.copy.337f911f9b4aad88',
  'I reviewed this record, scope and consequence': 'designer.copy.53d7b57e06411a49',
  'I inspected the current CMS record after this outcome':
    'designer.copy.dbd36d5d3e8a181a',
  'The outcome is uncertain. Inspect the current record through its CMS owner before another submission. This command will not be replayed.':
    'designer.copy.179316ae5337fdeb',
  'Retirement saved as an inactive version. Publication remains a separate governed action.':
    'designer.copy.d750ba14f370db33',
  'Authority or scope changed. Close this review and review the current selection again.':
    'designer.copy.0fe138f9c7e15856',
  'History is retained. This does not remove references, delete Media assets or deploy a publication.':
    'designer.copy.c0f56c6d23a00fd7',
  'Section placement': 'designer.copy.0d7f3ffd670ef609',
  'Retires only this placement, not its target component. Page placements retain their Site; nested component placements belong to the shared Catalog.':
    'designer.copy.c3c78ecf27ca9072',
  'Shared component': 'designer.copy.bfa14c41bd3b2b4d',
  'Retires this component in the selected enterprise and Catalog. It may be reused by multiple Sites in that Catalog; their references are not removed.':
    'designer.copy.f736213e9bcab993',
  'Media association': 'designer.copy.3899bbbefacae23d',
  'Retires only this component-to-Media association. The Media asset and component remain; the association may be shared across Sites in this Catalog.':
    'designer.copy.e76b106f06c141cf',
};
export function useContentDesignerCopy() {
  const localization = useAxisLocalization();
  const text = (
    source: string,
    parameters: Parameters<AxisLocalizationState['format']>[2] = {},
  ): string => {
    const key = keys[source];
    return key ? localization.format('cms.' + key, source, parameters) : source;
  };
  return { ...localization, text };
}
