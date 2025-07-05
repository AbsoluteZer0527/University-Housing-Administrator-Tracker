"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardHeader, CardContent, CardDescription, CardTitle
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function UniversitySearchForm() {
  const [universityName, setUniversityName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!universityName.trim()) {
      toast.error("Please enter a university name");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data: universities, error } = await supabase
      .from("universities")
      .select("id")
      .ilike("name", `%${universityName}%`)
      .limit(1);

    if (error) {
      toast.error("Error searching university");
      console.error(error);
    } else if (universities && universities[0]) {
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
      </CardContent>
    </Card>
  );
}
