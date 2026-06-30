import { useState } from 'react'
import type { FormEvent } from 'react'
import { Banknote, MapPin, Package, ShoppingBag } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field } from '@/components/Field'
import { apiRequest, authHeaders, getErrorMessage } from '@/lib/api'

type Notice = { kind: 'success' | 'error'; message: string } | null

type Wallet = { id: string; userId: string; balance: number }

type WalletTransaction = {
  id: string
  type: string
  amount: number
  note?: string | null
  createdAt: string
}

type Address = {
  id: string
  label: string
  recipient: string
  phone: string
  fullAddress: string
  city: string
  postalCode: string
  isDefault: boolean
}

type Product = {
  id: string
  name: string
  price: number
  stock: number
  storeId: string
}

type CartItem = {
  id: string
  quantity: number
  product: Product
}

type Cart = {
  id: string
  storeId: string | null
  items: CartItem[]
}

type Order = {
  id: string
  status: string
  deliveryMethod: string
  finalTotal: number
  createdAt: string
}

type Tab = 'wallet' | 'addresses' | 'catalog' | 'cart' | 'orders'

const DELIVERY_METHODS = ['INSTANT', 'NEXT_DAY', 'REGULAR'] as const

export function BuyerWorkspace({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>('wallet')
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<(typeof DELIVERY_METHODS)[number]>(
    'REGULAR',
  )

  const headers = authHeaders(token)

  function withNotice<T>(promise: Promise<T>, successMessage?: string) {
    setLoading(true)
    setNotice(null)
    return promise
      .then((result) => {
        if (successMessage) {
          setNotice({ kind: 'success', message: successMessage })
        }
        return result
      })
      .catch((error: unknown) => {
        setNotice({ kind: 'error', message: getErrorMessage(error) })
        throw error
      })
      .finally(() => setLoading(false))
  }

  async function loadWallet() {
    const data = await withNotice(
      apiRequest<Wallet>('/buyer/wallet', { headers }),
    ).catch(() => null)
    if (data) setWallet(data)
  }

  async function loadTransactions() {
    const data = await withNotice(
      apiRequest<WalletTransaction[]>('/buyer/wallet/transactions', { headers }),
    ).catch(() => null)
    if (data) setTransactions(data)
  }

  async function handleTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount'))

    const data = await withNotice(
      apiRequest<Wallet>('/buyer/wallet/top-up', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount }),
      }),
      'Wallet topped up.',
    ).catch(() => null)

    if (data) {
      setWallet(data)
      event.currentTarget.reset()
      void loadTransactions()
    }
  }

  async function loadAddresses() {
    const data = await withNotice(
      apiRequest<Address[]>('/buyer/addresses', { headers }),
    ).catch(() => null)
    if (data) {
      setAddresses(data)
      if (!selectedAddressId && data.length > 0) {
        setSelectedAddressId(data[0].id)
      }
    }
  }

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    await withNotice(
      apiRequest<Address>('/buyer/addresses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          label: form.get('label'),
          recipient: form.get('recipient'),
          phone: form.get('phone'),
          fullAddress: form.get('fullAddress'),
          city: form.get('city'),
          postalCode: form.get('postalCode'),
        }),
      }),
      'Address saved.',
    ).catch(() => null)

    event.currentTarget.reset()
    void loadAddresses()
  }

  async function handleDeleteAddress(addressId: string) {
    await withNotice(
      apiRequest(`/buyer/addresses/${addressId}`, { method: 'DELETE', headers }),
      'Address removed.',
    ).catch(() => null)
    void loadAddresses()
  }

  async function loadCatalog() {
    const data = await withNotice(apiRequest<Product[]>('/products')).catch(() => null)
    if (data) setProducts(data)
  }

  async function loadCart() {
    const data = await withNotice(
      apiRequest<Cart>('/buyer/cart', { headers }),
    ).catch(() => null)
    if (data) setCart(data)
  }

  async function handleAddToCart(productId: string) {
    await withNotice(
      apiRequest('/buyer/cart/items', {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId, quantity: 1 }),
      }),
      'Added to cart.',
    ).catch(() => null)
    void loadCart()
  }

  async function handleUpdateCartItem(itemId: string, quantity: number) {
    if (quantity < 1) return
    await withNotice(
      apiRequest(`/buyer/cart/items/${itemId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ quantity }),
      }),
    ).catch(() => null)
    void loadCart()
  }

  async function handleRemoveCartItem(itemId: string) {
    await withNotice(
      apiRequest(`/buyer/cart/items/${itemId}`, { method: 'DELETE', headers }),
      'Item removed from cart.',
    ).catch(() => null)
    void loadCart()
  }

  async function loadOrders() {
    const data = await withNotice(
      apiRequest<Order[]>('/buyer/orders', { headers }),
    ).catch(() => null)
    if (data) setOrders(data)
  }

  async function handleCheckout() {
    if (!selectedAddressId) {
      setNotice({ kind: 'error', message: 'Add and select a delivery address first.' })
      return
    }

    await withNotice(
      apiRequest('/buyer/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          addressId: selectedAddressId,
          deliveryMethod,
          discountCode: discountCode.trim() || undefined,
        }),
      }),
      'Checkout complete. Wallet deducted and order created.',
    ).catch(() => null)

    void loadCart()
    void loadWallet()
    void loadOrders()
  }

  function openTab(next: Tab) {
    setTab(next)
    setNotice(null)
    if (next === 'wallet' && !wallet) void loadWallet()
    if (next === 'addresses' && addresses.length === 0) void loadAddresses()
    if (next === 'catalog' && products.length === 0) void loadCatalog()
    if (next === 'cart' && !cart) void loadCart()
    if (next === 'orders' && orders.length === 0) void loadOrders()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buyer demo</CardTitle>
        <CardDescription>
          Calls the Level 3 buyer endpoints directly against the API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs>
          <TabsList className="grid-cols-5">
            <TabsTrigger active={tab === 'wallet'} onClick={() => openTab('wallet')}>
              Wallet
            </TabsTrigger>
            <TabsTrigger active={tab === 'addresses'} onClick={() => openTab('addresses')}>
              Addresses
            </TabsTrigger>
            <TabsTrigger active={tab === 'catalog'} onClick={() => openTab('catalog')}>
              Catalog
            </TabsTrigger>
            <TabsTrigger active={tab === 'cart'} onClick={() => openTab('cart')}>
              Cart
            </TabsTrigger>
            <TabsTrigger active={tab === 'orders'} onClick={() => openTab('orders')}>
              Orders
            </TabsTrigger>
          </TabsList>

          {notice && (
            <Alert className="mt-5" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
              {notice.message}
            </Alert>
          )}

          {tab === 'wallet' && (
            <TabsContent>
              <div className="flex items-center justify-between rounded-md border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Banknote className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-xl font-semibold">
                      {wallet ? formatIdr(wallet.balance) : '—'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" onClick={loadTransactions} disabled={loading}>
                  Load history
                </Button>
              </div>

              <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={handleTopUp}>
                <Field id="amount" label="Top-up amount (IDR)">
                  <Input id="amount" name="amount" type="number" min={1000} step={1000} required />
                </Field>
                <Button type="submit" className="self-end" disabled={loading}>
                  Top up
                </Button>
              </form>

              {transactions.length > 0 && (
                <div className="mt-5 grid gap-2">
                  {transactions.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2">
                          {entry.type}
                        </Badge>
                        {entry.note}
                      </span>
                      <span className={entry.amount < 0 ? 'text-destructive' : 'text-emerald-700'}>
                        {entry.amount < 0 ? '-' : '+'}
                        {formatIdr(Math.abs(entry.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {tab === 'addresses' && (
            <TabsContent>
              <div className="grid gap-3">
                {addresses.map((address) => (
                  <div key={address.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-medium">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {address.label}
                          {address.isDefault && <Badge variant="success">Default</Badge>}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {address.recipient} · {address.phone}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {address.fullAddress}, {address.city} {address.postalCode}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAddress(address.id)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {addresses.length === 0 && (
                  <p className="text-sm text-muted-foreground">No addresses yet.</p>
                )}
              </div>

              <Separator className="my-5" />

              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateAddress}>
                <Field id="label" label="Label">
                  <Input id="label" name="label" placeholder="Home" required />
                </Field>
                <Field id="recipient" label="Recipient">
                  <Input id="recipient" name="recipient" required />
                </Field>
                <Field id="phone" label="Phone">
                  <Input id="phone" name="phone" placeholder="0812xxxxxxx" required />
                </Field>
                <Field id="city" label="City">
                  <Input id="city" name="city" required />
                </Field>
                <Field id="fullAddress" label="Full address">
                  <Input id="fullAddress" name="fullAddress" required />
                </Field>
                <Field id="postalCode" label="Postal code">
                  <Input id="postalCode" name="postalCode" required />
                </Field>
                <Button type="submit" className="sm:col-span-2" disabled={loading}>
                  Save address
                </Button>
              </form>
            </TabsContent>
          )}

          {tab === 'catalog' && (
            <TabsContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        {product.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatIdr(product.price)} · {product.stock} in stock
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={loading || product.stock < 1}
                    >
                      Add to cart
                    </Button>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products published yet.</p>
                )}
              </div>
            </TabsContent>
          )}

          {tab === 'cart' && (
            <TabsContent>
              <div className="grid gap-3">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatIdr(item.product.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateCartItem(item.id, item.quantity - 1)}
                        disabled={loading}
                      >
                        -
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateCartItem(item.id, item.quantity + 1)}
                        disabled={loading}
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCartItem(item.id)}
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {(!cart || cart.items.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Cart is empty. Add a product from the Catalog tab.
                  </p>
                )}
              </div>

              {cart && cart.items.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Field id="checkout-address" label="Address">
                      <select
                        id="checkout-address"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={selectedAddressId}
                        onChange={(event) => setSelectedAddressId(event.target.value)}
                      >
                        <option value="">Select address</option>
                        {addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="checkout-delivery" label="Delivery method">
                      <select
                        id="checkout-delivery"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={deliveryMethod}
                        onChange={(event) =>
                          setDeliveryMethod(event.target.value as typeof deliveryMethod)
                        }
                      >
                        {DELIVERY_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="checkout-discount" label="Voucher or promo code">
                      <Input
                        id="checkout-discount"
                        value={discountCode}
                        onChange={(event) => setDiscountCode(event.target.value)}
                        placeholder="HEMAT10"
                      />
                    </Field>
                    <Button className="self-end" onClick={handleCheckout} disabled={loading}>
                      Checkout
                    </Button>
                  </div>
                  {addresses.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Add a delivery address in the Addresses tab before checking out.
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          )}

          {tab === 'orders' && (
            <TabsContent>
              <div className="grid gap-3">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Order {order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.deliveryMethod} · {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{order.status}</Badge>
                      <p className="mt-1 text-sm font-medium">{formatIdr(order.finalTotal)}</p>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    amount,
  )
}
