import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  BadgeCheck,
  CircleDollarSign,
  ClipboardCheck,
  Package,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DriverDeliveryWorkspace } from '@/components/DriverDeliveryWorkspace'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

type Role = 'ADMIN' | 'SELLER' | 'BUYER' | 'DRIVER'
type DeliveryMethod = 'INSTANT' | 'NEXT_DAY' | 'REGULAR'

type AuthUser = {
  id: string
  email: string
  username: string
  roles: Role[]
  activeRole?: Role
}

type Notice = { kind: 'success' | 'error'; message: string } | null
type Product = {
  id: string
  name: string
  description?: string
  price: number
  stock: number
  imageUrl?: string
  store?: { id: string; name: string; description?: string }
}
type StoreResource = {
  id: string
  name: string
  description?: string
  products?: Product[]
}
type Review = {
  id: string
  name: string
  rating: number
  category: string
  comment: string
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
}
type Cart = {
  id: string
  store?: StoreResource | null
  items: Array<{ id: string; quantity: number; product: Product }>
}
type Order = {
  id: string
  status: string
  subtotal: number
  discountAmount: number
  ppnAmount: number
  deliveryFee: number
  finalTotal: number
  deliveryMethod: DeliveryMethod
  store?: StoreResource
  histories?: Array<{ id: string; status: string; note?: string; createdAt: string }>
  deliveryJob?: { id: string; status: string; earning: number }
}
type DeliveryJob = {
  id: string
  status: string
  earning: number
  order: Order
}
type WalletTransaction = {
  id: string
  type: string
  amount: number
  note?: string
  createdAt: string
}
type BuyerSpendingReport = {
  orderCount: number
  completedOrders: number
  totalSpent: number
  totalDiscount: number
}
type SellerIncomeReport = {
  orderCount: number
  completedOrders: number
  grossIncome: number
}
type DriverEarningsReport = {
  total: number
  earnings: Array<{ id: string; amount: number; createdAt: string }>
}
type DiscountResource = {
  id: string
  code: string
  type: string
  amount: number
  remainingUsage?: number
  expiresAt: string
  isActive: boolean
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const roleOptions: Role[] = ['BUYER', 'SELLER', 'DRIVER', 'ADMIN']
const deliveryOptions: DeliveryMethod[] = ['REGULAR', 'NEXT_DAY', 'INSTANT']

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('accessToken') ?? '')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [stores, setStores] = useState<StoreResource[]>([])
  const [wallet, setWallet] = useState<{ balance: number } | null>(null)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [buyerReport, setBuyerReport] = useState<BuyerSpendingReport | null>(null)
  const [sellerOrders, setSellerOrders] = useState<Order[]>([])
  const [sellerReport, setSellerReport] = useState<SellerIncomeReport | null>(null)
  const [jobs, setJobs] = useState<DeliveryJob[]>([])
  const [driverJobs, setDriverJobs] = useState<DeliveryJob[]>([])
  const [driverEarnings, setDriverEarnings] = useState<DriverEarningsReport | null>(null)
  const [monitoring, setMonitoring] = useState<Record<string, unknown> | null>(null)
  const [vouchers, setVouchers] = useState<DiscountResource[]>([])
  const [promos, setPromos] = useState<DiscountResource[]>([])

  const activeRole = user?.activeRole
  const authHeaders = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  )

  useEffect(() => {
    loadPublicData()
  }, [])

  useEffect(() => {
    if (!activeRole) return
    loadRoleData(activeRole)
  }, [activeRole])

  async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || 'Request failed'
      throw new Error(message)
    }

    return data as T
  }

  async function run(message: string, action: () => Promise<void>) {
    try {
      await action()
      setNotice({ kind: 'success', message })
    } catch (error) {
      setNotice({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  async function loadPublicData() {
    const [nextProducts, nextReviews, nextStores] = await Promise.all([
      request<Product[]>('/products'),
      request<Review[]>('/reviews'),
      request<StoreResource[]>('/stores'),
    ])
    setProducts(nextProducts)
    setReviews(nextReviews)
    setStores(nextStores)
  }

  async function loadRoleData(role: Role) {
    if (role === 'BUYER') {
      const [
        nextWallet,
        nextTransactions,
        nextAddresses,
        nextCart,
        nextOrders,
        nextReport,
      ] = await Promise.all([
        request<{ balance: number }>('/buyer/wallet', { headers: authHeaders }),
        request<WalletTransaction[]>('/buyer/wallet/transactions', { headers: authHeaders }),
        request<Address[]>('/buyer/addresses', { headers: authHeaders }),
        request<Cart>('/buyer/cart', { headers: authHeaders }),
        request<Order[]>('/buyer/orders', { headers: authHeaders }),
        request<BuyerSpendingReport>('/buyer/reports/spending', { headers: authHeaders }),
      ])
      setWallet(nextWallet)
      setWalletTransactions(nextTransactions)
      setAddresses(nextAddresses)
      setCart(nextCart)
      setOrders(nextOrders)
      setBuyerReport(nextReport)
    }

    if (role === 'SELLER') {
      const [nextStores, nextOrders, nextReport] = await Promise.all([
        request<StoreResource[]>('/stores/me', { headers: authHeaders }),
        request<Order[]>('/seller/orders', { headers: authHeaders }),
        request<SellerIncomeReport>('/seller/reports/income', { headers: authHeaders }),
      ])
      setStores(nextStores)
      setSellerOrders(nextOrders)
      setSellerReport(nextReport)
    }

    if (role === 'DRIVER') {
      const [nextJobs, mine, nextEarnings] = await Promise.all([
        request<DeliveryJob[]>('/driver/jobs/available', { headers: authHeaders }),
        request<DeliveryJob[]>('/driver/jobs', { headers: authHeaders }),
        request<DriverEarningsReport>('/driver/earnings', { headers: authHeaders }),
      ])
      setJobs(nextJobs)
      setDriverJobs(mine)
      setDriverEarnings(nextEarnings)
    }

    if (role === 'ADMIN') {
      const [nextMonitoring, nextVouchers, nextPromos] = await Promise.all([
        request<Record<string, unknown>>('/admin/monitoring', { headers: authHeaders }),
        request<unknown[]>('/admin/vouchers', { headers: authHeaders }),
        request<unknown[]>('/admin/promos', { headers: authHeaders }),
      ])
      setMonitoring(nextMonitoring)
      setVouchers(nextVouchers)
      setPromos(nextPromos)
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>, mode: 'login' | 'register') {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run(mode === 'login' ? 'Signed in. Choose an active role.' : 'Account created. Sign in next.', async () => {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const data = await request<{ accessToken: string; user: AuthUser } | AuthUser>(path, {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          username: form.get('username') || undefined,
          password: form.get('password'),
        }),
      })

      if ('accessToken' in data) {
        localStorage.setItem('accessToken', data.accessToken)
        setToken(data.accessToken)
        setUser(data.user)
      }
    })
  }

  async function selectRole(role: Role) {
    await run(`${role} role is active.`, async () => {
      const data = await request<{ accessToken: string; user: AuthUser }>('/auth/select-role', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role }),
      })
      localStorage.setItem('accessToken', data.accessToken)
      setToken(data.accessToken)
      setUser(data.user)
    })
  }

  function logout() {
    localStorage.removeItem('accessToken')
    setToken('')
    setUser(null)
    setNotice({ kind: 'success', message: 'Session cleared.' })
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-emerald-700" />
              <h1 className="text-2xl font-semibold tracking-normal">SEAPEDIA</h1>
              <Badge variant="secondary">Level 7 Demo</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Public marketplace, active-role dashboards, checkout, delivery, and admin operations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeRole ? 'success' : 'outline'}>
              {activeRole ?? 'GUEST'}
            </Badge>
            {user && <span className="text-sm font-medium">{user.username}</span>}
            <Button variant="ghost" onClick={logout} disabled={!token}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-10">
        <section className="grid gap-6">
          {notice && (
            <Alert variant={notice.kind === 'success' ? 'success' : 'destructive'}>
              {notice.message}
            </Alert>
          )}
          <AuthPanel user={user} onAuth={handleAuth} onSelectRole={selectRole} />
          <ReviewPanel reviews={reviews} onRefresh={loadPublicData} run={run} />
        </section>

        <section className="grid gap-6">
          <PublicCatalog products={products} onAddToCart={(productId) => {
            void run('Product added to cart.', async () => {
              await request('/buyer/cart/items', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ productId, quantity: 1 }),
              })
              await loadRoleData('BUYER')
            })
          }} canBuy={activeRole === 'BUYER'} />

          {activeRole === 'BUYER' && (
            <BuyerPanel
              wallet={wallet}
              walletTransactions={walletTransactions}
              addresses={addresses}
              cart={cart}
              orders={orders}
              report={buyerReport}
              run={run}
              refresh={() => loadRoleData('BUYER')}
              request={request}
              authHeaders={authHeaders}
            />
          )}

          {activeRole === 'SELLER' && (
            <SellerPanel
              stores={stores}
              orders={sellerOrders}
              report={sellerReport}
              run={run}
              refresh={() => loadRoleData('SELLER')}
              request={request}
              authHeaders={authHeaders}
            />
          )}

          {activeRole === 'DRIVER' && (
            <DriverPanel
              jobs={jobs}
              driverJobs={driverJobs}
              earnings={driverEarnings}
              run={run}
              refresh={() => loadRoleData('DRIVER')}
              request={request}
              authHeaders={authHeaders}
            />
          )}

          {activeRole === 'ADMIN' && (
            <AdminPanel
              monitoring={monitoring}
              vouchers={vouchers}
              promos={promos}
              run={run}
              refresh={() => loadRoleData('ADMIN')}
              request={request}
              authHeaders={authHeaders}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function AuthPanel({
  user,
  onAuth,
  onSelectRole,
}: {
  user: AuthUser | null
  onAuth: (event: FormEvent<HTMLFormElement>, mode: 'login' | 'register') => void
  onSelectRole: (role: Role) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5" />
          Account and active role
        </CardTitle>
        <CardDescription>Login first, then choose exactly one role for protected actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <AuthForm mode="login" onSubmit={onAuth} />
          <AuthForm mode="register" onSubmit={onAuth} />
        </div>
        {user && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {roleOptions.filter((role) => user.roles.includes(role)).map((role) => (
                <Button key={role} variant={user.activeRole === role ? 'default' : 'outline'} onClick={() => onSelectRole(role)}>
                  <BadgeCheck className="h-4 w-4" />
                  {role}
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AuthForm({
  mode,
  onSubmit,
}: {
  mode: 'login' | 'register'
  onSubmit: (event: FormEvent<HTMLFormElement>, mode: 'login' | 'register') => void
}) {
  return (
    <form className="grid gap-3" onSubmit={(event) => onSubmit(event, mode)}>
      <h3 className="font-semibold">{mode === 'login' ? 'Login' : 'Register buyer'}</h3>
      <Field id={`${mode}-email`} label="Email">
        <Input id={`${mode}-email`} name="email" type="email" required />
      </Field>
      {mode === 'register' && (
        <Field id="register-username" label="Username">
          <Input id="register-username" name="username" required />
        </Field>
      )}
      <Field id={`${mode}-password`} label="Password">
        <Input id={`${mode}-password`} name="password" type="password" minLength={6} required />
      </Field>
      <Button type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
    </form>
  )
}

function ReviewPanel({
  reviews,
  onRefresh,
  run,
}: {
  reviews: Review[]
  onRefresh: () => Promise<void>
  run: (message: string, action: () => Promise<void>) => Promise<void>
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run('Review submitted.', async () => {
      await fetchJson('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          rating: Number(form.get('rating')),
          category: form.get('category'),
          comment: form.get('comment'),
        }),
      })
      event.currentTarget.reset()
      await onRefresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Public reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3" onSubmit={submit}>
          <Input name="name" placeholder="Name" required />
          <Input name="rating" type="number" min={1} max={5} defaultValue={5} required />
          <Input name="category" placeholder="Category" defaultValue="guest" required />
          <Textarea name="comment" placeholder="Review" required />
          <Button type="submit">Submit review</Button>
        </form>
        <div className="grid gap-3">
          {reviews.slice(0, 4).map((review) => (
            <div key={review.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <strong>{review.name}</strong>
                <Badge variant="outline">{review.rating}/5</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PublicCatalog({
  products,
  canBuy,
  onAddToCart,
}: {
  products: Product[]
  canBuy: boolean
  onAddToCart: (productId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Public catalog
        </CardTitle>
        <CardDescription>Guests can browse; buyers can add products to cart.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {products.length === 0 && <EmptyState>No products yet.</EmptyState>}
        {products.map((product) => (
          <div key={product.id} className="rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.store?.name ?? 'Store'}</p>
              </div>
              <Badge variant="secondary">{formatMoney(product.price)}</Badge>
            </div>
            <p className="mt-3 text-sm">{product.description || 'No description.'}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stock {product.stock}</span>
              <Button size="sm" disabled={!canBuy || product.stock < 1} onClick={() => onAddToCart(product.id)}>
                Add
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BuyerPanel(props: {
  wallet: { balance: number } | null
  walletTransactions: WalletTransaction[]
  addresses: Address[]
  cart: Cart | null
  orders: Order[]
  report: BuyerSpendingReport | null
  run: (message: string, action: () => Promise<void>) => Promise<void>
  refresh: () => Promise<void>
  request: <T>(path: string, options?: RequestInit) => Promise<T>
  authHeaders: Record<string, string>
}) {
  const { wallet, walletTransactions, addresses, cart, orders, report, run, refresh, request, authHeaders } = props

  return (
    <Dashboard title="Buyer dashboard" icon={<CircleDollarSign className="h-5 w-5" />}>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Wallet" value={formatMoney(wallet?.balance ?? 0)} />
        <Metric label="Orders" value={String(report?.orderCount ?? 0)} />
        <Metric label="Completed" value={String(report?.completedOrders ?? 0)} />
        <Metric label="Spent" value={formatMoney(report?.totalSpent ?? 0)} />
      </div>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Wallet topped up.', async (body) => {
        await request('/buyer/wallet/top-up', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <Input name="amount" type="number" min={1000} placeholder="Top up amount" required />
        <Button type="submit">Top up</Button>
      </form>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Address saved.', async (body) => {
        await request('/buyer/addresses', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <Input name="label" placeholder="Address label" required />
        <Input name="recipient" placeholder="Recipient" required />
        <Input name="phone" placeholder="Phone" required />
        <Input name="fullAddress" placeholder="Full address" required />
        <Input name="city" placeholder="City" required />
        <Input name="postalCode" placeholder="Postal code" required />
        <Button type="submit">Save address</Button>
      </form>
      <div className="rounded-md border p-4">
        <h3 className="font-semibold">Cart</h3>
        <p className="text-sm text-muted-foreground">{cart?.store?.name ?? 'No store selected'}</p>
        <div className="mt-3 grid gap-2">
          {cart?.items?.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span>{item.product.name} x {item.quantity}</span>
              <span>{formatMoney(item.product.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Checkout completed.', async (body) => {
        await request('/buyer/checkout', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <select name="addressId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
          <option value="">Select address</option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>{address.label} - {address.city}</option>
          ))}
        </select>
        <select name="deliveryMethod" className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue="REGULAR">
          {deliveryOptions.map((method) => <option key={method} value={method}>{method}</option>)}
        </select>
        <Input name="discountCode" placeholder="Discount code optional" />
        <Button type="submit" disabled={!cart?.items?.length}>Checkout</Button>
      </form>
      <TimelineList
        title="Wallet transactions"
        empty="No wallet transactions yet."
        items={walletTransactions.slice(0, 5).map((transaction) => ({
          id: transaction.id,
          label: `${transaction.type} ${formatMoney(transaction.amount)}`,
          meta: transaction.note || formatDate(transaction.createdAt),
        }))}
      />
      <OrderList orders={orders} />
    </Dashboard>
  )
}

function SellerPanel(props: {
  stores: StoreResource[]
  orders: Order[]
  report: SellerIncomeReport | null
  run: (message: string, action: () => Promise<void>) => Promise<void>
  refresh: () => Promise<void>
  request: <T>(path: string, options?: RequestInit) => Promise<T>
  authHeaders: Record<string, string>
}) {
  const { stores, orders, report, run, refresh, request, authHeaders } = props
  const firstStore = stores[0]

  return (
    <Dashboard title="Seller dashboard" icon={<Store className="h-5 w-5" />}>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Orders" value={String(report?.orderCount ?? 0)} />
        <Metric label="Completed" value={String(report?.completedOrders ?? 0)} />
        <Metric label="Gross income" value={formatMoney(report?.grossIncome ?? 0)} />
      </div>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Store saved.', async (body) => {
        await request('/stores', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <Input name="name" placeholder="Store name" required />
        <Textarea name="description" placeholder="Store description" />
        <Button type="submit">Create store</Button>
      </form>
      {firstStore && (
        <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Product saved.', async (body) => {
          await request(`/stores/${firstStore.id}/products`, { method: 'POST', headers: authHeaders, body })
          await refresh()
        })}>
          <Input name="name" placeholder="Product name" required />
          <Textarea name="description" placeholder="Description" />
          <Input name="price" type="number" min={1} placeholder="Price" required />
          <Input name="stock" type="number" min={0} placeholder="Stock" required />
          <Input name="imageUrl" placeholder="Image URL optional" />
          <Button type="submit">Create product in {firstStore.name}</Button>
        </form>
      )}
      <div className="grid gap-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <span>{order.id.slice(0, 8)} - {order.status}</span>
              <Button size="sm" disabled={order.status !== 'SEDANG_DIKEMAS'} onClick={() => {
                void run('Order processed.', async () => {
                  await request(`/seller/orders/${order.id}/process`, { method: 'POST', headers: authHeaders })
                  await refresh()
                })
              }}>Process</Button>
            </div>
          </div>
        ))}
      </div>
    </Dashboard>
  )
}

function DriverPanel(props: {
  jobs: DeliveryJob[]
  driverJobs: DeliveryJob[]
  earnings: DriverEarningsReport | null
  run: (message: string, action: () => Promise<void>) => Promise<void>
  refresh: () => Promise<void>
  request: <T>(path: string, options?: RequestInit) => Promise<T>
  authHeaders: Record<string, string>
}) {
  const { jobs, driverJobs, earnings, run, refresh, request, authHeaders } = props
  return (
    <Dashboard title="Driver dashboard" icon={<Truck className="h-5 w-5" />}>
      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="Total earnings" value={formatMoney(earnings?.total ?? 0)} />
        <Metric label="Completed jobs" value={String(earnings?.earnings.length ?? 0)} />
      </div>
      <h3 className="font-semibold">Available jobs</h3>
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
          <span>{job.order?.store?.name ?? 'Store'} - {formatMoney(job.earning)}</span>
          <Button size="sm" onClick={() => {
            void run('Job taken.', async () => {
              await request(`/driver/jobs/${job.id}/take`, { method: 'POST', headers: authHeaders })
              await refresh()
            })
          }}>Take</Button>
        </div>
      ))}
      <h3 className="font-semibold">My jobs</h3>
      {driverJobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
          <span>{job.status} - {formatMoney(job.earning)}</span>
          <Button size="sm" disabled={job.status !== 'TAKEN'} onClick={() => {
            void run('Delivery completed.', async () => {
              await request(`/driver/jobs/${job.id}/complete`, { method: 'POST', headers: authHeaders })
              await refresh()
            })
          }}>Complete</Button>
        </div>
      ))}
      <TimelineList
        title="Earning history"
        empty="No earnings yet."
        items={(earnings?.earnings ?? []).slice(0, 5).map((earning) => ({
          id: earning.id,
          label: formatMoney(earning.amount),
          meta: formatDate(earning.createdAt),
        }))}
      />
    </Dashboard>
  )
}

function AdminPanel(props: {
  monitoring: Record<string, unknown> | null
  vouchers: unknown[]
  promos: unknown[]
  run: (message: string, action: () => Promise<void>) => Promise<void>
  refresh: () => Promise<void>
  request: <T>(path: string, options?: RequestInit) => Promise<T>
  authHeaders: Record<string, string>
}) {
  const { monitoring, vouchers, promos, run, refresh, request, authHeaders } = props

  return (
    <Dashboard title="Admin dashboard" icon={<ShieldCheck className="h-5 w-5" />}>
      <div className="grid gap-3 md:grid-cols-4">
        {monitoring && Object.entries(monitoring).map(([key, value]) => (
          <Metric key={key} label={key} value={String(value)} />
        ))}
      </div>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Voucher created.', async (body) => {
        await request('/admin/vouchers', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <DiscountFields />
        <Button type="submit">Create voucher</Button>
      </form>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Promo created.', async (body) => {
        await request('/admin/promos', { method: 'POST', headers: authHeaders, body })
        await refresh()
      })}>
        <DiscountFields />
        <Button type="submit">Create promo</Button>
      </form>
      <form className="grid gap-3" onSubmit={(event) => submitJson(event, run, 'Admin user created.', async (body) => {
        await request('/admin/users', { method: 'POST', headers: authHeaders, body })
      })}>
        <Input name="email" type="email" placeholder="Admin email" required />
        <Input name="username" placeholder="Admin username" required />
        <Input name="password" type="password" minLength={6} placeholder="Password" required />
        <Button type="submit">Create admin user</Button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => {
          void run('Time advanced.', async () => {
            await request('/admin/time/advance', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({ days: 1 }),
            })
            await refresh()
          })
        }}>Advance 1 day</Button>
        <Button variant="secondary" onClick={() => {
          void run('Overdue processor completed.', async () => {
            await request('/admin/overdue/process', { method: 'POST', headers: authHeaders })
            await refresh()
          })
        }}>Process overdue</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Vouchers: {vouchers.length} | Promos: {promos.length}
      </p>
      <TimelineList
        title="Voucher codes"
        empty="No vouchers yet."
        items={vouchers.slice(0, 5).map((voucher) => ({
          id: voucher.id,
          label: `${voucher.code} - ${voucher.type} ${voucher.amount}`,
          meta: `${voucher.remainingUsage ?? 0} uses left, expires ${formatDate(voucher.expiresAt)}`,
        }))}
      />
      <TimelineList
        title="Promo codes"
        empty="No promos yet."
        items={promos.slice(0, 5).map((promo) => ({
          id: promo.id,
          label: `${promo.code} - ${promo.type} ${promo.amount}`,
          meta: `Expires ${formatDate(promo.expiresAt)}`,
        }))}
      />
    </Dashboard>
  )
}

function DiscountFields() {
  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  return (
    <>
      <Input name="code" placeholder="Code" required />
      <select name="type" className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue="FIXED">
        <option value="FIXED">Fixed rupiah</option>
        <option value="PERCENTAGE">Percentage</option>
      </select>
      <Input name="amount" type="number" min={1} placeholder="Amount" required />
      <Input name="remainingUsage" type="number" min={1} placeholder="Usage count for voucher" />
      <Input name="expiresAt" type="date" defaultValue={nextMonth.toISOString().slice(0, 10)} required />
    </>
  )
}

function Dashboard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  )
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <div className="grid gap-3">
      <h3 className="font-semibold">Orders</h3>
      {orders.length === 0 && <EmptyState>No orders yet.</EmptyState>}
      {orders.map((order) => (
        <div key={order.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <span>{order.id.slice(0, 8)} - {order.status}</span>
            <strong>{formatMoney(order.finalTotal)}</strong>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Subtotal {formatMoney(order.subtotal)} | Discount {formatMoney(order.discountAmount)} | PPN {formatMoney(order.ppnAmount)} | Delivery {formatMoney(order.deliveryFee)}
          </p>
        </div>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{children}</p>
}

function TimelineList({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; label: string; meta: string }>
}) {
  return (
    <div className="grid gap-3">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 && <EmptyState>{empty}</EmptyState>}
      {items.map((item) => (
        <div key={item.id} className="rounded-md border p-3">
          <p className="font-medium">{item.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p>
        </div>
      ))}
    </div>
  )
}

async function submitJson(
  event: FormEvent<HTMLFormElement>,
  run: (message: string, action: () => Promise<void>) => Promise<void>,
  message: string,
  action: (body: string) => Promise<void>,
) {
  event.preventDefault()
  const form = event.currentTarget
  const body = Object.fromEntries(new FormData(form).entries())
  await run(message, async () => {
    await action(JSON.stringify(cleanBody(body)))
    form.reset()
  })
}

function cleanBody(body: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== ''),
  )
}

async function fetchJson(path: string, options: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'Request failed')
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
