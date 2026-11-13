import type {
  ContentDesignerDraftComponent,
  ContentDesignerDraftSection,
} from './api/contentDesignerClient';
/** Retains the owner tree while presenting ordered, accessible parent paths. */
export function contentEntries(
  sections: readonly ContentDesignerDraftSection[],
  depth = 0,
  parent = '',
): readonly {
  section: ContentDesignerDraftSection;
  component: ContentDesignerDraftComponent;
  depth: number;
  parent: string;
}[] {
  return sections.flatMap((section) =>
    section.components.flatMap((component) => [
      { section, component, depth, parent },
      ...contentEntries(component.sections || [], depth + 1, component.code),
    ]),
  );
}
/** Updates one exact identity without flattening its children or unrelated extension content. */
export function updateContentTree(
  sections: readonly ContentDesignerDraftSection[],
  code: string,
  change: (component: ContentDesignerDraftComponent) => ContentDesignerDraftComponent,
): readonly ContentDesignerDraftSection[] {
  return sections.map((section) => ({
    ...section,
    components: section.components.map((component) =>
      component.code === code
        ? change(component)
        : component.sections
          ? {
              ...component,
              sections: updateContentTree(component.sections, code, change),
            }
          : component,
    ),
  }));
}
