import { NextResponse } from "next/server";

// 요청마다 새로 무작위 계산을 해야 하므로, 캐시되지 않고 매번 새로 실행되도록 해요.
export const dynamic = "force-dynamic";

// 진주시 외곽 지역(읍·면) 후보 목록이에요. 정확한 좌표는 매 요청마다 카카오 장소 검색으로 직접 조회해요
// (좌표를 미리 하드코딩하면 부정확할 수 있어서, 실시간으로 실제 위치를 찾도록 했어요).
const OUTSKIRT_TOWNS = [
  "진주시 문산읍",
  "진주시 금산면",
  "진주시 진성면",
  "진주시 미천면",
  "진주시 명석면",
  "진주시 대곡면",
  "진주시 정촌면",
  "진주시 사봉면",
  "진주시 이반성면",
  "진주시 지수면",
  "진주시 금곡면",
  "진주시 수곡면",
];

type LatLng = { lat: number; lng: number };
type Stop = LatLng & { id: number };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// 기준 좌표에서 특정 방향(도)·거리(m)만큼 떨어진 지점의 위경도를 계산해요.
function offset(base: LatLng, distanceMeters: number, bearingDeg: number): LatLng {
  const R = 6371000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (base.lat * Math.PI) / 180;
  const lngRad = (base.lng * Math.PI) / 180;
  const angularDistance = distanceMeters / R;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return { lat: (newLatRad * 180) / Math.PI, lng: (newLngRad * 180) / Math.PI };
}

async function geocodeTown(name: string, apiKey: string): Promise<LatLng> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
  if (!res.ok) throw new Error(`카카오 장소 검색에 실패했어요 (상태 코드 ${res.status})`);
  const data = await res.json();
  const first = data.documents?.[0];
  if (!first) throw new Error(`"${name}" 위치를 찾지 못했어요`);
  return { lat: Number(first.y), lng: Number(first.x) };
}

async function fetchRouteDistance(
  points: LatLng[],
  apiKey: string
): Promise<{ distanceMeters: number; durationSeconds: number }> {
  const [origin, ...rest] = points;
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);

  const params = new URLSearchParams({
    origin: `${origin.lng},${origin.lat}`,
    destination: `${destination.lng},${destination.lat}`,
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${w.lng},${w.lat}`).join("|"));
  }

  const res = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  if (!res.ok) throw new Error(`카카오 길찾기에 실패했어요 (상태 코드 ${res.status})`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route || route.result_code !== 0) {
    throw new Error("경로를 찾지 못했어요 (도로에서 너무 먼 지점일 수 있어요)");
  }
  return { distanceMeters: route.summary.distance, durationSeconds: route.summary.duration };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  arr.forEach((item, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([item, ...perm]);
    }
  });
  return result;
}

export async function GET() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KAKAO_REST_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 서버를 다시 시작해주세요." },
      { status: 500 }
    );
  }

  try {
    const townName = OUTSKIRT_TOWNS[Math.floor(Math.random() * OUTSKIRT_TOWNS.length)];
    const hub = await geocodeTown(townName, apiKey);

    const stopCount = 3 + Math.floor(Math.random() * 2); // 3~4곳
    const stops: Stop[] = Array.from({ length: stopCount }, (_, i) => {
      const distance = randomBetween(80, 500);
      const bearing = randomBetween(0, 360);
      const point = offset(hub, distance, bearing);
      return { id: i + 1, ...point };
    });

    // 배달지를 방문하는 모든 순서를 실제로 계산해보고, 도로 기준 총 이동거리가 가장 짧은 순서를 골라요.
    // (배달지가 3~4곳뿐이라 모든 경우의 수를 다 계산해도 충분히 빨라요)
    const orders = permutations(stops);
    let best: { order: Stop[]; distanceMeters: number; durationSeconds: number } | null = null;

    for (const order of orders) {
      const routePoints: LatLng[] = [hub, ...order.map((s) => ({ lat: s.lat, lng: s.lng }))];
      const result = await fetchRouteDistance(routePoints, apiKey);
      if (!best || result.distanceMeters < best.distanceMeters) {
        best = { order, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
      }
    }

    if (!best) throw new Error("경로 계산에 실패했어요.");

    return NextResponse.json({
      hub: { name: townName, lat: hub.lat, lng: hub.lng },
      stops,
      optimalOrder: best.order.map((s) => s.id),
      totalDistanceMeters: best.distanceMeters,
      totalDurationSeconds: best.durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
