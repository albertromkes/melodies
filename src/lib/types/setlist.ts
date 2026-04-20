export interface SetlistItem {
  id: string;
  songId: string;
  transposeSemitones: number;
  createdAt: number;
}

export interface ActiveSetlist {
  id: string;
  name: string;
  items: SetlistItem[];
  updatedAt: number;
}

export interface SetlistNavigationContext {
  type: 'setlist';
  itemId: string;
}

export interface CategoryNavigationContext {
  type: 'category';
}

export type NavigationContext = CategoryNavigationContext | SetlistNavigationContext;
