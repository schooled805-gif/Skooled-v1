import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Wallet, ClipboardList, Plus, Minus, X, AlertCircle } from "lucide-react";

async function apiFetch(url: string, userId: string, options?: RequestInit & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", "x-user-id": userId, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(errBody));
  }
  return res.json();
}

interface TuckshopAccount {
  id: string;
  student_id: string;
  student_name: string;
  balance_cents: number;
  balance_display: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
}

interface Menu {
  id: string;
  week_label: string;
  items: MenuItem[];
}

interface CartItem { item: MenuItem; qty: number }

interface Order {
  id: string;
  student_id: string;
  items: { name: string; price: number; quantity: number }[];
  total_cents: number;
  total_display: string;
  status: string;
  order_date: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  ready: "bg-purple-100 text-purple-700",
  collected: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function ParentTuckshop() {
  const { profile, school, user } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.schoolId ?? "";

  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Linked children
  const { data: links = [] } = useQuery<{ student_id: string; student_name: string; school_id: string }[]>({
    queryKey: ["parent-links", user?.id],
    queryFn: () => apiFetch(`/api/parent-student-links?parent_user_id=${user?.id}`, user?.id ?? ""),
    enabled: !!user?.id,
  });

  const activeChild = selectedChild ?? links[0]?.student_id ?? null;
  const activeChildName = links.find(l => l.student_id === activeChild)?.student_name ?? "Child";

  // Account for active child
  const { data: account } = useQuery<TuckshopAccount>({
    queryKey: ["tuckshop-account", activeChild],
    queryFn: () => apiFetch(`/api/tuckshop/account?student_id=${activeChild}`, user?.id ?? ""),
    enabled: !!activeChild,
  });

  // Current menu
  const { data: menu } = useQuery<Menu | null>({
    queryKey: ["tuckshop-menu", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/menu?school_id=${schoolId}`, user?.id ?? ""),
    enabled: !!schoolId,
  });

  // Orders for active child
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["tuckshop-orders", activeChild],
    queryFn: () => apiFetch(`/api/tuckshop/orders?student_id=${activeChild}`, user?.id ?? ""),
    enabled: !!activeChild,
  });

  const placeOrder = useMutation({
    mutationFn: (body: object) => apiFetch("/api/tuckshop/orders", user?.id ?? "", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tuckshop-account", activeChild] });
      qc.invalidateQueries({ queryKey: ["tuckshop-orders", activeChild] });
      setCart([]);
      setCartOpen(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    },
    onError: async (err: Error) => {
      try {
        const json = JSON.parse(err.message);
        setOrderError(json.error ?? "Failed to place order");
      } catch {
        setOrderError("Failed to place order");
      }
    },
  });

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === id);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(c => c.item.id !== id);
      return prev.map(c => c.item.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  function submitOrder() {
    if (!activeChild || !schoolId) return;
    setOrderError(null);
    placeOrder.mutate({
      student_id: activeChild,
      school_id: schoolId,
      parent_user_id: user?.id,
      items: cart.map(c => ({ menuItemId: c.item.id, name: c.item.name, price: c.item.price, quantity: c.qty })),
      total_cents: cartTotal,
      order_date: new Date().toISOString().split("T")[0],
    });
  }

  const byCategory = menu?.items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!item.available) return acc;
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {}) ?? {};

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tuckshop</h1>
            <p className="text-sm text-gray-500">Order food for your child &amp; manage their tuckshop balance</p>
          </div>
          {cartCount > 0 && (
            <Button onClick={() => setCartOpen(true)} className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart ({cartCount})
            </Button>
          )}
        </div>

        {/* Success banner */}
        {orderSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
            ✓ Order placed successfully! The tuckshop has been notified.
          </div>
        )}

        {/* Child selector */}
        {links.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {links.map(l => (
              <Button
                key={l.student_id}
                variant={activeChild === l.student_id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedChild(l.student_id)}
              >
                {l.student_name}
              </Button>
            ))}
          </div>
        )}

        {/* Balance card */}
        {account && (
          <Card className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">{activeChildName}'s Tuckshop Balance</p>
                  <p className="text-3xl font-bold mt-1">R {account.balance_display}</p>
                  {account.balance_cents < 500 && (
                    <p className="text-yellow-300 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />Low balance — ask the school office to top up
                    </p>
                  )}
                </div>
                <Wallet className="h-10 w-10 text-purple-300" />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="order">
          <TabsList>
            <TabsTrigger value="order">Order Food</TabsTrigger>
            <TabsTrigger value="history">Order History</TabsTrigger>
          </TabsList>

          {/* ── MENU ── */}
          <TabsContent value="order" className="mt-4">
            {!menu ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No menu published for this week yet</CardContent></Card>
            ) : (
              <div className="space-y-6">
                <p className="text-sm font-medium text-gray-600">{menu.week_label}</p>
                {Object.entries(byCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {items.map(item => {
                        const inCart = cart.find(c => c.item.id === item.id);
                        return (
                          <div key={item.id} className="border rounded-xl p-3 bg-white hover:shadow-sm transition-shadow">
                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                            <p className="font-bold text-gray-900 mt-2">R {(item.price / 100).toFixed(2)}</p>
                            {inCart ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => removeFromCart(item.id)}><Minus className="h-3 w-3" /></Button>
                                <span className="text-sm font-bold w-4 text-center">{inCart.qty}</span>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => addToCart(item)}><Plus className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <Button size="sm" className="mt-2 h-7 text-xs w-full" onClick={() => addToCart(item)}>Add</Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── HISTORY ── */}
          <TabsContent value="history" className="mt-4">
            {orders.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No orders yet</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100"}`}>
                              {order.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">{order.order_date}</span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {order.items.map((i, idx) => <span key={idx}>{i.quantity}× {i.name}{idx < order.items.length - 1 ? ", " : ""}</span>)}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900">R {order.total_display}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Cart dialog ── */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Your Cart — {activeChildName}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cart.map(c => (
              <div key={c.item.id} className="flex items-center justify-between text-sm">
                <span>{c.qty}× {c.item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">R {((c.item.price * c.qty) / 100).toFixed(2)}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => setCart(prev => prev.filter(x => x.item.id !== c.item.id))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>R {(cartTotal / 100).toFixed(2)}</span>
            </div>
            {account && (
              <p className="text-xs text-gray-500 mt-1">
                Balance after order: <span className={cartTotal > account.balance_cents ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                  R {((account.balance_cents - cartTotal) / 100).toFixed(2)}
                </span>
              </p>
            )}
            {orderError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{orderError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)}>Back</Button>
            <Button onClick={submitOrder} disabled={placeOrder.isPending || cart.length === 0}>
              {placeOrder.isPending ? "Placing…" : "Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
