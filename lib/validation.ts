import { z } from "zod";

// 클라이언트 폼(react-hook-form + zodResolver)과 API route에서 함께 사용한다.

// 공용 필드 규칙 (변환 없음). 폼에서 그대로 쓰고, 저장용 스키마에서만 소문자 변환을 덧붙인다.
const usernameField = z
  .string()
  .trim()
  .min(3, "아이디는 3자 이상이어야 합니다.")
  .max(20, "아이디는 20자 이하여야 합니다.")
  .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");

const passwordField = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(100, "비밀번호는 100자 이하여야 합니다.");

// API 저장용: username을 소문자로 정규화한다.
export const registerSchema = z.object({
  username: usernameField.transform((s) => s.toLowerCase()),
  password: passwordField,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// 회원가입 폼용: 비밀번호 확인 필드 + 일치 검사. (소문자 변환은 서버가 담당)
export const registerFormSchema = z
  .object({
    username: usernameField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "아이디를 입력하세요.").transform((s) => s.toLowerCase()),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});
export type LoginInput = z.infer<typeof loginSchema>;

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

// MongoDB ObjectId (24자리 hex)
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "잘못된 id 입니다.");

// hex 색상 (#rrggbb). 네이티브 컬러 피커가 항상 이 형식으로 준다.
export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않습니다.");

// 할 일 제목만 (추가 폼에서 사용)
export const todoTitleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "할 일을 입력하세요.")
    .max(200, "200자 이하로 입력하세요."),
});
export type TodoTitleInput = z.infer<typeof todoTitleSchema>;

// 할 일 생성 (API): 제목 + 날짜 + (선택) 카테고리
export const todoCreateSchema = todoTitleSchema.extend({
  date: dateStr,
  categoryId: objectId.nullish(), // 없으면 생략, 명시적으로 null 가능
});
export type TodoCreateInput = z.infer<typeof todoCreateSchema>;

export const todoUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    completed: z.boolean().optional(),
    categoryId: objectId.nullable().optional(), // null = 카테고리 해제
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.completed !== undefined ||
      v.categoryId !== undefined,
    { message: "변경할 값이 없습니다." },
  );
export type TodoUpdateInput = z.infer<typeof todoUpdateSchema>;

// 드래그 재정렬 (API): 그 날짜에 속한 내 할 일 id를 원하는 순서대로 나열해서 보낸다.
export const reorderSchema = z.object({
  date: dateStr,
  orderedIds: z.array(objectId).min(1, "재정렬할 항목이 없습니다."),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

// 카테고리 생성 / 수정
export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "카테고리 이름을 입력하세요.")
    .max(20, "20자 이하로 입력하세요."),
  color: hexColor,
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "카테고리 이름을 입력하세요.").max(20).optional(),
    color: hexColor.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: "변경할 값이 없습니다.",
  });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const frequencySchema = z.enum(["DAILY", "WEEKLY"]);

const weekdaysField = z.array(z.number().int().min(0).max(6));

// 루틴 생성. startDate 는 클라이언트가 보내지 않고 서버가 오늘로 설정한다.
export const routineCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "루틴 이름을 입력하세요.")
      .max(100, "100자 이하로 입력하세요."),
    frequency: frequencySchema,
    weekdays: weekdaysField.default([]),
  })
  .refine((v) => v.frequency !== "WEEKLY" || v.weekdays.length > 0, {
    message: "요일을 하나 이상 선택하세요.",
    path: ["weekdays"],
  });
export type RoutineCreateInput = z.infer<typeof routineCreateSchema>;

// 루틴 수정. 인라인 편집에서 title/frequency/weekdays/active 를 함께 보낸다.
export const routineUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "루틴 이름을 입력하세요.").max(100).optional(),
    frequency: frequencySchema.optional(),
    weekdays: weekdaysField.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "변경할 값이 없습니다." })
  .refine((v) => v.frequency !== "WEEKLY" || (v.weekdays?.length ?? 0) > 0, {
    message: "요일을 하나 이상 선택하세요.",
    path: ["weekdays"],
  });
export type RoutineUpdateInput = z.infer<typeof routineUpdateSchema>;
