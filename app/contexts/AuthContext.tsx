import { createContext, useContext } from 'react';
import { useRevalidator, useRouteLoaderData } from 'react-router';

export interface ProjectData {
  planName: string;
  launchDate: string;
  siteType: string;
  directorName: string;
  currentPhase: string; // 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Phase 4' | 'Phase 5'
  hearingSubmitted: boolean;
  contentSubmitted: boolean;
}

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
}

interface AuthContextType {
  currentUser: AuthUser | null;
  projectData: ProjectData | null;
  loading: boolean;
  refreshProjectData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  currentUser: null, 
  projectData: null, 
  loading: false,
  refreshProjectData: async () => {}
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const revalidator = useRevalidator();
  // Get logged-in user and project information from the root loader
  const rootData = useRouteLoaderData("root") as { 
    user: AuthUser | null;
    project: ProjectData | null;
  } | null;

  const currentUser = rootData?.user ?? null;
  const projectData = rootData?.project ?? null;

  const refreshProjectData = async () => {
    // Re-run all active loaders to refresh data from server (D1)
    revalidator.revalidate();
  };

  const value = {
    currentUser,
    projectData,
    loading: false, // Solved server-side, so loading is no longer needed client-side
    refreshProjectData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
