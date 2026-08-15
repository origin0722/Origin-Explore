"use client";

/**
 * Explore — Modals (site: ai.explore.poker/chat clone)
 * SettingsModal / OnboardingWizard / ProfileModal
 * Personal tool: no subscription, zh-only UI, local profile ("login").
 * Spec: docs/specs/ai-explore-poker-820d0558/07-modals.md
 */
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Layers,
  Palette,
  Plus,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  MODEL_PRESETS,
  OFFLINE_MODEL,
  THEMES,
  isThemeImplemented,
} from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type {
  ChatSettings,
  ModelInfo,
  ThemeOption,
} from "@/types/sites/ai-explore-poker-820d0558";

/* ------------------------------------------------------------------ */
/* shared modal shell                                                  */
/* ------------------------------------------------------------------ */

function ModalShell({
  children,
  onClose,
  zIndex = "z-50",
  overlay = "bg-overlay-modal",
}: {
  children: React.ReactNode;
  onClose(): void;
  zIndex?: string;
  overlay?: string;
}) {
  // Escape 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${overlay} ${zIndex} flex justify-center items-center transition-opacity`}
      onMouseDown={onClose}
    >
      {/* 全尺寸 flex 包装层，使子元素百分比尺寸可解析 */}
      <div
        className="w-full h-full flex justify-center items-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** 底部 toast（演示提示） */
function ToastView({ toast }: { toast: string | null }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-card-floating border border-std shadow-card px-4 py-2 text-sm text-primary whitespace-nowrap">
      {toast}
    </div>
  );
}

/** toast 状态（1800ms 自动消失） */
function useToast(): [string | null, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const show = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  };

  return [toast, show];
}

/** 开关（Switch 风格按钮: bg-brand / bg-btn-std） */
function Switch({ on, onChange }: { on: boolean; onChange(v: boolean): void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
        on ? "bg-brand" : "bg-btn-std"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** 单选行（radio 风格 label 行） */
function RadioRow({
  name,
  label,
  checked,
  onSelect,
  dot = false,
  big = false,
}: {
  name: string;
  label: React.ReactNode;
  checked: boolean;
  onSelect(): void;
  dot?: boolean;
  big?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        checked ? "bg-item-std-active" : "hover:bg-item-std"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={big ? "h-5 w-5 accent-brand" : "h-4 w-4 accent-brand"}
      />
      {dot && (
        <span
          className={`w-3 h-3 rounded-full ${
            checked ? "bg-brand shadow-brand" : "bg-btn-std"
          }`}
        />
      )}
      <span className={`${big ? "text-lg" : "text-sm"} text-primary`}>
        {label}
      </span>
      {checked && (
        <span className="ml-auto text-xs text-brand">使用中</span>
      )}
    </label>
  );
}

/** 主题单选行（radio + 品牌色圆点；未实现主题行尾标「待实现」） */
function ThemeRow({
  name,
  theme,
  checked,
  onSelect,
}: {
  name: string;
  theme: ThemeOption;
  checked: boolean;
  onSelect(): void;
}) {
  const pending = !isThemeImplemented(theme.name);
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        checked ? "bg-item-std-active" : "hover:bg-item-std"
      }`}
    >
      <input
        type="radio"
        name={name}
        className="h-4 w-4 accent-brand"
        checked={checked}
        onChange={onSelect}
      />
      <span className="w-3 h-3 rounded-full bg-brand shadow-brand" />
      <span className="text-sm text-primary">{theme.name}</span>
      {pending && (
        <span className="ml-auto text-[10px] text-text-quaternary">待实现</span>
      )}
    </label>
  );
}

const AVATAR_COLORS = ["#13e425", "#4d9fff", "#ffb84d", "#e4e4e4", "#ff6b6b"];

/** 头像色 5 圆点 radio */
function AvatarColorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange(c: string): void;
}) {
  return (
    <div className="flex gap-2.5">
      {AVATAR_COLORS.map((c) => (
        <label key={c} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={value === c}
            onChange={() => onChange(c)}
          />
          <span
            className="block w-8 h-8 rounded-full transition-transform peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-checked:ring-offset-modal-std"
            style={{ background: c }}
          />
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SettingsModal                                                       */
/* ------------------------------------------------------------------ */

const NAV_ITEMS: { id: string; label: string; icon: typeof Bot }[] = [
  { id: "models", label: "AI 模型", icon: Bot },
  { id: "allocation", label: "模型分配", icon: Layers },
  { id: "theme", label: "颜色主题", icon: Palette },
  { id: "shortcuts", label: "快捷键", icon: Keyboard },
  { id: "auto", label: "自动行为", icon: Zap },
];

function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: ModelInfo;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-3 px-4 border rounded-xl mb-2 cursor-pointer transition-colors ${
        selected
          ? "bg-item-std-active border-brand/50"
          : "bg-modal-floating border-std hover:border-brand/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-sm font-semibold flex items-center gap-1.5 min-w-0">
              <Star
                size={12}
                className={`flex-shrink-0 ${selected ? "text-brand" : "text-text-quaternary"}`}
              />
              <span className="truncate">{model.name}</span>
            </h4>
            {model.vision && (
              <span className="text-[10px] text-brand border border-brand/50 bg-brand/10 rounded px-1.5 py-0.5 flex-shrink-0">
                Vision
              </span>
            )}
            {selected && (
              <Check size={14} className="text-brand flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-tertiary mt-1 truncate">
            {model.provider} · {model.description}
          </p>
        </div>
        {model.provider === "BYOK" && (
          <span className="text-[10px] text-text-tertiary border border-std rounded px-1.5 py-0.5 flex-shrink-0 self-center">
            BYOK
          </span>
        )}
      </div>
    </div>
  );
}

export function SettingsModal() {
  const { settings, setSettings, closeModal, openModal, byokModels, addByokModel } = useApp();
  const [draft, setDraft] = useState<ChatSettings>(settings);
  const [section, setSection] = useState("models");
  const [toast, showToast] = useToast();
  // BYOK 表单
  const [byokOpen, setByokOpen] = useState(false);
  const [byokName, setByokName] = useState("");
  const [byokBaseUrl, setByokBaseUrl] = useState("");
  const [byokModelId, setByokModelId] = useState("");
  const [byokKey, setByokKey] = useState("");

  const update = (p: Partial<ChatSettings>) =>
    setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    setSettings(draft);
    closeModal("settings");
  };

  return (
    <ModalShell onClose={() => closeModal("settings")}>
      <div className="w-full h-full sm:w-[71.25%] sm:h-[71.25%] bg-modal-std rounded-3xl shadow-xl border-2 border-std flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-divider flex-shrink-0">
          <h2 className="text-xl font-bold">设置</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal("onboarding")}
              className="text-xs text-brand border border-brand/40 rounded-full px-3 py-1.5 hover:bg-brand/10 transition-colors"
            >
              设置引导
            </button>
            <button
              onClick={() => closeModal("settings")}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary hover:bg-item-std hover:text-primary transition-colors"
              aria-label="关闭设置"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 移动端横向导航 */}
        <div className="sm:hidden overflow-x-auto no-scrollbar px-4 pt-3 flex-shrink-0">
          <div className="flex gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  section === item.id
                    ? "bg-item-std-active text-primary"
                    : "bg-btn-std text-text-secondary"
                }`}
              >
                <item.icon size={12} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* 左导航 */}
          <nav className="hidden sm:block w-1/4 min-w-[180px] border-r border-divider p-4 overflow-y-auto nav-scroll flex-shrink-0">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setSection(item.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded text-sm transition-colors ${
                      section === item.id
                        ? "bg-item-std text-primary"
                        : "text-text-secondary hover:bg-item-std hover:text-primary"
                    }`}
                  >
                    <item.icon size={15} className="flex-shrink-0" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右面板 */}
          <div className="flex-1 p-6 overflow-y-auto scrollbar-card-std">
            {section === "models" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-3">
                  可用模型
                </h4>
                <button
                  onClick={() => setByokOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm text-brand mb-1 hover:opacity-80 transition-opacity"
                >
                  <Plus size={15} />
                  添加 BYOK 模型
                </button>
                <p className="text-xs text-text-tertiary mb-4">
                  添加你自己的模型（密钥仅存本机）
                </p>

                {byokOpen && (
                  <div className="mb-4 p-3 bg-modal-floating border border-std rounded-xl space-y-2">
                    {/* 预设一键填充（OpenAI 兼容接口） */}
                    <div className="flex flex-wrap gap-1.5">
                      {MODEL_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            setByokName(p.name);
                            setByokBaseUrl(p.baseUrl);
                            setByokModelId(p.modelId);
                          }}
                          title={`${p.provider} · ${p.description}`}
                          className="text-[11px] text-text-secondary border border-std rounded-full px-2.5 py-1 hover:border-brand/50 hover:text-primary transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <input
                      autoFocus
                      value={byokName}
                      onChange={(e) => setByokName(e.target.value)}
                      placeholder="模型名称，如 my-gpt-4o"
                      className="w-full bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                    />
                    <input
                      value={byokBaseUrl}
                      onChange={(e) => setByokBaseUrl(e.target.value)}
                      placeholder="API 地址，如 https://api.deepseek.com/v1（OpenAI 兼容）"
                      className="w-full bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                    />
                    <input
                      value={byokModelId}
                      onChange={(e) => setByokModelId(e.target.value)}
                      placeholder="模型 ID，如 deepseek-chat（留空则用名称）"
                      className="w-full bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                    />
                    <input
                      type="password"
                      value={byokKey}
                      onChange={(e) => setByokKey(e.target.value)}
                      placeholder="API Key（sk-…，仅存本机）"
                      className="w-full bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                    />
                    <p className="text-[10px] text-text-quaternary leading-4">
                      请求发往你填的地址（浏览器直连，密钥不出本机）；失败时自动回退离线知识库。
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setByokOpen(false);
                          setByokName("");
                          setByokBaseUrl("");
                          setByokModelId("");
                          setByokKey("");
                        }}
                        className="text-xs text-text-tertiary hover:text-primary px-3 py-1.5 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          if (!byokName.trim()) {
                            showToast("请填写模型名称");
                            return;
                          }
                          addByokModel({
                            name: byokName,
                            baseUrl: byokBaseUrl,
                            modelId: byokModelId,
                            apiKey: byokKey,
                          });
                          setByokName("");
                          setByokBaseUrl("");
                          setByokModelId("");
                          setByokKey("");
                          setByokOpen(false);
                          showToast("已添加 BYOK 模型");
                        }}
                        className="text-xs text-black bg-brand hover:opacity-90 rounded-full px-4 py-1.5 font-medium transition-opacity"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                )}

                {[OFFLINE_MODEL, ...byokModels].map((m) => (
                  <ModelRow
                    key={m.id}
                    model={m}
                    selected={draft.activeModelId === m.id}
                    onSelect={() => update({ activeModelId: m.id })}
                  />
                ))}
              </div>
            )}

            {section === "allocation" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-3">
                  模型分配
                </h4>
                <p className="text-xs text-text-tertiary mb-4">
                  为新对话分配默认使用的模型。
                </p>
                <div className="p-3 px-4 bg-modal-floating border border-std rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Star size={12} className="text-brand flex-shrink-0" />
                    <span className="text-sm text-primary truncate">
                      {[OFFLINE_MODEL, ...byokModels].find((m) => m.id === draft.activeModelId)?.name ??
                        draft.activeModelId}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-tertiary border border-std rounded px-1.5 py-0.5 flex-shrink-0">
                    默认
                  </span>
                </div>
                <p className="text-xs text-text-tertiary mt-3">
                  在「AI 模型」中点击模型可切换默认分配；对话框内亦可随时切换。
                </p>
              </div>
            )}

            {section === "theme" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-3">
                  颜色主题
                </h4>
                <div className="space-y-1">
                  {THEMES.map((t) => (
                    <ThemeRow
                      key={t.id}
                      name="settings_theme"
                      theme={t}
                      checked={draft.theme === t.name}
                      onSelect={() => update({ theme: t.name })}
                    />
                  ))}
                </div>
              </div>
            )}

            {section === "shortcuts" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-3">
                  快捷键
                </h4>
                <p className="text-xs text-text-tertiary mb-4">发送消息</p>
                <div className="space-y-1">
                  <RadioRow
                    name="settings_send_shortcut"
                    label={
                      <span className="flex items-center gap-2">
                        按 Ctrl+Enter 发送
                        <kbd className="text-[10px] text-text-tertiary border border-std rounded px-1.5 py-0.5">
                          Ctrl + Enter
                        </kbd>
                      </span>
                    }
                    checked={draft.sendShortcut === "ctrl-enter"}
                    onSelect={() => update({ sendShortcut: "ctrl-enter" })}
                  />
                  <RadioRow
                    name="settings_send_shortcut"
                    label={
                      <span className="flex items-center gap-2">
                        按 Enter 发送
                        <kbd className="text-[10px] text-text-tertiary border border-std rounded px-1.5 py-0.5">
                          Enter
                        </kbd>
                      </span>
                    }
                    checked={draft.sendShortcut === "enter"}
                    onSelect={() => update({ sendShortcut: "enter" })}
                  />
                </div>
              </div>
            )}

            {section === "auto" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-3">
                  自动行为
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 p-3 px-4 bg-modal-floating border border-std rounded-xl">
                    <div className="min-w-0">
                      <div className="text-sm text-primary">自动引用</div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        回答中自动插入引用来源
                      </p>
                    </div>
                    <Switch
                      on={draft.autoCitationEnabled}
                      onChange={(v) => update({ autoCitationEnabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3 px-4 bg-modal-floating border border-std rounded-xl">
                    <div className="min-w-0">
                      <div className="text-sm text-primary">联网搜索</div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        答案不确定时自动联网检索
                      </p>
                    </div>
                    <Switch
                      on={draft.isWebSearchEnabled}
                      onChange={(v) => update({ isWebSearchEnabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3 px-4 bg-modal-floating border border-std rounded-xl">
                    <div className="min-w-0">
                      <div className="text-sm text-primary">自动标题</div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        自动为对话生成标题
                      </p>
                    </div>
                    <Switch
                      on={draft.autoTitleEnabled}
                      onChange={(v) => update({ autoTitleEnabled: v })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部保存 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-divider flex-shrink-0">
          <p className="text-xs text-text-tertiary">设置仅保存在本地（演示）</p>
          <button
            onClick={save}
            className="bg-brand text-black font-bold rounded-full px-5 py-2 hover:opacity-90 transition-opacity"
          >
            保存
          </button>
        </div>
      </div>

      <ToastView toast={toast} />
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* OnboardingWizard                                                    */
/* ------------------------------------------------------------------ */

const ONBOARDING_STEPS = ["选择主题颜色", "个人信息"];

export function OnboardingWizard() {
  const { settings, setSettings, profile, setProfile, closeModal } = useApp();
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState(settings.theme);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [avatarColor, setAvatarColor] = useState(
    profile?.avatarColor ?? AVATAR_COLORS[0]
  );
  const [toast, showToast] = useToast();

  /** 跳过 / 完成共用的收尾：标记已引导并关闭（数据仅在完成时写入） */
  const done = () => {
    try {
      localStorage.setItem("explore-onboarded", "1");
    } catch {
      /* localStorage unavailable — skip */
    }
    closeModal("onboarding");
  };

  const finish = () => {
    if (!name.trim()) {
      showToast("请填写昵称");
      return;
    }
    setSettings({ theme });
    setProfile({ name: name.trim(), email: email.trim(), avatarColor });
    done();
  };

  return (
    <div
      className="fixed inset-0 bg-overlay-modal z-[100] flex items-center justify-center"
      onMouseDown={done}
    >
      <div
        className="w-[90%] max-w-[500px] h-[400px] bg-modal-std rounded-2xl shadow-2xl relative flex flex-col overflow-hidden border border-std"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 跳过 */}
        <button
          onClick={done}
          className="absolute top-4 right-5 text-xs text-text-tertiary hover:text-primary transition-colors z-10"
        >
          跳过
        </button>

        <div className="flex-1 px-8 pt-8 pb-20 flex flex-col items-center justify-center text-center min-h-0 overflow-hidden">
          <div key={step} className="new-word-fade-in w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold">{ONBOARDING_STEPS[step]}</h2>

            {step === 0 && (
              <>
                <p className="text-text-tertiary mt-2 text-sm">
                  选择您喜欢的应用外观风格。
                </p>
                <div className="mt-4 w-full max-h-56 overflow-y-auto scrollbar-card-neon pr-1 space-y-1">
                  {THEMES.map((t) => (
                    <ThemeRow
                      key={t.id}
                      name="setup_theme"
                      theme={t}
                      checked={theme === t.name}
                      onSelect={() => setTheme(t.name)}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-text-tertiary mt-2 text-sm">
                  这些信息仅保存在本机，用于个性化体验。
                </p>
                <div className="mt-4 w-full space-y-3">
                  <input
                    type="text"
                    placeholder="昵称"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-inputarea border border-std rounded-xl px-4 py-2.5 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                  />
                  <input
                    type="email"
                    placeholder="邮箱（可选）"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-inputarea border border-std rounded-xl px-4 py-2.5 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                  />
                  <div className="text-left">
                    <span className="text-xs text-text-tertiary">头像颜色</span>
                    <div className="mt-2">
                      <AvatarColorPicker
                        name="setup_avatar_color"
                        value={avatarColor}
                        onChange={setAvatarColor}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 步骤圆点 */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 pointer-events-none">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-brand" : "bg-btn-std"
              }`}
            />
          ))}
        </div>

        {/* 上一步 */}
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-btn-std hover:bg-btn-std-hover flex items-center justify-center shadow-lg transition-colors"
            aria-label="上一步"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* 下一步 / 完成 */}
        {step === 0 ? (
          <button
            onClick={() => setStep(1)}
            className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-btn-std hover:bg-btn-std-hover flex items-center justify-center shadow-lg transition-colors"
            aria-label="下一步"
          >
            <ChevronRight size={24} />
          </button>
        ) : (
          <button
            onClick={finish}
            className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-brand flex items-center justify-center text-black shadow-lg hover:scale-105 transition-transform"
            aria-label="完成"
          >
            <Check size={28} strokeWidth={3} />
          </button>
        )}

        <ToastView toast={toast} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ProfileModal（本地档案 = 个人工具的"登录"）                          */
/* ------------------------------------------------------------------ */

export function ProfileModal() {
  const { profile, setProfile, closeModal } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [avatarColor, setAvatarColor] = useState(
    profile?.avatarColor ?? AVATAR_COLORS[0]
  );
  const [toast, showToast] = useToast();

  const save = () => {
    if (!name.trim()) {
      showToast("请填写昵称");
      return;
    }
    setProfile({ name: name.trim(), email: email.trim(), avatarColor });
    setEditing(false);
    closeModal("login");
    showToast("已登录（本机存档）");
  };

  const startEdit = () => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setAvatarColor(profile.avatarColor);
    }
    setEditing(true);
  };

  return (
    <ModalShell onClose={() => closeModal("login")}>
      <div className="w-[90%] max-w-[400px] bg-modal-std rounded-3xl shadow-xl border-2 border-std p-8">
        {profile && !editing ? (
          /* 已登录态 */
          <>
            <div className="flex flex-col items-center text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black"
                style={{ background: profile.avatarColor }}
              >
                {(profile.name || "?").charAt(0)}
              </div>
              <h2 className="text-xl font-bold mt-3">{profile.name}</h2>
              <p className="text-sm text-text-tertiary mt-0.5">
                {profile.email}
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                onClick={startEdit}
                className="w-full py-2.5 rounded-full bg-btn-std hover:bg-btn-std-hover text-primary transition-colors"
              >
                编辑
              </button>
              <button
                onClick={() => setProfile(null)}
                className="w-full py-2.5 rounded-full bg-btn-std hover:bg-btn-std-hover text-primary transition-colors"
              >
                退出登录
              </button>
            </div>
          </>
        ) : (
          /* 未登录态 / 编辑态 */
          <>
            <div className="text-center">
              <h1 className="font-bruno-ace text-3xl text-brand shadow-brand">
                Explore
              </h1>
              <h2 className="text-xl font-bold mt-4">欢迎回来</h2>
              <p className="text-sm text-text-tertiary mt-1">
                登录以保存你的个人信息。（数据仅存本机）
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <input
                type="text"
                placeholder="昵称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-inputarea border border-std rounded-xl px-4 py-2.5 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
              />
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-inputarea border border-std rounded-xl px-4 py-2.5 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
              />
              <div>
                <span className="text-xs text-text-tertiary">头像颜色</span>
                <div className="mt-2">
                  <AvatarColorPicker
                    name="profile_avatar_color"
                    value={avatarColor}
                    onChange={setAvatarColor}
                  />
                </div>
              </div>
              <button
                onClick={save}
                className="w-full py-2.5 rounded-full bg-brand text-black font-bold hover:opacity-90 transition-opacity"
              >
                保存并登录
              </button>
            </div>
          </>
        )}

        <ToastView toast={toast} />
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* GuideModal — 使用指南（借鉴原站 How to Use 应用介绍）                */
/* ------------------------------------------------------------------ */

const GUIDE_ITEMS: { icon: string; title: string; desc: string }[] = [
  {
    icon: "✨",
    title: "智能标注",
    desc: "回复里的加粗术语都带下划线，点击即可展开解释卡片，继续追问深挖。",
  },
  {
    icon: "↗️",
    title: "子卡片",
    desc: "把上游卡片的标题作为背景主题，向下深挖背景知识。",
  },
  {
    icon: "➡️",
    title: "关联卡片",
    desc: "把上游卡片的标题作为相关主题，横向对比发散。",
  },
  {
    icon: "⬇️",
    title: "分支卡片",
    desc: "继承上游卡片主题与分支点之前的对话历史，另起炉灶；点分支轮次右上角的 ⛓ 可查看并调整分支点，📋 可总结分支点前的对话。",
  },
  {
    icon: "🪢",
    title: "发散卡片",
    desc: "有想探讨的关联想法？开一张发散卡片——平行会话不打断当前对话，在卡片树中位于来源卡片右侧同一层级。",
  },
  {
    icon: "📄",
    title: "文档阅读",
    desc: "导入文献高效阅读：划词即问，哪里不懂点哪里。",
  },
  {
    icon: "🌌",
    title: "思维宇宙",
    desc: "用自己的话表达理解，AI 验证后整合成你的知识星球——只连接真实关系。",
  },
  {
    icon: "💬",
    title: "引用回答",
    desc: "选中 AI 回复文本即可引用，支持多条引用，精确管理对话上下文。",
  },
  {
    icon: "🧭",
    title: "探索路径",
    desc: "每轮对话记录点开的词条卡片，深挖链条清晰可见，点击可重开。",
  },
  {
    icon: "🎨",
    title: "个性化",
    desc: "选择你的主题与语言，进入心流状态。",
  },
];

export function GuideModal() {
  const { closeModal } = useApp();
  return (
    <ModalShell onClose={() => closeModal("guide")} zIndex="z-[100]">
      <div className="w-[92%] max-w-[560px] max-h-[82vh] bg-modal-std rounded-2xl shadow-2xl relative flex flex-col overflow-hidden border border-std">
        <button
          onClick={() => closeModal("guide")}
          aria-label="关闭"
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-item-std-hover hover:text-primary"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto scrollbar-card-std px-6 sm:px-8 py-7">
          <h2 className="text-xl font-bold text-primary">使用指南</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            在这里，摆脱线性聊天框的限制，实现多层级对话——曾经在单线程对话中迷失的复杂讨论，现在可以完全展开。
          </p>

          <ul className="mt-5 grid grid-cols-1 gap-2.5">
            {GUIDE_ITEMS.map((f) => (
              <li
                key={f.title}
                className="flex items-start gap-3.5 rounded-xl bg-item-std px-4 py-3"
              >
                <span className="mt-0.5 shrink-0 text-lg leading-none" aria-hidden>
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-secondary">{f.title}</div>
                  <div className="mt-0.5 text-xs leading-snug text-text-tertiary">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-divider px-6 py-4">
          <button
            onClick={() => closeModal("guide")}
            className="w-full cursor-pointer rounded-full bg-btn-std px-6 py-2.5 text-sm text-primary transition-colors hover:bg-btn-std-hover"
          >
            开始探索 🌲
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
