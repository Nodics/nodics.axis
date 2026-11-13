# Documentation Routing

## Article Images

Validated article images open in a full-screen, keyboard-accessible viewer at
Fit size for an overview. Large architecture images scroll inside the viewer rather than
widening the article. Fit and bounded 25–200% zoom controls support narrow
screens; Escape or Close dismisses the viewer and restores trigger focus.
The full title wraps beside a top-right Close button; Fit, zoom and percentage
occupy a separate bounded row. Each opening resets to Fit; selecting zoom uses
the image's native width. Changing the article route, identity or image source
discards the open viewer.
Canonical image blocks declare `mediaCode`. Axis reuses the existing bounded
Media delivery client on its authenticated, registered WCMS Online connection;
credentials never go to a content-supplied URL. Missing or denied Media does not
fall back to an embedded source. Object URLs are revoked and requests cancelled
when the article, enterprise, session or connection changes. The source allowlist
remains only for older installed content during upgrade. Enlargement adds no
publication operation or separate storage authority.

`test/cms/renderers/components/documentation/DocumentationArticleRenderer.test.tsx`
covers native sizing, contained scrolling, fit/zoom, keyboard/focus behavior,
unsafe-source rejection and stale-viewer disposal. These component tests do not
replace live desktop/mobile visual acceptance.

## Online reader

Guide landing views show the topic directory. An exact article view shows the
delivered article and its own navigation, without repeating the full directory
or another page heading above it. Source lifecycle, access, maturity and visual
requirements remain in the collapsed **Article details** disclosure. Source
metadata does not establish the live publication state. The route and article
renderer tests protect the single article heading and disclosure behavior.
Below the theme's large breakpoint, article navigation starts closed behind
**Browse topics** and closes when a different topic is selected. Desktop retains
its independent open/closed preference and resizable rail. The template tests
cover reading first, opening the directory, topic selection and desktop resizing.
The article page opts into `readerLayout`; shared authoring/embedded consumers
retain visible editing navigation and their existing controls.

The selected WCMS Online connection supplies the authenticated documentation guide
catalogue. Render its delivered navigation, project choices, channel headings and
topic links. A guide query selects a view within that catalogue. An article URL
must match an exact delivered topic. Use its Site, locale, channel and access
mode for delivery. Only authenticated topics send an employee bearer token.
Navigation lists, adjacent articles, related topics and inline article links in
the reader use the same published topic set.

An empty guide, absent article or failed catalogue read offers the publication
center only to employees with an available BackOffice management grant. Other
readers are directed to their documentation administrator. A lookup failure
offers an explicit retry. The reader never searches Staged metadata, selects
a broader source prefix, or substitutes a different Site.

## Publication center

An authorized BackOffice `/docs` entry exposes publication management. Its
source registry and bounded Staged product discovery support installation and
publication using the existing owner APIs. Source detail links select the
managed source with `/docs?manage=<source id>`. The center pages through five
sources at a time. OpenAPI references use their separately declared live
contracts. A READY status or a setup source does not grant a CMS article link.

Technical Overview passes its shared, owner-configured status queue into
`createDocumentationPublicationClient`. Only `getStatus(signal)` enters that
queue; cancellation reaches the HTTP read and retired reads cannot become fresh
evidence. Installation, publication and repair commands retain their direct,
single-attempt transport. Other authorized publication-center consumers may use
the existing unqueued status transport. Preserve that distinction in typed client
extensions; the client and Technical Overview focused tests protect it.

Customize reader navigation, article labels and channel membership through the
owner's published Online records. Project renderers may wrap the presentation
while retaining the exact topic binding and access checks. Run the focused
documentation route and CMS article/navigation renderer tests, then typecheck.

Publication readiness retains validated exact Media dependency evidence through the client parser. The shared readiness panel groups affected assets into one checklist; it does not replace individual owner inspection or approval. Media-pending guidance names asset approval as the next action.

Guide landing pages filter only the delivered, authorized topic catalogue by topic and section label. Accessible result counts and clear-search recovery accompany responsive topic links; searching never queries or infers unpublished topics.

The article navigation search matches the complete inert `searchText` already
delivered by the owning frozen Online publication, alongside topic labels and
audiences. The 500-character display-label bound does not truncate that index.
Normalized search text is prepared once with the parsed component metadata, not
rebuilt for every keystroke; metadata is never rendered as HTML. The existing
500-item limit, exact published-topic route filter and audience selection remain
in force. Missing/non-string indexes add no inferred content, and no query reads
Staged, latest records or another source. Backend CMS publication owns which
current article text is indexed; renderer customization must preserve that
source boundary. The navigation renderer regression searches a phrase beyond
32,000 characters and keeps an unadmitted matching topic hidden.

Candidate publication status describes the selected release only. An unimported
candidate is presented neutrally, without claiming that an earlier Online guide
is absent or awaiting review. Reader access still comes from the independently
delivered Online catalogue. Only actual review states present approval work; no
status display installs, retries, approves, or broadens access. Source names remain
backend-owned metadata. Summary metrics are text and source/section titles use
level-two headings beneath the page heading, with existing typography preserved.
The route regression covers absent candidates and zero automatic commands; run
`npm run verify` and native desktop/mobile publication-center checks after changes.

On narrow publication-center views, candidate badges precede full wrapping source
labels and descriptions; an odd final summary metric spans the available row.
Source labels remain intact and backend-owned. Check both narrow and desktop
layouts after customizing the existing theme tokens or row-grid presentation.
