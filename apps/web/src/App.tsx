import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Image,
  LockKeyhole,
  MapPin,
  PackagePlus,
  Pencil,
  PlusCircle,
  RefreshCw,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import heroImg from './assets/hero.png'

type Role = 'ADMIN' | 'SELLER' | 'BUYER' | 'DRIVER'

type AuthUser = {
  id: string
  email: string
  username: string
  roles: Role[]
  createdAt?: string
  updatedAt?: string
}

type AuthResponse = {
  accessToken: string
  user: AuthUser
}

type StoreRecord = {
  id: string
  name: string
  description: string | null
  sellerId: string
  createdAt: string
  updatedAt: string
}

type ProductRecord = {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  stock: number
  storeId: string
  createdAt: string
  updatedAt: string
}

type CatalogProduct = ProductRecord & {
  store: {
    id: string
    name: string
  }
}

type WalletRecord = {
  id: string
  userId: string
  balance: number
  createdAt: string
  updatedAt: string
}

type AddressRecord = {
  id: string
  userId: string
  label: string
  recipientName: string
  phone: string
  street: string
  city: string
  province: string
  postalCode: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type CartStore = {
  id: string
  name: string
}

type CartProduct = ProductRecord & {
  store: CartStore
}

type CartItemRecord = {
  id: string
  productId: string
  quantity: number
  snapshotPrice: number
  lineTotal: number
  product: CartProduct
}

type CartRecord = {
  id: string
  userId: string
  storeId: string | null
  store: CartStore | null
  items: CartItemRecord[]
  totalItems: number
  subtotal: number
  createdAt: string
  updatedAt: string
}

type CartConflictResponse = {
  message?: string
  currentStore?: CartStore
  incomingStore?: CartStore
}

type AuthMode = 'login' | 'register'
type Notice = { kind: 'success' | 'error'; message: string } | null

class ApiRequestError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const marketplaceItems = [
  {
    title: 'Starter Storefront',
    description: 'Seller onboarding profile with role validation ready.',
    icon: Store,
    accent: 'bg-emerald-100 text-emerald-900',
  },
  {
    title: 'Buyer Access',
    description: 'Guest browsing and buyer identity separated from seller tools.',
    icon: UserRound,
    accent: 'bg-sky-100 text-sky-900',
  },
  {
    title: 'Driver Lane',
    description: 'Prepared for fulfillment roles without changing the account model.',
    icon: Truck,
    accent: 'bg-amber-100 text-amber-950',
  },
]

const reviewHighlights = [
  'Application review',
  'Public marketplace',
  'Role-ready auth',
]

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [token, setToken] = useState(() => localStorage.getItem('accessToken') ?? '')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authNotice, setAuthNotice] = useState<Notice>(null)
  const [reviewNotice, setReviewNotice] = useState<Notice>(null)
  const [catalogNotice, setCatalogNotice] = useState<Notice>(null)
  const [sellerNotice, setSellerNotice] = useState<Notice>(null)
  const [buyerNotice, setBuyerNotice] = useState<Notice>(null)
  const [cartNotice, setCartNotice] = useState<Notice>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [isSellerLoading, setIsSellerLoading] = useState(false)
  const [isBuyerLoading, setIsBuyerLoading] = useState(false)
  const [isCartLoading, setIsCartLoading] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [sellerStores, setSellerStores] = useState<StoreRecord[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [sellerProducts, setSellerProducts] = useState<ProductRecord[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletRecord | null>(null)
  const [addresses, setAddresses] = useState<AddressRecord[]>([])
  const [cart, setCart] = useState<CartRecord | null>(null)
  const [pendingCartProduct, setPendingCartProduct] = useState<CatalogProduct | null>(null)

  const activeRoles = useMemo(
    () => currentUser?.roles ?? [],
    [currentUser],
  )
  const isSeller = activeRoles.includes('SELLER')
  const isBuyer = activeRoles.includes('BUYER')
  const selectedStore = sellerStores.find((store) => store.id === selectedStoreId)

  const request = useCallback(async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        data?.message instanceof Array
          ? data.message.join(', ')
          : data?.message || 'Request failed'
      throw new ApiRequestError(message, response.status, data)
    }

    return data as T
  }, [])

  const authHeaders = useCallback(function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
    }
  }, [token])

  const loadCatalog = useCallback(async function loadCatalog() {
    setIsCatalogLoading(true)
    setCatalogNotice(null)

    try {
      const products = await request<CatalogProduct[]>('/catalog/products')
      setCatalogProducts(products)
    } catch (error) {
      setCatalogNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCatalogLoading(false)
    }
  }, [request])

  const loadStores = useCallback(async function loadStores() {
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      const stores = await request<StoreRecord[]>('/stores/me', {
        headers: authHeaders(),
      })
      const nextStoreId = selectedStoreId || stores[0]?.id || ''
      setSellerStores(stores)
      setSelectedStoreId(nextStoreId)

      if (nextStoreId) {
        const products = await request<ProductRecord[]>(`/stores/${nextStoreId}/products`, {
          headers: authHeaders(),
        })
        setSellerProducts(products)
      }
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }, [authHeaders, request, selectedStoreId])

  const loadSellerProducts = useCallback(async function loadSellerProducts(storeId: string) {
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      const products = await request<ProductRecord[]>(`/stores/${storeId}/products`, {
        headers: authHeaders(),
      })
      setSellerProducts(products)
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }, [authHeaders, request])

  const loadBuyerWorkspace = useCallback(async function loadBuyerWorkspace() {
    if (!token) {
      setBuyerNotice({ kind: 'error', message: 'Login with a buyer account first.' })
      return
    }

    setIsBuyerLoading(true)
    setBuyerNotice(null)

    try {
      const [nextWallet, nextAddresses] = await Promise.all([
        request<WalletRecord>('/wallet/me', {
          headers: authHeaders(),
        }),
        request<AddressRecord[]>('/addresses/me', {
          headers: authHeaders(),
        }),
      ])
      setWallet(nextWallet)
      setAddresses(nextAddresses)
      setBuyerNotice({ kind: 'success', message: 'Buyer workspace loaded.' })
    } catch (error) {
      setBuyerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBuyerLoading(false)
    }
  }, [authHeaders, request, token])

  const loadCart = useCallback(async function loadCart() {
    if (!token) {
      setCartNotice({ kind: 'error', message: 'Login with a buyer account first.' })
      return
    }

    setIsCartLoading(true)
    setCartNotice(null)

    try {
      const nextCart = await request<CartRecord>('/cart/me', {
        headers: authHeaders(),
      })
      setCart(nextCart)
      setCartNotice({ kind: 'success', message: 'Cart loaded.' })
    } catch (error) {
      setCartNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCartLoading(false)
    }
  }, [authHeaders, request, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCatalog])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsAuthLoading(true)
    setAuthNotice(null)

    try {
      const data = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      })

      localStorage.setItem('accessToken', data.accessToken)
      setToken(data.accessToken)
      setCurrentUser(data.user)
      setAuthNotice({ kind: 'success', message: `Welcome back, ${data.user.username}.` })
    } catch (error) {
      setAuthNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsAuthLoading(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsAuthLoading(true)
    setAuthNotice(null)

    try {
      const user = await request<AuthUser>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          username: form.get('username'),
          password: form.get('password'),
        }),
      })

      setAuthNotice({
        kind: 'success',
        message: `${user.username} is registered with ${user.roles.join(', ')} access.`,
      })
      setAuthMode('login')
    } catch (error) {
      setAuthNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsAuthLoading(false)
    }
  }

  async function loadProfile() {
    if (!token) {
      setAuthNotice({ kind: 'error', message: 'Login first to load your profile.' })
      return
    }

    setIsProfileLoading(true)
    setAuthNotice(null)

    try {
      const user = await request<AuthUser>('/auth/me', {
        headers: authHeaders(),
      })
      setCurrentUser(user)
      setAuthNotice({ kind: 'success', message: 'Profile loaded.' })
    } catch (error) {
      setAuthNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsProfileLoading(false)
    }
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      const store = await request<StoreRecord>('/stores', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: stringValue(data.get('storeName')),
          description: optionalString(data.get('storeDescription')),
        }),
      })
      form.reset()
      setSelectedStoreId(store.id)
      setSellerNotice({ kind: 'success', message: `${store.name} is ready for products.` })
      await loadStores()
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) {
      setSellerNotice({ kind: 'error', message: 'Create or select a store first.' })
      return
    }

    const form = event.currentTarget
    const data = new FormData(form)
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      await request<ProductRecord>(`/stores/${selectedStoreId}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(productPayload(data, false)),
      })
      form.reset()
      setSellerNotice({ kind: 'success', message: 'Product added to your store.' })
      await Promise.all([loadSellerProducts(selectedStoreId), loadCatalog()])
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }

  async function handleUpdateProduct(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      await request<ProductRecord>(`/products/${productId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(productPayload(data, true)),
      })
      setEditingProductId(null)
      setSellerNotice({ kind: 'success', message: 'Product updated.' })
      await Promise.all([loadSellerProducts(selectedStoreId), loadCatalog()])
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }

  async function handleDeleteProduct(productId: string) {
    setIsSellerLoading(true)
    setSellerNotice(null)

    try {
      await request<{ message: string }>(`/products/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      setSellerNotice({ kind: 'success', message: 'Product deleted.' })
      await Promise.all([loadSellerProducts(selectedStoreId), loadCatalog()])
    } catch (error) {
      setSellerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSellerLoading(false)
    }
  }

  async function topUpWallet(amount: number) {
    setIsBuyerLoading(true)
    setBuyerNotice(null)

    try {
      const nextWallet = await request<WalletRecord>('/wallet/top-up', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount }),
      })
      setWallet(nextWallet)
      setBuyerNotice({ kind: 'success', message: `${currency.format(amount)} added to your wallet.` })
    } catch (error) {
      setBuyerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBuyerLoading(false)
    }
  }

  async function handleTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const amount = numberValue(data.get('topUpAmount')) ?? 0

    await topUpWallet(amount)
    form.reset()
  }

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setIsBuyerLoading(true)
    setBuyerNotice(null)

    try {
      await request<AddressRecord>('/addresses', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(addressPayload(data)),
      })
      form.reset()
      setBuyerNotice({ kind: 'success', message: 'Address saved.' })
      await loadBuyerWorkspace()
    } catch (error) {
      setBuyerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBuyerLoading(false)
    }
  }

  async function handleSetDefaultAddress(addressId: string) {
    setIsBuyerLoading(true)
    setBuyerNotice(null)

    try {
      await request<AddressRecord>(`/addresses/${addressId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isDefault: true }),
      })
      setBuyerNotice({ kind: 'success', message: 'Default address updated.' })
      await loadBuyerWorkspace()
    } catch (error) {
      setBuyerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBuyerLoading(false)
    }
  }

  async function handleDeleteAddress(addressId: string) {
    setIsBuyerLoading(true)
    setBuyerNotice(null)

    try {
      await request<{ message: string }>(`/addresses/${addressId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      setBuyerNotice({ kind: 'success', message: 'Address deleted.' })
      await loadBuyerWorkspace()
    } catch (error) {
      setBuyerNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsBuyerLoading(false)
    }
  }

  async function addProductToCart(product: CatalogProduct) {
    if (!token) {
      setCartNotice({ kind: 'error', message: 'Login with a buyer account to add products.' })
      return
    }

    if (!isBuyer) {
      setCartNotice({ kind: 'error', message: 'BUYER access is required to use the cart.' })
      return
    }

    setIsCartLoading(true)
    setCartNotice(null)
    setPendingCartProduct(null)

    try {
      const nextCart = await request<CartRecord>('/cart/items', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      })
      setCart(nextCart)
      setCartNotice({ kind: 'success', message: `${product.name} added to cart.` })
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        const conflict = error.data as CartConflictResponse
        setPendingCartProduct(product)
        setCartNotice({
          kind: 'error',
          message: `${conflict.currentStore?.name ?? 'Another store'} is already in your cart. Clear it before adding from ${conflict.incomingStore?.name ?? product.store.name}.`,
        })
      } else {
        setCartNotice({ kind: 'error', message: getErrorMessage(error) })
      }
    } finally {
      setIsCartLoading(false)
    }
  }

  async function updateCartItemQuantity(itemId: string, quantity: number) {
    setIsCartLoading(true)
    setCartNotice(null)

    try {
      const nextCart = await request<CartRecord>(`/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ quantity }),
      })
      setCart(nextCart)
      setCartNotice({ kind: 'success', message: 'Cart quantity updated.' })
    } catch (error) {
      setCartNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCartLoading(false)
    }
  }

  async function removeCartItem(itemId: string) {
    setIsCartLoading(true)
    setCartNotice(null)

    try {
      const nextCart = await request<CartRecord>(`/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      setCart(nextCart)
      setCartNotice({ kind: 'success', message: 'Item removed from cart.' })
    } catch (error) {
      setCartNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCartLoading(false)
    }
  }

  async function clearCart() {
    setIsCartLoading(true)
    setCartNotice(null)

    try {
      const nextCart = await request<CartRecord>('/cart/clear', {
        method: 'DELETE',
        headers: authHeaders(),
      })
      setCart(nextCart)
      setPendingCartProduct(null)
      setCartNotice({ kind: 'success', message: 'Cart cleared.' })
    } catch (error) {
      setCartNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCartLoading(false)
    }
  }

  async function clearCartAndRetry() {
    if (!pendingCartProduct) return

    const product = pendingCartProduct
    setIsCartLoading(true)
    setCartNotice(null)

    try {
      await request<CartRecord>('/cart/clear', {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const nextCart = await request<CartRecord>('/cart/items', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      })
      setCart(nextCart)
      setPendingCartProduct(null)
      setCartNotice({ kind: 'success', message: `${product.name} added after clearing the cart.` })
    } catch (error) {
      setCartNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsCartLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('accessToken')
    setToken('')
    setCurrentUser(null)
    setSellerStores([])
    setSelectedStoreId('')
    setSellerProducts([])
    setWallet(null)
    setAddresses([])
    setCart(null)
    setPendingCartProduct(null)
    setAuthNotice({ kind: 'success', message: 'Session cleared.' })
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('reviewerName') ?? 'Guest')
    setReviewNotice({
      kind: 'success',
      message: `Thanks, ${name}. Your review is ready for marketplace moderation.`,
    })
    form.reset()
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_68%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:grid-cols-[1.08fr_0.92fr] md:px-8 lg:px-10">
          <div className="flex flex-col justify-center py-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                SEAPEDIA Marketplace
              </Badge>
              <Badge variant="outline">Guest</Badge>
              <Badge variant="outline">Buyer</Badge>
              <Badge variant="outline">Seller</Badge>
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-balance md:text-6xl">
              Public marketplace access with products sellers manage live.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Browse real catalog items as a guest, then sign in as a seller to
              create storefronts and publish products into SEAPEDIA.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => setAuthMode('register')}>
                Create account
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={loadProfile}>
                <ShieldCheck className="h-4 w-4" />
                Check roles
              </Button>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#ffffff_0%,#eef9f3_52%,#e8f3ff_100%)]" />
            <div className="relative flex h-full flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <Badge variant="success">Marketplace live</Badge>
                <Badge variant="outline">Seller CRUD</Badge>
              </div>
              <div className="mx-auto my-8 flex w-full max-w-sm items-center justify-center">
                <img
                  src={heroImg}
                  alt="Layered marketplace system"
                  className="h-52 w-52 object-contain drop-shadow-xl md:h-64 md:w-64"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {reviewHighlights.map((label) => (
                  <div key={label} className="rounded-md border bg-white/80 p-3 text-sm font-medium">
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 md:grid-cols-3 md:px-8 lg:px-10">
        {marketplaceItems.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title}>
              <CardHeader>
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-md ${item.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </section>

      <CatalogSection
        canAddToCart={Boolean(token && isBuyer)}
        isLoading={isCatalogLoading}
        notice={catalogNotice}
        products={catalogProducts}
        onAddToCart={addProductToCart}
        onRefresh={loadCatalog}
      />

      <CartSection
        cart={cart}
        isBuyer={isBuyer}
        isLoading={isCartLoading}
        notice={cartNotice}
        pendingProduct={pendingCartProduct}
        token={token}
        onClear={clearCart}
        onClearAndRetry={clearCartAndRetry}
        onRefresh={loadCart}
        onRemoveItem={removeCartItem}
        onUpdateQuantity={updateCartItemQuantity}
      />

      <AuthSection
        activeRoles={activeRoles}
        authMode={authMode}
        authNotice={authNotice}
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        isProfileLoading={isProfileLoading}
        token={token}
        onAuthModeChange={setAuthMode}
        onLogin={handleLogin}
        onLogout={logout}
        onRegister={handleRegister}
        onLoadProfile={loadProfile}
      />

      <SellerDashboard
        editingProductId={editingProductId}
        isSeller={isSeller}
        isLoading={isSellerLoading}
        notice={sellerNotice}
        products={sellerProducts}
        selectedStore={selectedStore}
        selectedStoreId={selectedStoreId}
        stores={sellerStores}
        token={token}
        onCreateProduct={handleCreateProduct}
        onCreateStore={handleCreateStore}
        onDeleteProduct={handleDeleteProduct}
        onEditProduct={setEditingProductId}
        onRefreshStores={loadStores}
        onSelectStore={(storeId) => {
          setSelectedStoreId(storeId)
          if (storeId) {
            void loadSellerProducts(storeId)
          }
        }}
        onUpdateProduct={handleUpdateProduct}
      />

      <BuyerWorkspace
        addresses={addresses}
        isBuyer={isBuyer}
        isLoading={isBuyerLoading}
        notice={buyerNotice}
        token={token}
        wallet={wallet}
        onCreateAddress={handleCreateAddress}
        onDeleteAddress={handleDeleteAddress}
        onRefresh={loadBuyerWorkspace}
        onSetDefaultAddress={handleSetDefaultAddress}
        onTopUp={handleTopUp}
        onTopUpPreset={(amount) => void topUpWallet(amount)}
      />

      <ReviewSection notice={reviewNotice} onReview={handleReview} />
    </main>
  )
}

function CatalogSection({
  canAddToCart,
  isLoading,
  notice,
  products,
  onAddToCart,
  onRefresh,
}: {
  canAddToCart: boolean
  isLoading: boolean
  notice: Notice
  products: CatalogProduct[]
  onAddToCart: (product: CatalogProduct) => void
  onRefresh: () => void
}) {
  return (
    <section className="border-y bg-muted/25">
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <PackagePlus className="h-3.5 w-3.5" />
              Live catalog
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal">Guest catalog from the database.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Public shoppers see products created by sellers through the dashboard.
            </p>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
            {isLoading ? 'Refreshing' : 'Refresh catalog'}
          </Button>
        </div>

        {notice && (
          <Alert className="mt-6" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
            {notice.message}
          </Alert>
        )}

        {isLoading && products.length === 0 ? (
          <p className="mt-8 text-muted-foreground">Loading catalog products...</p>
        ) : products.length === 0 ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>No products yet</CardTitle>
              <CardDescription>
                Once a seller creates products, they will appear here for guests.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                canAddToCart={canAddToCart}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ProductCard({
  canAddToCart,
  product,
  onAddToCart,
}: {
  canAddToCart: boolean
  product: CatalogProduct
  onAddToCart: (product: CatalogProduct) => void
}) {
  return (
    <Card className="overflow-hidden">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="flex h-44 items-center justify-center bg-muted">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>{product.store.name}</CardDescription>
          </div>
          <Badge variant={product.stock > 0 ? 'success' : 'outline'}>
            {product.stock > 0 ? `${product.stock} left` : 'Sold out'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="min-h-12 text-sm leading-6 text-muted-foreground">
          {product.description || 'No description provided.'}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-semibold">{currency.format(product.price)}</p>
          <Button
            type="button"
            size="sm"
            onClick={() => onAddToCart(product)}
            disabled={!canAddToCart || product.stock < 1}
          >
            <ShoppingCart className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CartSection({
  cart,
  isBuyer,
  isLoading,
  notice,
  pendingProduct,
  token,
  onClear,
  onClearAndRetry,
  onRefresh,
  onRemoveItem,
  onUpdateQuantity,
}: {
  cart: CartRecord | null
  isBuyer: boolean
  isLoading: boolean
  notice: Notice
  pendingProduct: CatalogProduct | null
  token: string
  onClear: () => void
  onClearAndRetry: () => void
  onRefresh: () => void
  onRemoveItem: (itemId: string) => void
  onUpdateQuantity: (itemId: string, quantity: number) => void
}) {
  const disabled = !token || !isBuyer || isLoading
  const items = cart?.items ?? []

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:px-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge variant="outline" className="mb-4 gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            Single-store cart
          </Badge>
          <h2 className="text-3xl font-semibold tracking-normal">Keep one store per cart.</h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Cart validation stays strict so checkout can be routed to one seller storefront.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onRefresh} disabled={disabled}>
            <RefreshCw className="h-4 w-4" />
            Refresh cart
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={disabled || items.length === 0}>
            Clear cart
          </Button>
        </div>
      </div>

      {!token ? (
        <Alert className="mt-6">Login with a buyer account to use the cart.</Alert>
      ) : !isBuyer ? (
        <Alert className="mt-6" variant="destructive">
          Your current account does not have BUYER access.
        </Alert>
      ) : null}

      {notice && (
        <Alert className="mt-6" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
          {notice.message}
        </Alert>
      )}

      {pendingProduct && (
        <Card className="mt-6 border-destructive/40">
          <CardHeader>
            <CardTitle>Switch cart store?</CardTitle>
            <CardDescription>
              Clear the current cart before adding {pendingProduct.name} from {pendingProduct.store.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" onClick={onClearAndRetry} disabled={disabled}>
              Clear cart and add item
            </Button>
            <Button type="button" variant="outline" onClick={onClear} disabled={disabled}>
              Clear cart only
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{cart?.store ? `Cart from ${cart.store.name}` : 'Cart is empty'}</CardTitle>
            <CardDescription>{cart?.totalItems ?? 0} item{cart?.totalItems === 1 ? '' : 's'} selected</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <Alert>Add a catalog product to start a single-store cart.</Alert>
            ) : (
              <div className="grid gap-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-md border bg-white p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currency.format(item.snapshotPrice)} each - stock {item.product.stock}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          aria-label={`Quantity for ${item.product.name}`}
                          className="w-24"
                          type="number"
                          min="1"
                          max={item.product.stock}
                          value={item.quantity}
                          disabled={disabled}
                          onChange={(event) => {
                            const quantity = Number(event.target.value)
                            if (quantity >= 1) {
                              onUpdateQuantity(item.id, quantity)
                            }
                          }}
                        />
                        <p className="min-w-24 text-right font-semibold">
                          {currency.format(item.lineTotal)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveItem(item.id)}
                          disabled={disabled}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cart summary</CardTitle>
            <CardDescription>{cart?.store?.name ?? 'No store selected'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{cart?.totalItems ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{currency.format(cart?.subtotal ?? 0)}</span>
              </div>
            </div>
            <Separator className="my-5" />
            <Alert>Checkout is prepared for the next level.</Alert>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function AuthSection({
  activeRoles,
  authMode,
  authNotice,
  currentUser,
  isAuthLoading,
  isProfileLoading,
  token,
  onAuthModeChange,
  onLogin,
  onLogout,
  onRegister,
  onLoadProfile,
}: {
  activeRoles: Role[]
  authMode: AuthMode
  authNotice: Notice
  currentUser: AuthUser | null
  isAuthLoading: boolean
  isProfileLoading: boolean
  token: string
  onAuthModeChange: (mode: AuthMode) => void
  onLogin: (event: FormEvent<HTMLFormElement>) => void
  onLogout: () => void
  onRegister: (event: FormEvent<HTMLFormElement>) => void
  onLoadProfile: () => void
}) {
  return (
    <section className="border-y bg-muted/35">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div>
          <Badge variant="outline" className="mb-4">Auth workspace</Badge>
          <h2 className="text-3xl font-semibold tracking-normal">Login, register, and inspect roles.</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            The UI calls the NestJS auth endpoints and keeps the current account roles
            visible as badges.
          </p>

          <div className="mt-6 rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current identity</p>
                <p className="mt-1 text-xl font-semibold">
                  {currentUser ? currentUser.username : 'Guest session'}
                </p>
              </div>
              <LockKeyhole className="h-6 w-6 text-muted-foreground" />
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-2">
              {activeRoles.length > 0 ? (
                activeRoles.map((role) => <Badge key={role}>{role}</Badge>)
              ) : (
                <Badge variant="outline">GUEST</Badge>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={onLoadProfile} disabled={isProfileLoading}>
                <BadgeCheck className="h-4 w-4" />
                {isProfileLoading ? 'Loading' : 'Load /auth/me'}
              </Button>
              <Button variant="ghost" onClick={onLogout} disabled={!token}>
                Clear session
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account access</CardTitle>
            <CardDescription>Use the API credentials created through the auth module.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs>
              <TabsList>
                <TabsTrigger active={authMode === 'login'} onClick={() => onAuthModeChange('login')}>
                  Login
                </TabsTrigger>
                <TabsTrigger active={authMode === 'register'} onClick={() => onAuthModeChange('register')}>
                  Register
                </TabsTrigger>
              </TabsList>

              {authNotice && (
                <Alert
                  className="mt-5"
                  variant={authNotice.kind === 'success' ? 'success' : 'destructive'}
                >
                  {authNotice.message}
                </Alert>
              )}

              {authMode === 'login' ? (
                <TabsContent>
                  <form className="grid gap-4" onSubmit={onLogin}>
                    <Field id="login-email" label="Email">
                      <Input id="login-email" name="email" type="email" autoComplete="email" required />
                    </Field>
                    <Field id="login-password" label="Password">
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        minLength={6}
                        required
                      />
                    </Field>
                    <Button type="submit" disabled={isAuthLoading}>
                      {isAuthLoading ? 'Signing in' : 'Sign in'}
                    </Button>
                  </form>
                </TabsContent>
              ) : (
                <TabsContent>
                  <form className="grid gap-4" onSubmit={onRegister}>
                    <Field id="register-email" label="Email">
                      <Input id="register-email" name="email" type="email" autoComplete="email" required />
                    </Field>
                    <Field id="register-username" label="Username">
                      <Input id="register-username" name="username" autoComplete="username" required />
                    </Field>
                    <Field id="register-password" label="Password">
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                    </Field>
                    <Button type="submit" disabled={isAuthLoading}>
                      {isAuthLoading ? 'Creating account' : 'Create buyer account'}
                    </Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function SellerDashboard({
  editingProductId,
  isSeller,
  isLoading,
  notice,
  products,
  selectedStore,
  selectedStoreId,
  stores,
  token,
  onCreateProduct,
  onCreateStore,
  onDeleteProduct,
  onEditProduct,
  onRefreshStores,
  onSelectStore,
  onUpdateProduct,
}: {
  editingProductId: string | null
  isSeller: boolean
  isLoading: boolean
  notice: Notice
  products: ProductRecord[]
  selectedStore?: StoreRecord
  selectedStoreId: string
  stores: StoreRecord[]
  token: string
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void
  onCreateStore: (event: FormEvent<HTMLFormElement>) => void
  onDeleteProduct: (productId: string) => void
  onEditProduct: (productId: string | null) => void
  onRefreshStores: () => void
  onSelectStore: (storeId: string) => void
  onUpdateProduct: (event: FormEvent<HTMLFormElement>, productId: string) => void
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:px-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge variant="outline" className="mb-4">Seller dashboard</Badge>
          <h2 className="text-3xl font-semibold tracking-normal">Manage storefronts and products.</h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Sellers can create stores, add product listings, and update inventory.
          </p>
        </div>
        <Button variant="outline" onClick={onRefreshStores} disabled={!token || !isSeller || isLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh stores
        </Button>
      </div>

      {!token ? (
        <Alert className="mt-6">Login with a seller account to manage products.</Alert>
      ) : !isSeller ? (
        <Alert className="mt-6" variant="destructive">
          Your current account does not have SELLER access.
        </Alert>
      ) : null}

      {notice && (
        <Alert className="mt-6" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
          {notice.message}
        </Alert>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create storefront</CardTitle>
            <CardDescription>A unique store name is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onCreateStore}>
              <Field id="storeName" label="Store name">
                <Input id="storeName" name="storeName" disabled={!isSeller} required />
              </Field>
              <Field id="storeDescription" label="Description">
                <Textarea id="storeDescription" name="storeDescription" disabled={!isSeller} />
              </Field>
              <Button type="submit" disabled={!isSeller || isLoading}>
                Create store
              </Button>
            </form>

            <Separator className="my-6" />

            <Field id="storeSelect" label="Selected store">
              <select
                id="storeSelect"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!isSeller || stores.length === 0}
                value={selectedStoreId}
                onChange={(event) => onSelectStore(event.target.value)}
              >
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add product</CardTitle>
            <CardDescription>
              {selectedStore ? `Publishing into ${selectedStore.name}` : 'Select a store first.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductForm
              disabled={!isSeller || !selectedStoreId || isLoading}
              submitLabel="Add product"
              onSubmit={onCreateProduct}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold tracking-normal">Store products</h3>
        {products.length === 0 ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>No products in this store</CardTitle>
              <CardDescription>Create the first product to publish it to the catalog.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{product.name}</CardTitle>
                      <CardDescription>{currency.format(product.price)}</CardDescription>
                    </div>
                    <Badge variant={product.stock > 0 ? 'success' : 'outline'}>
                      Stock {product.stock}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingProductId === product.id ? (
                    <ProductForm
                      disabled={isLoading}
                      product={product}
                      submitLabel="Save product"
                      onCancel={() => onEditProduct(null)}
                      onSubmit={(event) => onUpdateProduct(event, product.id)}
                    />
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {product.description || 'No description provided.'}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => onEditProduct(product.id)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => onDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ProductForm({
  disabled,
  product,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  disabled: boolean
  product?: ProductRecord
  submitLabel: string
  onCancel?: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field id={product ? `name-${product.id}` : 'productName'} label="Product name">
        <Input
          id={product ? `name-${product.id}` : 'productName'}
          name="productName"
          defaultValue={product?.name}
          disabled={disabled}
          required
        />
      </Field>
      <Field id={product ? `description-${product.id}` : 'productDescription'} label="Description">
        <Textarea
          id={product ? `description-${product.id}` : 'productDescription'}
          name="productDescription"
          defaultValue={product?.description ?? ''}
          disabled={disabled}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={product ? `price-${product.id}` : 'productPrice'} label="Price">
          <Input
            id={product ? `price-${product.id}` : 'productPrice'}
            name="productPrice"
            type="number"
            min="1"
            defaultValue={product?.price}
            disabled={disabled}
            required
          />
        </Field>
        <Field id={product ? `stock-${product.id}` : 'productStock'} label="Stock">
          <Input
            id={product ? `stock-${product.id}` : 'productStock'}
            name="productStock"
            type="number"
            min="0"
            defaultValue={product?.stock ?? 0}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field id={product ? `image-${product.id}` : 'productImage'} label="Image URL">
        <Input
          id={product ? `image-${product.id}` : 'productImage'}
          name="productImage"
          type="url"
          defaultValue={product?.imageUrl ?? ''}
          disabled={disabled}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function BuyerWorkspace({
  addresses,
  isBuyer,
  isLoading,
  notice,
  token,
  wallet,
  onCreateAddress,
  onDeleteAddress,
  onRefresh,
  onSetDefaultAddress,
  onTopUp,
  onTopUpPreset,
}: {
  addresses: AddressRecord[]
  isBuyer: boolean
  isLoading: boolean
  notice: Notice
  token: string
  wallet: WalletRecord | null
  onCreateAddress: (event: FormEvent<HTMLFormElement>) => void
  onDeleteAddress: (addressId: string) => void
  onRefresh: () => void
  onSetDefaultAddress: (addressId: string) => void
  onTopUp: (event: FormEvent<HTMLFormElement>) => void
  onTopUpPreset: (amount: number) => void
}) {
  const disabled = !token || !isBuyer || isLoading

  return (
    <section className="border-y bg-muted/25">
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Buyer wallet
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal">Top up funds and save addresses.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Buyers can add dummy wallet funds and keep delivery addresses ready for checkout.
            </p>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={disabled}>
            <RefreshCw className="h-4 w-4" />
            Refresh buyer data
          </Button>
        </div>

        {!token ? (
          <Alert className="mt-6">Login with a buyer account to access wallet tools.</Alert>
        ) : !isBuyer ? (
          <Alert className="mt-6" variant="destructive">
            Your current account does not have BUYER access.
          </Alert>
        ) : null}

        {notice && (
          <Alert className="mt-6" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
            {notice.message}
          </Alert>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <Card>
            <CardHeader>
              <CardTitle>Wallet balance</CardTitle>
              <CardDescription>
                {wallet ? `Last updated ${new Date(wallet.updatedAt).toLocaleString()}` : 'No wallet loaded yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-white p-5">
                <p className="text-sm font-medium text-muted-foreground">Available funds</p>
                <p className="mt-2 text-3xl font-semibold tracking-normal">
                  {currency.format(wallet?.balance ?? 0)}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[25000, 50000, 100000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="secondary"
                    onClick={() => onTopUpPreset(amount)}
                    disabled={disabled}
                    className="px-2"
                  >
                    {currency.format(amount)}
                  </Button>
                ))}
              </div>

              <form className="mt-5 grid gap-4" onSubmit={onTopUp}>
                <Field id="topUpAmount" label="Custom amount">
                  <Input
                    id="topUpAmount"
                    name="topUpAmount"
                    type="number"
                    min="1"
                    placeholder="75000"
                    disabled={disabled}
                    required
                  />
                </Field>
                <Button type="submit" disabled={disabled}>
                  <PlusCircle className="h-4 w-4" />
                  Add funds
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery addresses</CardTitle>
              <CardDescription>{addresses.length} saved address{addresses.length === 1 ? '' : 'es'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={onCreateAddress}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="addressLabel" label="Label">
                    <Input id="addressLabel" name="label" placeholder="Home" disabled={disabled} required />
                  </Field>
                  <Field id="recipientName" label="Recipient">
                    <Input id="recipientName" name="recipientName" placeholder="Alya" disabled={disabled} required />
                  </Field>
                </div>
                <Field id="addressPhone" label="Phone">
                  <Input id="addressPhone" name="phone" placeholder="+62..." disabled={disabled} required />
                </Field>
                <Field id="addressStreet" label="Street">
                  <Textarea id="addressStreet" name="street" placeholder="Jl. Sudirman No. 1" disabled={disabled} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="addressCity" label="City">
                    <Input id="addressCity" name="city" placeholder="Jakarta" disabled={disabled} required />
                  </Field>
                  <Field id="addressProvince" label="Province">
                    <Input id="addressProvince" name="province" placeholder="DKI Jakarta" disabled={disabled} required />
                  </Field>
                  <Field id="postalCode" label="Postal code">
                    <Input id="postalCode" name="postalCode" placeholder="10210" disabled={disabled} required />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    name="isDefault"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    disabled={disabled}
                  />
                  Make default address
                </label>
                <Button type="submit" disabled={disabled}>
                  Save address
                </Button>
              </form>

              <Separator className="my-6" />

              {addresses.length === 0 ? (
                <Alert>No delivery addresses saved yet.</Alert>
              ) : (
                <div className="grid gap-3">
                  {addresses.map((address) => (
                    <div key={address.id} className="rounded-md border bg-white p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <p className="font-semibold">{address.label}</p>
                            {address.isDefault && <Badge variant="success">Default</Badge>}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {address.recipientName} - {address.phone}
                            <br />
                            {address.street}, {address.city}, {address.province} {address.postalCode}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!address.isDefault && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onSetDefaultAddress(address.id)}
                              disabled={disabled}
                            >
                              Set default
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteAddress(address.id)}
                            disabled={disabled}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function ReviewSection({
  notice,
  onReview,
}: {
  notice: Notice
  onReview: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.95fr] lg:px-10">
      <div>
        <Badge variant="secondary" className="mb-4 gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Application reviews
        </Badge>
        <h2 className="text-3xl font-semibold tracking-normal">Public reviews before checkout exists.</h2>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          Collect marketplace feedback while checkout is still out of scope for Level 2.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CircleDollarSign className="mb-2 h-5 w-5 text-emerald-700" />
              <CardTitle>No payment dependency</CardTitle>
              <CardDescription>Reviews stay independent from order history.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Star className="mb-2 h-5 w-5 text-amber-600" />
              <CardTitle>Signal for sellers</CardTitle>
              <CardDescription>Early feedback helps shape public marketplace trust.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave a review</CardTitle>
          <CardDescription>Reviews are captured locally for this frontend step.</CardDescription>
        </CardHeader>
        <CardContent>
          {notice && (
            <Alert className="mb-5" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
              {notice.message}
            </Alert>
          )}
          <form className="grid gap-4" onSubmit={onReview}>
            <Field id="reviewerName" label="Name">
              <Input id="reviewerName" name="reviewerName" placeholder="Alya" required />
            </Field>
            <Field id="rating" label="Rating">
              <select
                id="rating"
                name="rating"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="5"
              >
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
            </Field>
            <Field id="reviewCategory" label="Category">
              <select
                id="reviewCategory"
                name="reviewCategory"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="guest"
              >
                <option value="guest">Guest experience</option>
                <option value="buyer">Buyer account</option>
                <option value="seller">Seller application</option>
              </select>
            </Field>
            <Field id="reviewText" label="Review">
              <Textarea
                id="reviewText"
                name="reviewText"
                placeholder="The marketplace flow feels..."
                required
              />
            </Field>
            <Button type="submit">Submit review</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function productPayload(data: FormData, partial: boolean) {
  const payload: {
    name?: string
    description?: string
    price?: number
    imageUrl?: string
    stock?: number
  } = {}
  const name = optionalString(data.get('productName'))
  const description = optionalString(data.get('productDescription'))
  const imageUrl = optionalString(data.get('productImage'))
  const price = numberValue(data.get('productPrice'))
  const stock = numberValue(data.get('productStock'))

  if (name || !partial) payload.name = name ?? ''
  if (description) payload.description = description
  if (price !== undefined || !partial) payload.price = price ?? 0
  if (imageUrl) payload.imageUrl = imageUrl
  if (stock !== undefined) payload.stock = stock

  return payload
}

function addressPayload(data: FormData) {
  return {
    label: stringValue(data.get('label')),
    recipientName: stringValue(data.get('recipientName')),
    phone: stringValue(data.get('phone')),
    street: stringValue(data.get('street')),
    city: stringValue(data.get('city')),
    province: stringValue(data.get('province')),
    postalCode: stringValue(data.get('postalCode')),
    isDefault: data.get('isDefault') === 'on',
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(value: FormDataEntryValue | null) {
  const text = stringValue(value)
  return text.length > 0 ? text : undefined
}

function numberValue(value: FormDataEntryValue | null) {
  const text = stringValue(value)
  if (!text) return undefined

  return Number(text)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
