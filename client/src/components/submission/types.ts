export type IssueCategory =
  | 'pothole'
  | 'garbage_dumping'
  | 'broken_streetlight'
  | 'overflowing_bin'
  | 'construction_debris'
  | 'unsegregated_waste'
  | 'other';

export interface CategoryOption {
  id: IssueCategory;
  label: string;
  description: string;
  iconName: 'pothole' | 'trash' | 'light' | 'bin' | 'construction' | 'recycle' | 'alert';
}

export type GpsStatus = 'idle' | 'locating' | 'success' | 'denied' | 'unavailable';

export interface ComplaintFormData {
  category: IssueCategory | '';
  customCategory: string;
  description: string;
  observedDate: string;
  locationArea: string;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsStatus: GpsStatus;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  declarationConfirmed: boolean;
}

export interface FormErrors {
  category?: string;
  customCategory?: string;
  description?: string;
  observedDate?: string;
  locationArea?: string;
  addressText?: string;
  image?: string;
  declaration?: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'pothole',
    label: 'Pothole & Road Damage',
    description: 'Cratered pavement, asphalt erosion, open road trenches',
    iconName: 'pothole',
  },
  {
    id: 'garbage_dumping',
    label: 'Garbage Dumping',
    description: 'Unauthorized roadside waste pile, blackspot dumping',
    iconName: 'trash',
  },
  {
    id: 'broken_streetlight',
    label: 'Broken Streetlight',
    description: 'Non-functioning street pole lamp, flickering or damaged wiring',
    iconName: 'light',
  },
  {
    id: 'overflowing_bin',
    label: 'Overflowing Public Bin',
    description: 'Full municipal waste receptacle spilling onto footpath',
    iconName: 'bin',
  },
  {
    id: 'construction_debris',
    label: 'Construction Debris',
    description: 'Unattended sand, bricks, concrete chunks blocking public path',
    iconName: 'construction',
  },
  {
    id: 'unsegregated_waste',
    label: 'Unsegregated Waste Pile',
    description: 'Mixed wet, dry, and bio waste dumped without segregation',
    iconName: 'recycle',
  },
  {
    id: 'other',
    label: 'Other Civic Grievance',
    description: 'Public utility or civic issue not covered in the categories above',
    iconName: 'alert',
  },
];

export const MYSURU_LOCALITIES = [
  'Kuvempunagar',
  'Gokulam',
  'Jayalakshmipuram',
  'Vijayanagar 1st Stage',
  'Vijayanagar 2nd Stage',
  'Saraswathipuram',
  'Hebbal Industrial Area',
  'Vontikoppal',
  'Devaraja Mohalla',
  'Nazarbad',
  'Chamarajapuram',
  'Yadavagiri',
  'Siddhartha Layout',
  'J.P. Nagar',
  'Ramakrishnanagar',
  'Dattagalli',
  'Bannimantap',
  'Alanahalli',
  'K.G. Koppal',
  'Agrahara',
];
