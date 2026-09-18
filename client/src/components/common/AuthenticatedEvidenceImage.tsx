import React, { useState, useEffect } from 'react';
import { Camera, ImageOff, Loader2 } from 'lucide-react';
import { apiGetComplaintImageBlobUrl } from '../../services/api';

interface AuthenticatedEvidenceImageProps {
  complaintId: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;
  dataTestId?: string;
}

export const AuthenticatedEvidenceImage: React.FC<AuthenticatedEvidenceImageProps> = ({
  complaintId,
  alt = 'Citizen evidence photo',
  className = 'w-full h-48 object-cover rounded-lg',
  aspectRatio,
  dataTestId = 'evidence-image',
}) => {
  const [imageState, setImageState] = useState<{
    id: string;
    blobUrl: string | null;
    loading: boolean;
    failed: boolean;
  }>({
    id: complaintId,
    blobUrl: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    apiGetComplaintImageBlobUrl(complaintId)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          createdUrl = url;
          setImageState({ id: complaintId, blobUrl: url, loading: false, failed: false });
        } else {
          setImageState({ id: complaintId, blobUrl: null, loading: false, failed: true });
        }
      })
      .catch(() => {
        if (active) {
          setImageState({ id: complaintId, blobUrl: null, loading: false, failed: true });
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [complaintId]);

  const isCurrent = imageState.id === complaintId;
  const loading = !isCurrent || imageState.loading;
  const failed = isCurrent && imageState.failed;
  const blobUrl = isCurrent ? imageState.blobUrl : null;

  if (loading) {
    return (
      <div
        className={`bg-bridge-almond-100 border border-bridge-almond-200 rounded-lg flex flex-col items-center justify-center p-4 text-bridge-charcoal-400 ${className}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <Loader2 className="w-5 h-5 animate-spin mb-1 text-bridge-gold-600" />
        <span className="text-[11px]">Loading evidence photo...</span>
      </div>
    );
  }

  if (failed || !blobUrl) {
    return (
      <div
        className={`bg-bridge-almond-50 border border-dashed border-bridge-almond-300 rounded-lg flex flex-col items-center justify-center p-4 text-bridge-charcoal-400 ${className}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <ImageOff className="w-6 h-6 mb-1 text-bridge-charcoal-400" />
        <span className="text-[11px] font-medium text-bridge-charcoal-600">Image unavailable</span>
        <span className="text-[10px] text-bridge-charcoal-400">Photo record unreadable or unattached</span>
      </div>
    );
  }

  return (
    <div className="relative group overflow-hidden rounded-lg">
      <img
        src={blobUrl}
        alt={alt}
        className={className}
        style={aspectRatio ? { aspectRatio } : undefined}
        data-test-id={dataTestId}
      />
      <div className="absolute top-2 left-2 bg-bridge-charcoal-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 opacity-90">
        <Camera className="w-3 h-3" />
        Evidence Photo
      </div>
    </div>
  );
};
