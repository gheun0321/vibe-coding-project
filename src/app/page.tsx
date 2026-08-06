"use client";

import { useEffect, useState } from "react";
import {
  IconEye,
  IconMic,
  IconBack,
  IconRice,
  IconWater,
  IconVeg,
  IconFruit,
  IconDaily,
  IconSnack,
  IconMed,
  IconOther,
  IconCheck,
  IconCalendarToday,
  IconCalendarTomorrow,
  IconCalendarPick,
  IconCash,
  IconCard,
} from "./icons";

type ScreenId = "home" | "items" | "delivery" | "address" | "payment" | "confirm";
type Mode = "button" | "voice" | null;
type PaymentMethod = "meet" | "card" | null;
type DateChoice = "today" | "tomorrow" | "custom";
type LineItem = { variant: string; qty: number; price: number };

type PresetItem = {
  id: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
};

// 순서는 음성 안내 멘트("채소, 과일, 쌀, 물, 생활용품, 간식, 약과 건강용품")와 맞춰뒀어요.
const PRESET_ITEMS: PresetItem[] = [
  { id: "veg", label: "채소", Icon: IconVeg },
  { id: "fruit", label: "과일", Icon: IconFruit },
  { id: "rice", label: "쌀", Icon: IconRice },
  { id: "water", label: "물", Icon: IconWater },
  { id: "daily", label: "생활용품", Icon: IconDaily },
  { id: "snack", label: "간식", Icon: IconSnack },
  { id: "med", label: "약·건강용품", Icon: IconMed },
];

// 어르신들이 자주 찾는 품목/용량과, 대략적인 가격(원)을 함께 구성했어요. 실제 상점 가격에 맞춰 언제든 바꿀 수 있어요.
const ITEM_PRICES: Record<string, Record<string, number>> = {
  veg: { 배추: 3000, 무: 2000, 감자: 4000, 양파: 3500, 당근: 3000, 시금치: 2500, 콩나물: 1500, 오이: 3000 },
  fruit: { 사과: 5000, 배: 6000, 바나나: 4000, 귤: 5000, 포도: 7000, 감: 4500, 수박: 15000, 참외: 6000 },
  rice: { "300g": 2500, "500g": 3500, "1kg": 5000, "2kg": 8000, "5kg": 18000, "10kg": 32000, "20kg": 58000 },
  water: { "100ml": 500, "150ml": 600, "200ml": 700, "300ml": 900, "500ml": 1000, "1L": 1500, "2L": 2000 },
  // 화장지·키친타올·세제처럼 무거워서 어르신이 직접 사 오기 힘든 것 위주
  daily: { 화장지: 12000, 키친타올: 6000, 칫솔: 2000, 치약: 3000, 주방세제: 4000, 빨래세제: 9000, 물티슈: 5000 },
  snack: { 뻥튀기: 2000, 약과: 5000, 두유: 4000, 요구르트: 3000, 비스킷: 2500, 카스테라: 4000, 사탕: 2000 },
  // 편의점에서도 살 수 있는 상비약 위주 (파스, 벌레 물린 데 바르는 약 등)
  med: { 파스: 4000, "물파스(벌레 물린 데)": 3000, 소화제: 3500, 감기약: 5000, 진통제: 4500, 밴드: 2000, 마스크: 3000 },
};

const ITEM_VARIANTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ITEM_PRICES).map(([id, prices]) => [id, Object.keys(prices)])
);

const STEP_ORDER: ScreenId[] = ["home", "items", "delivery", "address", "payment", "confirm"];
const STEP_LABEL: Partial<Record<ScreenId, string>> = {
  items: "1/5 · 물품 선택",
  delivery: "2/5 · 배송일 선택",
  address: "3/5 · 배송지 입력",
  payment: "4/5 · 결제 방법",
  confirm: "5/5 · 주문 완료",
};

const HOME_GREETING =
  "안녕하세요. 오늘은 무엇을 주문해 볼까요? 그림을 눌러 방법을 골라주세요. 화면 보고 고르기. 소리 듣고 고르기.";

function speak(text: string): boolean {
  try {
    if (!("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

type ListenOptions = { timeoutMs?: number; continuous?: boolean };

function listenOnce(
  onResult: (transcript: string) => void,
  onUnavailable: () => void,
  options?: ListenOptions
) {
  type SpeechRecognitionResultLike = { 0: { transcript: string } };
  type SpeechRecognitionCtor = new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    continuous: boolean;
    onresult: ((event: { results: { length: number; [index: number]: SpeechRecognitionResultLike } }) => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
  const Recognition =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
  if (!Recognition) {
    onUnavailable();
    return;
  }
  try {
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = options?.continuous ?? false;

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (options?.timeoutMs) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          recognition.stop();
        } catch {
          // ignore: recognition may already be stopped
        }
        onUnavailable();
      }, options.timeoutMs);
    }

    recognition.onresult = (event) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      onResult(event.results[event.results.length - 1][0].transcript);
    };
    recognition.onerror = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      onUnavailable();
    };
    recognition.start();
  } catch {
    onUnavailable();
  }
}

function isYesAnswer(text: string): boolean {
  if (/아니|안\s?맞|틀리|다르/.test(text)) return false;
  return /맞|그래|응|네|넵/.test(text);
}

function isNoAnswer(text: string): boolean {
  return /틀리|아니|다르|안\s?맞/.test(text);
}

function isNoMoreAnswer(text: string): boolean {
  return /없|괜찮|그만|다\s?됐/.test(text);
}

function formatCustomDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function parseSpokenDate(text: string): { value: string; display: string } | null {
  const match = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const now = new Date();
  let year = now.getFullYear();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (new Date(year, month - 1, day).getTime() < todayStart) year += 1;

  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { value, display: formatCustomDateLabel(value) };
}

const cardBase =
  "relative flex flex-col items-center justify-center gap-2 rounded-[26px] border-[5px] border-frame bg-surface p-4 min-h-[150px] cursor-pointer text-center outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";
const choiceCard =
  "flex flex-1 min-w-[150px] flex-col items-center justify-center gap-3 rounded-[24px] border-4 border-frame bg-surface p-6 cursor-pointer text-center outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";
const nextBtn =
  "rounded-[20px] bg-accent-success px-8 py-3.5 text-[clamp(1.05rem,2.2vw,1.3rem)] font-extrabold text-white disabled:bg-frame disabled:text-text-soft disabled:cursor-not-allowed";
const backBtn =
  "flex items-center gap-2 rounded-[18px] border-[3px] border-frame bg-surface px-4 py-2.5 text-[clamp(1.05rem,2vw,1.3rem)] font-bold outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";
const variantChip =
  "rounded-2xl border-[3px] border-frame bg-background px-4 py-2.5 text-[clamp(1rem,2vw,1.15rem)] font-bold outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";
const variantChipSelected = "border-accent-success bg-accent-success text-white";
const stepperBtn =
  "flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-frame text-2xl font-extrabold outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";

function VoiceBanner({
  active,
  status,
  onReplay,
}: {
  active: boolean;
  status: string;
  onReplay: () => void;
}) {
  if (!active) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3.5 rounded-[20px] border-[3px] border-accent-voice bg-surface px-4 py-3">
      <div className="flex h-[26px] items-end gap-1">
        {[0, 0.15, 0.3, 0.45].map((delay) => (
          <span
            key={delay}
            className="voice-wave-bar w-1.5 rounded-sm bg-accent-voice"
            style={{ animation: "wave 1s ease-in-out infinite", animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <span className="text-[clamp(.95rem,2vw,1.1rem)] font-bold text-text-soft">{status}</span>
      <button
        onClick={onReplay}
        className="flex items-center gap-2 rounded-2xl bg-accent-voice px-4 py-2.5 text-[clamp(.95rem,2vw,1.1rem)] font-extrabold text-white"
      >
        <IconMic className="h-[22px] w-[22px]" />
        다시 듣기
      </button>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [mode, setMode] = useState<Mode>(null);
  const [itemLines, setItemLines] = useState<Record<string, LineItem[]>>({});
  const [custom, setCustom] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<{ type: DateChoice; label: string } | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherInput, setOtherInput] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [replayToken, setReplayToken] = useState(0);
  const [pickingCustomDate, setPickingCustomDate] = useState(false);

  const [otherStep, setOtherStep] = useState<"idle" | "name" | "confirm" | "more">("idle");
  const [otherCandidate, setOtherCandidate] = useState("");
  const [otherVoiceStatus, setOtherVoiceStatus] = useState("");

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draftVariant, setDraftVariant] = useState("");
  const [draftQty, setDraftQty] = useState(1);
  const [justAddedVariant, setJustAddedVariant] = useState<string | null>(null);

  const [dateVoiceStatus, setDateVoiceStatus] = useState("");

  const voiceActive = mode === "voice" && screen !== "home";

  function deliveryNoticePhrase(): string {
    if (!delivery) return "";
    if (delivery.type === "today") return "오늘 중";
    if (delivery.type === "tomorrow") return "내일 중";
    if (delivery.type === "custom" && customDate) return `${formatCustomDateLabel(customDate)}에`;
    return "";
  }

  // 첫 화면: 매번 화면에 들어올 때 인사 + 화면 내용을 읽어줘요 (안내문구는 제외).
  useEffect(() => {
    if (screen !== "home") return;
    speak(HOME_GREETING);
  }, [screen]);

  useEffect(() => {
    if (mode !== "voice" || screen === "home") return;

    let prompt = "";
    let onResult: ((transcript: string) => void) | null = null;
    let listenOptions: ListenOptions | undefined;

    if (screen === "items") {
      prompt =
        "채소, 과일, 쌀, 물, 생활용품, 간식, 약과 건강용품 중에서 필요한 것을 그림을 눌러 담아주세요. 목록에 없으면 기타 그림을 눌러주세요.";
    } else if (screen === "delivery") {
      prompt = "오늘 배달, 내일 배달, 다른 날짜 중에서 골라주세요.";
      onResult = (t) => {
        if (t.includes("오늘")) pickDate("today");
        else if (t.includes("내일")) pickDate("tomorrow");
      };
    } else if (screen === "address") {
      prompt = "배달받을 주소를 말씀해 주시거나 입력해주세요. 천천히 말씀하셔도 괜찮아요.";
      onResult = (t) => setAddress(t);
      listenOptions = { timeoutMs: 15000, continuous: true };
    } else if (screen === "payment") {
      prompt = "만나서 결제하시려면 왼쪽, 카드로 결제하시려면 오른쪽 그림을 눌러주세요.";
      onResult = (t) => {
        if (t.includes("만나") || t.includes("현금")) pickPayment("meet");
        else if (t.includes("카드")) pickPayment("card");
      };
    } else if (screen === "confirm") {
      const phrase = deliveryNoticePhrase();
      prompt = `주문이 접수되었어요. 가까운 가게에 알림을 보냈고, ${phrase ? phrase + " " : ""}물건을 챙겨서 댁으로 배달해드려요.`;
    }

    const timer = setTimeout(() => {
      const ok = speak(prompt);
      setVoiceStatus(ok ? "안내 음성을 재생하고 있어요" : "이 화면에서는 음성 재생이 막혀 있어요 · 그림을 눌러 골라주세요");
      if (onResult) {
        listenOnce(
          onResult,
          () => {
            setVoiceStatus("그림을 눌러 골라주세요 (음성 인식은 이 환경에서 막혀 있을 수 있어요)");
          },
          listenOptions
        );
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, mode, replayToken]);

  useEffect(() => {
    if (!(otherOpen && mode === "voice")) {
      window.speechSynthesis?.cancel();
      return;
    }
    const timer = setTimeout(() => otherAskName(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherOpen, mode]);

  useEffect(() => {
    if (!(pickingCustomDate && mode === "voice" && screen === "delivery")) return;
    const timer = setTimeout(() => dateAskVoice(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickingCustomDate, mode, screen]);

  function closeOtherModal() {
    window.speechSynthesis?.cancel();
    setOtherOpen(false);
    setOtherStep("idle");
    setOtherVoiceStatus("");
  }

  function otherAskName() {
    setOtherStep("name");
    const ok = speak("추가하실 물건 이름을 말씀해주세요.");
    setOtherVoiceStatus(ok ? "물건 이름을 말씀해주세요" : "음성 재생이 막혀 있어요 · 직접 입력해주세요");
    listenOnce(
      (t) => otherConfirmCandidate(t),
      () => setOtherVoiceStatus("음성 인식이 되지 않았어요 · 직접 입력하거나 다시 듣기를 눌러주세요"),
      { timeoutMs: 15000, continuous: true }
    );
  }

  function otherConfirmCandidate(candidate: string) {
    const value = candidate.trim();
    if (!value) {
      otherAskName();
      return;
    }
    setOtherCandidate(value);
    setOtherStep("confirm");
    const ok = speak(`${value}, 맞으세요? 맞으면 맞다, 아니면 다시 말씀해주세요.`);
    setOtherVoiceStatus(ok ? `"${value}" 맞으세요?` : "음성 재생이 막혀 있어요 · 직접 입력해주세요");
    listenOnce(
      (t) => otherHandleConfirmAnswer(value, t),
      () => setOtherVoiceStatus("음성 인식이 되지 않았어요 · 직접 입력하거나 다시 듣기를 눌러주세요"),
      { timeoutMs: 15000, continuous: true }
    );
  }

  function otherHandleConfirmAnswer(candidate: string, answer: string) {
    if (isYesAnswer(answer)) {
      setCustom((prev) => [...prev, candidate]);
      otherAskMore();
    } else if (isNoAnswer(answer)) {
      speak("다시 한번 말씀해주세요.");
      otherAskName();
    } else {
      speak("잘 못 들었어요. 맞으면 맞다, 아니면 아니다 라고 말씀해주세요.");
      setOtherVoiceStatus("다시 들어볼게요");
      listenOnce(
        (t) => otherHandleConfirmAnswer(candidate, t),
        () => setOtherVoiceStatus("음성 인식이 되지 않았어요 · 직접 입력하거나 다시 듣기를 눌러주세요"),
        { timeoutMs: 15000, continuous: true }
      );
    }
  }

  function otherAskMore() {
    setOtherStep("more");
    const ok = speak("더 추가하실 물건이 있으세요? 없으시면 없다고 말씀하시거나 닫기를 눌러주세요.");
    setOtherVoiceStatus(ok ? "더 추가하실 물건이 있으세요?" : "음성 재생이 막혀 있어요 · 없으시면 닫기를 눌러주세요");
    listenOnce(
      (t) => otherHandleMoreAnswer(t),
      () => setOtherVoiceStatus("음성 인식이 되지 않았어요 · 없으시면 닫기를 눌러주세요"),
      { timeoutMs: 15000, continuous: true }
    );
  }

  function otherHandleMoreAnswer(answer: string) {
    if (isNoMoreAnswer(answer)) {
      speak("네, 담았어요. 창을 닫을게요.");
      setOtherVoiceStatus("주문에 담고 창을 닫을게요");
      setTimeout(() => closeOtherModal(), 3000);
    } else {
      otherConfirmCandidate(answer);
    }
  }

  function otherReplay() {
    if (otherStep === "name") otherAskName();
    else if (otherStep === "confirm") otherConfirmCandidate(otherCandidate);
    else if (otherStep === "more") otherAskMore();
  }

  function dateAskVoice() {
    const ok = speak("받고 싶은 날짜를 말씀해주세요. 예를 들어 8월 15일처럼 말씀해주세요.");
    setDateVoiceStatus(ok ? "날짜를 말씀해주세요" : "음성 재생이 막혀 있어요 · 달력에서 직접 골라주세요");
    listenOnce(
      (t) => dateConfirmCandidate(t),
      () => setDateVoiceStatus("음성 인식이 되지 않았어요 · 달력에서 직접 골라주세요"),
      { timeoutMs: 15000, continuous: true }
    );
  }

  function dateConfirmCandidate(text: string) {
    const parsed = parseSpokenDate(text);
    if (!parsed) {
      speak("날짜를 알아듣지 못했어요. 다시 말씀해주세요.");
      dateAskVoice();
      return;
    }
    const ok = speak(`${parsed.display}, 맞으세요? 맞으면 맞다, 아니면 다시 말씀해주세요.`);
    setDateVoiceStatus(ok ? `"${parsed.display}" 맞으세요?` : "음성 재생이 막혀 있어요 · 달력에서 직접 골라주세요");
    listenOnce(
      (t) => dateHandleConfirmAnswer(parsed, t),
      () => setDateVoiceStatus("음성 인식이 되지 않았어요 · 달력에서 직접 골라주세요"),
      { timeoutMs: 15000, continuous: true }
    );
  }

  function dateHandleConfirmAnswer(parsed: { value: string; display: string }, answer: string) {
    if (isYesAnswer(answer)) {
      pickCustomDate(parsed.value);
      speak(`${parsed.display}로 담았어요.`);
      setDateVoiceStatus(`${parsed.display}로 담았어요`);
    } else if (isNoAnswer(answer)) {
      speak("다시 말씀해주세요.");
      dateAskVoice();
    } else {
      speak("잘 못 들었어요. 맞으면 맞다, 아니면 아니다 라고 말씀해주세요.");
      setDateVoiceStatus("다시 들어볼게요");
      listenOnce(
        (t) => dateHandleConfirmAnswer(parsed, t),
        () => setDateVoiceStatus("음성 인식이 되지 않았어요 · 달력에서 직접 골라주세요"),
        { timeoutMs: 15000, continuous: true }
      );
    }
  }

  function chooseMode(m: "button" | "voice") {
    setMode(m);
    setScreen("items");
  }

  function goBack() {
    window.speechSynthesis?.cancel();
    const idx = STEP_ORDER.indexOf(screen);
    setScreen(STEP_ORDER[Math.max(0, idx - 1)]);
  }

  function openItemPopup(id: string) {
    const options = ITEM_VARIANTS[id] ?? [];
    setDraftVariant(options[0] ?? "");
    setDraftQty(1);
    setJustAddedVariant(null);
    setOpenItemId(id);
  }

  function addLineItem() {
    if (!openItemId || !draftVariant) return;
    const price = ITEM_PRICES[openItemId]?.[draftVariant] ?? 0;
    const categoryId = openItemId;
    setItemLines((prev) => {
      const lines = prev[categoryId] ?? [];
      const idx = lines.findIndex((line) => line.variant === draftVariant);
      const nextLines =
        idx >= 0
          ? lines.map((line, i) => (i === idx ? { ...line, qty: line.qty + draftQty } : line))
          : [...lines, { variant: draftVariant, qty: draftQty, price }];
      return { ...prev, [categoryId]: nextLines };
    });
    setJustAddedVariant(draftVariant);
    setTimeout(() => setJustAddedVariant(null), 700);
    setDraftQty(1);
  }

  function removeLineItem(categoryId: string, variant: string) {
    setItemLines((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] ?? []).filter((line) => line.variant !== variant),
    }));
  }

  function addCustomItem() {
    const value = otherInput.trim();
    if (!value) return;
    setCustom((prev) => [...prev, value]);
    setOtherInput("");
  }

  function removeCustomItem(index: number) {
    setCustom((prev) => prev.filter((_, i) => i !== index));
  }

  function pickDate(type: "today" | "tomorrow") {
    setPickingCustomDate(false);
    setDelivery({ type, label: type === "today" ? "오늘 중" : "내일 중" });
  }

  function openCustomDatePicker() {
    setPickingCustomDate(true);
    if (!customDate) setDelivery(null);
  }

  function pickCustomDate(value: string) {
    setCustomDate(value);
    if (!value) {
      setDelivery(null);
      return;
    }
    const label = `${formatCustomDateLabel(value)} 도착 희망`;
    setDelivery({ type: "custom", label });
  }

  function pickPayment(method: "meet" | "card") {
    setPayment(method);
    setScreen("confirm");
  }

  function restart() {
    window.speechSynthesis?.cancel();
    setScreen("home");
    setMode(null);
    setItemLines({});
    setCustom([]);
    setDelivery(null);
    setCustomDate("");
    setPickingCustomDate(false);
    setAddress("");
    setPayment(null);
  }

  const totalLineCount = Object.values(itemLines).reduce((sum, lines) => sum + lines.length, 0) + custom.length;
  const itemsSubtotal = Object.values(itemLines)
    .flat()
    .reduce((sum, line) => sum + line.price * line.qty, 0);
  const summaryItems = [
    ...PRESET_ITEMS.flatMap((it) =>
      (itemLines[it.id] ?? []).map((line) => `${line.variant} × ${line.qty}개 (${(line.price * line.qty).toLocaleString()}원)`)
    ),
    ...custom,
  ];
  const openItem = PRESET_ITEMS.find((it) => it.id === openItemId);
  const openItemLines = openItemId ? itemLines[openItemId] ?? [] : [];
  const openItemSubtotal = openItemLines.reduce((sum, line) => sum + line.price * line.qty, 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-4 sm:p-8">
      {screen === "home" && (
        <section className="flex flex-1 flex-col gap-6">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold leading-snug text-balance">
            오늘은 무엇을 주문해 볼까요?
            <span className="mt-2 block text-[clamp(1rem,2.2vw,1.25rem)] font-semibold text-text-soft">
              그림을 눌러 방법을 골라주세요
            </span>
          </p>
          <div className="flex flex-1 flex-col gap-4 min-[560px]:flex-row">
            <button
              onClick={() => chooseMode("button")}
              className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[32px] border-[6px] border-accent-button-deep bg-accent-button p-8 text-white outline-none transition hover:brightness-105 active:scale-[.98] focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2"
            >
              <IconEye className="h-[clamp(84px,14vw,150px)] w-[clamp(84px,14vw,150px)]" />
              <span className="text-[clamp(1.5rem,3.6vw,2.3rem)] font-extrabold">
                화면 보고
                <br />
                고르기
              </span>
            </button>
            <button
              onClick={() => chooseMode("voice")}
              className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[32px] border-[6px] border-accent-voice-deep bg-accent-voice p-8 text-white outline-none transition hover:brightness-105 active:scale-[.98] focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2"
            >
              <IconMic className="h-[clamp(84px,14vw,150px)] w-[clamp(84px,14vw,150px)]" />
              <span className="text-[clamp(1.5rem,3.6vw,2.3rem)] font-extrabold">
                소리 듣고
                <br />
                고르기
              </span>
            </button>
          </div>
          <p className="text-center text-[clamp(.85rem,1.8vw,1rem)] font-semibold text-text-soft">
            실제 서비스에서는 태블릿이나 휴대폰에서 그대로 눌러 사용해요
          </p>
        </section>
      )}

      {screen !== "home" && (
        <div className="flex items-center justify-between gap-3">
          {screen !== "confirm" ? (
            <button onClick={goBack} className={backBtn}>
              <IconBack className="h-[26px] w-[26px]" />
              {screen === "items" ? "처음으로" : "이전으로"}
            </button>
          ) : (
            <span />
          )}
          <span className="text-[clamp(1rem,2vw,1.2rem)] font-extrabold text-text-soft">{STEP_LABEL[screen]}</span>
        </div>
      )}

      {screen === "items" && (
        <section className="flex flex-1 flex-col gap-5">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold text-balance">
            필요한 물건을 눌러 담아주세요
          </p>
          <VoiceBanner active={voiceActive} status={voiceStatus} onReplay={() => setReplayToken((n) => n + 1)} />
          <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] content-start gap-4">
            {PRESET_ITEMS.map((item) => {
              const lines = itemLines[item.id] ?? [];
              const configured = lines.length > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => openItemPopup(item.id)}
                  className={`${cardBase} ${configured ? "border-accent-success shadow-[inset_0_0_0_3px_var(--accent-success)]" : ""}`}
                >
                  <span
                    className={`absolute right-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-success text-white ${configured ? "flex" : "hidden"}`}
                  >
                    <IconCheck className="h-[18px] w-[18px]" />
                  </span>
                  <item.Icon
                    className={`h-[clamp(48px,7vw,72px)] w-[clamp(48px,7vw,72px)] ${configured ? "text-accent-success" : "text-text-soft"}`}
                  />
                  <span className="text-[clamp(1.1rem,2.4vw,1.4rem)] font-extrabold">{item.label}</span>
                  {configured && (
                    <span className="text-[clamp(.85rem,1.8vw,1rem)] font-bold text-accent-success">
                      {lines.length === 1 ? `${lines[0].variant} × ${lines[0].qty}개` : `${lines.length}가지 담음`}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setOtherOpen(true)}
              className={`${cardBase} ${custom.length > 0 ? "border-accent-success shadow-[inset_0_0_0_3px_var(--accent-success)]" : ""}`}
            >
              <span
                className={`absolute right-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-success text-white ${custom.length > 0 ? "flex" : "hidden"}`}
              >
                <IconCheck className="h-[18px] w-[18px]" />
              </span>
              <IconOther
                className={`h-[clamp(48px,7vw,72px)] w-[clamp(48px,7vw,72px)] ${custom.length > 0 ? "text-accent-success" : "text-text-soft"}`}
              />
              <span className="text-[clamp(1.1rem,2.4vw,1.4rem)] font-extrabold">
                기타(직접 입력){custom.length > 0 ? ` · ${custom.length}개` : ""}
              </span>
            </button>
          </div>
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t-[3px] border-frame bg-background pt-3.5">
            <span className="text-[clamp(1.05rem,2.2vw,1.3rem)] font-extrabold">{totalLineCount}개 담았어요</span>
            <button disabled={totalLineCount === 0} onClick={() => setScreen("delivery")} className={nextBtn}>
              다음
            </button>
          </div>
        </section>
      )}

      {screen === "delivery" && (
        <section className="flex flex-1 flex-col gap-5">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold text-balance">언제 받고 싶으세요?</p>
          <VoiceBanner active={voiceActive} status={voiceStatus} onReplay={() => setReplayToken((n) => n + 1)} />
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => pickDate("today")}
              className={`${choiceCard} ${delivery?.type === "today" ? "border-accent-success shadow-[inset_0_0_0_3px_var(--accent-success)]" : ""}`}
            >
              <IconCalendarToday className="h-[clamp(48px,8vw,68px)] w-[clamp(48px,8vw,68px)] text-accent-success" />
              <span className="text-[clamp(1.15rem,2.6vw,1.5rem)] font-extrabold">오늘 배달</span>
            </button>
            <button
              onClick={() => pickDate("tomorrow")}
              className={`${choiceCard} ${delivery?.type === "tomorrow" ? "border-accent-success shadow-[inset_0_0_0_3px_var(--accent-success)]" : ""}`}
            >
              <IconCalendarTomorrow className="h-[clamp(48px,8vw,68px)] w-[clamp(48px,8vw,68px)] text-accent-success" />
              <span className="text-[clamp(1.15rem,2.6vw,1.5rem)] font-extrabold">내일 배달</span>
            </button>
            <button
              onClick={openCustomDatePicker}
              className={`${choiceCard} ${pickingCustomDate || delivery?.type === "custom" ? "border-accent-success shadow-[inset_0_0_0_3px_var(--accent-success)]" : ""}`}
            >
              <IconCalendarPick className="h-[clamp(48px,8vw,68px)] w-[clamp(48px,8vw,68px)] text-accent-success" />
              <span className="text-[clamp(1.15rem,2.6vw,1.5rem)] font-extrabold">다른 날짜</span>
            </button>
          </div>
          {pickingCustomDate ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <input
                  type="date"
                  autoFocus
                  value={customDate}
                  onChange={(e) => pickCustomDate(e.target.value)}
                  className="rounded-2xl border-[3px] border-frame bg-surface px-4 py-3 text-[clamp(1.1rem,2.2vw,1.3rem)] text-foreground"
                />
                <button
                  onClick={dateAskVoice}
                  className="flex items-center gap-2 rounded-2xl bg-accent-voice px-4 py-3 text-[clamp(1rem,2vw,1.15rem)] font-extrabold text-white"
                >
                  <IconMic className="h-[24px] w-[24px]" />
                  말하기
                </button>
              </div>
              <VoiceBanner active={dateVoiceStatus.length > 0} status={dateVoiceStatus} onReplay={dateAskVoice} />
            </div>
          ) : null}
          <p className="min-h-[1.4em] text-center text-[clamp(1rem,2.2vw,1.2rem)] font-bold text-accent-success">
            {delivery ? `선택한 배송일: ${delivery.label}` : ""}
          </p>
          <div className="sticky bottom-0 flex items-center justify-end border-t-[3px] border-frame bg-background pt-3.5">
            <button disabled={!delivery} onClick={() => setScreen("address")} className={nextBtn}>
              다음
            </button>
          </div>
        </section>
      )}

      {screen === "address" && (
        <section className="flex flex-1 flex-col gap-5">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold text-balance">어디로 배달해드릴까요?</p>
          <VoiceBanner active={voiceActive} status={voiceStatus} onReplay={() => setReplayToken((n) => n + 1)} />
          <div className="mx-auto flex w-full max-w-xl gap-2.5">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="예: 진주시 OO면 OO길 12"
              className="flex-1 rounded-[18px] border-[3px] border-frame bg-surface p-4 text-[clamp(1.1rem,2.2vw,1.35rem)] text-foreground"
            />
            <button
              onClick={() =>
                listenOnce(
                  (t) => setAddress(t),
                  () => {},
                  { timeoutMs: 15000, continuous: true }
                )
              }
              className="flex items-center gap-2 self-stretch rounded-2xl bg-accent-voice px-4 text-[clamp(1rem,2vw,1.15rem)] font-extrabold text-white"
            >
              <IconMic className="h-[26px] w-[26px]" />
              말하기
            </button>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end border-t-[3px] border-frame bg-background pt-3.5">
            <button disabled={address.trim().length === 0} onClick={() => setScreen("payment")} className={nextBtn}>
              다음
            </button>
          </div>
        </section>
      )}

      {screen === "payment" && (
        <section className="flex flex-1 flex-col gap-5">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold text-balance">결제는 어떻게 하시겠어요?</p>
          <VoiceBanner active={voiceActive} status={voiceStatus} onReplay={() => setReplayToken((n) => n + 1)} />
          <div className="flex flex-1 flex-col gap-4 min-[480px]:flex-row">
            <button onClick={() => pickPayment("meet")} className={choiceCard}>
              <IconCash className="h-[clamp(48px,8vw,68px)] w-[clamp(48px,8vw,68px)] text-accent-success" />
              <span className="text-[clamp(1.15rem,2.6vw,1.5rem)] font-extrabold">만나서 결제</span>
            </button>
            <button onClick={() => pickPayment("card")} className={choiceCard}>
              <IconCard className="h-[clamp(48px,8vw,68px)] w-[clamp(48px,8vw,68px)] text-accent-success" />
              <span className="text-[clamp(1.15rem,2.6vw,1.5rem)] font-extrabold">카드 결제</span>
            </button>
          </div>
        </section>
      )}

      {screen === "confirm" && (
        <section className="flex flex-1 flex-col gap-5">
          <p className="text-center text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold text-balance">주문이 접수되었어요!</p>
          <VoiceBanner active={voiceActive} status={voiceStatus} onReplay={() => setReplayToken((n) => n + 1)} />
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-[24px] border-4 border-frame bg-surface p-6">
            <div className="flex justify-between gap-3.5">
              <span className="shrink-0 text-[clamp(1rem,2.2vw,1.2rem)] font-extrabold">담은 물품</span>
              <span className="text-right text-[clamp(1rem,2.2vw,1.2rem)] font-semibold text-text-soft">
                {summaryItems.join(", ") || "없음"}
              </span>
            </div>
            {itemsSubtotal > 0 && (
              <div className="flex justify-between gap-3.5">
                <span className="shrink-0 text-[clamp(1rem,2.2vw,1.2rem)] font-extrabold">물품 금액</span>
                <span className="text-right text-[clamp(1rem,2.2vw,1.2rem)] font-semibold text-text-soft">
                  {itemsSubtotal.toLocaleString()}원{custom.length > 0 ? " (기타 품목 제외)" : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-3.5">
              <span className="shrink-0 text-[clamp(1rem,2.2vw,1.2rem)] font-extrabold">배송일</span>
              <span className="text-right text-[clamp(1rem,2.2vw,1.2rem)] font-semibold text-text-soft">
                {delivery?.label ?? ""}
              </span>
            </div>
            <div className="flex justify-between gap-3.5">
              <span className="shrink-0 text-[clamp(1rem,2.2vw,1.2rem)] font-extrabold">배송지</span>
              <span className="text-right text-[clamp(1rem,2.2vw,1.2rem)] font-semibold text-text-soft">{address}</span>
            </div>
            <div className="flex justify-between gap-3.5">
              <span className="shrink-0 text-[clamp(1rem,2.2vw,1.2rem)] font-extrabold">결제방법</span>
              <span className="text-right text-[clamp(1rem,2.2vw,1.2rem)] font-semibold text-text-soft">
                {payment === "meet" ? "만나서 결제" : payment === "card" ? "카드 결제" : ""}
              </span>
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-xl items-center gap-3.5 rounded-2xl border-[3px] border-accent-success bg-surface px-5 py-4">
            <IconCheck className="h-11 w-11 shrink-0 text-accent-success" />
            <p className="text-[clamp(1rem,2.2vw,1.15rem)] font-bold">
              가까운 가게에 알림을 보냈어요. {deliveryNoticePhrase() ? `${deliveryNoticePhrase()} ` : ""}물건을 챙겨서 댁으로
              배달해드려요.
            </p>
          </div>
          <button
            onClick={restart}
            className="self-center rounded-[20px] bg-accent-button px-8 py-3.5 text-[clamp(1.1rem,2.2vw,1.35rem)] font-extrabold text-white"
          >
            처음으로
          </button>
        </section>
      )}

      {otherOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/45 p-5">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-[28px] border-[5px] border-frame bg-surface p-7">
            <h2 className="text-[clamp(1.3rem,2.8vw,1.6rem)] font-extrabold">기타 물품 입력</h2>
            <VoiceBanner active={mode === "voice"} status={otherVoiceStatus} onReplay={otherReplay} />
            {mode === "voice" && (
              <p className="text-[clamp(.9rem,2vw,1.05rem)] font-semibold text-text-soft">
                말씀하신 물건이 맞는지 소리로 확인해드려요. 다 담으셨으면 &quot;없다&quot;라고 말씀하시거나 닫기를 눌러주세요.
              </p>
            )}
            <div className="flex gap-2.5">
              <input
                value={otherInput}
                onChange={(e) => setOtherInput(e.target.value)}
                placeholder="예: 된장, 계란 한 판"
                className="flex-1 rounded-[18px] border-[3px] border-frame bg-background px-4 py-3 text-[clamp(1.1rem,2.2vw,1.35rem)] text-foreground"
              />
              <button
                onClick={() =>
                  listenOnce(
                    (t) => setOtherInput(t),
                    () => {},
                    { timeoutMs: 15000, continuous: true }
                  )
                }
                className="flex items-center gap-2 rounded-2xl bg-accent-voice px-4 text-[clamp(1rem,2vw,1.15rem)] font-extrabold text-white"
              >
                <IconMic className="h-[26px] w-[26px]" />
                말하기
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {custom.map((text, i) => (
                <span
                  key={`${text}-${i}`}
                  className="flex items-center gap-1.5 rounded-2xl border-2 border-frame bg-background py-1.5 pl-3.5 pr-1.5 text-[1rem] font-bold"
                >
                  {text}
                  <button
                    onClick={() => removeCustomItem(i)}
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-frame font-extrabold leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={closeOtherModal}
                className="rounded-2xl border-[3px] border-frame px-5 py-2.5 text-[clamp(1rem,2vw,1.1rem)] font-bold"
              >
                닫기
              </button>
              <button
                onClick={addCustomItem}
                className="rounded-2xl bg-accent-success px-5.5 py-2.5 text-[clamp(1rem,2vw,1.1rem)] font-extrabold text-white"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {openItemId && openItem && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/45 p-5">
          <div className="flex w-full max-w-lg flex-col gap-5 rounded-[28px] border-[5px] border-frame bg-surface p-7">
            <h2 className="text-[clamp(1.3rem,2.8vw,1.6rem)] font-extrabold">{openItem.label} 담기</h2>
            <div className="flex flex-wrap gap-2.5">
              {(ITEM_VARIANTS[openItemId] ?? []).map((v) => (
                <button
                  key={v}
                  onClick={() => setDraftVariant(v)}
                  className={`${variantChip} ${draftVariant === v ? variantChipSelected : ""}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setDraftQty((q) => Math.max(1, q - 1))} className={stepperBtn}>
                −
              </button>
              <span className="min-w-[4ch] text-center text-[clamp(1.3rem,3vw,1.6rem)] font-extrabold">
                {draftQty}개
              </span>
              <button onClick={() => setDraftQty((q) => Math.min(20, q + 1))} className={stepperBtn}>
                +
              </button>
            </div>
            <button
              onClick={addLineItem}
              disabled={!draftVariant}
              className="rounded-2xl bg-accent-success px-6 py-3 text-[clamp(1.05rem,2.2vw,1.25rem)] font-extrabold text-white disabled:bg-frame disabled:text-text-soft"
            >
              {draftVariant || "물건"} 담기
            </button>

            {openItemLines.length > 0 && (
              <div className="flex flex-col gap-2 border-t-[3px] border-frame pt-4">
                <span className="text-[clamp(.95rem,2vw,1.1rem)] font-extrabold text-text-soft">담은 목록</span>
                {openItemLines.map((line) => (
                  <div
                    key={line.variant}
                    className={`flash-row flex items-center justify-between rounded-xl border-2 border-frame bg-background px-3.5 py-2.5 ${
                      justAddedVariant === line.variant ? "animate-[flash-pick_0.7s_ease-out]" : ""
                    }`}
                  >
                    <span className="text-[clamp(1rem,2.1vw,1.15rem)] font-bold">
                      {line.variant} × {line.qty}개
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="text-[clamp(.95rem,2vw,1.05rem)] font-semibold text-text-soft">
                        {(line.price * line.qty).toLocaleString()}원
                      </span>
                      <button
                        onClick={() => removeLineItem(openItemId, line.variant)}
                        className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-frame font-extrabold leading-none"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))}
                <div className="flex justify-end text-[clamp(1rem,2.1vw,1.15rem)] font-extrabold">
                  {openItemSubtotal.toLocaleString()}원
                </div>
              </div>
            )}

            <button
              onClick={() => setOpenItemId(null)}
              className="self-end rounded-2xl border-[3px] border-frame px-6 py-2.5 text-[clamp(1rem,2vw,1.1rem)] font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
