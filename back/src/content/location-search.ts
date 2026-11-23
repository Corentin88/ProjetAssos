import { ServiceUnavailableException } from '@nestjs/common';
import { ContentInputError } from './content-input.error.js';

type Match = { label: string; latitude: number; longitude: number };

export async function searchAddress(address: string): Promise<Match[]> {
  if (address.trim().length < 3) throw new ContentInputError('Saisissez une adresse plus précise.');
  const url = new URL('https://data.geopf.fr/geocodage/search');
  url.search = new URLSearchParams({ q: address.trim(), limit: '5', autocomplete: '0', indexes: 'address' }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) throw new Error();
    const { features } = await response.json() as {
      features?: { properties?: { label?: string }; geometry?: { coordinates?: number[] } }[];
    };
    return (features ?? []).slice(0, 5).flatMap(feature => {
      const [longitude, latitude] = feature.geometry?.coordinates ?? [];
      const label = feature.properties?.label;
      return typeof label === 'string' && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
        ? [{ latitude, longitude, label: label.slice(0, 500) }] : [];
    });
  } catch {
    throw new ServiceUnavailableException();
  }
}
