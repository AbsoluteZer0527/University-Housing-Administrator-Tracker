"use client";

import { JSX, useEffect, useState } from "react";
import type { Database } from "@/types";
type Administrator = Database["public"]["Tables"]["administrators"]["Row"];
type AdminStatus = Database["public"]["Enums"]["admin_status"];
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronUp, Mail, Phone, MapPin, Link, Building
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AdministratorCardProps {
  administrator: Administrator;
  universityId: string;
  onStatusChange?: (adminId: string, status: AdminStatus) => void;
}

export function AdministratorCard({
  administrator,
  onStatusChange
}: AdministratorCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AdminStatus>(administrator.status);

  const supabase = createClient();

  // Update local status when administrator prop changes
  useEffect(() => {
    setStatus(administrator.status);
  }, [administrator.status]);

  const getStatusLabel = (s: AdminStatus) => {
    const map = {
      not_contacted: "Not Contacted",
      todo: "To Do",
      sent: "Sent",
      declined: "Declined",
      follow_up: "Follow Up",
      complete: "Complete"
    };
    return map[s] ?? "Unknown";
  };

  const getStatusColor = (s: AdminStatus) => {
    const map = {
      not_contacted: "bg-gray-500",
      todo: "bg-indigo-500",
      sent: "bg-blue-500",
      declined: "bg-red-500",
      follow_up: "bg-amber-500",
      complete: "bg-green-500"
    };
    return map[s] ?? "bg-gray-500";
  };

  const handleStatusChange = async (value: string) => {
    const newStatus = value as AdminStatus;
    setStatus(newStatus);

    const { error } = await supabase
      .from("administrators")
      .update({ status: newStatus })
      .eq("id", administrator.id);

    if (!error) {
      toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
      onStatusChange?.(administrator.id, newStatus);
    } else {
      toast.error("Failed to update status");
      setStatus(administrator.status); // revert
    }
  };

  return (
    <Card className="w-full mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{administrator.name}</CardTitle>
            <CardDescription>{administrator.role}</CardDescription>
          </div>
          <Badge variant="outline" className={`${getStatusColor(status)} text-white`}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="pt-2 pb-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost"  className="w-full flex justify-between items-center bg-slate-100" >
              <span>View Details</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </CardContent>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-2">
            {administrator.email && (
              <Detail icon={<Mail />} label={administrator.email} link={`mailto:${administrator.email}`} />
            )}
            {administrator.phone && (
              <Detail icon={<Phone />} label={administrator.phone} />
            )}
            {administrator.source_url && (
              <Detail icon={<Link />} label="View Source" link={administrator.source_url} />
            )}
          </CardContent>
        </CollapsibleContent>

        <CardFooter className="pt-3">
          <div className="w-full">
            <label className="text-sm font-medium mb-1 block">Update Status</label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_contacted">Not Contacted</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardFooter>
      </Collapsible>
    </Card>
  );
}

function Detail({ icon, label, link }: { icon: JSX.Element; label: string; link?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-70">{icon}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
