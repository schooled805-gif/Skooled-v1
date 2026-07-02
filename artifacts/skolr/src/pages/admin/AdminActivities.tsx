import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListProfiles } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trophy, Trash2, Edit2, Building2, Clock } from "lucide-react";

async function apiFetch(url: string, token: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as any)?.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Activity {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_external: boolean;
  coach_teacher_id: string | null;
  provider_id: string | null;
  coach_name: string | null;
  provider_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  season: string | null;
  start_date: string | null;
  end_date: string | null;
}

const SEASONS: { value: string; label: string }[] = [
  { value: "weekly", label: "Weekly (ongoing)" },
  { value: "term1", label: "Term 1" },
  { value: "term2", label: "Term 2" },
  { value: "term3", label: "Term 3" },
  { value: "term4", label: "Term 4" },
  { value: "annual", label: "Annual" },
];
const seasonLabel = (v: string | null) => SEASONS.find((s) => s.value === v)?.label ?? "Weekly (ongoing)";

interface Provider {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

const emptyForm = {
  name: "", description: "", category: "", is_external: false,
  coach_teacher_id: "", provider_id: "", day_of_week: "Monday",
  start_time: "14:00", end_time: "15:00", location: "",
  season: "weekly", start_date: "", end_date: "",
};

export default function AdminActivities() {
  const { schoolId, session } = useAuth();
  const token = session?.access_token ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["activities", schoolId],
    queryFn: () => apiFetch(`/api/activities`, token),
    enabled: !!token,
  });
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["activity-providers", schoolId],
    queryFn: () => apiFetch(`/api/activity-providers`, token),
    enabled: !!token,
  });
  const { data: profiles } = useListProfiles(schoolId ? { school_id: schoolId } : undefined);
  const teachers = ((profiles ?? []) as any[]).filter((p) => p.role === "teacher");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  const [provOpen, setProvOpen] = useState(false);
  const [provForm, setProvForm] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [provDelete, setProvDelete] = useState<Provider | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["activity-providers"] });
  };

  const saveActivity = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        is_external: form.is_external,
        coach_teacher_id: form.is_external ? null : form.coach_teacher_id || null,
        provider_id: form.is_external ? form.provider_id || null : null,
        day_of_week: form.day_of_week || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        season: form.season || "weekly",
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      return editId
        ? apiFetch(`/api/activities/${editId}`, token, { method: "PATCH", body })
        : apiFetch(`/api/activities`, token, { method: "POST", body });
    },
    onSuccess: () => { invalidate(); setOpen(false); toast({ title: editId ? "Activity updated" : "Activity created" }); },
    onError: (e: any) => toast({ title: "Could not save activity", description: e?.message, variant: "destructive" }),
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/activities/${id}`, token, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Activity deleted" }); },
    onError: (e: any) => toast({ title: "Could not delete activity", description: e?.message, variant: "destructive" }),
  });

  const saveProvider = useMutation({
    mutationFn: () => apiFetch(`/api/activity-providers`, token, {
      method: "POST",
      body: {
        name: provForm.name,
        contact_name: provForm.contact_name || null,
        contact_email: provForm.contact_email || null,
        contact_phone: provForm.contact_phone || null,
      },
    }),
    onSuccess: () => {
      invalidate(); setProvOpen(false);
      setProvForm({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
      toast({ title: "Provider added" });
    },
    onError: (e: any) => toast({ title: "Could not add provider", description: e?.message, variant: "destructive" }),
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/activity-providers/${id}`, token, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setProvDelete(null); toast({ title: "Provider removed" }); },
    onError: (e: any) => toast({ title: "Could not remove provider", description: e?.message, variant: "destructive" }),
  });

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (a: Activity) => {
    setEditId(a.id);
    setForm({
      name: a.name,
      description: a.description ?? "",
      category: a.category ?? "",
      is_external: a.is_external,
      coach_teacher_id: a.coach_teacher_id ?? "",
      provider_id: a.provider_id ?? "",
      day_of_week: a.day_of_week ?? "Monday",
      start_time: a.start_time ?? "14:00",
      end_time: a.end_time ?? "15:00",
      location: a.location ?? "",
      season: a.season ?? "weekly",
      start_date: a.start_date ?? "",
      end_date: a.end_date ?? "",
    });
    setOpen(true);
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activities</h1>
            <p className="text-gray-500 mt-1">Extra-murals run by school coaches or external providers</p>
          </div>
        </div>

        <Tabs defaultValue="activities">
          <TabsList>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>

          {/* ── ACTIVITIES ── */}
          <TabsContent value="activities" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-activity">
                <Plus className="h-4 w-4 mr-2" /> New Activity
              </Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : activities.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-gray-400">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">No activities yet</p>
                <p className="text-sm mt-1">Create your first extra-mural activity</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((a) => (
                  <Card key={a.id} data-testid={`card-activity-${a.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{a.name}</p>
                            {a.category && <p className="text-xs text-gray-400">{a.category}</p>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={a.is_external ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                            {a.is_external ? "External" : "In-house"}
                          </Badge>
                          {a.season && a.season !== "weekly" && (
                            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[10px]">{seasonLabel(a.season)}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p className="flex items-center gap-1.5 text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {a.day_of_week ?? "—"}{a.start_time ? ` · ${a.start_time}${a.end_time ? `–${a.end_time}` : ""}` : ""}
                        </p>
                        <p className="text-gray-500">
                          {a.is_external ? (a.provider_name ?? "No provider") : (a.coach_name ?? "No coach")}
                          {a.location ? ` · ${a.location}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(a)} data-testid={`button-edit-${a.id}`}>
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => setDeleteTarget(a)} data-testid={`button-delete-${a.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── PROVIDERS ── */}
          <TabsContent value="providers" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setProvOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-provider">
                <Plus className="h-4 w-4 mr-2" /> New Provider
              </Button>
            </div>
            {providers.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-gray-400">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500">No providers yet</p>
                <p className="text-sm mt-1">Add external companies that run activities at your school</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((p) => (
                  <Card key={p.id} data-testid={`card-provider-${p.id}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-amber-600" />
                          </div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500 h-7" onClick={() => setProvDelete(p)} data-testid={`button-delete-provider-${p.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        {p.contact_name && <p>{p.contact_name}</p>}
                        {p.contact_email && <p>{p.contact_email}</p>}
                        {p.contact_phone && <p>{p.contact_phone}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Activity dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Activity" : "New Activity"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Activity Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Chess Club" data-testid="input-activity-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Sport" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Hall B" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
              <input
                id="is_external" type="checkbox" checked={form.is_external}
                onChange={(e) => setForm((f) => ({ ...f, is_external: e.target.checked }))}
                data-testid="checkbox-external"
              />
              <Label htmlFor="is_external" className="cursor-pointer">Run by an external provider</Label>
            </div>

            {form.is_external ? (
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.provider_id}
                  onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
                  data-testid="select-provider"
                >
                  <option value="">Select provider…</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {providers.length === 0 && <p className="text-xs text-amber-600">No providers yet — add one in the Providers tab.</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Coach (teacher)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.coach_teacher_id}
                  onChange={(e) => setForm((f) => ({ ...f, coach_teacher_id: e.target.value }))}
                  data-testid="select-coach"
                >
                  <option value="">Select coach…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Season</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.season}
                onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                data-testid="select-season"
              >
                {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <p className="text-xs text-gray-400">
                {form.season === "weekly"
                  ? "Runs every week on the chosen day."
                  : "Runs for a fixed season — set the date range below."}
              </p>
            </div>

            {form.season !== "weekly" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} data-testid="input-start-date" />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} data-testid="input-end-date" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Day</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.day_of_week}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value }))}
                  data-testid="select-day"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveActivity.mutate()}
              disabled={!form.name.trim() || saveActivity.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-activity"
            >
              {saveActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider dialog */}
      <Dialog open={provOpen} onOpenChange={setProvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Provider</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-red-500">*</span></Label>
              <Input value={provForm.name} onChange={(e) => setProvForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Active Kids SA" data-testid="input-provider-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={provForm.contact_name} onChange={(e) => setProvForm((f) => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input type="email" value={provForm.contact_email} onChange={(e) => setProvForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input value={provForm.contact_phone} onChange={(e) => setProvForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProvOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveProvider.mutate()}
              disabled={!provForm.name.trim() || saveProvider.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-provider"
            >
              {saveProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete activity */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.name ?? "this activity"} and all of its sign-ups. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteActivity.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteActivity.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteActivity.mutate(deleteTarget.id); }}
              data-testid="button-confirm-delete-activity"
            >
              {deleteActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete activity"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete provider */}
      <AlertDialog open={!!provDelete} onOpenChange={(o) => { if (!o) setProvDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {provDelete?.name ?? "this provider"}. Activities linked to it will keep running but show no provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProvider.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProvider.isPending}
              onClick={(e) => { e.preventDefault(); if (provDelete) deleteProvider.mutate(provDelete.id); }}
              data-testid="button-confirm-delete-provider"
            >
              {deleteProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove provider"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
