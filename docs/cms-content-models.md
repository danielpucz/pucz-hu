# Pucz.hu — Structured CMS architecture (content-only stage)

Five top-level Pages CMS sections: **Articles**, **Recipes**, **Fun Lists**, **Events**, **Projects**.

## Immutable frontend boundary
This migration does not introduce or publish new list/event/project routes. The V5.6 frontend, CSS, homepage, article layouts and fortune-cookie interactions are unchanged. All structured archive records start as unpublished.

## Fun Lists
Three documents in `src/content/fun-lists/`, retaining their original page-level text, original order and historical slugs:
- `incredible-people` — person blocks with `name`, `role`, `note`, `url`
- `things-that-sparks-joy` — joyful observations with text and optional link
- `list-of-songs-that-doesnt-end-but-fade-out` — song blocks with artist, track and original external link

The list editor's repeatable item blocks have stable IDs. Reordering list items does not change their identity. **Future page route: `/list/[slug]/`**, not `/fun-lists/`. The legacy `/list/` slugs are intentionally unchanged.

## Events (editable field labels per event series)
There are two editors under Events:
- **Event series & labels:** an individual series defines `labels.title`, `labels.date` and an unlimited ordered list of `detailDefinitions` (each `key` + human-readable `label`).
- **Event records:** each entry references its series and stores an intrinsic `title`, `date`, `note`, `sourceOrder`, and arbitrary `details: [{key,value}]`.

For *Dinner & Movie Nights*, the title label is **Film**, and the series details are **Food** and **Nr. of guests**. A future lecture series could instead define **Speaker**, **Venue**, **Audience**. Editing a series label requires no changes to its individual event entries.

**Important Pages CMS limitation:** its actual editing-form control captions are static, not calculated from another collection. Labels are dynamic in the content model and will drive the eventual rendered page, but the per-event editing controls themselves remain generic (“Title”, “Stable field key”, “Value”). If fully dynamic editing-form labels become necessary, that would require a custom editor.

The first event series preserves the original archive address `/list/dinner-and-movie-night/`. New series may use `/events/<slug>/` once designed; original addresses take priority.

## Projects
`src/content/projects/` contains one Markdown record per real project with original `title`, `summary`, `year`, `type`, `client`, `work`, optional `url`, original `sourceOrder`, and `published:false`.

`src/data/project-archive.md` is the **Every Project Ever** collection-page copy and metadata, editable in the same Projects group. Its original address remains `/list/every-project-ever/`.

Projects are independent from both Fun Lists and Events. A dense archive and a future selective portfolio can consume the same records.

## Content integrity
Every value is extracted from `src/data/archive-lists/*.html`, the original preserved Webflow card data. These original HTML assets stay in the repository for reference. The old `src/content/lists/*.md` item snapshots are replaced only after the structured import is verified.

Content schema is in `src/content.config.ts`. Pages CMS sidebar and field definitions live in `.pages.yml`. Never introduce design-level toggles (card colors, animations, fonts) into these schemas without discussing a concrete reuse requirement.

## Before publication
- Confirm item counts: people 45, joy 134, songs 41, event records 7, projects 225.
- Review representative entries, all links, original order, and text against the old Webflow HTML.
- Design each frontend template separately, then add public routes and footer links only when the design is approved.
