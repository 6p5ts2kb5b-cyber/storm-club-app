// スタッフマスターの形と、お試しモード用のサンプル

export type Role = "admin" | "staff" | "viewer";

export interface Staff {
  id: string;
  name: string;
  /** ログイン用のGoogleメールアドレス（審判名簿・指導者名簿だけの人は空） */
  email: string | null;
  role: Role;
  can_coach: boolean;
  can_umpire: boolean;
  can_plate: boolean;
  can_base: boolean;
  is_active: boolean;
  note: string | null;
}

export type StaffInput = Omit<Staff, "id">;

export const ROLE_LABEL: Record<Role, string> = {
  admin: "管理者",
  staff: "スタッフ",
  viewer: "閲覧のみ",
};

export const EMPTY_STAFF: StaffInput = {
  name: "",
  email: "",
  role: "staff",
  can_coach: true,
  can_umpire: false,
  can_plate: false,
  can_base: false,
  is_active: true,
  note: "",
};

/** 入力内容の確認。問題があれば日本語のメッセージを返します */
export function validateStaff(s: StaffInput): string | null {
  if (!s.name.trim()) return "氏名を入力してください。";
  const email = (s.email ?? "").trim();
  if (!email) return "Googleのメールアドレスを入力してください。";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "メールアドレスの形が正しくありません（例：tanaka@gmail.com）。";
  if ((s.can_plate || s.can_base) && !s.can_umpire) return "球審・塁審ができる人は「審判」もオンにしてください。";
  return null;
}

/** データベースからのエラーを、初心者にも分かる言葉に直します */
export function explainDbError(message: string, code?: string): string {
  if (code === "23505" || /duplicate|unique/i.test(message)) return "このメールアドレスはすでに登録されています。";
  if (code === "42501" || /row-level security|permission/i.test(message)) return "この操作は管理者だけができます。";
  if (/fetch|network/i.test(message)) return "インターネットにつながっていません。電波の良い場所でもう一度保存してください。";
  return "保存できませんでした。時間をおいてもう一度お試しください。";
}

export const SAMPLE_STAFF: Staff[] = [
  { id: "s1", name: "玉城", email: "tamaki@example.com", role: "admin", can_coach: true, can_umpire: true, can_plate: true, can_base: true, is_active: true, note: "代表" },
  { id: "s2", name: "田中", email: "tanaka@example.com", role: "staff", can_coach: true, can_umpire: true, can_plate: true, can_base: true, is_active: true, note: null },
  { id: "s3", name: "佐藤", email: "sato@example.com", role: "staff", can_coach: true, can_umpire: true, can_plate: false, can_base: true, is_active: true, note: null },
  { id: "s4", name: "鈴木", email: "suzuki@example.com", role: "staff", can_coach: false, can_umpire: true, can_plate: true, can_base: true, is_active: true, note: "審判専門" },
  { id: "s6", name: "山本", email: null, role: "staff", can_coach: false, can_umpire: true, can_plate: true, can_base: true, is_active: true, note: "保護者" },
  { id: "s7", name: "木村", email: null, role: "staff", can_coach: false, can_umpire: true, can_plate: false, can_base: true, is_active: true, note: null },
  { id: "s8", name: "井上", email: null, role: "staff", can_coach: true, can_umpire: false, can_plate: false, can_base: false, is_active: true, note: "OB" },
  { id: "s5", name: "高橋", email: "takahashi@example.com", role: "viewer", can_coach: false, can_umpire: false, can_plate: false, can_base: false, is_active: false, note: "2025年度まで" },
];

/** ログインできる人か（メールアドレスが登録されている） */
export function canLogin(s: Pick<Staff, "email">): boolean {
  return Boolean(s.email && s.email.trim());
}

/** 名簿の種類 */
export type RosterKind = "umpire" | "coach" | "login";

export const ROSTER_LABEL: Record<RosterKind, string> = {
  umpire: "審判名簿",
  coach: "指導者名簿",
  login: "ログイン名簿",
};

/** 複数行の文字から名前を取り出す（1行に1人。「、」「,」区切りも可。重複は除く） */
export function parseNames(text: string): string[] {
  const names = text
    .split(/[\n,、，]+/)
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(names)];
}
