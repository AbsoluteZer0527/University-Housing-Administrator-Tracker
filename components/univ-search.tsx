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
import { User } from '@supabase/supabase-js';

const RECENT_KEY = "recentUniversitySearches";
interface UniversitySearchFormProps {
  user?: User | null;
}

export function UniversitySearchForm({ user }: UniversitySearchFormProps) {
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

    // Step 1: Try to find the university in Supabase
    const { data: universities, error } = await supabase
      .from("universities")
      .select("id")
      .ilike("name", `%${trimmed}%`)
      .limit(1);

    if (error) {
      toast.error("Error searching university");
      console.error(error);
      setIsLoading(false);
      return;
    }

    // Step 2: If found, redirect immediately
    if (universities && universities.length > 0) {
      addToRecentSearches(trimmed);
      router.push(`/university/${universities[0].id}`);
      setIsLoading(false);
      return;
    }

    // Step 3: If not found, trigger scraper
    toast.info("University not found, attempting to scrape...");

    try {
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universityName: trimmed }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        throw new Error(scrapeData?.message || "Scrape failed");
      }

      // Handle successful scraping
      if (scrapeData.success) {
        if (scrapeData.existing && scrapeData.redirect_to) {
          // University already exists (found during scraping)
          toast.success(`Found existing university with ${scrapeData.admins.length} administrators`);
          addToRecentSearches(trimmed);
          router.push(scrapeData.redirect_to);
        } else if (scrapeData.university && scrapeData.university.id) {
          // University was created (with or without admins)
          if (scrapeData.no_admins_found) {
            // No admins found but university created with housing pages
            toast.warning(`University created with ${scrapeData.housing_pages_found?.length || 0} housing pages found, but no administrators extracted`);
          } else {
            // Admins were found and added
            toast.success(`Successfully scraped ${scrapeData.new_inserted || scrapeData.admins.length} administrators for ${trimmed}`);
          }
          
          addToRecentSearches(trimmed);
          router.push(`/university/${scrapeData.university.id}`);
        } else {
          toast.error("Scraping succeeded but no university data returned");
        }
      } else {
        throw new Error(scrapeData.message || "Scraping failed");
      }

    } catch (err: unknown) {
      console.error("Scraping error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to scrape university data";
      toast.error(errorMsg);
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
            disabled={isLoading || !user}
          />
          <Button type="submit" className="w-full" disabled={isLoading || !user}>
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