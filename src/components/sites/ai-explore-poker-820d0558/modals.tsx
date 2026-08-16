"use client";

/**
 * Explore — Modals (site: ai.explore.poker/chat clone)
 * SettingsModal / OnboardingWizard / ProfileModal
 * Personal tool: no subscription, zh-only UI, local profile ("login").
 * Spec: docs/specs/ai-explore-poker-820d0558/07-modals.md
 */
import { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Eye,
  FolderTree,
  GitBranch,
  Keyboard,
  Layers,
  Loader2,
  Network,
  Orbit,
  Palette,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "./app-context";
import {
  MODEL_PRESETS,
  THEMES,
  isThemeImplemented,
} from "@/lib/sites/ai-explore-poker-820d0558/mock";
import type {
  ByokModel,
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
      role="dialog"
      aria-modal="true"
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

/** 测试 OpenAI 兼容接口连通性：GET {baseUrl}/models，带 Bearer 认证。
    返回 { ok, message }；超时/网络/CORS 失败统一转为可读消息。 */
async function testByokConnection(
  baseUrl: string,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    });
    if (res.ok) {
      let count: number | null = null;
      try {
        const data = (await res.json()) as { data?: unknown[] };
        if (Array.isArray(data.data)) count = data.data.length;
      } catch {
        /* 无 JSON 也能算连通 */
      }
      return {
        ok: true,
        message: count != null ? `连接成功（${count} 个模型可用）` : "连接成功",
      };
    }
    return { ok: false, message: `连接失败（HTTP ${res.status}）` };
  } catch (e) {
    const why = e instanceof Error && e.name === "AbortError" ? "请求超时" : "网络错误 / 被拦截";
    return { ok: false, message: `连接失败：${why}` };
  } finally {
    window.clearTimeout(timer);
  }
}

const NAV_ITEMS: { id: string; label: string; icon: typeof Bot }[] = [
  { id: "models", label: "AI 模型", icon: Bot },
  { id: "allocation", label: "模型分配", icon: Layers },
  { id: "memory", label: "个人记忆", icon: Brain },
  { id: "theme", label: "颜色主题", icon: Palette },
  { id: "shortcuts", label: "快捷键", icon: Keyboard },
  { id: "auto", label: "自动行为", icon: Zap },
];

function ModelRow({
  model,
  selected,
  onSelect,
  onRemove,
  onTest,
  testState,
}: {
  model: ModelInfo;
  selected: boolean;
  onSelect(): void;
  onRemove?: () => void;
  onTest?: () => void;
  testState?: { testing: boolean; result: { ok: boolean; message: string } | null };
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
          {testState?.result && (
            <p
              className={`mt-1 text-[11px] ${
                testState.result.ok ? "text-brand" : "text-destructive"
              }`}
            >
              {testState.result.ok ? "✓ " : "✗ "}
              {testState.result.message}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1 flex-shrink-0 self-center">
          {model.provider === "BYOK" && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTest?.();
                }}
                disabled={testState?.testing}
                aria-label={`测试 ${model.name} 连接`}
                title="测试连接"
                className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-brand transition-colors disabled:opacity-50"
              >
                {testState?.testing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Zap size={13} />
                )}
              </button>
              <span className="text-[10px] text-text-tertiary border border-std rounded px-1.5 py-0.5">
                BYOK
              </span>
            </>
          )}
          {model.provider === "BYOK" && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // 不触发行选中
                if (window.confirm(`删除模型「${model.name}」？密钥将从本机移除。`)) {
                  onRemove();
                }
              }}
              aria-label={`删除模型 ${model.name}`}
              title="删除该模型（密钥将从本机移除）"
              className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-destructive transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const {
    settings,
    setSettings,
    closeModal,
    openModal,
    byokModels,
    addByokModel,
    removeByokModel,
    profile,
    memories,
    addMemory,
    removeMemory,
    termStates,
    thoughtNodes,
  } =
    useApp();
  const [draft, setDraft] = useState<ChatSettings>(settings);
  const [section, setSection] = useState("models");
  const [toast, showToast] = useToast();
  // BYOK 表单
  const [byokOpen, setByokOpen] = useState(false);
  const [byokName, setByokName] = useState("");
  const [byokBaseUrl, setByokBaseUrl] = useState("");
  const [byokModelId, setByokModelId] = useState("");
  const [byokKey, setByokKey] = useState("");
  /** BYOK 表单：是否视觉（多模态）模型 */
  const [byokVision, setByokVision] = useState(false);
  // 连通性测试：表单草稿测试 + 已保存模型逐行测试
  const [testingDraft, setTestingDraft] = useState(false);
  const [draftTestResult, setDraftTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const testDraft = async () => {
    if (!byokBaseUrl.trim() || !byokKey.trim()) {
      showToast("请先填写 API 地址和 Key");
      return;
    }
    setTestingDraft(true);
    setDraftTestResult(null);
    const res = await testByokConnection(byokBaseUrl, byokKey);
    setDraftTestResult(res);
    setTestingDraft(false);
  };

  const testModel = async (m: ByokModel) => {
    setTestingId(m.id);
    setTestResults((r) => ({ ...r, [m.id]: null as unknown as { ok: boolean; message: string } }));
    const res = await testByokConnection(m.baseUrl, m.apiKey);
    setTestResults((r) => ({ ...r, [m.id]: res }));
    setTestingId(null);
  };

  // 个人记忆：手动添加输入
  const [memoryText, setMemoryText] = useState("");
  const [memoryCat, setMemoryCat] = useState("");

  const submitMemory = () => {
    if (!memoryText.trim()) {
      showToast("请填写要记住的内容");
      return;
    }
    addMemory(memoryText, memoryCat || undefined);
    setMemoryText("");
    setMemoryCat("");
    showToast("✓ 已记住");
  };

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
              onClick={() => openModal("docs")}
              className="text-xs text-brand border border-brand/40 rounded-full px-3 py-1.5 hover:bg-brand/10 transition-colors"
            >
              使用文档
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
                      请求发往你填的地址（浏览器直连，密钥不出本机）；添加前可先「测试连接」确认可用。
                    </p>
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={byokVision}
                        onChange={(e) => setByokVision(e.target.checked)}
                        className="h-3.5 w-3.5 accent-brand"
                      />
                      这是一个视觉（多模态）模型 —— 可作为「视觉模式」的识图模型（眼睛）
                    </label>
                    {draftTestResult && (
                      <p
                        className={`text-[11px] ${
                          draftTestResult.ok ? "text-brand" : "text-destructive"
                        }`}
                      >
                        {draftTestResult.ok ? "✓ " : "✗ "}
                        {draftTestResult.message}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={testDraft}
                        disabled={testingDraft}
                        className="text-xs text-text-secondary border border-std rounded-full px-3 py-1.5 hover:border-brand/50 hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {testingDraft ? "测试中…" : "测试连接"}
                      </button>
                      <button
                        onClick={() => {
                          setByokOpen(false);
                          setByokName("");
                          setByokBaseUrl("");
                          setByokModelId("");
                          setByokKey("");
                          setByokVision(false);
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
                          const ok = addByokModel({
                            name: byokName,
                            baseUrl: byokBaseUrl,
                            modelId: byokModelId,
                            apiKey: byokKey,
                            vision: byokVision,
                          });
                          if (!ok) {
                            showToast("同名模型已存在，请换一个名称");
                            return;
                          }
                          setByokName("");
                          setByokBaseUrl("");
                          setByokModelId("");
                          setByokKey("");
                          setByokVision(false);
                          setByokOpen(false);
                          showToast("已添加 BYOK 模型");
                        }}
                        className="text-xs text-brand-fg bg-brand hover:opacity-90 rounded-full px-4 py-1.5 font-medium transition-opacity"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                )}

                {byokModels.length === 0 && (
                  <div className="rounded-xl border border-dashed border-std p-4 text-center text-sm text-text-tertiary">
                    还没有配置模型 —— 点击上方「添加 BYOK 模型」接入你的 API。
                  </div>
                )}
                {byokModels.map((m) => (
                  <ModelRow
                    key={m.id}
                    model={m}
                    selected={draft.activeModelId === m.id}
                    onSelect={() => update({ activeModelId: m.id })}
                    onRemove={() => {
                      removeByokModel(m.id);
                      showToast("已删除模型");
                    }}
                    onTest={() => testModel(m)}
                    testState={{
                      testing: testingId === m.id,
                      result: testResults[m.id] ?? null,
                    }}
                  />
                ))}
              </div>
            )}

            {section === "models" && (
              <div className="mt-6 rounded-2xl border border-std bg-modal-floating/50 p-4">
                <h4 className="text-sm font-semibold text-text-header-secondary mb-1">
                  视觉模式（图片理解）
                </h4>
                <p className="text-xs text-text-tertiary mb-3">
                  发送图片时：多模态主模型直传原图；纯文本主模型则先由「视觉模型」识图，再把描述注入回答。
                </p>
                <div className="space-y-1">
                  <RadioRow
                    name="settings_vision_mode"
                    label="自动（推荐）：主模型支持则直传，否则用视觉模型识图"
                    checked={draft.visionMode === "auto"}
                    onSelect={() => update({ visionMode: "auto" })}
                  />
                  <RadioRow
                    name="settings_vision_mode"
                    label="原生：直传原图（需多模态主模型）"
                    checked={draft.visionMode === "native"}
                    onSelect={() => update({ visionMode: "native" })}
                  />
                  <RadioRow
                    name="settings_vision_mode"
                    label="路由：始终用视觉模型识图"
                    checked={draft.visionMode === "router"}
                    onSelect={() => update({ visionMode: "router" })}
                  />
                  <RadioRow
                    name="settings_vision_mode"
                    label="关闭：不允许发送图片"
                    checked={draft.visionMode === "off"}
                    onSelect={() => update({ visionMode: "off" })}
                  />
                </div>
                <div className="mt-4">
                  <div className="text-xs text-text-tertiary mb-1.5">
                    视觉模型（识图"眼睛"）：{draft.visionMode === "auto" || draft.visionMode === "router" ? "用于路由识图" : "当前模式下不参与"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {byokModels.filter((m) => m.vision).length === 0 && (
                      <span className="text-[11px] text-text-quaternary">
                        还没有视觉模型 —— 添加模型时勾选「视觉（多模态）模型」，或使用预设 GLM-4V-Flash / Qwen-VL-Max
                      </span>
                    )}
                    {byokModels
                      .filter((m) => m.vision)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => update({ visionModelId: m.id })}
                          className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                            draft.visionModelId === m.id
                              ? "border-brand/60 bg-brand/10 text-brand"
                              : "border-std text-text-secondary hover:border-brand/40 hover:text-primary"
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                  </div>
                </div>
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
                      {byokModels.find((m) => m.id === draft.activeModelId)?.name ??
                        (draft.activeModelId ? draft.activeModelId : "未配置模型")}
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

            {section === "memory" && (
              <div>
                <h4 className="text-sm font-semibold text-text-header-secondary mb-1">
                  个人记忆
                </h4>
                <p className="text-xs text-text-tertiary mb-4">
                  AI 在<span className="text-brand">所有对话</span>中都会参考以下信息回答，让回复更贴合你。数据仅存本机。
                </p>

                {/* 手动添加 */}
                <div className="p-3 bg-modal-floating border border-std rounded-xl space-y-2">
                  <div className="text-sm text-primary">添加「关于我」的事实</div>
                  <input
                    value={memoryText}
                    onChange={(e) => setMemoryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitMemory();
                    }}
                    placeholder="如：我是一名机器学习工程师 / 我喜欢读科幻小说"
                    className="w-full bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={memoryCat}
                      onChange={(e) => setMemoryCat(e.target.value)}
                      placeholder="分类（可选）：职业 / 兴趣 / 背景"
                      className="flex-1 min-w-0 bg-inputarea border border-std rounded-lg px-3 py-2 outline-none focus:border-brand/50 placeholder:text-text-quaternary text-sm"
                    />
                    <button
                      onClick={submitMemory}
                      className="shrink-0 text-xs text-brand-fg bg-brand hover:opacity-90 rounded-full px-4 py-2 font-medium transition-opacity"
                    >
                      记住
                    </button>
                  </div>
                </div>

                {/* 手动记忆列表 */}
                {memories.filter((m) => m.source === "manual").length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-text-tertiary mb-2">手动记忆（{memories.filter((m) => m.source === "manual").length}）</div>
                    <ul className="space-y-1.5">
                      {memories
                        .filter((m) => m.source === "manual")
                        .map((m) => (
                          <li
                            key={m.id}
                            className="flex items-start gap-2 rounded-xl bg-item-std px-3 py-2"
                          >
                            <span className="flex-1 min-w-0 text-sm text-text-secondary">
                              {m.category && (
                                <span className="mr-1.5 rounded border border-std px-1.5 text-[10px] text-text-tertiary">
                                  {m.category}
                                </span>
                              )}
                              {m.text}
                            </span>
                            <button
                              onClick={() => removeMemory(m.id)}
                              aria-label="删除这条记忆"
                              title="删除"
                              className="shrink-0 rounded p-1 text-text-quaternary transition-colors hover:bg-item-std-hover hover:text-destructive"
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* 自动记忆（来自账户/掌握度/思维宇宙） */}
                <div className="mt-5">
                  <div className="text-xs text-text-tertiary mb-2">
                    自动记忆（AI 从你的使用中了解到的）
                  </div>
                  <ul className="space-y-1.5">
                    {profile?.name && (
                      <li className="flex items-center gap-2 rounded-xl bg-item-std px-3 py-2 text-sm text-text-secondary">
                        <Star size={13} className="text-brand shrink-0" />
                        你的称呼：{profile.name}
                      </li>
                    )}
                    {Object.entries(termStates)
                      .filter(([, s]) => s === "mastered")
                      .slice(0, 10)
                      .map(([t]) => (
                        <li key={t} className="flex items-center gap-2 rounded-xl bg-item-std px-3 py-2 text-sm text-text-secondary">
                          <Check size={13} className="text-brand shrink-0" />
                          已掌握术语：{t}
                        </li>
                      ))}
                    {thoughtNodes
                      .filter((n) => n.status !== "pending")
                      .slice(0, 10)
                      .map((n) => (
                        <li key={n.id} className="flex items-center gap-2 rounded-xl bg-item-std px-3 py-2 text-sm text-text-secondary">
                          <Sparkles size={13} className="text-brand shrink-0" />
                          思维宇宙概念：{n.subject}
                        </li>
                      ))}
                    {!profile?.name &&
                      Object.values(termStates).filter((s) => s === "mastered").length === 0 &&
                      thoughtNodes.filter((n) => n.status !== "pending").length === 0 && (
                        <li className="rounded-xl border border-dashed border-std px-3 py-3 text-center text-xs text-text-tertiary">
                          暂无自动记忆——去对话里标记「已掌握」术语、收录思维宇宙概念，或完善账户档案
                        </li>
                      )}
                  </ul>
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
            className="bg-brand text-brand-fg font-bold rounded-full px-5 py-2 hover:opacity-90 transition-opacity"
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
            className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-brand flex items-center justify-center text-brand-fg shadow-lg hover:scale-105 transition-transform"
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
              <h1 className="font-monoton brand-neon text-2xl">
                OriginExplore
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
                className="w-full py-2.5 rounded-full bg-brand text-brand-fg font-bold hover:opacity-90 transition-opacity"
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
/* UsageDocModal — 使用文档（合并"如何使用"+"使用指南"的完整教程）       */
/* 侧边栏「使用文档」入口打开；章节快捷导航 + 可滚动正文。               */
/* ------------------------------------------------------------------ */

const DOC_SECTIONS: { id: string; label: string; icon: typeof Compass }[] = [
  { id: "welcome", label: "欢迎", icon: Compass },
  { id: "quickstart", label: "快速开始", icon: Zap },
  { id: "layers", label: "层级对话", icon: Network },
  { id: "diverge", label: "发散与分支", icon: GitBranch },
  { id: "tree", label: "卡片树", icon: FolderTree },
  { id: "universe", label: "思维宇宙", icon: Orbit },
  { id: "reading", label: "文档阅读", icon: BookOpen },
  { id: "smart", label: "智能模式", icon: Sparkles },
  { id: "vision", label: "视觉模式", icon: Eye },
  { id: "data", label: "数据与备份", icon: Database },
];

function DocCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Compass;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-std bg-card-std/50 px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Icon size={15} className="text-brand shrink-0" />
        {title}
      </p>
      <div className="mt-1.5 text-sm leading-6 text-text-secondary">{children}</div>
    </div>
  );
}

function DocSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`doc-${id}`} className="scroll-mt-4">
      <h3 className="flex items-center gap-2 text-lg font-bold text-primary">
        <span className="h-4 w-1 rounded-full bg-brand" />
        {title}
      </h3>
      {lead && <p className="mt-2 text-sm leading-6 text-text-tertiary">{lead}</p>}
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

export function UsageDocModal() {
  const { closeModal } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  const jumpTo = (id: string) => {
    scrollRef.current
      ?.querySelector(`#doc-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <ModalShell onClose={() => closeModal("docs")} zIndex="z-[100]">
      <div className="w-[92%] max-w-[880px] h-[85vh] bg-modal-std rounded-2xl shadow-2xl relative flex flex-col overflow-hidden border border-std">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-divider flex-shrink-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <BookMarked size={20} className="text-brand" />
            使用文档
          </h2>
          <button
            onClick={() => closeModal("docs")}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-item-std hover:text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* 章节快捷导航 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2 border-b border-divider flex-shrink-0">
          {DOC_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jumpTo(s.id)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors bg-btn-std text-text-secondary hover:bg-item-std-active hover:text-primary"
            >
              <s.icon size={12} />
              {s.label}
            </button>
          ))}
        </div>

        {/* 可滚动正文 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-card-std px-7 sm:px-10 py-8 space-y-10"
        >
          {/* 欢迎 */}
          <DocSection id="welcome" title="欢迎">
            <p className="text-base leading-8 text-primary">
              OriginExplore —— <span className="text-brand font-semibold">AI 结构化思维与知识探索工具</span>
              。哪里不懂点哪里，把一次对话长成一棵属于你的知识树。
            </p>
            <p className="text-sm leading-7 text-text-secondary">
              与传统聊天框不同，这里每一次「深挖」都会变成独立的卡片，层层展开、互不打断；
              你走过的探索路径、收录的理解，都会沉淀成可视化的知识网络。
            </p>
          </DocSection>

          {/* 快速开始 */}
          <DocSection
            id="quickstart"
            title="快速开始"
            lead="首次使用请先在「设置 → AI 模型」中配置 API 模型；四步走完第一次探索，约 2 分钟上手："
          >
            <DocCard icon={Zap} title="① 输入问题">
              在底部输入框问点什么（如「什么是量子纠缠？」），AI 会分点作答，把关键术语用
              <span className="text-brand">加粗</span> 标记——它们就是可点击的「深挖入口」。
            </DocCard>
            <DocCard icon={Network} title="② 点击术语深挖">
              点任意加粗术语，弹出术语卡片：↗️ 深挖背景 · ➡️ 横向对比 · ⬇️ 另起炉灶。
              每点一步，右侧「卡片树」就长出一个新节点。
            </DocCard>
            <DocCard icon={GitBranch} title="③ 发散或分支">
              想不打断当前对话聊相关话题？用「🪢 发散对话」开平行会话；
              想基于某个理解重新出发？用「⛓ 分支卡片」另起炉灶。
            </DocCard>
            <DocCard icon={Orbit} title="④ 收录进思维宇宙">
              对某个概念「懂了」时，点卡片上的「收录」，它会被点亮成 3D 星球；
              打开思维宇宙就能俯瞰你全部的理解。
            </DocCard>
          </DocSection>

          {/* 层级对话 */}
          <DocSection
            id="layers"
            title="层级对话"
            lead="核心交互：AI 回答里的加粗术语，全部可以点开继续深入。"
          >
            <DocCard icon={Network} title="↗️ 深挖背景">
              在术语卡片内继续提问，得到的新回答会作为「子卡片」挂在这层下面，
              读上游主题层层深入，答案自然连成树。
            </DocCard>
            <DocCard icon={Network} title="➡️ 横向对比">
              让 AI 对比当前术语与相关概念（如「煤炭 vs 石油」），对比结果作为同级卡片展开，
              并建立关联关系。
            </DocCard>
            <DocCard icon={Network} title="⬇️ 另起炉灶（继承上下文）">
              带着当前对话的上下文开一个新主题，既不完全脱离，也不打断主线；
              新卡片成为独立轮次，可在其中继续深入。
            </DocCard>
            <DocCard icon={Network} title="未读标记">
              每个轮次都有「已读/未读」状态：卡片树节点右键可切换，点击节点/跳转会清除，
              帮你标记「还没看完的深挖」。
            </DocCard>
          </DocSection>

          {/* 发散与分支 */}
          <DocSection
            id="diverge"
            title="发散与分支"
            lead="两种「并行展开」的方式，区别在于是否继承历史："
          >
            <DocCard icon={GitBranch} title="🪢 发散对话（平行会话）">
              术语卡片 →「🪢 发散对话」→ 平行会话从右侧滑入，与当前对话同级、互不打断；
              可在里面继续提问（消息顺延进该平行对话），点「回到主对话」滑回。
              卡片树中与来源卡同层右侧，用淡染标记。
            </DocCard>
            <DocCard icon={GitBranch} title="⛓ 分支卡片（另起炉灶）">
              术语卡片 →「⬇️ 另起炉灶」开分支；分支卡头部 ⛓ 可查看/调整「分支点」
              （来源对话里出现「✂️ 在此分支」标记，分割线随分支点移动），
              📋 可生成分支点前的上游对话总结。
            </DocCard>
            <DocCard icon={GitBranch} title="去重保护">
              同一来源 + 同一标题的发散/分支卡片只会创建一次，重复点开直接跳转到已有卡片，
              不会产生重复分支。
            </DocCard>
          </DocSection>

          {/* 卡片树 */}
          <DocSection
            id="tree"
            title="卡片树（右侧地图）"
            lead="当前对话的完整导航地图，常驻在对话区右侧。"
          >
            <DocCard icon={FolderTree} title="节点与状态">
              每个节点 = 一轮对话/一张术语卡。辉光节点 = 你当前所在位置；
              发散组用淡染底色标记；曲线引导线展示发散/分支/术语卡的来源关系。
            </DocCard>
            <DocCard icon={FolderTree} title="操作">
              点击节点跳转到对应卡片；右键切换已读/未读；收藏的轮次会同步出现在侧边栏「收藏」区。
            </DocCard>
          </DocSection>

          {/* 思维宇宙 */}
          <DocSection
            id="universe"
            title="思维宇宙"
            lead="全屏 3D 视图，俯瞰你沉淀下来的全部理解。"
          >
            <DocCard icon={Orbit} title="收录与验证">
              对话/文档里点「收录」后，节点先进入「待验证」；在思维宇宙侧栏确认后点亮成星球。
            </DocCard>
            <DocCard icon={Orbit} title="连接链">
              点击任意星球，右下角显示它的「连接链」（root → … → 本节点）——真实的深挖来源关系，
              可沿链跳转；拖拽旋转视角，滚轮缩放，空白处点击取消选中。
            </DocCard>
            <DocCard icon={Orbit} title="入口">
              对话框底部中央的 🧠 按钮，或最右侧 20px 折叠条打开「思维宇宙」侧栏。
            </DocCard>
          </DocSection>

          {/* 文档阅读 */}
          <DocSection
            id="reading"
            title="文档阅读"
            lead="上传论文/长文，逐段读懂。"
          >
            <DocCard icon={BookOpen} title="上传">
              侧边栏「本地文档」→「+」上传，支持 PDF / Word / Markdown / TXT / HTML。
            </DocCard>
            <DocCard icon={BookOpen} title="划词即问">
              阅读时选中文字 → 问 AI，会自动创建「论文：xxx」项目并基于文档内容回答。
            </DocCard>
            <DocCard icon={BookOpen} title="AI 解读">
              文档解读视图可让 AI 语义分块 + 双语对照 + 格式工整地重排全文；
              失败时自动回退本地启发式拆解，结果缓存到文档。
            </DocCard>
          </DocSection>

          {/* 智能模式 */}
          <DocSection
            id="smart"
            title="智能模式与联网搜索"
            lead="常驻聊天专属的个性化能力。"
          >
            <DocCard icon={Sparkles} title="AI 智能模式">
              侧边栏「常驻聊天」旁的 ✨ 开启后，AI 会结合你的个人档案、思维宇宙已收录概念、
              术语掌握度来回答——用你懂的概念打比方，回顾你问过的话题。
            </DocCard>
            <DocCard icon={Sparkles} title="联网搜索">
              设置 → 自动行为 → 开启「联网搜索」后，不确定的问题会先实时检索网页再回答，
              并附上来源链接；搜索失败时自动降级为普通回答。
            </DocCard>
            <DocCard icon={Sparkles} title="引用回答">
              选中 AI 回复中的任意文本，可引用到提问框，多条引用叠加提问。
            </DocCard>
          </DocSection>

          {/* 视觉模式 */}
          <DocSection
            id="vision"
            title="视觉模式（图片理解）"
            lead="发送图片，让 AI 看图——即使主模型是纯文本的也能做到。"
          >
            <DocCard icon={Eye} title="两种路线（自动判定）">
              输入框旁 🖼 按钮 / 直接粘贴 / 拖拽图片即可发送。主模型本身支持多模态
              （如 GPT-5.4、Gemini）→ 原图直传；主模型纯文本（如 DeepSeek）
              → 先由「视觉模型」识图，再把描述注入回答。
            </DocCard>
            <DocCard icon={Eye} title="配置建议">
              设置 → AI 模型 → 勾选「视觉（多模态）模型」添加识图模型。
              推荐：DeepSeek 用户配 <span className="text-brand">GLM-4V-Flash</span>
              （智谱免费档）当"眼睛"；视觉模式选「自动」即可。
            </DocCard>
            <DocCard icon={Eye} title="省流机制">
              图片自动降采样后发送；同一张图二次发送命中本地缓存（不重复识图）；
              历史对话里的旧图会降级为文字描述，控制请求体量。图片仅存缩略图在本机。
            </DocCard>
          </DocSection>

          {/* 数据与备份 */}
          <DocSection
            id="data"
            title="数据与备份"
            lead="个人工具：所有数据仅保存在本机，不经过任何服务器。"
          >
            <DocCard icon={Database} title="备份与恢复">
              侧边栏顶部「导出完整备份」把所有数据（项目 + 思维宇宙 + 文档 + 设置 + 档案）导出为
              单个 JSON 文件；「导入项目/恢复备份」按 id 合并还原，兼容旧版项目文件。
            </DocCard>
            <DocCard icon={Database} title="数据安全">
              密钥（BYOK API Key）仅存本机浏览器/应用存储；请求由浏览器直连你填写的 API 地址，
              不会经过第三方服务器。
            </DocCard>
          </DocSection>
        </div>

        {/* 底部 */}
        <div className="shrink-0 border-t border-divider px-6 py-4">
          <button
            onClick={() => closeModal("docs")}
            className="w-full cursor-pointer rounded-full bg-btn-std px-6 py-2.5 text-sm text-primary transition-colors hover:bg-btn-std-hover"
          >
            开始探索 🌲
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
