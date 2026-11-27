export type Point = [latitude: number, longitude: number];

export interface GpxPoint {
  coordinates: Point;
  elevation?: number;
  time?: number;
}

const radians = Math.PI / 180;
export function distanceKm([latA, lonA]: Point, [latB, lonB]: Point) {
  const haversine = Math.sin((latB - latA) * radians / 2) ** 2
    + Math.cos(latA * radians) * Math.cos(latB * radians)
    * Math.sin((lonB - lonA) * radians / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export type GpxSample = {
  coordinates: Point;
  distanceKm: number;
  elevation: number | null;
  time: string | null;
  slope: 'up' | 'down' | 'flat' | null;
  elevationBreak: boolean;
};

export function sampleGpx(segments: GpxPoint[][]) {
  const drawable = segments.filter(segment => segment.length >= 2);
  const step = Math.ceil((drawable.length - 1) / 159) || 1;
  const selected = drawable.filter((_, index) => index % step === 0 || index === drawable.length - 1);
  const selectedSet = new Set(selected);
  const budget = 1200 - selected.length * 2;
  const totalPoints = selected.reduce((sum, segment) => sum + segment.length - 2, 0);
  let distance = 0;
  return segments.flatMap(segment => {
    if (!selectedSet.has(segment)) {
      for (let i = 1; i < segment.length; i++)
        distance += distanceKm(segment[i - 1].coordinates, segment[i].coordinates);
      return [];
    }
    const distances = segment.map((point, index) => {
      if (index > 0) distance += distanceKm(segment[index - 1].coordinates, point.coordinates);
      return distance;
    });
    const slopes: GpxSample['slope'][] = [];
    let start = 0;
    while (start < segment.length) {
      if (segment[start].elevation === undefined) { start++; continue; }
      let end = start;
      while (end + 1 < segment.length && segment[end + 1].elevation !== undefined) end++;
      let left = start;
      let right = start;
      // Fenêtre horizontale d’environ 50 m, sans franchir une lacune d’altitude.
      for (let index = start; index <= end; index++) {
        while (left < index && distances[left] < distances[index] - 0.025) left++;
        while (right < end && distances[right + 1] <= distances[index] + 0.025) right++;
        const meters = (distances[right] - distances[left]) * 1000;
        if (meters < 15) continue;
        const grade = (segment[right].elevation! - segment[left].elevation!) / meters;
        slopes[index] = grade > 0.04 ? 'up' : grade < -0.04 ? 'down' : 'flat';
      }
      // Un GPX peu dense conserve une pente exploitable sur son intervalle réel.
      for (let index = start + 1; index <= end; index++) {
        const meters = (distances[index] - distances[index - 1]) * 1000;
        if (slopes[index] || meters < 15) continue;
        const grade = (segment[index].elevation! - segment[index - 1].elevation!) / meters;
        slopes[index] = grade > 0.04 ? 'up' : grade < -0.04 ? 'down' : 'flat';
      }
      start = end + 1;
    }
    const count = Math.min(segment.length - 1, 1 + Math.floor((segment.length - 2) * budget / Math.max(1, totalPoints)));
    const samples: GpxSample[] = [];
    let previous = 0;
    for (let position = 0; position <= count; position++) {
      const index = Math.round(position * (segment.length - 1) / count);
      const point = segment[index];
      let elevationBreak = segment[previous].elevation === undefined;
      for (let i = previous + 1; i <= index; i++) elevationBreak ||= segment[i].elevation === undefined;
      samples.push({
        coordinates: point.coordinates,
        distanceKm: distances[index],
        elevation: point.elevation ?? null,
        time: point.time === undefined ? null : new Date(point.time).toISOString(),
        slope: position && !elevationBreak && distances[index] > distances[previous]
          ? slopes[Math.ceil((previous + index) / 2)] ?? null : null,
        elevationBreak,
      });
      previous = index;
    }
    return [samples];
  });
}

export function describeGpx(name: string, segments: GpxPoint[][]) {
  let distance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let elevationMin: number | undefined;
  let elevationMax: number | undefined;
  let hasElevationPair = false;
  let departure: number | undefined;
  let arrival: number | undefined;
  for (const segment of segments) {
    let previousPoint: GpxPoint | undefined;
    let reference: number | undefined;
    let extreme = 0;
    let direction = 0;
    const accumulate = () => {
      if (reference === undefined || direction === 0) return;
      elevationGain += Math.max(0, extreme - reference);
      elevationLoss += Math.max(0, reference - extreme);
    };
    for (const point of segment) {
      if (point.time !== undefined) {
        if (departure === undefined) departure = point.time;
        else arrival = point.time;
      }
      if (previousPoint) distance += distanceKm(previousPoint.coordinates, point.coordinates);
      const elevation = point.elevation;
      if (elevation === undefined) {
        accumulate();
        reference = undefined;
        direction = 0;
      } else {
        elevationMin = Math.min(elevationMin ?? elevation, elevation);
        elevationMax = Math.max(elevationMax ?? elevation, elevation);
        if (previousPoint?.elevation !== undefined) hasElevationPair = true;
        if (reference === undefined) reference = extreme = elevation;
        // Une variation ou un changement de pente doit atteindre 3 m.
        // Les segments et les suites sans altitude sont traités séparément.
        if (direction === 0) {
          if (Math.abs(elevation - reference) >= 3) {
            direction = Math.sign(elevation - reference);
            extreme = elevation;
          }
        } else if ((elevation - extreme) * direction > 0) {
          extreme = elevation;
        } else if ((extreme - elevation) * direction >= 3) {
          accumulate();
          reference = extreme;
          extreme = elevation;
          direction *= -1;
        }
      }
      previousPoint = point;
    }
    accumulate();
  }
  return {
    name,
    distance: Math.round(distance * 1000) / 1000,
    durationSeconds: departure !== undefined && arrival !== undefined && arrival >= departure
      ? Math.floor((arrival - departure) / 1000) : null,
    departureAt: departure === undefined ? null : new Date(departure).toISOString(),
    arrivalAt: arrival === undefined ? null : new Date(arrival).toISOString(),
    elevationGain: hasElevationPair ? Math.round(elevationGain) : null,
    elevationLoss: hasElevationPair ? Math.round(elevationLoss) : null,
    elevationMin: elevationMin ?? null,
    elevationMax: elevationMax ?? null,
  };
}
