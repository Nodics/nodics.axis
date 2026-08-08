# Media Management Workspace

## Purpose

Media Management gives BackOffice users a single place to work with files that
Nodics stores through the framework media lifecycle. A media file can be an
import spreadsheet, a CMS banner image, a product gallery image, a product
thumbnail, a PDF document, or another governed file that a business process
needs to keep and reference.

Axis does not own media storage. The backend `nMedia` module owns media
metadata, folders, formats, sets, references, storage provider selection,
storage-key generation, upload validation, access policy, and content delivery.
Axis only renders the employee workspace that is returned by the BackOffice
navigation contract.

In the Axis UI, the word **Visibility** is used for the backend media access
policy. Visibility answers a business question: "who can safely open this
file?" It does not mean database permission and it does not mean the employee's
BackOffice role. For example, data import and data export files are normally
private, while approved CMS or product assets may become public or signed later.

## Navigation

The left navigation group is **Media Management**. It is published by nMedia
through `backofficeCapabilities.media.navigation`, not hardcoded in Axis. The
current first slice exposes these entries:

- **Media** for uploaded media records.
- **Media Folders** for purpose-based folders such as import sources, data
  export files, CMS assets, product assets, and utility files.
- **Media Sets** for groups of related media variants, such as a product image
  gallery or responsive CMS image set.
- **Media Formats** for reusable formats such as original, thumbnail, mobile,
  desktop, zoom, and import file.
- **Media Usage** for finding which product, CMS, import, or business record is
  referencing a media item.
- **Storage and Delivery** for provider policy, visibility, and delivery
  behavior.

These entries appear only when BackOffice returns them for the authenticated
employee. Axis must not show a duplicate static media menu when the backend does
not authorize it.

## Implemented Axis behavior

The implemented browser route is `/media/*`, but page composition is
owned by the authenticated Axis CMS content catalog route at
`/media`. The catalog maps `axis.page.media-management` to the Axis
page renderer, `axis.template.media-management` to the template renderer, and
`axis.component.media-management-workspace` to the reusable workspace component
renderer. The renderer reads the current browser location and backend-published
navigation to make each section route meaningful:

- `/media` explains the full governed media operations area.
- `/media/items` explains uploaded media records.
- `/media/folders` explains media folder policy.
- `/media/sets` explains logical media sets and variants.
- `/media/formats` explains reusable presentation or processing
  formats.
- `/media/usage` explains media references and usage tracing.
- `/media/storage-delivery` explains provider policy and delivery
  behavior.

The active section shows three beginner-friendly blocks:

1. the backend owner or model that remains authoritative;
2. what the employee workspace can safely show now;
3. the next capability slices that will make the section operational.

The route uses the same employee session, screen-lock, runtime bootstrap,
left-nav, CMS renderer boundary, and authorization gates as the rest of Axis.
Axis must not mount Media Management as a direct operations page that bypasses
the content catalog and renderer registry.

The **Media** section now includes an operational media record workspace. Axis
discovers the `media` schema through the same generated Schema Workbench
contract used by the Business Data workbench, then searches records through the
owning nMedia module connection. The screen shows safe business metadata such as
media code, original filename, folder, format, visibility, lifecycle status,
MIME type, extension, size, checksum, checksum algorithm, and provider. Normal
business detail panels do not expose provider storage keys or backend-resolved
full paths.

The media list is designed to scale beyond the small local-development list.
Business users can narrow media records by:

- **Source type**, which is the business purpose published by nMedia context
  metadata or, for older backend deployments, derived from backend folder
  metadata. Examples include data imports, data exports, product media, content
  media, business documents, or utility media;
- **Visibility**, such as private, public, or future signed delivery;
- **Status**, such as ready, consumed, retired, or failed;
- **Format**, such as import file, original, thumbnail, desktop, mobile, or a
  partner-defined format;
- free-text search across safe metadata such as code, filename, folder, format,
  status, MIME type, and extension.

Axis sends search text, queryable source-type/facet selections, page number,
page size, and the schema default sort to nMedia through the generated
Schema Workbench record contract. The table count comes from the backend
`totalCount`, not from a browser-side full-record load. Axis only renders
filters when the active schema advertises the corresponding safe filter field
and operator. Source type is mapped to backend folder codes from `/contexts`,
then passed as a `folderCode` filter when the media schema allows it. This keeps
large media libraries scalable while preserving nMedia as the only authority for
record retrieval, filtering, storage, and delivery. Axis must not create a
browser-only media index or read storage folders directly.

The same section also supports governed upload. The employee selects an upload
purpose, such as data imports, content media, product media, or utility media.
Axis first asks nMedia for backend-owned media source contexts through
`/contexts`. The context response tells Axis which source types are eligible
for manual upload, which compatibility aliases identify the same source type,
which folders and formats they use, and which route template can be shown to
the employee. Axis treats backend `sourceType`, `code`, and `aliases` as the
authority for source-type mapping. Regex-style browser guessing is only an
older-backend fallback when `/contexts` is unavailable. If an older backend does
not publish contexts, Axis falls back to the older `/storage/policy` folder
probes. Data exports are not shown as a manual-upload source type by default
because export files are generated by the Exports workspace. When the employee
uploads a file, Axis posts multipart data to the nMedia `/storage/upload`
endpoint. nMedia validates the folder, file type, size, checksum, provider, and
storage key. Axis receives the returned media code and refreshes the media list.
Axis does not choose the filesystem folder, does not generate the storage key,
and does not persist
media metadata directly.

The upload UI is implemented as the reusable `MediaUploadWizard` component under
Media Management operations. The wizard keeps the interaction layered:

1. select a backend-published source type;
2. show the resolved nMedia folder, format, route template, extension policy,
   MIME policy, and max-size policy;
3. show the backend-published target module and schema when a source type
   requires target context;
4. keep file selection disabled until a valid source type, policy, and required
   target context are known;
5. let the employee choose a local file;
6. show a browser-only review; and
7. submit the file to nMedia and call the parent refresh callback after a media
   code is returned.

The browser-only review is intentionally advisory. Axis may show local metadata
that helps an employee catch obvious mistakes before upload, including file
size, MIME type, extension, image dimensions, a thumbnail for image files, CSV
headers and row count, JSON top-level shape, and a small text preview. These
signals are not business validation. nMedia still validates upload policy, and
the owning module, such as nImport, Product, CMS, or a partner module, still
validates business content after it receives the media code.

Media detail includes three operational checks:

1. **Delivery preview** uses the nMedia content endpoint only when the media is
   public and in a deliverable lifecycle state.
2. **Usage summary** checks nMedia `mediaReference` records for the selected
   media code and links to `/media/usage?mediaCode=...` so the
   employee can review where the file is used.
3. **Lifecycle actions** expose retire or restore actions only when the
   generated media schema allows update for the employee session. Axis blocks
   retire when active usage references are visible, because a business user
   should review dependencies before making a file inactive.

The **Media Folders** section uses the same backend-owned pattern. Axis
discovers the `mediaFolder` schema from nMedia, searches folder records through
the nMedia module connection, and presents folder policy in business-friendly
language. It shows the folder code, name, description, storage prefix,
visibility/access mode, allowed extensions, allowed MIME types, maximum file
size, and retention days. This helps administrators understand where import
files, data export files, CMS assets, product assets, and utility documents are
routed without making Axis own storage rules.

When an employee selects a folder, Axis shows a policy-impact warning. The
warning explains that changes to the folder policy affect future upload
validation, default visibility, retention, and provider-relative routing. It
also repeats the boundary: provider secrets, raw paths, and alternate
browser-side upload rules must not be added to Axis.

Folder policy editing is intentionally nMedia-owned. If the discovered
`mediaFolder` schema does not advertise update permission for the employee
session, Axis shows the policy as read-only and directs administrators back to
backend-approved media configuration. When update is advertised, Axis exposes a
small policy action panel for visibility, maximum upload size, and retention
days. The panel submits only those fields through the nMedia folder policy
operation, so future upload validation uses the same backend authority. Axis
does not edit storage prefixes, resolved paths, provider secrets, provider
configuration, or browser-side policy rules. nMedia remains responsible for
validation, routing, provider behavior, tenant policy, and persistence.

Media Management may link to Schema Workbench for generic `mediaFolder` record
inspection, search, audit, or seed-data workflows instead of duplicating the
generic record form. The handoff URL is
`/schema-workbench?module=media&schema=mediaFolder`; when the backend advertises
create permission, Axis may also link to
`/schema-workbench?module=media&schema=mediaFolder&mode=create`. Those links do
not replace the nMedia policy operation for live upload-policy changes unless a
deployment explicitly synchronizes generated records into effective
configuration through nMedia-owned governance.

The **Media Formats** section is also operational. Axis discovers the
`mediaFormat` schema from nMedia and shows reusable presentation or processing
formats such as original, thumbnail, desktop, mobile, zoom, or import file. The
screen presents format code, name, purpose, family, lifecycle status,
description, width, height, and a combined dimensions view. Formats help backend
and frontend teams use consistent business vocabulary for media variants without
making Axis transform images or own storefront rendering behavior.

Format detail also asks nMedia for `/contexts` and shows where the selected
format is advertised. This answers questions such as "which folders/source
types can use desktop?" without hardcoding source-type behavior in Axis. A
format can be default, allowed, both, or unused by the current backend context
configuration. The live upload authority remains nMedia format policy; Schema
Workbench records are useful for inspection and audit, not a second browser
policy authority.

The **Media Sets** section now lists and searches logical media groups from the
`mediaSet` schema. A media set represents one logical asset group, such as a
product gallery, responsive CMS image group, documentation asset group, or mixed
file bundle. Axis shows the set code, name, description, media type, business
purpose, and lifecycle status.

When an employee selects a media set, Axis also loads the set composition from
the nMedia-owned `mediaSetEntry` schema. The detail panel shows each linked
variant with its media code, optional format code, variant role, locale,
channel, device, breakpoint, fallback entry, dimensions, position, primary
flag, and lifecycle status. This keeps the business view clear: the set
describes the logical group, each entry describes a specific reusable variant,
and each variant still points to an owned media record. Axis does not duplicate
variant ownership or infer image behavior; it asks nMedia for the set entries
using a backend filter on the selected set code.

Set-entry actions call nMedia-owned endpoints under
`/sets/{mediaSetCode}/entries`. Axis can reorder entries, mark one entry as
primary, remove an entry from the set, and hand off full create/edit record
workflows to Schema Workbench. These actions intentionally do not update
Product, CMS, import, export, or partner business records. Those modules decide
where a media set is used; nMedia manages the reusable media grouping and
variant metadata.

The **Media Usage** section now searches the nMedia `mediaReference` schema. A
media reference answers the business question, "where is this file or media set
being used?" without moving ownership away from the source module. For example,
a product record may reference a product gallery, a CMS component may reference
a banner image, or an import process may reference the uploaded source file.
Axis shows the owner module, owner schema, owner record code, relation type,
media code, media set code, position, and lifecycle status.

When the route receives a `mediaCode` query parameter, Axis filters the usage
workspace to that media item. This gives Media detail a safe deep link into
usage without inventing a second search endpoint. The filter still runs through
nMedia's generated schema/workbench contract.

Usage can also be filtered by owner module, owner schema, owner record, relation
type, and status when the backend schema advertises those fields as queryable.
The owner-record filter is useful when a business user already knows the
Product, CMS, import, export, or partner record that may be holding a reference.

This is not analytics usage and it is not a duplicate product or CMS editor.
nMedia owns only the media reference trace. The product, CMS, import, or partner
module continues to own the business record and its validation rules. This
separation lets administrators safely answer cleanup questions such as "can this
file be retired?" before removing or retiring media that may still be attached
to another business object.

Media detail also includes an **Import/export linkage** panel. The panel is
read-only. It asks nImport for run history with the selected `mediaCode` and
shows any matching import runs, counts, status, data type, and modules. It also
summarizes import/export `mediaReference` traces when they exist. Axis does not
edit the import run, export result, Product record, CMS record, or partner
record from this panel; it links the employee to the owning Import/Export
workspace for deeper work. Export status remains owned by nExport and should be
surfaced only through nExport-published contracts.

The **Storage and Delivery** section now provides a read-only policy inspection
view. Axis first calls the nMedia `/contexts` API and derives safe folder
policy rows from the backend-owned context projection, including backend-owned
source type aliases. For older backend deployments that do not yet publish
contexts, Axis falls back to the
`/storage/policy` API with small safe probe descriptors for known folder
purposes. The result shows folder-level upload rules: folder code, business
label, visibility, allowed extensions, allowed MIME types, maximum file size,
and checksum algorithm.

The same screen also calls `/storage/providers/summary` when the backend
publishes it. That summary is deliberately safe: active provider code, provider
type, enabled/active flags, provider health status, key strategy name, and
delivery mode. It does not expose absolute filesystem paths, bucket names,
certificates, credentials, object keys, or signed URL secrets. Axis does not
call the storage-location endpoint, does not generate storage keys, and does
not offer provider credential controls. nMedia still decides whether a folder
uses local storage, NAS, S3, Azure, Google Cloud Storage, FTP, or a partner
provider.

For a beginner developer, this means:

1. Axis asks nMedia, "which media source contexts and folder policies are safe
   for this employee workspace?"
2. nMedia returns safe context and upload-policy metadata without provider
   secrets or raw paths.
3. Axis optionally asks nMedia for the safe storage provider summary and shows
   only provider code, type, health, delivery, and key-strategy metadata.
4. Axis displays only the safe context, policy, and provider summary metadata.
5. When a real upload happens, Axis sends the selected file to nMedia.
6. nMedia resolves provider and storage location, creates the media record, and
   returns the media code.
7. When a file is opened, Axis uses the nMedia content delivery endpoint with
   the media code instead of a raw file path.

For example, an import CSV is uploaded under the `importSources` purpose. A
generated export CSV or ZIP is stored under the `exportFiles` purpose. A CMS
banner image is uploaded under the `cmsAssets` purpose. A product gallery image
is uploaded under the `productAssets` purpose. They may all use the same local
provider in local development, but production can route them differently through
nMedia configuration without changing Axis.

For single-schema data operations, nMedia uses separate provider-relative data
paths for imports and exports:

- import files:
  `data/import/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;
- generated export files:
  `data/export/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.

Axis may display the business purpose and media code, but it must not assemble
or persist these paths itself. Multi-schema aggregated exports will need their
own backend-owned path contract later.

For business media operations, nMedia uses separate provider-relative media
paths by purpose:

- product media:
  `media/product/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;
- content media:
  `media/content/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;
- utility media:
  `media/utility/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.

Axis can present these as Product media, Content media, and Utility media
filters, but the backend folder configuration and key strategy remain the only
authority for the actual storage key.

Axis deliberately does not display backend-resolved full paths. If a file can be
opened inline, the UI uses the nMedia content endpoint, not a filesystem path.
If a file is downloaded, Axis uses the nMedia download endpoint
`/download/{mediaCode}` so backend content-disposition and authorization policy
remain in charge. This keeps local storage, NAS, cloud storage, and future
signed URL providers behind the backend media contract.

The **Media** record detail view follows the same rule. When a selected media
record is a public image in a deliverable lifecycle state, Axis can render a
small preview by calling the nMedia content delivery URL. For other file types,
Axis offers an open action through `/content/{mediaCode}` and a download action
through `/download/{mediaCode}` only when the backend record is public and in a
deliverable state. Private and signed files are not opened directly from the
browser until nMedia exposes the proper authorized or signed delivery contract.
Axis must never convert `fullPath`, `relativePath`, bucket keys, or storage keys
into browser links.

Provider diagnostics remain a separate capability slice. They must be
implemented against nMedia-owned APIs instead of frontend path logic.

## Backend ownership

nMedia is the source of truth for:

- media records and their original filename, stored filename, MIME type,
  extension, size, checksum, provider code, folder code, format code, storage
  key, relative path, absolute path policy, access URL, visibility/access mode,
  and status;
- media folders and their allowed file types, storage prefix, visibility/access
  policy, and retention policy;
- media formats and named variants;
- media sets and set entries;
- media references from CMS, product, import, or other backend-owned records;
- local, NAS, S3, Azure Blob, Google Cloud Storage, or partner provider
  configuration;
- public, private, or future signed delivery policy.

Axis uses only backend contracts. It does not calculate storage paths, expose
absolute paths, infer visibility/access policy, or decide whether a media file is
reusable.

## Customize and extend safely

Partners can customize Media Management safely by changing nMedia configuration
or extending nMedia services:

- add a new storage provider under nMedia and register it in module
  configuration;
- override the storage-key strategy so files route to a partner-specific folder
  layout;
- add a new media folder for a business purpose, such as KYC documents,
  generated export files, or logistics proof-of-delivery images;
- add new formats for brand or storefront image requirements;
- extend backend APIs for governed media search, usage inspection, preview,
  cleanup, or provider diagnostics;
- add Axis renderers that consume those APIs after BackOffice publishes the
  corresponding navigation or operation contract.

Partners should not customize Axis by adding hardcoded menus, direct storage
calls, direct database reads, raw filesystem URLs, or assumptions about local
development paths. Those would create duplicate authority paths and would break
cloud, NAS, or multi-provider deployments.

### Customizing storage policy safely

Storage customization belongs to nMedia. A partner or project can configure the
local provider for development, a mounted NAS path for enterprise deployments,
or a cloud provider for production. The important contract is that Axis never
needs to know the storage path. Axis only needs the returned media code and the
safe delivery URL or content endpoint.

The safe extension sequence is:

1. Add or override nMedia provider configuration.
2. Add or override a storage-key strategy service if the folder layout must
   change.
3. Add or override folder configuration for business purposes such as import
   files, product images, CMS banners, KYC documents, or process evidence.
4. Expose only safe inspection metadata from nMedia when the BackOffice needs to
   display it.
5. Keep provider secrets and absolute paths out of Axis, content catalog data,
   documentation content packs, and browser-visible responses.

If a partner wants files under a structure like
`{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`, that
structure must be produced by a backend nMedia key strategy service. Axis can
display the business folder and media code, but it must not assemble that path
itself.

### Customizing upload behavior safely

Upload behavior is configured by nMedia folders, formats, providers, and key
strategies. Axis should not be customized with file-type rules or storage
folders. A partner can extend upload behavior safely by adding backend
configuration such as:

- a new folder for a purpose like KYC documents, warranty attachments, shipment
  proof images, data export files, or learning resources;
- a new format such as storefront-thumbnail, mobile-banner, zoom-image, or
  compliance-document;
- a new provider such as NAS, S3, Azure Blob, Google Cloud Storage, FTP, or a
  partner document store;
- a new key strategy when the physical or provider-side path needs a different
  structure;
- a visibility/access policy that marks which media can be public, private,
  signed, or internal-only.

After nMedia publishes the new context or folder policy, Axis can show it
automatically in the upload purpose selector. If the partner needs a richer
workflow, such as a product gallery uploader or CMS banner picker, that workflow
should still call nMedia upload first and then create the product or CMS
reference through the owning module contract.

The smallest safe Axis customization is to compose `MediaUploadWizard` inside a
project-owned page or workflow and respond to its returned media code. A customer
page may change surrounding copy, add a next-step panel, or route the media code
to an owning Product, CMS, Import, or partner API. It must not copy the wizard
into a second upload implementation, hardcode folder-to-source mappings, invent
file policy, generate media records locally, infer storage paths, or bypass
nMedia upload.

When customizing the wizard, keep tests focused on the boundary:

- generated export contexts remain excluded from manual upload unless nMedia
  explicitly publishes a different contract;
- file selection is blocked until backend policy is known;
- source types marked `targetRequired` by nMedia are blocked until the backend
  publishes the target module and schema Axis should send with upload;
- unsupported extensions, MIME types, and oversized files are rejected locally
  only as early UX warnings;
- successful upload calls nMedia with the backend-derived folder, format,
  module, and schema context;
- backend upload errors are shown as safe messages without exposing service
  internals; and
- local previews for images, CSV, JSON, or text remain advisory and never
  replace backend validation.

## Verification

When adding a Media Management feature, verify:

1. nMedia publishes the navigation or API contract.
2. BackOffice filters the entry by permissions.
3. Axis renders the route only when the authenticated bootstrap contains the
   entry and the CMS content catalog resolves the `/media` page.
4. Media record, folder, format, and set search use the nMedia-owned
   schema/workbench API and never a direct database or storage read.
5. Storage policy inspection uses nMedia `/contexts` first, including
   backend-owned `sourceType`, `code`, and `aliases`, and falls back to
   `/storage/policy` only for older backend deployments. It does not call
   storage-location or upload APIs unless that workflow is explicitly being
   executed.
6. Preview and download actions use nMedia delivery URLs only, never raw storage
   paths.
7. Private and signed media do not show direct browser delivery actions until
   nMedia exposes and authorizes that delivery contract.
8. Upload posts to nMedia `/storage/upload`; Axis does not create media records
   directly.
9. Usage deep links filter the nMedia `mediaReference` schema through the
   generated workbench contract.
10. Renderer coverage includes `axis.page.media-management`,
    `axis.template.media-management`, and
    `axis.component.media-management-workspace`; future media presentation
    changes must extend CMS properties or renderer contracts rather than
    adding another direct operations page.
11. Retire and restore actions use the nMedia media schema update contract and
    are hidden or disabled when update is not authorized.
12. Large media lists provide source-type, visibility, status, format, free-text
    search, and pagination without creating a browser-side media authority.
13. Import/export linkage remains read-only. Axis may query nImport history by
    media code and show import/export media references, but it must not mutate
    import runs, export results, Product records, CMS records, or partner owner
    records through Media Management.
14. Storage provider summaries show only safe operator metadata: active
    provider code, provider type, enabled/active state, health, key strategy,
    and delivery mode. They must not show credentials, certificates, buckets,
    storage keys, signed URL secrets, absolute paths, or backend-resolved full
    paths.
15. Generated export files are downloaded through nMedia media-code delivery,
    not through export-specific browser paths or duplicate binary routes.
16. Upload, search, reference, lifecycle, or delivery behavior stays
    backend-owned.
17. Positive, negative, boundary, permission, contract, integration, and
    regression tests cover the new behavior.
