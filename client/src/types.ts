export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export type AuthUser = {
  id: string;
  email: string;
  realRole: UserRole;
  effectiveRole: UserRole;
  linkedEntityId: string | null;
  isImpersonating: boolean;
  effectiveDisplayName: string | null;
  mustChangePassword: boolean;
};

export type Teacher = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  email: string;
  primaryAddress: string | null;
  secondaryAddress: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
};

export type Student = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  graduationDate: string;
  email: string;
  primaryGuardianFirstName: string;
  primaryGuardianLastName: string;
  secondaryGuardianFirstName: string | null;
  secondaryGuardianLastName: string | null;
  primaryGuardianEmail: string | null;
  secondaryGuardianEmail: string | null;
  primaryAddress: string | null;
  secondaryAddress: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  courseCode: string;
  teacherId: string;
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string | null;
  pointsPossible: number;
};

export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  submittedAt: string;
  status: "SUBMITTED" | "GRADED";
  score: number | null;
};

export type TatSubmissionProjection = {
  format: "detail";
  focus: {
    id: string;
    semanticId: string;
    label: string;
    value: {
      title: string;
    };
    state: {
      reviewState?: string;
      gradingState?: string;
      feedbackState?: string;
      score?: number | string | null;
      masteryLabel?: string;
      masteryBand?: string;
      isPassing?: boolean | null;
    };
    meta: {
      label: string;
      type: string;
    };
    status: string;
  };
  node: {
    semanticId: string;
    id: string;
    label: string;
    state: {
      reviewState?: string;
      gradingState?: string;
      feedbackState?: string;
      score?: number | string | null;
      masteryLabel?: string;
      masteryBand?: string;
      isPassing?: boolean | null;
    };
    meta: {
      label: string;
      type: string;
    };
    relationships: Array<{
      relation: string;
      target: string;
    }>;
  };
};

export type TatSubmissionResponse = {
  validation: unknown[];
  debug: {
    projections: {
      lmsSubmissionGraph: TatSubmissionProjection;
    };
  };
};

export type AssignmentStatusProjection = {
  node: {
    id: string;
    label: string;
    type: "assignment";
  };
  viewer: {
    role: "STUDENT" | "TEACHER";
    viewerId: string;
  };
  status: {
    code:
      | "awaiting_submission"
      | "submitted"
      | "graded"
      | "no_submissions"
      | "needs_grading"
      | "unknown";
    label: string;
    tone: "danger" | "info" | "success" | "warning" | "neutral";
  };
  nextAction: {
    code:
      | "submit_work"
      | "wait_for_grade"
      | "review_feedback"
      | "grade_submissions"
      | "view_submissions"
      | "none";
    label: string;
  };
  meta: {
    submissionCount?: number;
    gradedCount?: number;
    ungradedCount?: number;
    hasSubmission?: boolean;
    hasGrade?: boolean;
  };
};

export type CourseAssignmentSummaryProjection = {
  course: {
    id: string;
    label: string;
  };
  viewer: {
    role: "ADMIN" | "TEACHER" | "STUDENT";
    viewerId: string;
  };
  assignmentNodes: string[];
  assignments: Array<{
    id: string;
    label: string;
    submissionCount: number;
    gradedCount: number;
    ungradedCount: number;
    status: {
      code: "no_submissions" | "needs_grading" | "graded" | "unknown";
      label: string;
      tone: "neutral" | "warning" | "success";
    };
    nextAction: {
      code: "none" | "grade_submissions" | "view_submissions";
      label: string;
    };
  }>;
};
