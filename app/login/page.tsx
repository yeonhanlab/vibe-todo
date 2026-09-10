"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";

import { loginSchema, type LoginInput } from "@/lib/validation";

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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const result = await signIn("credentials", {
      username: values.username,
      password: values.password,
      redirect: false,
    });

    if (!result || result.error) {
      setError("root", {
        message: "아이디 또는 비밀번호가 올바르지 않습니다.",
      });
      return;
    }

    // 열린 리다이렉트 방지: 내부 경로("/...")만 허용
    const callbackUrl = searchParams.get("callbackUrl");
    const target =
      callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
    router.push(target);
    router.refresh();
  }

  return (
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
          autoComplete="current-password"
          className={inputClass}
          {...register("password")}
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
        {isSubmitting ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="mt-1 text-sm text-zinc-500">
          아이디와 비밀번호를 입력하세요.
        </p>
      </div>

      <Suspense fallback={<div className="h-64" />}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-zinc-500">
        계정이 없으세요?{" "}
        <Link href="/register" className="font-medium text-zinc-900 underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
