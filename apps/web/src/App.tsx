import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Star,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import heroImg from './assets/hero.png'

type Role = 'ADMIN' | 'SELLER' | 'BUYER' | 'DRIVER'

type AuthUser = {
  id: string
  email: string
  username: string
  roles: Role[]
  activeRole?: Role
  createdAt?: string
  updatedAt?: string
}

type AuthResponse = {
  accessToken: string
  user: AuthUser
}

type AuthMode = 'login' | 'register'
type Notice = { kind: 'success' | 'error'; message: string } | null

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

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [token, setToken] = useState(() => localStorage.getItem('accessToken') ?? '')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authNotice, setAuthNotice] = useState<Notice>(null)
  const [reviewNotice, setReviewNotice] = useState<Notice>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  const activeRoles = useMemo(
    () => currentUser?.roles ?? [],
    [currentUser],
  )

  async function request<T>(path: string, options: RequestInit = {}) {
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
      throw new Error(message)
    }

    return data as T
  }

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setCurrentUser(user)
      setAuthNotice({ kind: 'success', message: 'Profile loaded.' })
    } catch (error) {
      setAuthNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsProfileLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('accessToken')
    setToken('')
    setCurrentUser(null)
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
              Public marketplace access with roles that travel with every account.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Browse as a guest, register as a buyer, and keep seller-ready roles attached
              to the same identity as the marketplace grows.
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
                <Badge variant="outline">JWT ready</Badge>
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
                <Button variant="secondary" onClick={loadProfile} disabled={isProfileLoading}>
                  <BadgeCheck className="h-4 w-4" />
                  {isProfileLoading ? 'Loading' : 'Load /auth/me'}
                </Button>
                <Button variant="ghost" onClick={logout} disabled={!token}>
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
                  <TabsTrigger active={authMode === 'login'} onClick={() => setAuthMode('login')}>
                    Login
                  </TabsTrigger>
                  <TabsTrigger active={authMode === 'register'} onClick={() => setAuthMode('register')}>
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
                    <form className="grid gap-4" onSubmit={handleLogin}>
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
                    <form className="grid gap-4" onSubmit={handleRegister}>
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

      <DriverDeliveryWorkspace
        token={token}
        currentUser={currentUser}
        onToken={setToken}
        onUser={setCurrentUser}
      />

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.95fr] lg:px-10">
        <div>
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Application reviews
          </Badge>
          <h2 className="text-3xl font-semibold tracking-normal">Public reviews before checkout exists.</h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Collect marketplace feedback while checkout is still out of scope for Level 1.
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
            {reviewNotice && (
              <Alert
                className="mb-5"
                variant={reviewNotice.kind === 'success' ? 'success' : 'destructive'}
              >
                {reviewNotice.message}
              </Alert>
            )}
            <form className="grid gap-4" onSubmit={handleReview}>
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
    </main>
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
