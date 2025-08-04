"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UniversitySearchForm } from "@/components/univ-search";
import { CategoryAdministratorsList } from "@/components/admin-category";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold mb-2">
          University Housing Administrator Tracker
        </h1>
        <p className="text-gray-600 max-w-md mb-6">
          Search for university housing administrators, track outreach, and manage communication status. 
        </p>
        <p className="text-gray-600 max-w-md mb-6 text-xs">
          Note: If the university is not found in the database, it will run the scraper and return at most 10 minutes, please be patient and wait until you get some result.
        </p>
        
        
        {/* Optional: Show login prompt if not authenticated */}
        {!user && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              Please log in to search, view, and manage administrators.
            </p>
          </div>
        )}

        <UniversitySearchForm user = {user}/>
        

        {/* Only show CategoryAdministratorsList if user is logged in */}
        {user && <CategoryAdministratorsList />}
      </div>
    </main>
  );
}