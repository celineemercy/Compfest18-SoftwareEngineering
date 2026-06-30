import { useState } from 'react'
import { BarChart3, PackageCheck, Store } from 'lucide-react'
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
import { apiRequest, authHeaders, getErrorMessage } from '@/lib/api'

type Notice = { kind: 'success' | 'error'; message: string } | null

type Order = {
  id: string
  status: string
  deliveryMethod: string
  subtotal: number
  discountAmount: number
  finalTotal: number
  createdAt: string
  store?: { name: string }
  items?: Array<{ id: string; productName: string; quantity: number; total: number }>
}

type IncomeReport = {
  orderCount: number
  completedOrders: number
  grossIncome: number
}

export function SellerOrderWorkspace({ token }: { token: string }) {
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [report, setReport] = useState<IncomeReport | null>(null)
  const headers = authHeaders(token)

  function withNotice<T>(promise: Promise<T>, successMessage?: string) {
    setLoading(true)
    setNotice(null)
    return promise
      .then((result) => {
        if (successMessage) setNotice({ kind: 'success', message: successMessage })
        return result
      })
      .catch((error: unknown) => {
        setNotice({ kind: 'error', message: getErrorMessage(error) })
        throw error
      })
      .finally(() => setLoading(false))
  }

  async function loadOrders() {
    const data = await withNotice(apiRequest<Order[]>('/seller/orders', { headers })).catch(
      () => null,
    )
    if (data) setOrders(data)
  }

  async function loadReport() {
    const data = await withNotice(
      apiRequest<IncomeReport>('/seller/reports/income', { headers }),
    ).catch(() => null)
    if (data) setReport(data)
  }

  async function handleProcess(orderId: string) {
    await withNotice(
      apiRequest(`/seller/orders/${orderId}/process`, {
        method: 'POST',
        headers,
      }),
      'Order moved to waiting for driver.',
    ).catch(() => null)
    void loadOrders()
    void loadReport()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seller processing</CardTitle>
        <CardDescription>Review incoming orders, process eligible orders, and inspect income.</CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <Alert className="mb-5" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
            {notice.message}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile
            icon="orders"
            label="Store orders"
            value={String(report?.orderCount ?? orders.length)}
            onRefresh={loadOrders}
            loading={loading}
          />
          <SummaryTile
            icon="complete"
            label="Completed"
            value={String(report?.completedOrders ?? 0)}
            onRefresh={loadReport}
            loading={loading}
          />
          <SummaryTile
            icon="income"
            label="Gross income"
            value={report ? formatIdr(report.grossIncome) : formatIdr(0)}
            onRefresh={loadReport}
            loading={loading}
          />
        </div>

        <Separator className="my-5" />

        <div className="grid gap-3">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={loadOrders} disabled={loading}>
              Refresh orders
            </Button>
          </div>
          {orders.map((order) => (
            <div key={order.id} className="rounded-md border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    {order.store?.name ?? 'Seller store'} order {order.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.deliveryMethod} - {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Subtotal {formatIdr(order.subtotal)} - discount {formatIdr(order.discountAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <Badge variant="outline">{order.status}</Badge>
                  <Button
                    size="sm"
                    onClick={() => handleProcess(order.id)}
                    disabled={loading || order.status !== 'SEDANG_DIKEMAS'}
                  >
                    Process order
                  </Button>
                </div>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        {item.productName} x{item.quantity}
                      </span>
                      <span>{formatIdr(item.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground">No incoming orders for this seller yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  onRefresh,
  loading,
}: {
  icon: 'orders' | 'complete' | 'income'
  label: string
  value: string
  onRefresh: () => void
  loading: boolean
}) {
  const Icon = icon === 'orders' ? Store : icon === 'complete' ? PackageCheck : BarChart3

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          Load
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}
