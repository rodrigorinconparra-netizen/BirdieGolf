"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthState } from "../actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerAction,
    {},
  );

  return (
    <div className="glass p-6">
      <h2 className="text-lg font-semibold">Crea tu cuenta</h2>
      <p className="mt-1 text-sm text-muted">Empieza a registrar tus vueltas.</p>

      <form action={action} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Nombre</label>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Tu nombre"
            className="field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Email</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tucorreo@email.com"
            className="field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Contraseña</label>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Mínimo 6 caracteres"
            className="field"
          />
        </div>

        {state.error ? (
          <p className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-accent">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
