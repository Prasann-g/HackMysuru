export type IssueCategory =
  | 'garbage_dumping'
  | 'overflowing_bin'
  | 'pothole'
  | 'broken_streetlight'
  | 'unsegregated_waste'
  | 'construction_debris'
  | 'other';

export interface CategoryOption {
  id: IssueCategory;
  label: string;
  description: string;
}

export interface ComplaintFormData {
  category: IssueCategory | '';
  customCategory: string;
  description: string;
  observedDate: string;
  locationSearch: string;
  addressText: string;
  imageFile: File | null;
  imagePreviewUrl: string | null;
}

export interface FormErrors {
  category?: string;
  customCategory?: string;
  description?: string;
  observedDate?: string;
  locationSearch?: string;
  addressText?: string;
  image?: string;
}
