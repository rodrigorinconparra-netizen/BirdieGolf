"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className="glass p-6">
      <h2 className="text-lg font-semibold">Inicia sesión</h2>
      <p className="mt-1 text-sm text-muted">Bienvenido de nuevo.</p>

      <form action={action} className="mt-6 space-y-4">
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
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="field"
          />
        </div>

        {state.error ? (
          <p className="rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-accent">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
