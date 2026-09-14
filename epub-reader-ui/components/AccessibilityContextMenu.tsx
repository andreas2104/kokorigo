"use client";

import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type ReaderFont = "default" | "serif" | "sans" | "dyslexic" | "rhythmic";

export type ReaderAccessibilitySettings = {
  fontSize: number;
  zoom: number;
  font: ReaderFont;
};

type AccessibilityContextMenuProps = {
  settings: ReaderAccessibilitySettings;
  onChange: (settings: ReaderAccessibilitySettings) => void;
  children: ReactNode;
  pointerTrackingEnabled?: boolean;
};

const STORAGE_KEY = "kokorigo:reader-accessibility";
const DEFAULT_SETTINGS: ReaderAccessibilitySettings = { fontSize: 18, zoom: 1, font: "default" };
const FONTS: Array<{ id: ReaderFont; label: string; preview: string }> = [
  { id: "default", label: "Par défaut", preview: "inherit" },
  { id: "serif", label: "Serif", preview: "Georgia, serif" },
  { id: "sans", label: "Sans-serif", preview: "system-ui, sans-serif" },
  { id: "dyslexic", label: "OpenDyslexic", preview: "OpenDyslexic, system-ui, sans-serif" },
  { id: "rhythmic", label: "Rythmique", preview: "system-ui, sans-serif" },
];

export function loadReaderAccessibilitySettings(): ReaderAccessibilitySettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ReaderAccessibilitySettings> | null;
    if (!parsed) return DEFAULT_SETTINGS;
    return {
      fontSize: Math.min(32, Math.max(12, Number(parsed.fontSize) || DEFAULT_SETTINGS.fontSize)),
      zoom: Math.min(1.4, Math.max(0.8, Number(parsed.zoom) || DEFAULT_SETTINGS.zoom)),
      font: FONTS.some((font) => font.id === parsed.font) ? parsed.font as ReaderFont : DEFAULT_SETTINGS.font,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveReaderAccessibilitySettings(settings: ReaderAccessibilitySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    return;
  }
}

export function useReaderAccessibilitySettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadReaderAccessibilitySettings()), []);
  const update = (next: ReaderAccessibilitySettings) => {
    setSettings(next);
    saveReaderAccessibilitySettings(next);
  };
  return [settings, update] as const;
}

export function readerContentStyle(settings: ReaderAccessibilitySettings): React.CSSProperties {
  const selectedFont = FONTS.find((font) => font.id === settings.font) ?? FONTS[0];
  return {
    fontSize: `${settings.fontSize}px`,
    fontFamily: selectedFont.preview,
    letterSpacing: settings.font === "rhythmic" ? "0.05em" : undefined,
    lineHeight: settings.font === "rhythmic" ? 1.9 : undefined,
    transform: `scale(${settings.zoom})`,
    transformOrigin: "var(--reader-zoom-origin-x, 50%) var(--reader-zoom-origin-y, 0%)",
    transition: "transform 160ms ease, transform-origin 80ms linear",
  };
}

export function focusReaderZoomOnElement(element: HTMLElement | null) {
  const content = element?.closest<HTMLElement>("[data-reader-content]");
  if (!element || !content) return;
  const contentBounds = content.getBoundingClientRect();
  const elementBounds = element.getBoundingClientRect();
  if (!contentBounds.width || !contentBounds.height) return;
  const x = ((elementBounds.left + elementBounds.width / 2 - contentBounds.left) / contentBounds.width) * 100;
  const y = ((elementBounds.top + elementBounds.height / 2 - contentBounds.top) / contentBounds.height) * 100;
  content.style.setProperty("--reader-zoom-origin-x", `${Math.min(100, Math.max(0, x))}%`);
  content.style.setProperty("--reader-zoom-origin-y", `${Math.min(100, Math.max(0, y))}%`);
}

export default function AccessibilityContextMenu({ settings, onChange, children, pointerTrackingEnabled = true }: AccessibilityContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const close = () => { setOpen(false); setFontsOpen(false); };
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    longPressOriginRef.current = null;
  };

  const openAt = (clientX: number, clientY: number) => {
    const width = 260;
    const height = Math.min(fontsOpen ? 390 : 285, window.innerHeight * 0.7);
    setPosition({
      x: Math.min(clientX, Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(clientY, Math.max(8, window.innerHeight - height - 8)),
    });
    setOpen(true);
  };

  const show = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    openAt(event.clientX, event.clientY);
  };

  // Un écran tactile n'a pas de clic droit : l'appui long ouvre le même menu.
  const startLongPress = (event: React.PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    cancelLongPress();
    if (event.pointerType !== "touch" || menuRef.current?.contains(event.target as Node)) return;
    const { clientX, clientY } = event;
    longPressOriginRef.current = { x: clientX, y: clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickRef.current = true;
      openAt(clientX, clientY);
    }, 500);
  };

  // L'appui long ne doit pas déclencher la lecture du mot touché.
  const swallowClickAfterLongPress = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => () => cancelLongPress(), []);

  const change = (partial: Partial<ReaderAccessibilitySettings>) => onChange({ ...settings, ...partial });
  const close = () => { setOpen(false); setFontsOpen(false); };
  const followPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = longPressOriginRef.current;
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancelLongPress();
    // Le défilement tactile ne doit pas déplacer le centre du zoom.
    if (event.pointerType === "touch" || !pointerTrackingEnabled) return;
    if (menuRef.current?.contains(event.target as Node)) return;
    const content = wrapperRef.current?.querySelector<HTMLElement>("[data-reader-content]");
    if (!content) return;
    const bounds = content.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    content.style.setProperty("--reader-zoom-origin-x", `${x}%`);
    content.style.setProperty("--reader-zoom-origin-y", `${y}%`);
  };
  const items = [
    { label: "Agrandir le texte", icon: Plus, disabled: settings.fontSize >= 32, action: () => change({ fontSize: Math.min(32, settings.fontSize + 2) }) },
    { label: "Réduire le texte", icon: Minus, disabled: settings.fontSize <= 12, action: () => change({ fontSize: Math.max(12, settings.fontSize - 2) }) },
    { label: "Zoom avant", icon: ZoomIn, disabled: settings.zoom >= 1.4, action: () => change({ zoom: Math.min(1.4, Number((settings.zoom + 0.1).toFixed(1))) }) },
    { label: "Zoom arrière", icon: ZoomOut, disabled: settings.zoom <= 0.8, action: () => change({ zoom: Math.max(0.8, Number((settings.zoom - 0.1).toFixed(1))) }) },
  ];

  return (
    <div
      ref={wrapperRef}
      onContextMenu={show}
      onPointerMove={followPointer}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClickCapture={swallowClickAfterLongPress}
      className="contents"
    >
      {children}
      {open && (
        <div ref={menuRef} role="menu" aria-label="Options d’accessibilité" className="fixed z-[100] max-h-[70vh] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" style={{ left: position.x, top: position.y }} onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); close(); return; }
          const target = event.target as HTMLElement;
          const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? []);
          const index = menuItems.indexOf(target);
          if (index < 0 || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          menuItems[(index + (event.key === "ArrowDown" ? 1 : -1) + menuItems.length) % menuItems.length]?.focus();
        }}>
          {items.map(({ label, icon: Icon, disabled, action }, index) => (
            <button key={label} ref={index === 0 ? firstItemRef : undefined} type="button" role="menuitem" aria-disabled={disabled} disabled={disabled} onClick={() => { action(); close(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-violet-50 focus:bg-violet-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-violet-950/50 dark:focus:bg-violet-950/50">
              <Icon className="h-4 w-4 text-violet-500" />{label}
            </button>
          ))}
          <button type="button" role="menuitem" aria-haspopup="true" aria-expanded={fontsOpen} onClick={() => setFontsOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-violet-50 focus:bg-violet-50 focus:outline-none dark:hover:bg-violet-950/50 dark:focus:bg-violet-950/50"><span className="w-4 text-center font-serif text-violet-500">Aa</span>Police<ChevronRight className={`ml-auto h-4 w-4 transition-transform ${fontsOpen ? "rotate-90" : ""}`} /></button>
          {fontsOpen && <div role="menu" aria-label="Choisir une police" className="mb-1 ml-4 border-l border-slate-200 pl-1 dark:border-slate-700">{FONTS.map((font) => <button key={font.id} type="button" role="menuitem" onClick={() => { change({ font: font.id }); close(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 focus:bg-violet-50 focus:outline-none dark:hover:bg-violet-950/50" style={{ fontFamily: font.preview, letterSpacing: font.id === "rhythmic" ? "0.05em" : undefined, lineHeight: font.id === "rhythmic" ? 1.6 : undefined }}><span className="w-4">{settings.font === font.id && <Check className="h-4 w-4 text-violet-500" />}</span>{font.label}</button>)}</div>}
          <button type="button" role="menuitem" onClick={() => { onChange(DEFAULT_SETTINGS); close(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-violet-50 focus:bg-violet-50 focus:outline-none dark:hover:bg-violet-950/50"><RotateCcw className="h-4 w-4 text-violet-500" />Réinitialiser</button>
        </div>
      )}
    </div>
  );
}
