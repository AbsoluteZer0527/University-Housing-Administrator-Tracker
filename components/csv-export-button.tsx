// components/csv-export-button.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface Administrator {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  source_url?: string;
  status: string;
  university_id: string;
}

interface CsvExportButtonProps {
  administrators: Administrator[];
  universityName: string;
  className?: string;
}

export function CsvExportButton({ 
  administrators, 
  universityName, 
  className 
}: CsvExportButtonProps) {
  
  const exportToCsv = () => {
    if (!administrators || administrators.length === 0) {
      toast.error("No administrator data to export");
      return;
    }

    try {
      // Define CSV headers
      const headers = [
        "Name",
        "Role", 
        "Email",
        "Phone",
        "Source URL"
      ];

      // Convert data to CSV format
      const csvData = administrators.map(admin => [
        `"${admin.name.replace(/"/g, '""')}"`, // Escape quotes in names
        `"${admin.role.replace(/"/g, '""')}"`,
        `"${admin.email}"`,
        `"${admin.phone || ''}"`,
        `"${admin.source_url || ''}"`
      ]);

      // Combine headers and data
      const csvContent = [
        headers.join(","),
        ...csvData.map(row => row.join(","))
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // Create filename with university name and timestamp
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const sanitizedUniversityName = universityName
          .replace(/[^a-z0-9]/gi, '_') // Replace special chars with underscore
          .toLowerCase();
        
        link.setAttribute("download", `${sanitizedUniversityName}_administrators_${timestamp}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Exported ${administrators.length} administrators to CSV`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  return (
    <Button 
      onClick={exportToCsv}
      variant="outline"
      size="sm"
      className={className}
      disabled={!administrators || administrators.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV ({administrators?.length || 0} admins)
    </Button>
  );
}