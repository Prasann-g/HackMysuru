import React, { useState } from 'react';
import {
  Camera,
  Copy,
  Check,
  Hash,
  AlertTriangle,
  MapPin,
  Layers,
  Info,
  ScanLine,
  Clock,
} from 'lucide-react';
import type { ComplaintRecord } from '../../services/api';

interface CVEvidenceInspectionPanelProps {
  complaint: ComplaintRecord;
}

export const CVEvidenceInspectionPanel: React.FC<CVEvidenceInspectionPanelProps> = ({
  complaint,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const vResult = complaint.verificationResult;
  const eq = vResult?.evidenceQuality;
  const geo = vResult?.geoEvidence;
  const temporal = vResult?.temporalEvidence;

  // 1. Quality Score
  const hasQualityScore = eq?.qualityScore !== undefined && eq?.qualityScore !== null;
  const qualityScore = hasQualityScore ? eq.qualityScore : null;

  // 2. Dimensions & File
  const width = eq?.width;
  const height = eq?.height;
  const dimensionsText =
    width && height ? `${width} × ${height} px` : 'Unavailable';
  const formatText =
    eq?.format?.toUpperCase() ||
    complaint.evidenceMetadata?.mimetype?.replace('image/', '').toUpperCase() ||
    'Unavailable';
  const fileSizeText = eq?.fileSizeBytes
    ? `${(eq.fileSizeBytes / 1024).toFixed(1)} KB`
    : complaint.evidenceMetadata?.sizeBytes
    ? `${(complaint.evidenceMetadata.sizeBytes / 1024).toFixed(1)} KB`
    : 'Unavailable';

  // 3. Sharpness / Blur
  const hasSharpness = eq?.sharpness !== undefined && eq?.sharpness !== null;
  const isBlurry = eq?.sharpness?.isBlurry;
  const laplacian = eq?.sharpness?.laplacianVariance;

  // 4. Photometrics (Brightness & Contrast)
  const hasBrightness = eq?.brightness !== undefined && eq?.brightness !== null;
  const meanBrightness = eq?.brightness?.mean;
  const isDark = eq?.brightness?.isSeverelyDark;
  const isOverexposed = eq?.brightness?.isSeverelyOverexposed;

  const hasContrast = eq?.contrast !== undefined && eq?.contrast !== null;
  const contrastStdev = eq?.contrast?.stdev;
  const isBlank = eq?.contrast?.isBlankOrUniform;

  // 5. SHA-256 Duplicate Screening
  const sha256 = complaint.imageSha256 || null;
  const imageComparisonSignal = vResult?.imageComparisonSignal ?? null;
  const isExactDuplicate = imageComparisonSignal === 'EXACT_IMAGE_REUSE';
  const sha256Compared = vResult?.imageComparisonCoverage?.sha256Compared ?? false;

  // 6. dHash Screening
  const phash = complaint.imagePhash || null;
  const isVisualDuplicate = imageComparisonSignal === 'LIKELY_VISUAL_SIMILARITY';
  const dHashCompared = vResult?.imageComparisonCoverage?.dHashCompared ?? false;
  const visualMatch = vResult?.matches?.find((m) => m.imageMatch);
  const hammingDistance = visualMatch?.imageMatch?.hammingDistance;

  // 7. Forensic EXIF & GPS
  const hasExif = eq?.metadata?.hasExif ?? false;
  const cameraDevice =
    [eq?.metadata?.cameraMake, eq?.metadata?.cameraModel]
      .filter(Boolean)
      .join(' ') ||
    eq?.metadata?.software ||
    null;
  const hasGps = eq?.metadata?.hasGpsMetadata ?? false;
  const gpsCoords =
    hasGps && eq?.metadata?.gpsLatitude && eq?.metadata?.gpsLongitude
      ? `${eq.metadata.gpsLatitude.toFixed(5)}°, ${eq.metadata.gpsLongitude.toFixed(5)}°`
      : null;

  // 8. Temporal Indicators
  const exifTime = temporal?.exifDateTime || eq?.metadata?.dateTimeOriginal || null;
  const dateDelta = temporal?.diffDaysWithObservedDate;

  // 9. Road-Damage Visual Classification (Phase 2E — MODEL_NOT_AVAILABLE until trained)
  const vc = vResult?.visualClassification;
  const vcStatus = vc?.status ?? null;
  const vcClass = vc?.predictedClass ?? null;
  const vcLimitations = vc?.limitations ?? [];

  return (
    <div className="bg-gradient-to-br from-bridge-warm-ivory via-white to-bridge-almond-50/50 rounded-2xl p-4 sm:p-5 border border-bridge-almond-300 shadow-sm space-y-4 text-xs">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-bridge-almond-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-bridge-gold-100/80 border border-bridge-gold-200 text-bridge-gold-900">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-bridge-charcoal-900 text-sm tracking-tight flex items-center gap-1.5">
              <span>CV Evidence Inspection</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-bridge-charcoal-100 text-bridge-charcoal-700 font-semibold border border-bridge-charcoal-200">
                Deterministic
              </span>
            </h4>
            <p className="text-[11px] text-bridge-charcoal-500">
              Deterministic Spatial Convolution &amp; Perceptual Gradient Hash Analysis
            </p>
          </div>
        </div>

        {/* Quality Score Indicator */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-bridge-charcoal-400 block font-medium uppercase tracking-wider">
              Evidence Quality Score
            </span>
            <span className="font-mono font-bold text-xs text-bridge-charcoal-900">
              {qualityScore !== null ? `${qualityScore} / 100` : 'Unavailable'}
            </span>
          </div>
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              qualityScore !== null && qualityScore >= 75
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : qualityScore !== null && qualityScore >= 50
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : qualityScore !== null
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-bridge-almond-100 text-bridge-charcoal-600 border-bridge-almond-300'
            }`}
          >
            {qualityScore !== null && qualityScore >= 75
              ? 'Optimal Clarity'
              : qualityScore !== null && qualityScore >= 50
              ? 'Acceptable Detail'
              : qualityScore !== null
              ? 'Low Quality'
              : 'Unavailable'}
          </div>
        </div>
      </div>

      {/* Mandatory Honest Scientific Disclaimer */}
      <div className="bg-bridge-almond-100/70 border border-bridge-almond-200/90 rounded-xl p-2.5 text-[11px] text-bridge-charcoal-700 flex items-start gap-2 leading-relaxed">
        <Info className="w-4 h-4 text-bridge-gold-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-bridge-charcoal-900 block">
            Classical Computer Vision — deterministic image and metadata analysis. Not AI object detection.
          </strong>
          These signals assist human review and do not prove authenticity or scene truth.
        </div>
      </div>

      {/* Grid: 3 Analytical Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* PILLAR 1: Photometrics & Spatial Sharpness */}
        <div className="bg-white p-3 rounded-xl border border-bridge-almond-200 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-bridge-almond-150">
            <span className="font-semibold text-bridge-charcoal-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-bridge-gold-600" />
              <span>Spatial &amp; Photometrics</span>
            </span>
            <span className="text-[10px] text-bridge-charcoal-400 font-mono">
              3×3 Laplacian
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-bridge-charcoal-500 block">Resolution &amp; File:</span>
              <span className="font-semibold text-bridge-charcoal-800 font-mono">
                {dimensionsText}
              </span>
              <span className="text-[10px] text-bridge-charcoal-500 block">
                {formatText} • {fileSizeText}
              </span>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block">Edge Sharpness (Laplacian):</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasSharpness ? (
                  isBlurry ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                      Low Sharpness / Blurry
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                      Adequate Focus
                    </span>
                  )
                ) : (
                  <span className="text-bridge-charcoal-400 text-[10px]">Unavailable</span>
                )}
                {laplacian !== undefined && (
                  <span className="font-mono text-[10px] text-bridge-charcoal-600">
                    Var: {laplacian}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block">Photometric Luminance:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasBrightness ? (
                  isDark ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                      Low-Light Scene
                    </span>
                  ) : isOverexposed ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                      Severe Glare
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                      Balanced Exposure
                    </span>
                  )
                ) : (
                  <span className="text-bridge-charcoal-400 text-[10px]">Unavailable</span>
                )}
                {meanBrightness !== undefined && (
                  <span className="font-mono text-[10px] text-bridge-charcoal-600">
                    {meanBrightness}/255
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block">Contrast Uniformity:</span>
              <span className="font-semibold text-bridge-charcoal-800">
                {hasContrast ? (
                  isBlank ? (
                    <span className="text-rose-700 font-bold">Uniform / Near-Blank</span>
                  ) : (
                    <span className="text-emerald-700">Dynamic Range OK</span>
                  )
                ) : (
                  <span className="text-bridge-charcoal-400 font-normal">Unavailable</span>
                )}
              </span>
              {contrastStdev !== undefined && (
                <span className="text-[10px] text-bridge-charcoal-500 font-mono block">
                  StdDev: {contrastStdev}σ
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PILLAR 2: Cryptographic & Perceptual Hash Screening */}
        <div className="bg-white p-3 rounded-xl border border-bridge-almond-200 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-bridge-almond-150">
            <span className="font-semibold text-bridge-charcoal-800 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-bridge-gold-600" />
              <span>Hash Fingerprinting</span>
            </span>
            <span className="text-[10px] text-bridge-charcoal-400 font-mono">
              SHA-256 + dHash
            </span>
          </div>

          <div className="space-y-2.5 text-[11px]">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-bridge-charcoal-500">Cryptographic SHA-256:</span>
                {sha256 && (
                  <button
                    type="button"
                    onClick={() => handleCopy(sha256, 'sha256')}
                    className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-0.5 rounded"
                    title="Copy SHA-256"
                  >
                    {copiedField === 'sha256' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              <div className="font-mono text-[10px] bg-bridge-almond-50 p-1.5 rounded border border-bridge-almond-200 truncate text-bridge-charcoal-800">
                {sha256 || 'Unavailable'}
              </div>
              <div className="mt-1">
                {isExactDuplicate ? (
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-[10px] inline-block">
                    Exact Image Reuse Detected
                  </span>
                ) : imageComparisonSignal === 'NO_IMAGE_MATCH' && sha256Compared ? (
                  <span className="text-[10px] text-emerald-700 font-medium">
                    Unique byte signature in candidate pool
                  </span>
                ) : imageComparisonSignal === 'LIKELY_VISUAL_SIMILARITY' ? (
                  <span className="text-[10px] text-bridge-charcoal-600 font-medium">
                    No exact byte match found
                  </span>
                ) : (
                  <span className="text-[10px] text-bridge-charcoal-500 italic">
                    Comparison unavailable
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-bridge-charcoal-500">Perceptual dHash (64-bit gradient):</span>
                {phash && (
                  <button
                    type="button"
                    onClick={() => handleCopy(phash, 'phash')}
                    className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-0.5 rounded"
                    title="Copy dHash"
                  >
                    {copiedField === 'phash' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              <div className="font-mono text-[10px] bg-bridge-almond-50 p-1.5 rounded border border-bridge-almond-200 truncate text-bridge-charcoal-800">
                {phash || 'Unavailable'}
              </div>
              <div className="mt-1">
                {isVisualDuplicate ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px] inline-block">
                    Near-Duplicate Resemblance {hammingDistance !== undefined ? `(d = ${hammingDistance}/64)` : ''}
                  </span>
                ) : isExactDuplicate ? (
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-[10px] inline-block">
                    {hammingDistance !== undefined && hammingDistance !== null
                      ? `Exact Visual Match (d = ${hammingDistance}/64)`
                      : 'Exact file match confirmed; dHash distance unavailable'}
                  </span>
                ) : imageComparisonSignal === 'NO_IMAGE_MATCH' && dHashCompared ? (
                  <span className="text-[10px] text-emerald-700 font-medium">
                    No visual duplicate within threshold (d ≤ 10)
                  </span>
                ) : (
                  <span className="text-[10px] text-bridge-charcoal-500 italic">
                    Comparison unavailable
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PILLAR 3: Forensic EXIF, GPS & Temporal Signals */}
        <div className="bg-white p-3 rounded-xl border border-bridge-almond-200 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-bridge-almond-150">
            <span className="font-semibold text-bridge-charcoal-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-bridge-gold-600" />
              <span>Forensics &amp; Provenance</span>
            </span>
            <span className="text-[10px] text-bridge-charcoal-400 font-mono">
              EXIF / GPS
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-bridge-charcoal-500 block">Camera Device / App:</span>
              <span className="font-semibold text-bridge-charcoal-800 block truncate">
                {cameraDevice || (hasExif ? 'EXIF present; device details unavailable' : 'Unavailable / Stripped')}
              </span>
              <span className="text-[10px] text-bridge-charcoal-400 block">
                {hasExif ? 'Header markers present' : 'No EXIF metadata detected'}
              </span>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block">Embedded GPS Metadata:</span>
              {gpsCoords ? (
                <div>
                  <span className="font-mono text-bridge-charcoal-800 font-semibold block truncate">
                    {gpsCoords}
                  </span>
                  {geo?.status && (
                    <span
                      className={`px-1.5 py-0.2 rounded font-semibold text-[10px] inline-block mt-0.5 border ${
                        geo.status === 'VALID'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : geo.status === 'MISMATCH' || geo.status === 'OUT_OF_BOUNDS'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Geo-Validation: {geo.status}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-bridge-charcoal-500 text-[10px]">
                  No embedded GPS (advisory on-site review)
                </span>
              )}
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block">Temporal Timestamp:</span>
              <span className="font-mono text-bridge-charcoal-800 block truncate font-medium">
                {exifTime || 'Unavailable'}
              </span>
              {dateDelta !== undefined && (
                <span className="text-[10px] text-bridge-charcoal-500 block">
                  Delta with reported date: {dateDelta} day(s)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phase 2E — Road-Damage Visual Classification */}
      {vcStatus !== null && (
        <div className="bg-white rounded-xl border border-bridge-almond-200 p-3 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-bridge-almond-150">
            <span className="font-semibold text-bridge-charcoal-800 flex items-center gap-1.5 text-[11px]">
              <ScanLine className="w-3.5 h-3.5 text-bridge-gold-600" />
              <span>Road-Damage Visual Classification</span>
            </span>
            <span className="text-[10px] font-mono text-bridge-charcoal-400 uppercase tracking-wider">
              Phase 2E
            </span>
          </div>

          {vcStatus === 'MODEL_NOT_AVAILABLE' && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Model training pending
                </span>
                <span className="text-slate-600 leading-relaxed">
                  Automated road-damage classification is not yet available.
                  A trained model artifact has not been deployed.
                  Damage type and severity must be assessed through physical site inspection.
                </span>
              </div>
            </div>
          )}

          {vcStatus === 'CLASSIFIED' && vcClass && (
            <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg p-2.5 text-[11px] text-teal-800">
              <ScanLine className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-teal-900 block capitalize">
                  Predicted class: {vcClass.replace('_', ' ')}
                </span>
                <span className="text-teal-700 leading-relaxed">
                  This is an assistive signal only. Physical site inspection is required to confirm damage type and severity.
                </span>
              </div>
            </div>
          )}

          {vcStatus === 'INFERENCE_ERROR' && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-700">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span>Classification could not be completed for this image. Officer should assess damage through site inspection.</span>
            </div>
          )}

          {vcStatus === 'IMAGE_UNREADABLE' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>Image could not be decoded for classification. Manual officer review required.</span>
            </div>
          )}

          {vcLimitations.length > 0 && (
            <div className="text-[10px] text-bridge-charcoal-400 leading-relaxed pt-0.5">
              <strong className="font-semibold text-bridge-charcoal-500">Limitation: </strong>
              {vcLimitations[0]}
            </div>
          )}
        </div>
      )}

      {/* Municipal Evidence Integrity Standard (Rule 7) */}
      <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 text-[11px] text-amber-950 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-amber-950">Municipal Evidence Protocol (Rule 7 Standard):</strong>{' '}
          Digital camera watermarks, GPS overlays, and EXIF headers are citizen-submitted evidence. Under MCC operating standards, camera stamps are not certified as tamper-proof until verified through physical site inspection by Ward Field Engineers.
        </p>
      </div>
    </div>
  );
};
