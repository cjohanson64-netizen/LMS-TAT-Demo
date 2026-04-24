import { createContext } from "react";

export type RefreshKey =
  | "teachers"
  | "students"
  | "courses"
  | "enrollments"
  | "assignments"
  | "submissions";

export type RefreshVersions = Record<RefreshKey, number>;

export type DataRefreshContextValue = {
  versions: RefreshVersions;
  refresh: (key: RefreshKey) => void;
  refreshMany: (keys: RefreshKey[]) => void;
};

export const initialRefreshVersions: RefreshVersions = {
  teachers: 0,
  students: 0,
  courses: 0,
  enrollments: 0,
  assignments: 0,
  submissions: 0,
};

export const DataRefreshContext = createContext<DataRefreshContextValue | null>(
  null
);
