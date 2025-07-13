// app/university/[id]/page.tsx

import { createClient } from "@/lib/supabase/server"; // or client if this is a client page
import { AdministratorList } from "@/components/admin-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  params: { id: string };
}

export default async function UniversityPage({ params }: Props) {
  const supabase = await createClient();
  const { id: universityId } = await params;

  // Fetch university
  const { data: university, error: universityError } = await supabase
    .from("universities")
    .select("*")
    .eq("id", universityId)
    .single();

  // Fetch administrators
  const { data: administrators, error: adminError } = await supabase
    .from("administrators")
    .select("*")
    .eq("university_id", universityId);

  if (universityError || adminError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Error Loading University</h2>
            <p className="text-muted-foreground mb-6">
              {universityError?.message || adminError?.message}
            </p>
            <Link href="/">
              <Button>Return to Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const housingPages = administrators 
  ? [...new Set(administrators
      .map(admin => admin.source_url)
      .filter(Boolean)
    )] as string[]
  : [];

  return (
    <div className="space-y-6 p-4">
      <Link href="/" className="inline-flex items-center mb-6">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      <Card>
  <CardHeader>
    <CardTitle>{university.name}</CardTitle>
    <CardDescription>
      {university.website && (
        <a
          href={university.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {university.website}
        </a>
      )}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">
      Total Administrators: {administrators?.length ?? 0}
    </p>
    
    {/* Housing Pages Found */}
    {housingPages.length > 0 && (
      <div className="mt-4">
        <p className="text-sm text-muted-foreground mb-2">
          Housing Pages Found: {housingPages.length}
        </p>
        <div className="space-y-1">
          {housingPages.map((page, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                {index + 1}
              </span>
              <a
                href={page}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline break-all"
              >
                {page}
              </a>
            </div>
          ))}
        </div>
      </div>
    )}
  </CardContent>
</Card>
      
      <AdministratorList
        administrators={administrators ?? []}
        universityId={universityId}
      />
    </div>
  );
}
