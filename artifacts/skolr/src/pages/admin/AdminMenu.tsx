import React, { useMemo, useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, Plus, Trash2, ChevronLeft, ChevronRight, Loader2, CalendarDays,
} from "lucide-react";

async function apiFetch(url: string, token: string, options?: Omit<RequestInit, "body"> & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(errBody));
  }
  if (res.status === 204) return null;
  return res.json();
}

interface Meal {
  slot: string;
  description: string;
}

interface DailyMenu {
  id: string;
  school_id: string;
  menu_date: string;
  meals: Meal[];
}

const DEFAULT_SLOTS = ["Breakfast", "Mid-Morning Snack", "Lunch", "Afternoon Snack"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday of the week containing the given ISO date. */
function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function prettyDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
}

function prettyDayShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function AdminMenu() {
  const { profile, school, session } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const schoolId = school?.id ?? profile?.school_id ?? "";
  const token = session?.access_token ?? "";

  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));

  // The week (Mon–Fri) the selected date falls in.
  const weekDays = useMemo(() => {
    const mon = mondayOf(selectedDate);
    return Array.from({ length: 5 }, (_, i) => addDays(mon, i));
  }, [selectedDate]);

  const rangeFrom = view === "day" ? selectedDate : weekDays[0];
  const rangeTo = view === "day" ? selectedDate : weekDays[weekDays.length - 1];

  const { data: menus = [], isLoading } = useQuery<DailyMenu[]>({
    queryKey: ["daily-menu", schoolId, rangeFrom, rangeTo],
    queryFn: () => apiFetch(`/api/daily-menu?from=${rangeFrom}&to=${rangeTo}`, token),
    enabled: !!schoolId && !!token,
  });

  const menuByDate = useMemo(() => {
    const map = new Map<string, DailyMenu>();
    for (const m of menus) map.set(m.menu_date, m);
    return map;
  }, [menus]);

  const saveMenu = useMutation({
    mutationFn: (body: { menu_date: string; meals: Meal[] }) =>
      apiFetch("/api/daily-menu", token, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-menu"] });
      toast({ title: "Menu saved" });
    },
    onError: () => toast({ title: "Could not save menu", variant: "destructive" }),
  });

  const deleteMenu = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/daily-menu/${id}`, token, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-menu"] });
      toast({ title: "Menu cleared" });
    },
  });

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-blue-600" /> Daily Menu
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Set the meals served each day. View by day or by week.</p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              onClick={() => setView("day")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === "day" ? "bg-white shadow-sm text-blue-700" : "text-gray-500"}`}
              data-testid="button-view-day"
            >
              Day
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === "week" ? "bg-white shadow-sm text-blue-700" : "text-gray-500"}`}
              data-testid="button-view-week"
            >
              Week
            </button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(addDays(selectedDate, view === "day" ? -1 : -7))}
              data-testid="button-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {view === "day" ? prettyDate(selectedDate) : `${prettyDayShort(weekDays[0])} – ${prettyDayShort(weekDays[4])}`}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(addDays(selectedDate, view === "day" ? 1 : 7))}
              data-testid="button-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="h-9 w-auto"
              data-testid="input-date"
            />
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(toISODate(new Date()))}>Today</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading menu…
          </div>
        ) : view === "day" ? (
          <DayEditor
            date={selectedDate}
            menu={menuByDate.get(selectedDate) ?? null}
            saving={saveMenu.isPending}
            onSave={meals => saveMenu.mutate({ menu_date: selectedDate, meals })}
            onClear={id => deleteMenu.mutate(id)}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {weekDays.map(d => (
              <Card key={d} className={d === toISODate(new Date()) ? "ring-2 ring-blue-200" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{prettyDayShort(d)}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedDate(d); setView("day"); }} data-testid={`button-edit-${d}`}>
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const m = menuByDate.get(d);
                    const meals = (m?.meals ?? []).filter(x => x.slot.trim() || x.description.trim());
                    if (meals.length === 0) return <p className="text-sm text-gray-400 py-2">No menu set</p>;
                    return (
                      <ul className="space-y-2">
                        {meals.map((meal, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium text-gray-800">{meal.slot}</span>
                            {meal.description ? <span className="text-gray-500"> — {meal.description}</span> : null}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

function DayEditor({
  date, menu, saving, onSave, onClear,
}: {
  date: string;
  menu: DailyMenu | null;
  saving: boolean;
  onSave: (meals: Meal[]) => void;
  onClear: (id: string) => void;
}) {
  const initial = useMemo<Meal[]>(() => {
    if (menu && menu.meals.length) return menu.meals.map(m => ({ slot: m.slot, description: m.description }));
    return DEFAULT_SLOTS.map(slot => ({ slot, description: "" }));
  }, [menu]);

  const [meals, setMeals] = useState<Meal[]>(initial);

  // Reset the editor whenever the loaded menu/date changes.
  React.useEffect(() => { setMeals(initial); }, [initial, date]);

  function update(i: number, field: keyof Meal, value: string) {
    setMeals(prev => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }
  function add() {
    setMeals(prev => [...prev, { slot: "", description: "" }]);
  }
  function remove(i: number) {
    setMeals(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{prettyDate(date)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meals.map((meal, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-end">
            <div>
              {i === 0 && <Label className="text-xs text-gray-500">Meal</Label>}
              <Input
                value={meal.slot}
                onChange={e => update(i, "slot", e.target.value)}
                placeholder="e.g. Lunch"
                className="mt-0.5 h-9"
                data-testid={`input-slot-${i}`}
              />
            </div>
            <div>
              {i === 0 && <Label className="text-xs text-gray-500">What's being served</Label>}
              <Input
                value={meal.description}
                onChange={e => update(i, "description", e.target.value)}
                placeholder="e.g. Chicken & rice with veggies"
                className="mt-0.5 h-9"
                data-testid={`input-desc-${i}`}
              />
            </div>
            <Button variant="ghost" size="icon" className="text-red-500 h-9 w-9" onClick={() => remove(i)} data-testid={`button-remove-${i}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} data-testid="button-add-meal">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add meal
        </Button>
      </CardContent>
      <div className="flex items-center justify-between gap-2 px-6 pb-6">
        <div>
          {menu && (
            <Button variant="ghost" className="text-red-500" onClick={() => onClear(menu.id)} data-testid="button-clear-menu">
              Clear day
            </Button>
          )}
        </div>
        <Button
          onClick={() => onSave(meals.filter(m => m.slot.trim() || m.description.trim()))}
          disabled={saving}
          data-testid="button-save-menu"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Menu
        </Button>
      </div>
    </Card>
  );
}
