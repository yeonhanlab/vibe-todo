"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { registerFormSchema, type RegisterFormValues } from "@/lib/validation";

const inputClass =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { username: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: values.username,
        password: values.password,
      }),
    });

    if (!res.ok) {
      const data: { error?: string; field?: string } = await res
        .json()
        .catch(() => ({}));
      if (data.field === "username") {
        setError("username", { message: data.error ?? "가입에 실패했습니다." });
      } else {
        setError("root", { message: data.error ?? "가입에 실패했습니다." });
      }
      return;
    }

    // 가입 성공 → 자동 로그인
    const result = await signIn("credentials", {
      username: values.username,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setError("root", {
        message:
          "가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.",
      });
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="mt-1 text-sm text-zinc-500">
          아이디와 비밀번호로 계정을 만드세요.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field label="아이디" error={errors.username?.message}>
          <input
            type="text"
            autoComplete="username"
            className={inputClass}
            {...register("username")}
          />
        </Field>

        <Field label="비밀번호" error={errors.password?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register("password")}
          />
        </Field>

        <Field label="비밀번호 확인" error={errors.confirmPassword?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register("confirmPassword")}
          />
        </Field>

        {errors.root?.message && (
          <p className="text-sm text-red-600">{errors.root.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {isSubmitting ? "처리 중…" : "가입하기"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        이미 계정이 있으세요?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
