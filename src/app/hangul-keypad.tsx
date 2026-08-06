"use client";

import { useState } from "react";

const INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const MEDIAL_KEYS = ["ㅗ", "ㅛ", "ㅜ", "ㅠ", "ㅡ", "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅣ"];
const FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const VOWEL_COMBOS: Record<string, string> = {
  "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
  "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ",
  "ㅡㅣ": "ㅢ",
};
const FINAL_COMBOS: Record<string, string> = {
  "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ",
  "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
};

type Comp = { initial: string | null; medial: string | null; final: string | null };
const EMPTY_COMP: Comp = { initial: null, medial: null, final: null };

// 초성+중성+종성을 완성된 한글 한 글자로 합쳐줘요 (유니코드 한글 조합 공식).
function renderComp(c: Comp): string {
  if (c.initial === null) return "";
  if (c.medial === null) return c.initial;
  const i = INITIALS.indexOf(c.initial);
  const m = MEDIAL_INDEX[c.medial];
  const f = c.final ? FINALS.indexOf(c.final) : 0;
  if (i < 0 || m === undefined || f < 0) return c.initial;
  return String.fromCharCode(0xac00 + (i * 21 + m) * 28 + f);
}

const MEDIAL_ORDER = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const MEDIAL_INDEX: Record<string, number> = Object.fromEntries(MEDIAL_ORDER.map((v, i) => [v, i]));

const keyBtn =
  "flex items-center justify-center rounded-xl border-2 border-frame bg-surface py-2.5 text-[clamp(1.05rem,2.4vw,1.3rem)] font-extrabold outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2";

export function HangulKeypad({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (next: string) => void;
  onDone: (finalValue: string) => void;
}) {
  const [committed, setCommitted] = useState(value);
  const [comp, setComp] = useState<Comp>(EMPTY_COMP);

  function emit(nextCommitted: string, nextComp: Comp) {
    setCommitted(nextCommitted);
    setComp(nextComp);
    onChange(nextCommitted + renderComp(nextComp));
  }

  function pressConsonant(c: string) {
    if (comp.medial === null) {
      emit(committed + (comp.initial ?? ""), { initial: c, medial: null, final: null });
      return;
    }
    if (comp.final === null) {
      if (FINALS.includes(c) && c !== "") {
        emit(committed, { ...comp, final: c });
      } else {
        emit(committed + renderComp(comp), { initial: c, medial: null, final: null });
      }
      return;
    }
    const combo = FINAL_COMBOS[comp.final + c];
    if (combo) {
      emit(committed, { ...comp, final: combo });
    } else {
      emit(committed + renderComp(comp), { initial: c, medial: null, final: null });
    }
  }

  function pressVowel(v: string) {
    if (comp.initial === null) {
      emit(committed, { initial: "ㅇ", medial: v, final: null });
      return;
    }
    if (comp.medial === null) {
      emit(committed, { ...comp, medial: v });
      return;
    }
    if (comp.final === null) {
      const combo = VOWEL_COMBOS[comp.medial + v];
      if (combo) {
        emit(committed, { ...comp, medial: combo });
      } else {
        emit(committed + renderComp(comp), { initial: "ㅇ", medial: v, final: null });
      }
      return;
    }
    // 받침 뒤에 모음이 오면, 받침이 다음 글자의 초성으로 넘어가요 (예: ㄱㅏㄴ + ㅏ → 가나).
    const movedInitial = comp.final;
    const prevSyllable = renderComp({ ...comp, final: null });
    emit(committed + prevSyllable, { initial: movedInitial, medial: v, final: null });
  }

  function pressSpace() {
    emit(`${committed}${renderComp(comp)} `, EMPTY_COMP);
  }

  function pressBackspace() {
    if (comp.final !== null) {
      emit(committed, { ...comp, final: null });
      return;
    }
    if (comp.medial !== null) {
      emit(committed, { ...comp, medial: null });
      return;
    }
    if (comp.initial !== null) {
      emit(committed, EMPTY_COMP);
      return;
    }
    emit(committed.slice(0, -1), EMPTY_COMP);
  }

  function finish() {
    onDone(committed + renderComp(comp));
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-[3px] border-frame bg-background p-3">
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
        {INITIALS.map((c) => (
          <button key={c} onClick={() => pressConsonant(c)} className={keyBtn} type="button">
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {MEDIAL_KEYS.map((v) => (
          <button key={v} onClick={() => pressVowel(v)} className={keyBtn} type="button">
            {v}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={pressSpace} className={`${keyBtn} flex-1`} type="button">
          띄어쓰기
        </button>
        <button onClick={pressBackspace} className={`${keyBtn} w-16`} type="button">
          ⌫
        </button>
        <button
          onClick={finish}
          className="w-20 rounded-xl bg-accent-success text-[clamp(1.05rem,2.4vw,1.3rem)] font-extrabold text-white"
          type="button"
        >
          완료
        </button>
      </div>
    </div>
  );
}
