import { useState } from 'react'
import type { FormEvent } from 'react'
import { BadgePercent, TicketPercent } from 'lucide-react'
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
type DiscountType = 'FIXED' | 'PERCENTAGE'
type DiscountKind = 'voucher' | 'promo'

type Voucher = {
  id: string
  code: string
  type: DiscountType
  amount: number
  remainingUsage: number
  isActive: boolean
  expiresAt: string
}

type Promo = {
  id: string
  code: string
  type: DiscountType
  amount: number
  isActive: boolean
  expiresAt: string
}

export function AdminDiscountWorkspace({ token }: { token: string }) {
  const [tab, setTab] = useState<DiscountKind>('voucher')
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
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

  async function loadVouchers() {
    const data = await withNotice(apiRequest<Voucher[]>('/admin/vouchers', { headers })).catch(
      () => null,
    )
    if (data) setVouchers(data)
  }

  async function loadPromos() {
    const data = await withNotice(apiRequest<Promo[]>('/admin/promos', { headers })).catch(
      () => null,
    )
    if (data) setPromos(data)
  }

  async function handleCreateDiscount(event: FormEvent<HTMLFormElement>, kind: DiscountKind) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const expiresAt = String(data.get('expiresAt'))
    const endpoint = kind === 'voucher' ? '/admin/vouchers' : '/admin/promos'
    const payload = {
      code: data.get('code'),
      type: data.get('type'),
      amount: Number(data.get('amount')),
      expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
      ...(kind === 'voucher' ? { remainingUsage: Number(data.get('remainingUsage')) } : {}),
    }

    await withNotice(
      apiRequest(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
      kind === 'voucher' ? 'Voucher created.' : 'Promo created.',
    ).catch(() => null)

    form.reset()
    if (kind === 'voucher') void loadVouchers()
    if (kind === 'promo') void loadPromos()
  }

  function openTab(next: DiscountKind) {
    setTab(next)
    setNotice(null)
    if (next === 'voucher' && vouchers.length === 0) void loadVouchers()
    if (next === 'promo' && promos.length === 0) void loadPromos()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin discounts</CardTitle>
        <CardDescription>Create vouchers and promo codes for Level 4 checkout proof.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs>
          <TabsList className="grid-cols-2">
            <TabsTrigger active={tab === 'voucher'} onClick={() => openTab('voucher')}>
              Vouchers
            </TabsTrigger>
            <TabsTrigger active={tab === 'promo'} onClick={() => openTab('promo')}>
              Promos
            </TabsTrigger>
          </TabsList>

          {notice && (
            <Alert className="mt-5" variant={notice.kind === 'success' ? 'success' : 'destructive'}>
              {notice.message}
            </Alert>
          )}

          {tab === 'voucher' && (
            <TabsContent>
              <DiscountForm kind="voucher" loading={loading} onSubmit={handleCreateDiscount} />
              <Separator className="my-5" />
              <DiscountList
                icon="voucher"
                items={vouchers.map((voucher) => ({
                  id: voucher.id,
                  code: voucher.code,
                  type: voucher.type,
                  amount: voucher.amount,
                  status: voucher.isActive ? `${voucher.remainingUsage} left` : 'Inactive',
                  expiresAt: voucher.expiresAt,
                }))}
                emptyLabel="No vouchers created yet."
                onRefresh={loadVouchers}
                loading={loading}
              />
            </TabsContent>
          )}

          {tab === 'promo' && (
            <TabsContent>
              <DiscountForm kind="promo" loading={loading} onSubmit={handleCreateDiscount} />
              <Separator className="my-5" />
              <DiscountList
                icon="promo"
                items={promos.map((promo) => ({
                  id: promo.id,
                  code: promo.code,
                  type: promo.type,
                  amount: promo.amount,
                  status: promo.isActive ? 'Active' : 'Inactive',
                  expiresAt: promo.expiresAt,
                }))}
                emptyLabel="No promo codes created yet."
                onRefresh={loadPromos}
                loading={loading}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function DiscountForm({
  kind,
  loading,
  onSubmit,
}: {
  kind: DiscountKind
  loading: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>, kind: DiscountKind) => void
}) {
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => onSubmit(event, kind)}>
      <Field id={`${kind}-code`} label="Code">
        <Input id={`${kind}-code`} name="code" placeholder={kind === 'voucher' ? 'HEMAT10' : 'PROMO25'} required />
      </Field>
      <Field id={`${kind}-type`} label="Type">
        <select
          id={`${kind}-type`}
          name="type"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue="FIXED"
        >
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">Percentage</option>
        </select>
      </Field>
      <Field id={`${kind}-amount`} label="Amount">
        <Input id={`${kind}-amount`} name="amount" type="number" min={1} required />
      </Field>
      {kind === 'voucher' && (
        <Field id="voucher-remaining" label="Usage limit">
          <Input id="voucher-remaining" name="remainingUsage" type="number" min={1} defaultValue={1} required />
        </Field>
      )}
      <Field id={`${kind}-expires`} label="Expires at">
        <Input id={`${kind}-expires`} name="expiresAt" type="date" required />
      </Field>
      <Button type="submit" className="self-end" disabled={loading}>
        {kind === 'voucher' ? 'Create voucher' : 'Create promo'}
      </Button>
    </form>
  )
}

function DiscountList({
  icon,
  items,
  emptyLabel,
  onRefresh,
  loading,
}: {
  icon: 'voucher' | 'promo'
  items: Array<{
    id: string
    code: string
    type: DiscountType
    amount: number
    status: string
    expiresAt: string
  }>
  emptyLabel: string
  onRefresh: () => void
  loading: boolean
}) {
  const Icon = icon === 'voucher' ? TicketPercent : BadgePercent

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {item.code}
            </p>
            <p className="text-sm text-muted-foreground">
              {item.type} - {item.amount} - expires {new Date(item.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant="outline">{item.status}</Badge>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
    </div>
  )
}
