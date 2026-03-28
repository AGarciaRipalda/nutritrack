"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createManagedUser,
  deleteManagedUser,
  fetchAdminUsers,
  type ManagedUser,
  updateManagedUserRole,
} from "@/lib/api"
import { getCurrentSessionUser, isAdminUser } from "@/lib/auth"
import { Shield, Trash2, UserPlus } from "lucide-react"

type UserRole = "user" | "admin"

const initialForm = {
  email: "",
  password: "",
  name: "",
  role: "user" as UserRole,
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatRoleLabel(role: UserRole) {
  return role === "admin" ? "Administrador" : "Usuario"
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [creating, setCreating] = useState(false)
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null)
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({})

  const currentUser = getCurrentSessionUser()
  const currentUserId = currentUser?.id ?? null
  const hasAdminAccess = isAdminUser(currentUser)

  const adminCount = useMemo(
    () => users.filter((user) => user.role === "admin").length,
    [users],
  )

  useEffect(() => {
    let cancelled = false

    const loadUsers = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchAdminUsers()
        if (cancelled) return
        setUsers(response)
        setRoleDrafts(
          Object.fromEntries(response.map((user) => [user.id, user.role])),
        )
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la lista de usuarios.",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const upsertUser = (updated: ManagedUser) => {
    setUsers((current) =>
      current
        .map((user) => (user.id === updated.id ? updated : user))
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1
          return a.email.localeCompare(b.email)
        }),
    )
    setRoleDrafts((current) => ({ ...current, [updated.id]: updated.role }))
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    setError(null)
    setStatus(null)

    try {
      const created = await createManagedUser(form)
      setUsers((current) =>
        [...current, created].sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1
          return a.email.localeCompare(b.email)
        }),
      )
      setRoleDrafts((current) => ({ ...current, [created.id]: created.role }))
      setForm(initialForm)
      setStatus(`Usuario creado: ${created.email}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el usuario.",
      )
    } finally {
      setCreating(false)
    }
  }

  const handleRoleUpdate = async (user: ManagedUser) => {
    const nextRole = roleDrafts[user.id] ?? user.role
    if (nextRole === user.role) return

    setPendingRoleUserId(user.id)
    setError(null)
    setStatus(null)

    try {
      const updated = await updateManagedUserRole(user.id, nextRole)
      upsertUser(updated)
      setStatus(
        `Rol actualizado: ${updated.email} ahora es ${formatRoleLabel(updated.role)}.`,
      )
    } catch (err) {
      setRoleDrafts((current) => ({ ...current, [user.id]: user.role }))
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el rol.",
      )
    } finally {
      setPendingRoleUserId(null)
    }
  }

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`¿Eliminar a ${user.email}?`)) return

    setPendingDeleteUserId(user.id)
    setError(null)
    setStatus(null)

    try {
      await deleteManagedUser(user.id)
      setUsers((current) => current.filter((entry) => entry.id !== user.id))
      setStatus(`Usuario eliminado: ${user.email}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el usuario.",
      )
    } finally {
      setPendingDeleteUserId(null)
    }
  }

  if (!hasAdminAccess) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">
            Verificando acceso de administrador...
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="rounded-3xl border border-black/20 bg-black/5 p-6 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-emerald-400" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Gestión de usuarios
              </h2>
              <p className="text-muted-foreground">
                Crea cuentas, ajusta roles y elimina usuarios desde el panel de
                administración.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="rounded-3xl border border-black/20 bg-black/5 p-6 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
            <div className="mb-5 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              <h3 className="text-xl font-semibold text-foreground">
                Crear usuario
              </h3>
            </div>

            <form className="space-y-4" onSubmit={handleCreateUser}>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Correo electrónico</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="usuario@metabolic.es"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-name">Nombre</Label>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nuevo usuario"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Contraseña</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      role: value as UserRole,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creando usuario..." : "Crear usuario"}
              </Button>
            </form>

            {status ? (
              <p className="mt-4 text-sm text-emerald-500">{status}</p>
            ) : null}
            {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
          </Card>

          <Card className="rounded-3xl border border-black/20 bg-black/5 p-6 backdrop-blur-xl dark:border-white/20 dark:bg-white/10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Usuarios
                </h3>
                <p className="text-sm text-muted-foreground">
                  {users.length} usuarios en total, {adminCount} administradores
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Cargando usuarios...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha de alta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId
                    const isOnlyAdmin = user.role === "admin" && adminCount <= 1

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {user.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Select
                              value={roleDrafts[user.id] ?? user.role}
                              onValueChange={(value) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [user.id]: value as UserRole,
                                }))
                              }
                              disabled={pendingRoleUserId === user.id}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Usuario</SelectItem>
                                <SelectItem value="admin">
                                  Administrador
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Badge
                              variant={
                                user.role === "admin" ? "default" : "secondary"
                              }
                            >
                              {formatRoleLabel(user.role)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRoleUpdate(user)}
                              disabled={
                                pendingRoleUserId === user.id ||
                                (roleDrafts[user.id] ?? user.role) === user.role
                              }
                            >
                              {pendingRoleUserId === user.id
                                ? "Guardando..."
                                : "Guardar rol"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDeleteUser(user)}
                              disabled={
                                pendingDeleteUserId === user.id ||
                                isSelf ||
                                isOnlyAdmin
                              }
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              {pendingDeleteUserId === user.id
                                ? "Eliminando..."
                                : "Eliminar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No hay usuarios registrados.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
