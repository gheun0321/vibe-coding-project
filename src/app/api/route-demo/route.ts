import { NextResponse } from "next/server";

// 요청마다 새로 무작위 계산을 해야 하므로, 캐시되지 않고 매번 새로 실행되도록 해요.
export const dynamic = "force-dynamic";

// 진주시 외곽 지역(읍·면) 후보 목록이에요. 사용자가 허브 주소를 직접 입력하지 않았을 때,
// 이 근처에서 실제 마트·편의점을 찾는 기준점으로 써요.
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

// 카카오 로컬 API의 업종 카테고리 코드예요: CS2=편의점, MT1=대형마트.
const STORE_CATEGORY_CODES = ["CS2", "MT1"];

type LatLng = { lat: number; lng: number };
type Stop = LatLng & { id: number };
type PlaceResult = LatLng & { name: string };

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

// 주소·장소 이름으로 위치를 찾아요 (사용자가 직접 입력한 허브 주소를 그대로 지오코딩할 때 써요).
async function geocodePlace(query: string, apiKey: string): Promise<PlaceResult> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
  if (!res.ok) throw new Error(`카카오 장소 검색에 실패했어요 (상태 코드 ${res.status})`);
  const data = await res.json();
  const first = data.documents?.[0];
  if (!first) throw new Error(`"${query}" 위치를 찾지 못했어요`);
  return { name: first.place_name || query, lat: Number(first.y), lng: Number(first.x) };
}

// 기준 좌표 근처에서 실제 마트·편의점을 찾아요 (허브를 임의의 빈 땅이 아니라 진짜 상점으로 잡기 위해서예요).
async function findNearbyStore(center: LatLng, apiKey: string): Promise<PlaceResult> {
  const categoryCode = STORE_CATEGORY_CODES[Math.floor(Math.random() * STORE_CATEGORY_CODES.length)];
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${categoryCode}&x=${center.lng}&y=${center.lat}&radius=5000&sort=distance`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
  if (!res.ok) throw new Error(`카카오 매장 검색에 실패했어요 (상태 코드 ${res.status})`);
  const data = await res.json();
  const candidates: { place_name: string; x: string; y: string }[] = data.documents ?? [];
  if (candidates.length === 0) throw new Error("이 근처에서 마트·편의점을 찾지 못했어요. 다시 시도해주세요.");
  const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
  return { name: pick.place_name, lat: Number(pick.y), lng: Number(pick.x) };
}

type RouteInfo = { distanceMeters: number; durationSeconds: number; path: LatLng[] };

async function fetchRouteDistance(points: LatLng[], apiKey: string): Promise<RouteInfo> {
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

  // 실제 도로 모양(굴곡)을 지도에 그릴 수 있도록, 구간별 좌표(vertexes)를 하나의 경로로 모아요.
  const path: LatLng[] = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const vertexes: number[] = road.vertexes ?? [];
      for (let i = 0; i < vertexes.length; i += 2) {
        path.push({ lng: vertexes[i], lat: vertexes[i + 1] });
      }
    }
  }

  return { distanceMeters: route.summary.distance, durationSeconds: route.summary.duration, path };
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

export async function GET(request: Request) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "KAKAO_REST_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 서버를 다시 시작해주세요." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const hubAddressInput = searchParams.get("hubAddress")?.trim();

    // 허브는 항상 실제 마트·편의점이에요: 사용자가 주소를 입력하면 그 주소를 그대로 허브로 쓰고,
    // 입력하지 않으면 진주 외곽 동네 중 하나를 무작위로 고른 뒤 그 근처의 실제 마트·편의점을 찾아요.
    const hub = hubAddressInput
      ? await geocodePlace(hubAddressInput, apiKey)
      : await findNearbyStore(
          await geocodePlace(OUTSKIRT_TOWNS[Math.floor(Math.random() * OUTSKIRT_TOWNS.length)], apiKey),
          apiKey
        );

    // 허브 주변 500m 이내에 배달받을 가정집을 무작위로 서너 곳 만들어요.
    const stopCount = 3 + Math.floor(Math.random() * 2); // 3~4곳
    const stops: Stop[] = Array.from({ length: stopCount }, (_, i) => {
      const distance = randomBetween(80, 500);
      const bearing = randomBetween(0, 360);
      const point = offset(hub, distance, bearing);
      return { id: i + 1, ...point };
    });

    // 가정집을 방문하는 모든 순서를 실제로 계산해보고, 도로 기준 총 이동거리가 가장 짧은(단거리) 순서를 골라요.
    // (집이 3~4곳뿐이라 모든 경우의 수를 다 계산해도 충분히 빨라요)
    const orders = permutations(stops);
    let best: { order: Stop[] } & RouteInfo | null = null;

    for (const order of orders) {
      const routePoints: LatLng[] = [hub, ...order.map((s) => ({ lat: s.lat, lng: s.lng }))];
      const result = await fetchRouteDistance(routePoints, apiKey);
      if (!best || result.distanceMeters < best.distanceMeters) {
        best = { order, ...result };
      }
    }

    if (!best) throw new Error("경로 계산에 실패했어요.");

    return NextResponse.json({
      hub: { name: hub.name, lat: hub.lat, lng: hub.lng },
      stops,
      optimalOrder: best.order.map((s) => s.id),
      totalDistanceMeters: best.distanceMeters,
      totalDurationSeconds: best.durationSeconds,
      path: best.path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
