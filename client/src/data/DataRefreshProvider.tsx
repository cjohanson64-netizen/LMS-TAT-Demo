import {
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  DataRefreshContext,
  initialRefreshVersions,
  type RefreshKey,
  type RefreshVersions,
} from "./DataRefreshContext";

type RefreshAction =
  | { type: "refresh"; key: RefreshKey }
  | { type: "refreshMany"; keys: RefreshKey[] };

function refreshReducer(
  state: RefreshVersions,
  action: RefreshAction
): RefreshVersions {
  if (action.type === "refresh") {
    return {
      ...state,
      [action.key]: state[action.key] + 1,
    };
  }

  const nextState = { ...state };

  for (const key of action.keys) {
    nextState[key] += 1;
  }

  return nextState;
}

export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const [versions, dispatch] = useReducer(
    refreshReducer,
    initialRefreshVersions
  );

  const refresh = useCallback((key: RefreshKey) => {
    dispatch({ type: "refresh", key });
  }, []);

  const refreshMany = useCallback((keys: RefreshKey[]) => {
    dispatch({ type: "refreshMany", keys });
  }, []);

  const value = useMemo(
    () => ({
      versions,
      refresh,
      refreshMany,
    }),
    [versions, refresh, refreshMany]
  );

  return (
    <DataRefreshContext.Provider value={value}>
      {children}
    </DataRefreshContext.Provider>
  );
}
