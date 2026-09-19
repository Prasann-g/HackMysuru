import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadWardsDataset,
  getWardForCoordinates,
  resetWardsCache,
  WARD_BOUNDARY_VERSION,
} from '../src/services/wardService.js';
import path from 'node:path';
import fs from 'node:fs';

describe('Authentic Mysuru Ward Resolution Service (wardService)', () => {
  beforeEach(() => {
    resetWardsCache();
  });

  afterEach(() => {
    resetWardsCache();
  });

  it('1. loads exactly 65 authentic ward polygon features from supplied GeoJSON', () => {
    const dataset = loadWardsDataset();
    expect(dataset).not.toBeNull();
    expect(dataset!.totalWards).toBe(65);
    expect(dataset!.features.length).toBe(65);
    expect(dataset!.boundaryVersion).toBe('mysuru-mcc-wards-65');
  });

  it('2. verifies all ward numbers 1 through 65 exist without gaps or duplicates', () => {
    const dataset = loadWardsDataset();
    expect(dataset).not.toBeNull();

    const wardNumbers = dataset!.features
      .map((f) => Number(f.wardNumber))
      .sort((a, b) => a - b);

    expect(wardNumbers.length).toBe(65);
    expect(wardNumbers[0]).toBe(1);
    expect(wardNumbers[64]).toBe(65);

    for (let i = 1; i <= 65; i++) {
      expect(wardNumbers[i - 1]).toBe(i);
    }
  });

  it('3. verifies KGIS properties are properly mapped from dataset', () => {
    const dataset = loadWardsDataset();
    expect(dataset).not.toBeNull();

    const ward1 = dataset!.features.find((f) => f.wardNumber === '1');
    expect(ward1).toBeDefined();
    expect(ward1!.wardId).toBe(6354);
    expect(ward1!.wardCode).toBe('2605001');
    expect(ward1!.wardName).toBe('Hebbalu Lakshmikanthanagar');
    expect(ward1!.lgdWardCode).toBe(28806);
    expect(ward1!.bbox).toBeDefined();
    expect(ward1!.coordinates.length).toBeGreaterThanOrEqual(3);
  });

  it('4. matches verified coordinate inside Ward 1 Hebbalu Lakshmikanthanagar', () => {
    // Exact interior centroid coordinate calculated from actual polygon
    const lat = 12.349695;
    const lng = 76.609568;

    const result = getWardForCoordinates(lat, lng);
    expect(result.status).toBe('matched');
    expect(result.wardNumber).toBe('1');
    expect(result.wardName).toBe('Hebbalu Lakshmikanthanagar');
    expect(result.wardId).toBe(6354);
    expect(result.wardCode).toBe('2605001');
    expect(result.lgdWardCode).toBe(28806);
    expect(result.boundaryVersion).toBe(WARD_BOUNDARY_VERSION);
  });

  it('5. matches verified coordinate inside Ward 2 Manchegowdanakoppalu', () => {
    // Exact interior centroid coordinate from Ward 2 polygon
    const lat = 12.344937;
    const lng = 76.613153;

    const result = getWardForCoordinates(lat, lng);
    expect(result.status).toBe('matched');
    expect(result.wardNumber).toBe('2');
    expect(result.wardName).toBe('Manchegowdanakoppalu');
    expect(result.wardId).toBe(6355);
    expect(result.wardCode).toBe('2605002');
  });

  it('6. matches verified coordinate inside Ward 65 Srirampura', () => {
    // Exact interior centroid coordinate from Ward 65 polygon
    const lat = 12.265741;
    const lng = 76.624681;

    const result = getWardForCoordinates(lat, lng);
    expect(result.status).toBe('matched');
    expect(result.wardNumber).toBe('65');
    expect(result.wardName).toBe('Srirampura');
    expect(result.wardId).toBe(6482);
    expect(result.wardCode).toBe('2605065');
  });

  it('7. returns outside_boundary for coordinates clearly outside Mysuru MCC limits', () => {
    // Bengaluru Vidhana Soudha coordinates
    const lat = 12.9716;
    const lng = 77.5946;

    const result = getWardForCoordinates(lat, lng);
    expect(result.status).toBe('outside_boundary');
    expect(result.wardId).toBeNull();
    expect(result.wardNumber).toBeNull();
    expect(result.wardName).toBeNull();
  });

  it('8. validates coordinates and fails gracefully for invalid input values', () => {
    // Out of bounds latitude
    expect(getWardForCoordinates(95.0, 76.61).status).toBe('outside_boundary');
    expect(getWardForCoordinates(-95.0, 76.61).status).toBe('outside_boundary');

    // Out of bounds longitude
    expect(getWardForCoordinates(12.3, 190.0).status).toBe('outside_boundary');
    expect(getWardForCoordinates(12.3, -190.0).status).toBe('outside_boundary');

    // NaN and non-finite
    expect(getWardForCoordinates(NaN, 76.61).status).toBe('outside_boundary');
    expect(getWardForCoordinates(12.3, Infinity).status).toBe('outside_boundary');
    expect(getWardForCoordinates('invalid', 'invalid').status).toBe('outside_boundary');
    expect(getWardForCoordinates(undefined, undefined).status).toBe('outside_boundary');
  });

  it('9. confirms GeoJSON CRS84 longitude/latitude ordering is respected', () => {
    // If [longitude, latitude] were mistakenly swapped as [latitude, longitude]:
    // lat=76.609568 (swapped) and lng=12.349695 would be completely outside the Mysuru bounding box!
    const swappedResult = getWardForCoordinates(76.609568, 12.349695);
    expect(swappedResult.status).toBe('outside_boundary');

    // Correct GPS order: latitude=12.349695, longitude=76.609568
    const correctResult = getWardForCoordinates(12.349695, 76.609568);
    expect(correctResult.status).toBe('matched');
    expect(correctResult.wardNumber).toBe('1');
  });

  it('10. resolves points lying exactly on polygon boundaries deterministically', () => {
    // Exact boundary vertex of Ward 1: [76.6062242, 12.3529849]
    const vertexLat = 12.3529849;
    const vertexLng = 76.6062242;

    const result1 = getWardForCoordinates(vertexLat, vertexLng);
    expect(result1.status).toBe('matched');
    expect(result1.wardNumber).toBe('1');

    // Running multiple times produces the exact same deterministic outcome
    const result2 = getWardForCoordinates(vertexLat, vertexLng);
    expect(result2.wardNumber).toBe(result1.wardNumber);
    expect(result2.wardId).toBe(result1.wardId);
  });

  it('11. returns boundary_unavailable when GeoJSON cannot be loaded', () => {
    // Test custom non-existent file path
    const nonExistentPath = path.resolve(process.cwd(), 'server', 'data', 'does-not-exist.geojson');
    const dataset = loadWardsDataset(nonExistentPath);
    expect(dataset).toBeNull();
  });
});
