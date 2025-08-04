"use client";

import { useState, useEffect } from "react";
import { AdministratorCard } from "./admin-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client"; 
import { toast } from "sonner";
import type { Database } from "@/types";


type Administrator = Database["public"]["Tables"]["administrators"]["Row"];
type AdminStatus = Database["public"]["Enums"]["admin_status"];

interface AdministratorListProps {
  administrators: Administrator[];
  universityId: string;
}

export function AdministratorList({ administrators }: AdministratorListProps) {
  const [allAdmins, setAllAdmins] = useState<Administrator[]>(administrators);
  const [filteredAdmins, setFilteredAdmins] = useState<Administrator[]>(administrators);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [currentBulkStatus, setCurrentBulkStatus] = useState<'todo' | 'not_contacted'>('todo');

  const supabase = createClient();

  const handleStatusChange = (adminId: string, status: AdminStatus) => {
    setAllAdmins((prevAdmins) =>
      prevAdmins.map((admin) =>
        admin.id === adminId ? { ...admin, status } : admin
      )
    );
  };

  const handleDataChange = (adminId: string, updatedData: Partial<Administrator>) => {
  // Update your local state if needed
  setAllAdmins(prev => 
    prev.map(admin => 
      admin.id === adminId 
        ? { ...admin, ...updatedData }
        : admin
    )
  );
};

  const handleBulkStatusUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Get all admin IDs for this university
      const adminIds = allAdmins.map(admin => admin.id);
      
      // Update all administrators' status to 'todo' in the database
      const { error } = await supabase
        .from('administrators')
        .update({ status: currentBulkStatus })
        .in('id', adminIds);

      if (error) {
        throw error;
      }

      // Update local state
        setAllAdmins(prevAdmins =>
            prevAdmins.map(admin => ({ ...admin, status: currentBulkStatus as AdminStatus }))
        );

        setCurrentBulkStatus(currentBulkStatus === 'todo' ? 'not_contacted' : 'todo');

      const statusText = currentBulkStatus === 'todo' ? 'To Do' : 'Not Contacted';
      toast.success(`Successfully updated ${adminIds.length} administrators to "${statusText}" status`);
    } catch (error) {
      console.error('Error updating administrator statuses:', error);
      toast.error('Failed to update administrator statuses');
    } finally {
      setIsUpdating(false);
    }
  };


  useEffect(() => {
    let result = [...allAdmins];

    if (statusFilter !== "all") {
      result = result.filter((admin) => admin.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (admin) =>
          admin.name.toLowerCase().includes(term) ||
          admin.role.toLowerCase().includes(term) ||
          admin.email.toLowerCase().includes(term)
      );
    }

    setFilteredAdmins(result);
  }, [allAdmins, statusFilter, searchTerm]);

  useEffect(() => {
    setAllAdmins(administrators);
  }, [administrators]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Housing Administrators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="w-full md:w-1/2">
                <Label htmlFor="search" className="mb-2 block">Search</Label>
                <Input
                id="search"
                placeholder="Search by name, role, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="w-full md:w-1/2">
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <Label htmlFor="status" className="mb-2 block">Filter by Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="not_contacted">Not Contacted</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="declined">Declined</SelectItem>
                                <SelectItem value="follow_up">Follow Up</SelectItem>
                                <SelectItem value="complete">Complete</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className=" pb-0.5">
                        <Button
                            onClick={handleBulkStatusUpdate}
                            disabled={isUpdating}
                            variant="outline"
                            className={`whitespace-nowrap ${
                                currentBulkStatus === 'not_contacted' 
                                ? 'bg-gray-400 text-white hover:bg-gray-500 hover:text-white' 
                                : 'bg-indigo-400 text-white hover:bg-indigo-500 hover:text-white'
                                }`}
                                >
                                {isUpdating 
                                    ? "Updating..." 
                                    : currentBulkStatus === 'todo'
                                    ? "Make All To-Do" 
                                    : "Make All Not Contacted"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        {filteredAdmins.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No administrators match the current filters.</p>
          </div>
        ) : (
          filteredAdmins.map((admin) => (
            <AdministratorCard
            
              key={admin.id}
              universityId={admin.university_id}
              administrator={admin}
              onStatusChange={handleStatusChange}
              onDataChange={handleDataChange}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
