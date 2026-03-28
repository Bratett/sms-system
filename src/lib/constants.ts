export const APP_NAME = "SMS - School Management System";

export const SCHOOL_TYPES = ["day", "boarding", "day-boarding"] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const SCHOOL_CATEGORIES = ["public", "private"] as const;
export type SchoolCategory = (typeof SCHOOL_CATEGORIES)[number];

export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Eastern",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Western North",
  "Oti",
  "North East",
  "Savannah",
] as const;

export const GENDER_OPTIONS = ["male", "female"] as const;

export const STUDENT_STATUSES = [
  "active",
  "suspended",
  "withdrawn",
  "transferred",
  "completed",
  "graduated",
  "deceased",
] as const;

export const STAFF_TYPES = ["teaching", "non-teaching"] as const;

export const TERM_NUMBERS = [1, 2, 3] as const;

export const PAGINATION_DEFAULT = {
  page: 1,
  pageSize: 25,
  maxPageSize: 100,
} as const;
