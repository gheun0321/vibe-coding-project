"use client";

import { useState } from "react";

type Stop = { id: number; lat: number; lng: number };
type RouteResult = {
  hub: { name: string; lat: number; lng: number };
  stops: Stop[];
  optimalOrder: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

// 허브에서 각 배달지까지의 직선거리(참고용 표시 — 실제 이동거리는 도로 기준으로 별도 계산돼요).
function straightLineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function CoDeliveryDemo() {
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/route-demo");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청에 실패했어요.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  const stopsById = new Map(result?.stops.map((s) => [s.id, s]));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold">공동배송 경로 데모</h1>
        <p className="mt-2 text-[clamp(.95rem,2vw,1.05rem)] font-semibold text-text-soft">
          진주 외곽 동네 중 하나를 무작위로 골라 허브로 삼고, 그 주변 500m 이내에 배달지 3~4곳을 무작위로 만든 뒤
          실제 도로 기준으로 가장 짧은 방문 순서를 계산해요. (카카오모빌리티 길찾기 API 사용)
        </p>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="self-start rounded-2xl bg-accent-success px-6 py-3 text-[clamp(1rem,2.2vw,1.15rem)] font-extrabold text-white disabled:opacity-60"
      >
        {loading ? "경로 계산 중..." : "새 배송 그룹 만들기"}
      </button>

      {error && (
        <div className="rounded-2xl border-2 border-accent-button bg-surface p-4 text-[clamp(.95rem,2vw,1.05rem)] font-semibold text-accent-button-deep">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-frame bg-surface p-5">
          <div>
            <span className="text-[clamp(.85rem,1.8vw,.95rem)] font-bold text-text-soft">허브 동네</span>
            <p className="text-[clamp(1.2rem,2.6vw,1.4rem)] font-extrabold">{result.hub.name}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[clamp(.85rem,1.8vw,.95rem)] font-bold text-text-soft">최적 방문 순서</span>
            <ol className="flex flex-col gap-2">
              {result.optimalOrder.map((id, i) => {
                const stop = stopsById.get(id);
                if (!stop) return null;
                const straight = Math.round(straightLineMeters(result.hub, stop));
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-xl border-2 border-frame bg-background px-4 py-2.5"
                  >
                    <span className="font-bold">
                      {i + 1}번째 · 배달지 {id}
                    </span>
                    <span className="text-sm font-semibold text-text-soft">허브 직선거리 약 {straight}m</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex justify-between border-t-2 border-frame pt-4 text-[clamp(1.05rem,2.2vw,1.2rem)] font-extrabold">
            <span>총 이동거리</span>
            <span>{(result.totalDistanceMeters / 1000).toFixed(1)}km</span>
          </div>
          <div className="flex justify-between text-[clamp(1.05rem,2.2vw,1.2rem)] font-extrabold">
            <span>예상 소요시간</span>
            <span>{Math.round(result.totalDurationSeconds / 60)}분</span>
          </div>
        </div>
      )}
    </div>
  );
}
