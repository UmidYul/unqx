"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const result = await Promise.race([
        signIn("credentials", {
          login,
          password,
          redirect: false,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 15000),
        ),
      ]);

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Неверный логин или пароль");
        } else {
          setError(`Ошибка входа: ${result.error}`);
        }
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Ошибка авторизации на сервере. Попробуйте снова.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-3xl border border-neutral-300 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Вход в админ-панель</h1>

      <label className="block text-sm font-medium text-neutral-700">
        Логин
        <input
          type="text"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-500"
          autoComplete="username"
          required
        />
      </label>

      <label className="block text-sm font-medium text-neutral-700">
        Пароль
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-500"
          autoComplete="current-password"
          required
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
