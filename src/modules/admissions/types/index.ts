export interface ApplicationRow {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  dateOfBirth: Date;
  gender: string;
  previousSchool: string | null;
  jhsIndexNumber: string | null;
  jhsAggregate: number | null;
  programmePreference1Id: string | null;
  programmePreference1Name: string | null;
  programmePreference2Id: string | null;
  programmePreference2Name: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianRelationship: string | null;
  guardianAddress: string | null;
  guardianOccupation: string | null;
  boardingStatus: string;
  applicationType: string;
  applicationSource: string;
  beceIndexNumber: string | null;
  enrollmentCode: string | null;
  placementSchoolCode: string | null;
  status: string;
  notes: string | null;
  submittedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  enrolledStudentId: string | null;
  academicYearId: string;
  createdAt: Date;
  updatedAt: Date;
  documents: ApplicationDocument[];
}

export interface ApplicationDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}

export interface PublicApplicationStatus {
  applicationNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
}

export interface AdmissionStats {
  total: number;
  submitted: number;
  underReview: number;
  shortlisted: number;
  accepted: number;
  rejected: number;
  enrolled: number;
  draft: number;
}
