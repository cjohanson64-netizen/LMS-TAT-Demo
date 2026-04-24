import { useContext } from "react";
import { DataRefreshContext } from "./DataRefreshContext";

export function useDataRefresh() {
  const context = useContext(DataRefreshContext);

  if (!context) {
    throw new Error("useDataRefresh must be used within a DataRefreshProvider");
  }

  return context;
}
