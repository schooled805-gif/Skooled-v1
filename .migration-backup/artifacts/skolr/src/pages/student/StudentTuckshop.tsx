import React, { useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Wallet, Plus, Minus, X, AlertCircle, Receipt } from "lucide-react";

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
  items: { name: string; price: number; quantity: number }[];
  total_cents: number;
  total_display: string;
  status: string;
  order_date: string;
}

interface Transaction {
  id: string;
  amount_cents: number;
  amount_display: string;
  type: string;
  description: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  ready: "bg-purple-100 text-purple-700",
  collected: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function StudentTuckshop() {
  const { profile, school, user } = useAuth();
  const qc = useQueryClient();
  const schoolId = school?.id ?? profile?.schoolId ?? "";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Get student record via profile
  const { data: students = [] } = useQuery<{ id: string }[]>({
    queryKey: ["students-by-profile", profile?.id],
    queryFn: () => apiFetch(`/api/students?profile_id=${profile?.id}`, user?.id ?? ""),
    enabled: !!profile?.id,
  });
  const studentId = students[0]?.id ?? null;

  const { data: account } = useQuery<TuckshopAccount>({
    queryKey: ["tuckshop-account-student", studentId],
    queryFn: () => apiFetch(`/api/tuckshop/account?student_id=${studentId}`, user?.id ?? ""),
    enabled: !!studentId,
  });

  const { data: menu } = useQuery<Menu | null>({
    queryKey: ["tuckshop-menu", schoolId],
    queryFn: () => apiFetch(`/api/tuckshop/menu?school_id=${schoolId}`, user?.id ?? ""),
    enabled: !!schoolId,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["tuckshop-orders-student", studentId],
    queryFn: () => apiFetch(`/api/tuckshop/orders?student_id=${studentId}`, user?.id ?? ""),
    enabled: !!studentId,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["tuckshop-transactions", account?.id],
    queryFn: () => apiFetch(`/api/tuckshop/transactions?account_id=${account?.id}`, user?.id ?? ""),
    enabled: !!account?.id,
  });

  const placeOrder = useMutation({
    mutationFn: (body: object) => apiFetch("/api/tuckshop/orders", user?.id ?? "", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tuckshop-account-student", studentId] });
      qc.invalidateQueries({ queryKey: ["tuckshop-orders-student", studentId] });
      qc.invalidateQueries({ queryKey: ["tuckshop-transactions", account?.id] });
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
    if (!studentId || !schoolId) return;
    setOrderError(null);
    placeOrder.mutate({
      student_id: studentId,
      school_id: schoolId,
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

  const readyOrder = orders.find(o => o.status === "ready");

  return (
    <PortalLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tuckshop</h1>
            <p className="text-sm text-gray-500">Order from today's menu</p>
          </div>
          {cartCount > 0 && (
            <Button onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-4 w-4 mr-2" />Cart ({cartCount})
            </Button>
          )}
        </div>

        {/* Ready to collect banner */}
        {readyOrder && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
            🎉 Your order is ready to collect at the tuckshop!
          </div>
        )}

        {/* Order success */}
        {orderSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
            ✓ Order placed! You'll be notified when it's ready.
          </div>
        )}

        {/* Balance card */}
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-orange-200 text-sm">My Tuckshop Balance</p>
              <p className="text-3xl font-bold mt-1">R {account?.balance_display ?? "0.00"}</p>
              {account && account.balance_cents < 500 && (
                <p className="text-yellow-300 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />Low balance — ask a parent to top up
                </p>
              )}
            </div>
            <Wallet className="h-10 w-10 text-orange-300" />
          </CardContent>
        </Card>

        <Tabs defaultValue="order">
          <TabsList>
            <TabsTrigger value="order">This Week's Menu</TabsTrigger>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          {/* ── MENU ── */}
          <TabsContent value="order" className="mt-4">
            {!menu ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No menu published for this week yet</CardContent></Card>
            ) : (
              <div className="space-y-5">
                <p className="text-sm font-medium text-gray-500">{menu.week_label}</p>
                {Object.entries(byCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{cat}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {items.map(item => {
                        const inCart = cart.find(c => c.item.id === item.id);
                        return (
                          <div key={item.id} className="border rounded-xl p-3 bg-white hover:shadow-sm transition-shadow">
                            <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                            <p className="font-bold text-gray-900 mt-2 text-base">R {(item.price / 100).toFixed(2)}</p>
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

          {/* ── ORDERS ── */}
          <TabsContent value="orders" className="mt-4">
            {orders.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No orders yet</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Card key={order.id}>
                    <CardContent className="p-4 flex items-center justify-between">
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
                      <p className="font-bold">R {order.total_display}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TRANSACTIONS ── */}
          <TabsContent value="transactions" className="mt-4">
            {transactions.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-gray-400">No transactions yet</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {transactions.map(txn => (
                  <div key={txn.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{txn.description}</p>
                      <p className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className={`font-bold text-sm ${txn.amount_cents >= 0 ? "text-green-600" : "text-gray-900"}`}>
                      R {txn.amount_display}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Cart dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Your Order</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {cart.map(c => (
              <div key={c.item.id} className="flex items-center justify-between text-sm">
                <span>{c.qty}× {c.item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">R {((c.item.price * c.qty) / 100).toFixed(2)}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400"
                    onClick={() => setCart(prev => prev.filter(x => x.item.id !== c.item.id))}>
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
                Balance after: <span className={cartTotal > account.balance_cents ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                  R {((account.balance_cents - cartTotal) / 100).toFixed(2)}
                </span>
              </p>
            )}
            {orderError && <p className="text-xs text-red-600 mt-2">{orderError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)}>Back</Button>
            <Button onClick={submitOrder} disabled={placeOrder.isPending}>
              {placeOrder.isPending ? "Placing…" : "Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
