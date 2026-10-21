import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Content is edited in Pages CMS and compiled at build time by Astro.
// Unpublished entries stay in GitHub/CMS but do not generate public pages.
const editorialSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  publishedAt: z.union([z.string(), z.date()]).optional().nullable(),
  published: z.boolean().default(false),
  navigationTitle: z.string().optional(),
  legacyPath: z.string().optional(),
  primaryPath: z.enum(['blog', 'articles', 'meals', 'recipes', 'list']).optional(),
});

const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '**/*.md' }),
  schema: editorialSchema,
});

const recipes = defineCollection({
  loader: glob({ base: './src/content/recipes', pattern: '**/*.md' }),
  schema: editorialSchema,
});

// The original HTML cards remain archived in src/data/archive-lists.
const funListEntry = z.discriminatedUnion('_block', [
  z.object({
    _block: z.literal('person'),
    id: z.string(),
    name: z.string(),
    role: z.string().optional(),
    note: z.string().optional(),
    url: z.string().optional(),
  }),
  z.object({
    _block: z.literal('joy'),
    id: z.string(),
    text: z.string(),
    url: z.string().optional(),
  }),
  z.object({
    _block: z.literal('song'),
    id: z.string(),
    artist: z.string(),
    track: z.string(),
    url: z.string().optional(),
  }),
]);

const archivePageFields = z.object({
  title: z.string(),
  navigationTitle: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  legacyPath: z.string().optional(),
  published: z.boolean().default(false),
});

const funLists = defineCollection({
  loader: glob({ base: './src/content/fun-lists', pattern: '**/*.md' }),
  schema: archivePageFields.extend({
    listType: z.enum(['people', 'joy', 'songs']),
    items: z.array(funListEntry).default([]),
  }),
});

const eventSeries = defineCollection({
  loader: glob({ base: './src/content/event-series', pattern: '**/*.md' }),
  schema: archivePageFields.extend({
    slug: z.string(),
    labels: z.object({ title: z.string(), date: z.string() }),
    detailDefinitions: z.array(z.object({ key: z.string(), label: z.string() })).default([]),
  }),
});

const events = defineCollection({
  loader: glob({ base: './src/content/events', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    series: z.string(),
    date: z.string().optional(),
    note: z.string().optional(),
    details: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
    sourceOrder: z.number().int(),
    published: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    year: z.string().optional(),
    type: z.string().optional(),
    client: z.string().optional(),
    work: z.string().optional(),
    url: z.string().optional(),
    sourceOrder: z.number().int(),
    published: z.boolean().default(false),
  }),
});

export const collections = { articles, recipes, funLists, eventSeries, events, projects };
