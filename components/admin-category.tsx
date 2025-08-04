"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdministratorCard } from "@/components/admin-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Database } from "@/types";

type Administrator = Database["public"]["Tables"]["administrators"]["Row"];
//type University = Database["public"]["Tables"]["universities"]["Row"];
type AdminStatus = Administrator["status"];

interface AdminWithUniversity extends Administrator {
  universityName: string;
}

const categories: { label: string; key: AdminStatus; color: string }[] = [
  { label: "To Do", key: "todo", color: "bg-indigo-500" },
  { label: "Sent", key: "sent", color: "bg-blue-500" },
  { label: "Follow Up", key: "follow_up", color: "bg-amber-500" },
  { label: "Complete", key: "complete", color: "bg-green-500" },
];

export function CategoryAdministratorsList() {
  const [loading, setLoading] = useState(true);
  const [categorizedAdmins, setCategorizedAdmins] = useState<
    Record<AdminStatus, AdminWithUniversity[]>
  >({
    todo: [],
    sent: [],
    follow_up: [],
    complete: [],
    not_contacted: [],
    declined: [],
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data: admins, error } = await supabase
        .from("administrators")
        .select("*, universities(name)");

      if (error || !admins) {
        console.error("Failed to fetch administrators:", error);
        setLoading(false);
        return;
      }

      // Group by status
      const grouped: Record<AdminStatus, AdminWithUniversity[]> = {
        todo: [],
        sent: [],
        follow_up: [],
        complete: [],
        not_contacted: [],
        declined: [],
      };

      for (const admin of admins) {
        const universityName = (admin as { universities?: { name?: string } }).universities?.name || "Unknown";
        const status = admin.status as AdminStatus;
        grouped[status]?.push({ ...admin, universityName });
        }

      setCategorizedAdmins(grouped);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleStatusChange = (
    adminId: string,
    //universityId: string,
    newStatus: AdminStatus
  ) => {
    setCategorizedAdmins((prev) => {
      const allAdmins = Object.entries(prev).flatMap(([, list]) => list);
      const admin = allAdmins.find((a) => a.id === adminId);
      if (!admin) return prev;

      const updated: Record<AdminStatus, AdminWithUniversity[]> = {
        todo: [],
        sent: [],
        follow_up: [],
        complete: [],
        not_contacted: [],
        declined: [],
      };

      for (const [status, admins] of Object.entries(prev)) {
        updated[status as AdminStatus] = admins.filter((a) => a.id !== adminId);
      }

      updated[newStatus].push({ ...admin, status: newStatus });
      return updated;
    });

    // Optional: persist status update to Supabase
    const supabase = createClient();
    supabase
      .from("administrators")
      .update({ status: newStatus })
      .eq("id", adminId)
      .then(({ error }) => {
        if (error) console.error("Failed to update status", error);
      });
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-8 w-full">
        {categories.map(({ key, label, color }) => (
          <Card
            key={key}
            className="w-full rounded-2xl shadow-sm bg-muted border border-muted"
            id={`${key}Category`}
            data-category={key}
          >
            <CardHeader className={`${color} bg-opacity-10 text-black rounded-t-2xl`}>
              <CardTitle className="text-center font-semibold">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[200px]">
              {categorizedAdmins[key].length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No administrators in this category
                </p>
              ) : (
                <SortableContext
                  items={categorizedAdmins[key].map((admin) => admin.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categorizedAdmins[key].map((admin) => (
                    <div key={admin.id} className="mb-4">
                      <AdministratorCard
                        administrator={admin}
                        universityId={admin.university_id}
                        onStatusChange={(id, status) =>
                          handleStatusChange(id, status)
                        }
                      />
                      <p className="text-xs text-muted-foreground text-right mt-1">
                        {admin.universityName}
                      </p>
                    </div>
                  ))}
                </SortableContext>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </DndContext>
  );
}
