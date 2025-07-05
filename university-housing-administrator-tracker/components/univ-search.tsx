"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const RECENT_KEY = "recentUniversitySearches";

export function UniversitySearchForm() {
  const [universityName, setUniversityName] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const addToRecentSearches = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const updated = [trimmed, ...recentSearches.filter(n => n !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = universityName.trim();
    if (!trimmed) {
      toast.error("Please enter a university name");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data: universities, error } = await supabase
      .from("universities")
      .select("id")
      .ilike("name", `%${trimmed}%`)
      .limit(1);

    if (error) {
      toast.error("Error searching university");
      console.error(error);
    } else if (universities && universities[0]) {
      addToRecentSearches(trimmed);
      router.push(`/university/${universities[0].id}`);
    } else {
      toast.error("University not found");
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle>University Housing Administrator Search</CardTitle>
        <CardDescription>
          Enter a university name to search for housing administrators
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            placeholder="Enter university name..."
            value={universityName}
            onChange={(e) => setUniversityName(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </form>

        {recentSearches.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent searches</h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => setUniversityName(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
