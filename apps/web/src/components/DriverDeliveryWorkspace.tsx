import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  PackageCheck,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
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
import { Separator } from '@/components/ui/separator'

type Role = 'ADMIN' | 'SELLER' | 'BUYER' | 'DRIVER'

type AuthUser = {
  id: string
  email: string
  username: string
  roles: Role[]
  activeRole?: Role
}

type AuthResponse = {
  accessToken: string
  user: AuthUser
}

type DeliveryJob = {
  id: string
  status: 'AVAILABLE' | 'TAKEN' | 'COMPLETED' | 'RETURNED'
  earning: number
  driverId?: string | null
  order?: {
    id: string
    status: string
    deliveryFee: number
    finalTotal: number
    store?: {
      name: string
    }
    address?: {
      city: string
      fullAddress: string
      recipient: string
    }
  }
}

type DriverEarning = {
  id: string
  jobId: string
  amount: number
  createdAt?: string
}

type EarningsResponse = {
  total: number
  earnings: DriverEarning[]
}

type Notice = { kind: 'success' | 'error'; message: string } | null

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function DriverDeliveryWorkspace({
  token,
  currentUser,
  onToken,
  onUser,
}: {
  token: string
  currentUser: AuthUser | null
  onToken: (token: string) => void
  onUser: (user: AuthUser) => void
}) {
  const [availableJobs, setAvailableJobs] = useState<DeliveryJob[]>([])
  const [assignedJobs, setAssignedJobs] = useState<DeliveryJob[]>([])
  const [earnings, setEarnings] = useState<EarningsResponse>({ total: 0, earnings: [] })
  const [notice, setNotice] = useState<Notice>(null)
  const [isLoading, setIsLoading] = useState(false)
  const hasDriverRole = Boolean(currentUser?.roles.includes('DRIVER'))
  const isDriverActive = currentUser?.activeRole === 'DRIVER'

  const activeJobs = useMemo(
    () => assignedJobs.filter((job) => job.status === 'TAKEN'),
    [assignedJobs],
  )

  async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

  async function activateDriverRole() {
    if (!token) {
      setNotice({ kind: 'error', message: 'Login first, then activate DRIVER role.' })
      return
    }

    setIsLoading(true)
    setNotice(null)

    try {
      const data = await request<AuthResponse>('/auth/select-role', {
        method: 'POST',
        body: JSON.stringify({ role: 'DRIVER' }),
      })
      localStorage.setItem('accessToken', data.accessToken)
      onToken(data.accessToken)
      onUser(data.user)
      setNotice({ kind: 'success', message: 'DRIVER role is active for this session.' })
    } catch (error) {
      setNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDriverDashboard() {
    if (!token) {
      setNotice({ kind: 'error', message: 'Login as a driver before loading delivery work.' })
      return
    }

    setIsLoading(true)
    setNotice(null)

    try {
      const [available, assigned, earningSummary] = await Promise.all([
        request<DeliveryJob[]>('/driver/jobs/available'),
        request<DeliveryJob[]>('/driver/jobs'),
        request<EarningsResponse>('/driver/earnings'),
      ])
      setAvailableJobs(available)
      setAssignedJobs(assigned)
      setEarnings(earningSummary)
      setNotice({ kind: 'success', message: 'Driver dashboard refreshed.' })
    } catch (error) {
      setNotice({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }

  async function takeJob(jobId: string) {
    await mutateJob(`/driver/jobs/${jobId}/take`, 'Delivery job accepted.')
  }

  async function completeJob(jobId: string) {
    await mutateJob(`/driver/jobs/${jobId}/complete`, 'Delivery completed and earnings updated.')
  }

  async function mutateJob(path: string, successMessage: string) {
    setIsLoading(true)
    setNotice(null)

    try {
      await request<DeliveryJob>(path, { method: 'POST' })
      setNotice({ kind: 'success', message: successMessage })
      await loadDriverDashboard()
    } catch (error) {
      setNotice({ kind: 'error', message: getErrorMessage(error) })
      setIsLoading(false)
    }
  }

  return (
    <section className="border-y bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.78fr_1.22fr] lg:px-10">
        <div>
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Level 5 driver delivery
          </Badge>
          <h2 className="text-3xl font-semibold tracking-normal">Driver dashboard for manual delivery acceptance.</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            The demo calls the protected driver endpoints for available jobs, assigned work,
            completion, and completed-job earnings.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="Available"
              value={availableJobs.length}
            />
            <MetricCard
              icon={<Route className="h-5 w-5" />}
              label="Assigned"
              value={assignedJobs.length}
            />
            <MetricCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Earnings"
              value={formatCurrency(earnings.total)}
            />
          </div>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Driver session</CardTitle>
              <CardDescription>Use a token whose active role is DRIVER.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant={hasDriverRole ? 'success' : 'outline'}>
                  {hasDriverRole ? 'DRIVER role available' : 'DRIVER role missing'}
                </Badge>
                <Badge variant={isDriverActive ? 'success' : 'outline'}>
                  {isDriverActive ? 'DRIVER active' : 'Active role not DRIVER'}
                </Badge>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={activateDriverRole} disabled={isLoading || !hasDriverRole}>
                  <ShieldCheck className="h-4 w-4" />
                  Activate driver
                </Button>
                <Button onClick={loadDriverDashboard} disabled={isLoading}>
                  <RefreshCw className="h-4 w-4" />
                  {isLoading ? 'Refreshing' : 'Refresh jobs'}
                </Button>
              </div>
              {notice && (
                <Alert
                  className="mt-5"
                  variant={notice.kind === 'success' ? 'success' : 'destructive'}
                >
                  {notice.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Available delivery jobs</CardTitle>
              <CardDescription>Jobs waiting for a driver after seller processing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {availableJobs.length === 0 ? (
                <EmptyState label="No available delivery jobs." />
              ) : (
                availableJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    action={
                      <Button size="sm" onClick={() => takeJob(job.id)} disabled={isLoading}>
                        <PackageCheck className="h-4 w-4" />
                        Take job
                      </Button>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assigned jobs</CardTitle>
              <CardDescription>Only jobs owned by the current driver are listed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {assignedJobs.length === 0 ? (
                <EmptyState label="No assigned jobs for this driver." />
              ) : (
                assignedJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    action={
                      job.status === 'TAKEN' ? (
                        <Button size="sm" onClick={() => completeJob(job.id)} disabled={isLoading}>
                          <CheckCircle2 className="h-4 w-4" />
                          Complete
                        </Button>
                      ) : (
                        <Badge variant="success">Done</Badge>
                      )
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Driver earnings summary</CardTitle>
              <CardDescription>Only completed delivery jobs create earnings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed earnings</p>
                  <p className="mt-1 text-3xl font-semibold">{formatCurrency(earnings.total)}</p>
                </div>
                <Badge variant="outline">{earnings.earnings.length} payouts</Badge>
              </div>
              <Separator className="my-4" />
              <div className="grid gap-2">
                {earnings.earnings.length === 0 ? (
                  <EmptyState label="No completed driver earnings yet." />
                ) : (
                  earnings.earnings.map((earning) => (
                    <div
                      key={earning.id}
                      className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{earning.jobId}</span>
                      <span>{formatCurrency(earning.amount)}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Active deliveries waiting for completion: {activeJobs.length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-primary shadow-sm">
          {icon}
        </div>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function JobRow({
  job,
  action,
}: {
  job: DeliveryJob
  action: ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{job.order?.store?.name ?? 'Delivery job'}</p>
          <Badge variant="outline">{job.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {job.order?.address?.recipient ?? 'Recipient'} - {job.order?.address?.city ?? 'Destination'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">Fee {formatCurrency(job.order?.deliveryFee ?? 0)}</Badge>
          <Badge variant="secondary">Earn {formatCurrency(job.earning)}</Badge>
          {job.order?.status && <Badge variant="outline">{job.order.status}</Badge>}
        </div>
      </div>
      <div className="sm:justify-self-end">{action}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed bg-white px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}
