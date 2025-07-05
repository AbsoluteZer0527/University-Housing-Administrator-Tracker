"use client";

import { useState, useEffect } from "react";
import { AdministratorCard } from "./admin-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/types";

type Administrator = Database["public"]["Tables"]["administrators"]["Row"];
type AdminStatus = Database["public"]["Enums"]["admin_status"];

interface AdministratorListProps {
  administrators: Administrator[];
  universityId: string;
}

export function AdministratorList({ administrators, universityId }: AdministratorListProps) {
  const [filteredAdmins, setFilteredAdmins] = useState<Administrator[]>(administrators);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleStatusChange = (adminId: string, status: AdminStatus) => {
    setFilteredAdmins((prevAdmins) =>
      prevAdmins.map((admin) =>
        admin.id === adminId ? { ...admin, status } : admin
      )
    );
  };

  useEffect(() => {
    let result = [...administrators];

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
  }, [administrators, statusFilter, searchTerm]);

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
        </div>

        {filteredAdmins.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No administrators match the current filters.</p>
          </div>
        ) : (
          filteredAdmins.map((admin) => (
            <AdministratorCard
              key={admin.id}
              administrator={admin}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
