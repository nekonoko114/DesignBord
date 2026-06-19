import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface ProjectData {
  planName: string;
  launchDate: string;
  siteType: string;
  directorName: string;
  currentPhase: string; // 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Phase 4' | 'Phase 5'
  hearingSubmitted: boolean;
  contentSubmitted: boolean;
}

const defaultProjectData: ProjectData = {
  planName: "プレミアム・コーポレートプラン",
  launchDate: "2026年 7月 3日（目安）",
  siteType: "コーポレートサイト",
  directorName: "山田 太郎",
  currentPhase: "Phase 1",
  hearingSubmitted: false,
  contentSubmitted: false
};

interface AuthContextType {
  currentUser: User | null;
  projectData: ProjectData | null;
  loading: boolean;
  refreshProjectData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  currentUser: null, 
  projectData: null, 
  loading: true,
  refreshProjectData: async () => {}
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjectData = async (uid: string) => {
    try {
      const docRef = doc(db, "projects", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as ProjectData;
      } else {
        const initialData = {
          ...defaultProjectData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(docRef, initialData);
        return defaultProjectData;
      }
    } catch (e) {
      console.error("Failed to load project data in AuthContext:", e);
      return defaultProjectData;
    }
  };

  const refreshProjectData = async () => {
    if (currentUser) {
      const data = await fetchProjectData(currentUser.uid);
      setProjectData(data);
    }
  };

  useEffect(() => {
    console.log("[AuthContext] Setting up onAuthStateChanged...");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[AuthContext] onAuthStateChanged fired. User:", user ? user.uid : "null");
      setCurrentUser(user);
      setLoading(false); // Auth状態が確定したら即座にロード完了とする
      
      if (user) {
        console.log("[AuthContext] Fetching project data for:", user.uid);
        fetchProjectData(user.uid)
          .then((data) => {
            console.log("[AuthContext] Project data fetched successfully");
            setProjectData(data);
          })
          .catch((e) => {
            console.error("[AuthContext] Error fetching project data:", e);
          });
      } else {
        setProjectData(null);
      }
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    projectData,
    loading,
    refreshProjectData
  };

  console.log("[AuthContext] Rendering Provider. loading:", loading);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
