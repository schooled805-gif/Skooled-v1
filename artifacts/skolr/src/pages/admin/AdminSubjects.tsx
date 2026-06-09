import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePhase } from "@/contexts/PhaseContext";
import { PhaseTabs } from "@/components/PhaseTabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListProfiles } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, BookMarked, Trash2, UserPlus, X } from "lucide-react";

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

interface Subject { id: string; name: string; code: string | null; phase?: string | null; }
interface SubjectTeacher { id: string; subject_id: string; teacher_id: string; teacher_name: string | null; }

export default function AdminSubjects() {
  const { schoolId, session } = useAuth();
  const { multiPhase, activePhase } = usePhase();
  const token = session?.access_token ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ["subjects", schoolId],
    queryFn: () => apiFetch(`/api/subjects`, token),
    enabled: !!token,
  });
  const { data: subjectTeachers = [] } = useQuery<SubjectTeacher[]>({
    queryKey: ["subject-teachers", schoolId],
    queryFn: () => apiFetch(`/api/subject-teachers`, token),
    enabled: !!token,
  });
  const { data: profiles } = useListProfiles(schoolId ? { school_id: schoolId } : undefined);
  const teachers = ((profiles ?? []) as any[]).filter((p) => p.role === "teacher");
  const phaseTeachers = teachers.filter((t) => !multiPhase || t.phase === activePhase || !t.phase);
  const visibleSubjects = subjects.filter((s) => !multiPhase || s.phase === activePhase || !s.phase);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [assignFor, setAssignFor] = useState<Subject | null>(null);
  const [teacherToAdd, setTeacherToAdd] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["subject-teachers"] });
  };

  const createSubject = useMutation({
    mutationFn: () => apiFetch(`/api/subjects`, token, { method: "POST", body: { name, code: code || null, ...(multiPhase && activePhase ? { phase: activePhase } : {}) } }),
    onSuccess: () => { invalidate(); setOpen(false); setName(""); setCode(""); toast({ title: "Subject created" }); },
    onError: (e: any) => toast({ title: "Could not create subject", description: e?.message, variant: "destructive" }),
  });
  const deleteSubject = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/subjects/${id}`, token, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Subject deleted" }); },
    onError: (e: any) => toast({ title: "Could not delete subject", description: e?.message, variant: "destructive" }),
  });
  const assignTeacher = useMutation({
    mutationFn: ({ subjectId, teacherId }: { subjectId: string; teacherId: string }) =>
      apiFetch(`/api/subjects/${subjectId}/teachers`, token, { method: "POST", body: { teacher_id: teacherId } }),
    onSuccess: () => { invalidate(); setTeacherToAdd(""); toast({ title: "Teacher assigned" }); },
    onError: (e: any) => toast({ title: "Could not assign teacher", description: e?.message, variant: "destructive" }),
  });
  const unassignTeacher = useMutation({
    mutationFn: ({ subjectId, teacherId }: { subjectId: string; teacherId: string }) =>
      apiFetch(`/api/subjects/${subjectId}/teachers/${teacherId}`, token, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Teacher removed" }); },
    onError: (e: any) => toast({ title: "Could not remove teacher", description: e?.message, variant: "destructive" }),
  });

  const teachersFor = (subjectId: string) => subjectTeachers.filter((st) => st.subject_id === subjectId);
  const unassignedTeachers = assignFor
    ? phaseTeachers.filter((t) => !teachersFor(assignFor.id).some((st) => st.teacher_id === t.id))
    : [];

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Subjects</h1>
            <p className="text-gray-500 mt-1">Manage subjects and assign teachers</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-subject">
            <Plus className="h-4 w-4 mr-2" /> New Subject
          </Button>
        </div>

        <PhaseTabs />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : visibleSubjects.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookMarked className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No subjects yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first subject (e.g. Maths) to get started</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Subject
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleSubjects.map((subj) => {
              const assigned = teachersFor(subj.id);
              return (
                <Card key={subj.id} data-testid={`card-subject-${subj.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <BookMarked className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{subj.name}</p>
                          {subj.code && <p className="text-xs text-gray-400">{subj.code}</p>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Teachers</p>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">None assigned</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assigned.map((st) => (
                            <Badge key={st.id} variant="outline" className="gap-1 pr-1">
                              {st.teacher_name ?? "Teacher"}
                              <button
                                className="hover:text-red-500"
                                onClick={() => unassignTeacher.mutate({ subjectId: subj.id, teacherId: st.teacher_id })}
                                data-testid={`button-unassign-${st.id}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t">
                      <Button
                        size="sm" variant="outline" className="gap-1"
                        onClick={() => { setAssignFor(subj); setTeacherToAdd(""); }}
                        data-testid={`button-assign-${subj.id}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Assign
                      </Button>
                      <Button
                        size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                        onClick={() => setDeleteTarget(subj)}
                        data-testid={`button-delete-${subj.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create subject */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Subject</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subject Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maths" data-testid="input-subject-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Code (optional)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MATH101" data-testid="input-subject-code" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSubject.mutate()}
              disabled={!name.trim() || createSubject.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-subject"
            >
              {createSubject.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign teacher */}
      <Dialog open={!!assignFor} onOpenChange={(o) => { if (!o) setAssignFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign teacher to {assignFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {teachers.length === 0 ? (
              <p className="text-sm text-amber-600">No teachers found. Add teachers first.</p>
            ) : unassignedTeachers.length === 0 ? (
              <p className="text-sm text-gray-500">All teachers are already assigned to this subject.</p>
            ) : (
              <div className="space-y-1.5">
                <Label>Teacher</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={teacherToAdd}
                  onChange={(e) => setTeacherToAdd(e.target.value)}
                  data-testid="select-teacher-assign"
                >
                  <option value="">Select teacher…</option>
                  {unassignedTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)}>Close</Button>
            <Button
              disabled={!teacherToAdd || assignTeacher.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => assignFor && assignTeacher.mutate({ subjectId: assignFor.id, teacherId: teacherToAdd })}
              data-testid="button-confirm-assign"
            >
              {assignTeacher.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete subject */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.name ?? "this subject"} and all of its teacher assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSubject.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteSubject.mutate(deleteTarget.id); }}
              data-testid="button-confirm-delete-subject"
            >
              {deleteSubject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
