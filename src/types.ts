export interface Donation {
  id: string;
  name: string;
  amount: number;
  message: string;
  timestamp: string;
}

export interface ImpactStats {
  yearSince: number;
  mealsPerDay: number;
  childrenAssisted: number;
  country: string;
}

export interface DonationResponse {
  success: boolean;
  donations: Donation[];
  totals: ImpactStats;
}

export interface ImpactItem {
  id: string;
  name: string;
  cost: number;
  impactText: string;
  icon: string;
  unit: string;
}

export interface VslSlide {
  id: number;
  timestamp: number; // in seconds
  title: string;
  subtitle: string;
  mediaUrl: string; // reference image description or stock photo
  narrativeText: string;
}
