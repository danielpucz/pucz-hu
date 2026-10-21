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

const lists = defineCollection({
  loader: glob({ base: './src/content/lists', pattern: '**/*.md' }),
  schema: editorialSchema,
});

export const collections = { articles, recipes, lists };
