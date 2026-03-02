import type { z } from "zod";

import type { ButtonInputSchema, CardUpsertSchema, TagInputSchema } from "@/lib/validation";

export type TagInput = z.infer<typeof TagInputSchema>;
export type ButtonInput = z.infer<typeof ButtonInputSchema>;
export type CardFormInput = z.infer<typeof CardUpsertSchema>;

export interface CardListItem {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  viewsCount: number;
  uniqueViewsCount: number;
  createdAt: string;
}

export interface DailyViewsPoint {
  date: string;
  views: number;
  uniqueViews: number;
}

export interface DeviceSplit {
  mobile: number;
  desktop: number;
}
