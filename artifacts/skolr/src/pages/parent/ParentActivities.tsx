import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListParentStudentLinks } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, Clock, Plus, X, CalendarPlus, Trash2, MapPin } from "lucide-react";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

interface Activity {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_external: boolean;
  coach_name: string | null;
  provider_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
}

interface Signup {
  id: string;
  activity_id: string;
  student_id: string;
  student_name: string | null;
  status: string;
}

interface ChildLink {
  id: string;
  student_id: string;
  student_name: string | null;
}

interface CustomEvent {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  days_of_week: string[];
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
}

const emptyCustom = {
  student_id: "",
  title: "",
  description: "",
  days_of_week: [] as string[],
  start_time: "",
  end_time: "",
  start_date: "",
  end_date: "",
  location: "",
};

export default function ParentActivities() {
  const { session } = useAuth();
  const { user } = useAuth();
  const token = session?.access_token ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: () => apiFetch(`/api/activities`, token),
    enabled: !!token,
  });
  const { data: signups = [] } = useQuery<Signup[]>({
    queryKey: ["activity-signups"],
    queryFn: () => apiFetch(`/api/activity-signups`, token),
    enabled: !!token,
  });
  const { data: rawLinks } = useListParentStudentLinks(user?.id ? { parent_user_id: user.id } : undefined);
  const children = ((rawLinks ?? []) as unknown as ChildLink[]);

  const { data: customEvents = [] } = useQuery<CustomEvent[]>({
    queryKey: ["custom-events"],
    queryFn: () => apiFetch(`/api/custom-events`, token),
    enabled: !!token,
  });

  const childName = (id: string) => children.find((c) => c.student_id === id)?.student_name ?? "Child";

  const [signupFor, setSignupFor] = useState<Activity | null>(null);
  const [childId, setChildId] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ ...emptyCustom });

  const addCustom = useMutation({
    mutationFn: () => apiFetch(`/api/custom-events`, token, {
      method: "POST",
      body: {
        student_id: customForm.student_id,
        title: customForm.title,
        description: customForm.description || null,
        days_of_week: customForm.days_of_week,
        start_time: customForm.start_time || null,
        end_time: customForm.end_time || null,
        start_date: customForm.start_date || null,
        end_date: customForm.end_date || null,
        location: customForm.location || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-events"] });
      setCustomOpen(false); setCustomForm({ ...emptyCustom });
      toast({ title: "Activity added" });
    },
    onError: (e: any) => toast({ title: "Could not add", description: e?.message, variant: "destructive" }),
  });

  const deleteCustom = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/custom-events/${id}`, token, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-events"] }); toast({ title: "Activity removed" }); },
    onError: (e: any) => toast({ title: "Could not remove", description: e?.message, variant: "destructive" }),
  });

  const toggleDay = (day: string) =>
    setCustomForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day],
    }));

  const signUp = useMutation({
    mutationFn: ({ activityId, studentId }: { activityId: string; studentId: string }) =>
      apiFetch(`/api/activity-signups`, token, { method: "POST", body: { activity_id: activityId, student_id: studentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-signups"] });
      setSignupFor(null); setChildId("");
      toast({ title: "Signed up" });
    },
    onError: (e: any) => toast({ title: "Could not sign up", description: e?.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/activity-signups/${id}`, token, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activity-signups"] }); toast({ title: "Sign-up cancelled" }); },
    onError: (e: any) => toast({ title: "Could not cancel", description: e?.message, variant: "destructive" }),
  });

  const signupsFor = (activityId: string) => signups.filter((s) => s.activity_id === activityId);
  const availableChildren = signupFor
    ? children.filter((c) => !signupsFor(signupFor.id).some((s) => s.student_id === c.student_id))
    : [];

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activities</h1>
          <p className="text-gray-500 mt-1">Browse extra-murals and sign your children up</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-purple-600" /></div>
        ) : activities.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-gray-400">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No activities available yet</p>
            <p className="text-sm mt-1">Check back soon — the school hasn't added any extra-murals.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((a) => {
              const enrolled = signupsFor(a.id);
              return (
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
                    </div>
                    {a.description && <p className="text-sm text-gray-600">{a.description}</p>}
                    <div className="text-sm text-gray-500 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {a.day_of_week ?? "—"}{a.start_time ? ` · ${a.start_time}${a.end_time ? `–${a.end_time}` : ""}` : ""}
                      </p>
                      <p>
                        {a.is_external ? (a.provider_name ?? "External provider") : (a.coach_name ?? "School coach")}
                        {a.location ? ` · ${a.location}` : ""}
                      </p>
                    </div>
                    {enrolled.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs text-gray-400">Signed up</p>
                        <div className="flex flex-wrap gap-1.5">
                          {enrolled.map((s) => (
                            <Badge key={s.id} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1 pr-1">
                              {s.student_name ?? "Child"}
                              <button className="hover:text-red-600" onClick={() => cancel.mutate(s.id)} data-testid={`button-cancel-${s.id}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end pt-1 border-t">
                      <Button
                        size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1"
                        onClick={() => { setSignupFor(a); setChildId(""); }}
                        data-testid={`button-signup-${a.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Sign up a child
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Parent-added activities (not on the school calendar) ── */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900">My Child's Other Activities</h2>
              <p className="text-gray-500 text-sm mt-1">Add activities your child does outside school (e.g. private swimming). They show on your schedule.</p>
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 gap-1"
              onClick={() => { setCustomForm({ ...emptyCustom }); setCustomOpen(true); }}
              disabled={children.length === 0}
              data-testid="button-add-custom-event"
            >
              <CalendarPlus className="h-4 w-4" /> Add Activity
            </Button>
          </div>
          {customEvents.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-gray-400">
              <CalendarPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No extra activities added yet</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customEvents.map((ev) => (
                <Card key={ev.id} data-testid={`card-custom-${ev.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{ev.title}</p>
                        <p className="text-xs text-indigo-600">{childName(ev.student_id)}</p>
                      </div>
                      <button className="text-gray-400 hover:text-red-600" onClick={() => deleteCustom.mutate(ev.id)} data-testid={`button-delete-custom-${ev.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {ev.description && <p className="text-sm text-gray-600">{ev.description}</p>}
                    <div className="text-sm text-gray-500 space-y-1">
                      {ev.days_of_week.length > 0 && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {ev.days_of_week.map((d) => d.slice(0, 3)).join(", ")}
                          {ev.start_time ? ` · ${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ""}` : ""}
                        </p>
                      )}
                      {ev.location && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ev.location}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom event dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add an Activity</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Child <span className="text-red-500">*</span></Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={customForm.student_id}
                onChange={(e) => setCustomForm((f) => ({ ...f, student_id: e.target.value }))}
                data-testid="select-custom-child"
              >
                <option value="">Select child…</option>
                {children.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name ?? "Child"}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Activity name <span className="text-red-500">*</span></Label>
              <Input value={customForm.title} onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Private swimming" data-testid="input-custom-title" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={customForm.description} onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Repeats on</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${customForm.days_of_week.includes(d) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300"}`}
                    data-testid={`toggle-day-${d}`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input type="time" value={customForm.start_time} onChange={(e) => setCustomForm((f) => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input type="time" value={customForm.end_time} onChange={(e) => setCustomForm((f) => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input type="date" value={customForm.start_date} onChange={(e) => setCustomForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Until</Label>
                <Input type="date" value={customForm.end_date} onChange={(e) => setCustomForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={customForm.location} onChange={(e) => setCustomForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Aquatic Centre" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addCustom.mutate()}
              disabled={!customForm.student_id || !customForm.title.trim() || addCustom.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-custom-event"
            >
              {addCustom.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!signupFor} onOpenChange={(o) => { if (!o) setSignupFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sign up for {signupFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {children.length === 0 ? (
              <p className="text-sm text-amber-600">No children are linked to your account. Contact the school admin.</p>
            ) : availableChildren.length === 0 ? (
              <p className="text-sm text-gray-500">All your children are already signed up for this activity.</p>
            ) : (
              <div className="space-y-1.5">
                <Label>Child</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  data-testid="select-child"
                >
                  <option value="">Select child…</option>
                  {availableChildren.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name ?? "Child"}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignupFor(null)}>Cancel</Button>
            <Button
              disabled={!childId || signUp.isPending}
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => signupFor && signUp.mutate({ activityId: signupFor.id, studentId: childId })}
              data-testid="button-confirm-signup"
            >
              {signUp.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Sign up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
