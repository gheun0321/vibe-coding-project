"use client";

import { useEffect, useRef, useState } from "react";

type Stop = { id: number; lat: number; lng: number };
type LatLng = { lat: number; lng: number };
type RouteResult = {
  hub: { name: string; lat: number; lng: number };
  stops: Stop[];
  optimalOrder: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  path: LatLng[];
};

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

type KakaoLatLng = unknown;
type KakaoOverlayLike = { setMap: (m: unknown) => void };
type KakaoMapsNS = {
  load: (cb: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend: (p: KakaoLatLng) => void };
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => { setBounds: (b: unknown) => void };
  CustomOverlay: new (opts: { position: KakaoLatLng; content: string; yAnchor?: number }) => KakaoOverlayLike;
  Polyline: new (opts: {
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
  }) => KakaoOverlayLike;
};

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNS };
  }
}

// 허브에서 각 배달지까지의 직선거리(참고용 표시 — 실제 이동거리는 도로 기준으로 별도 계산돼요).
function straightLineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 위경도를 허브 기준 평면 좌표(동쪽 몇m, 북쪽 몇m)로 바꿔요 — 도식(SVG) 표시용.
function toLocalMeters(hub: LatLng, p: LatLng) {
  const east = (p.lng - hub.lng) * Math.cos((hub.lat * Math.PI) / 180) * 111320;
  const north = (p.lat - hub.lat) * 110540;
  return { east, north };
}

const MAP_SIZE = 320;
const CENTER = MAP_SIZE / 2;
const RADIUS_METERS = 500;
const PIXELS_PER_METER = (MAP_SIZE / 2 - 46) / RADIUS_METERS;

function toSvgPoint(east: number, north: number) {
  return { x: CENTER + east * PIXELS_PER_METER, y: CENTER - north * PIXELS_PER_METER };
}

// 실제 지도를 못 불러올 때(키 미설정 등) 대신 보여주는 도식 지도예요.
function SchematicMap({ result }: { result: RouteResult }) {
  const stopsById = new Map(result.stops.map((s) => [s.id, s]));
  const orderedPoints = [
    { x: CENTER, y: CENTER },
    ...result.optimalOrder.map((id) => {
      const s = stopsById.get(id)!;
      const { east, north } = toLocalMeters(result.hub, s);
      return toSvgPoint(east, north);
    }),
  ];
  const pathD = orderedPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      className="w-full rounded-2xl border-2 border-frame bg-background"
      role="img"
      aria-label="허브와 배달지 위치, 방문 순서를 보여주는 도식 지도"
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS_METERS * PIXELS_PER_METER}
        fill="none"
        stroke="var(--frame)"
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      <text
        x={CENTER}
        y={CENTER - RADIUS_METERS * PIXELS_PER_METER - 8}
        textAnchor="middle"
        className="fill-text-soft text-[11px] font-bold"
      >
        500m 반경
      </text>
      <path d={pathD} fill="none" stroke="var(--accent-success)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {result.optimalOrder.map((id, i) => {
        const s = stopsById.get(id);
        if (!s) return null;
        const { east, north } = toLocalMeters(result.hub, s);
        const { x, y } = toSvgPoint(east, north);
        return (
          <g key={id}>
            <circle cx={x} cy={y} r={16} fill="var(--accent-success)" stroke="var(--surface)" strokeWidth={3} />
            <text x={x} y={y + 5} textAnchor="middle" className="fill-white text-[13px] font-extrabold">
              {i + 1}
            </text>
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={19} fill="var(--accent-button)" stroke="var(--surface)" strokeWidth={3} />
      <text x={CENTER} y={CENTER + 5} textAnchor="middle" className="fill-white text-[12px] font-extrabold">
        허브
      </text>
    </svg>
  );
}

function loadKakaoMapsSdk(): Promise<KakaoMapsNS> {
  return new Promise((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error("카카오 JavaScript 키가 설정되지 않았어요."));
      return;
    }
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao!.maps!));
      return;
    }
    const existing = document.getElementById("kakao-maps-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => window.kakao!.maps!.load(() => resolve(window.kakao!.maps!)));
      existing.addEventListener("error", () => reject(new Error("카카오맵 스크립트를 불러오지 못했어요.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    script.onload = () => window.kakao!.maps!.load(() => resolve(window.kakao!.maps!));
    script.onerror = () => reject(new Error("카카오맵 스크립트를 불러오지 못했어요. 도메인 등록을 확인해주세요."));
    document.head.appendChild(script);
  });
}

function markerHtml(bg: string, label: string, size: number) {
  return `<div style="background:${bg};color:#fff;border:3px solid var(--surface);border-radius:9999px;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${size >= 40 ? 13 : 14}px;box-shadow:0 2px 6px rgba(0,0,0,.3)">${label}</div>`;
}

function KakaoRealMap({ result }: { result: RouteResult }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadKakaoMapsSdk()
      .then((kakao) => {
        if (cancelled || !mapRef.current) return;
        const center = new kakao.LatLng(result.hub.lat, result.hub.lng);
        const map = new kakao.Map(mapRef.current, { center, level: 4 });
        const bounds = new kakao.LatLngBounds();
        bounds.extend(center);

        new kakao.CustomOverlay({ position: center, content: markerHtml("var(--accent-button)", "허브", 40) }).setMap(map);

        const stopsById = new Map(result.stops.map((s) => [s.id, s]));
        result.optimalOrder.forEach((id, i) => {
          const s = stopsById.get(id);
          if (!s) return;
          const pos = new kakao.LatLng(s.lat, s.lng);
          bounds.extend(pos);
          new kakao.CustomOverlay({ position: pos, content: markerHtml("var(--accent-success)", String(i + 1), 32) }).setMap(
            map
          );
        });

        if (result.path.length > 1) {
          const path = result.path.map((p) => new kakao.LatLng(p.lat, p.lng));
          path.forEach((p) => bounds.extend(p));
          new kakao.Polyline({
            path,
            strokeWeight: 5,
            strokeColor: "#3F7A4B",
            strokeOpacity: 0.9,
            strokeStyle: "solid",
          }).setMap(map);
        }

        map.setBounds(bounds);
      })
      .catch((e) => setMapError(e instanceof Error ? e.message : "지도를 불러오지 못했어요."));
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (mapError) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border-2 border-accent-button bg-surface p-4 text-sm font-semibold text-accent-button-deep">
          실제 지도를 불러오지 못했어요 ({mapError}) — 대신 도식으로 보여드려요.
        </div>
        <SchematicMap result={result} />
      </div>
    );
  }

  return <div ref={mapRef} className="h-[360px] w-full rounded-2xl border-2 border-frame" />;
}

export default function CoDeliveryDemo() {
  const [hubAddress, setHubAddress] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const query = hubAddress.trim() ? `?hubAddress=${encodeURIComponent(hubAddress.trim())}` : "";
      const res = await fetch(`/api/route-demo${query}`);
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
          마트·편의점을 허브로 삼고, 그 주변 500m 이내 가정집 3~4곳을 무작위로 만든 뒤 실제 도로 기준으로 가장
          짧은(단거리) 배달 순서를 계산해요. (카카오모빌리티 길찾기 API 사용)
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="hub-address" className="text-[clamp(.9rem,1.9vw,1rem)] font-bold text-text-soft">
          허브 매장 주소 (마트·편의점) — 비워두면 무작위로 골라드려요
        </label>
        <input
          id="hub-address"
          value={hubAddress}
          onChange={(e) => setHubAddress(e.target.value)}
          placeholder="예: 진주시 문산읍 OO로 12"
          className="rounded-2xl border-2 border-frame bg-surface px-4 py-3 text-[clamp(1rem,2.1vw,1.1rem)] text-foreground"
        />
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
        <div className="flex flex-col gap-5">
          <div>
            {KAKAO_JS_KEY ? <KakaoRealMap result={result} /> : <SchematicMap result={result} />}
            <p className="mt-2 text-center text-[clamp(.8rem,1.7vw,.9rem)] font-semibold text-text-soft">
              주황 = 허브, 초록 숫자 = 방문 순서{KAKAO_JS_KEY ? " · 초록 선 = 실제 도로 경로" : " (도식 — 실제 도로 굴곡은 반영 안 됨)"}
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border-2 border-frame bg-surface p-5">
            <div>
              <span className="text-[clamp(.85rem,1.8vw,.95rem)] font-bold text-text-soft">허브 매장</span>
              <p className="text-[clamp(1.2rem,2.6vw,1.4rem)] font-extrabold">{result.hub.name}</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[clamp(.85rem,1.8vw,.95rem)] font-bold text-text-soft">최적 배달 순서 (가정집)</span>
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
                      <span className="flex items-center gap-2.5 font-bold">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-success text-sm text-white">
                          {i + 1}
                        </span>
                        가정집 {id}
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
        </div>
      )}
    </div>
  );
}
