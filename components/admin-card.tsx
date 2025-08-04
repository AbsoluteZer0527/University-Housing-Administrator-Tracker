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
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronUp, Mail, Phone, Link, Edit2, Save, X
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AdministratorCardProps {
  administrator: Administrator;
  universityId: string;
  onStatusChange?: (adminId: string, status: AdminStatus) => void;
  onDataChange?: (adminId: string, updatedData: Partial<Administrator>) => void;
}

export function AdministratorCard({
  administrator,
  onStatusChange,
  onDataChange
}: AdministratorCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<AdminStatus>(administrator.status);
  
  // Editable fields state
  const [editData, setEditData] = useState({
    name: administrator.name,
    role: administrator.role,
    email: administrator.email || "",
    phone: administrator.phone || "",
    source_url: administrator.source_url || ""
  });

  const supabase = createClient();

  // Update local status when administrator prop changes
  useEffect(() => {
    setStatus(administrator.status);
    setEditData({
      name: administrator.name,
      role: administrator.role,
      email: administrator.email || "",
      phone: administrator.phone || "",
      source_url: administrator.source_url || ""
    });
  }, [administrator]);

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
      sent: "bg-cyan-500",
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

  const handleEditClick = () => {
    setIsEditing(true);
    setIsOpen(true); // Expand card when editing
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset to original values
    setEditData({
      name: administrator.name,
      role: administrator.role,
      email: administrator.email || "",
      phone: administrator.phone || "",
      source_url: administrator.source_url || ""
    });
  };

  const handleSaveEdit = async () => {
    // Validate required fields
    if (!editData.name.trim() || !editData.role.trim() || !editData.email.trim()) {
      toast.error("Name, role, and email are required");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const loadingId = toast.loading("Saving changes...");

    try {
      const updateData = {
        name: editData.name.trim(),
        role: editData.role.trim(),
        email: editData.email.trim(),
        phone: editData.phone.trim() || null,
        source_url: editData.source_url.trim() || null
      };

      const { error } = await supabase
        .from("administrators")
        .update(updateData)
        .eq("id", administrator.id);

      if (error) {
        throw error;
      }

      toast.success("Administrator updated successfully!", { id: loadingId });
      setIsEditing(false);
      
      // Notify parent component about the change
      onDataChange?.(administrator.id, updateData);

    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update administrator", { id: loadingId });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="w-full mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 mr-4">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Administrator name"
                  className="text-lg font-semibold"
                />
                <Input
                  value={editData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  placeholder="Role/Title"
                  className="text-sm"
                />
              </div>
            ) : (
              <>
                <CardTitle>{administrator.name}</CardTitle>
                <CardDescription>{administrator.role}</CardDescription>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${getStatusColor(status)} text-white`}>
              {getStatusLabel(status)}
            </Badge>
            
            {isEditing ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveEdit}
                  className="h-8 w-8 p-0"
                >
                  <Save className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleEditClick}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="pt-2 pb-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex justify-between items-center bg-muted">
              <span>View Details</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </CardContent>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-2">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 opacity-70" />
                  <Input
                    type="email"
                    value={editData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Email address"
                    className="flex-1"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 opacity-70" />
                  <Input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Phone number (optional)"
                    className="flex-1"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 opacity-70" />
                  <Input
                    type="url"
                    value={editData.source_url}
                    onChange={(e) => handleInputChange('source_url', e.target.value)}
                    placeholder="Source URL (optional)"
                    className="flex-1"
                  />
                </div>
              </div>
            ) : (
              <>
                {administrator.email && (
                  <Detail 
                    icon={<Mail />} 
                    label={administrator.email} 
                    link={`mailto:${administrator.email}`} 
                  />
                )}
                {administrator.phone && (
                  <Detail icon={<Phone />} label={administrator.phone} />
                )}
                {administrator.source_url && (
                  <Detail 
                    icon={<Link />} 
                    label="View Source" 
                    link={administrator.source_url} 
                  />
                )}
              </>
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