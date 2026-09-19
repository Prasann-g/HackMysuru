import { Router } from 'express';
import {
  evaluateRouting,
  createFallbackRoutingDecision,
  getJurisdictionDataSourceStatus,
} from '../services/routingEngine.js';
import { getWardForCoordinates, getMysuruWardsGeoJson } from '../services/wardService.js';
import type { RoutingInput } from '../types/routing.js';

export const routingRouter = Router();

// 1. Evaluate Routing for given complaint coordinates, category, and context
routingRouter.post('/evaluate', (req, res) => {
  const input = req.body as RoutingInput;

  try {
    const decision = evaluateRouting(input);
    res.status(200).json(decision);
  } catch (err: unknown) {
    console.error('[Routing Evaluation Exception]', err);
    const fallback = createFallbackRoutingDecision(err);
    res.status(200).json(fallback);
  }
});

// 2. Query system jurisdiction data source availability
routingRouter.get('/jurisdiction-status', (_req, res) => {
  const status = getJurisdictionDataSourceStatus();
  const isAvailable = status === 'AVAILABLE';
  res.status(200).json({
    status,
    authoritativeDatasetAvailable: isAvailable,
    datasetIdentifier: isAvailable ? 'mysuru-mcc-wards-65' : undefined,
    totalWards: isAvailable ? 65 : 0,
    message: isAvailable
      ? 'Authentic 65-ward GIS polygon dataset available for Mysuru City Corporation jurisdiction resolution.'
      : 'Authoritative GIS polygons, official ward boundaries, and municipal gazette datasets are currently UNAVAILABLE in the repository.',
    operatingPolicy:
      'Zero-hallucination policy enforced: Point-in-polygon matching verified against 65-ward GeoJSON; outside-boundary points held for review.',
  });
});

// 3. Point-in-polygon Ward Lookup for Coordinates
routingRouter.post('/ward-lookup', (req, res) => {
  const { latitude, longitude } = req.body;
  const result = getWardForCoordinates(latitude, longitude);
  res.status(200).json(result);
});

// 4. Authentic 65-ward GIS GeoJSON
routingRouter.get(['/wards/geojson', '/geojson'], (_req, res) => {
  const data = getMysuruWardsGeoJson();
  if (!data) {
    res.status(404).json({ error: 'Mysuru ward boundaries GeoJSON not found.' });
    return;
  }
  res.status(200).json(data);
});
