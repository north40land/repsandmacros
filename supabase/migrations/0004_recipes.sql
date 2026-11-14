-- Phase 3, part 2: recipes. A recipe is a food whose per-serving numbers come from
-- its ingredients. The ingredient list is kept here so the recipe can be edited later.
--   recipe = { servings, items: [{ name, brand, quantity, unit, calories, protein, carbs, fat, fiber }] }
alter table public.foods add column if not exists recipe jsonb;
