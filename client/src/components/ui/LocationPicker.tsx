// src/components/ui/LocationPicker.tsx
import React, { useState, useEffect } from "react";
import { MapPin, Navigation, ExternalLink, X, Check, Loader2, Compass } from "lucide-react";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

export interface LocationPickerProps {
  label?: string;
  latitude: number;
  longitude: number;
  mapsUrl?: string;
  onChange: (coords: { latitude: number; longitude: number; mapsUrl?: string }) => void;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function getMapsLink(opts?: {
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  location?: string;
  fieldNumber?: string;
}): string | null {
  if (!opts) return null;
  if (opts.googleMapsUrl && opts.googleMapsUrl.trim().startsWith("http")) {
    return opts.googleMapsUrl.trim();
  }
  if (
    typeof opts.latitude === "number" &&
    typeof opts.longitude === "number" &&
    (opts.latitude !== 0 || opts.longitude !== 0) &&
    !isNaN(opts.latitude) &&
    !isNaN(opts.longitude)
  ) {
    return `https://www.google.com/maps?q=${opts.latitude},${opts.longitude}`;
  }
  if (opts.address && opts.address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.address.trim())}`;
  }
  if (opts.location && opts.location.trim()) {
    const q = `${opts.location.trim()}${opts.fieldNumber ? ` ${opts.fieldNumber.trim()}` : ""}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return null;
}

export function extractLatLngFromMapsUrl(input: string): { latitude: number; longitude: number } | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // 1. Direct comma separated: "12.971598, 77.594562" or "12.971598,77.594562"
  const directMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    }
  }

  // 2. Google Maps URL with @lat,lng e.g. .../@12.9715987,77.5945627,15z...
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      latitude: Number(parseFloat(atMatch[1]).toFixed(6)),
      longitude: Number(parseFloat(atMatch[2]).toFixed(6)),
    };
  }

  // 3. Google Maps query param ?q=lat,lng or &q=lat,lng or ?query=lat,lng or ll=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|query|ll|loc:)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return {
      latitude: Number(parseFloat(qMatch[1]).toFixed(6)),
      longitude: Number(parseFloat(qMatch[2]).toFixed(6)),
    };
  }

  // 4. Google Maps embedded data !3dlat!4dlng
  const dataMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) {
    return {
      latitude: Number(parseFloat(dataMatch[1]).toFixed(6)),
      longitude: Number(parseFloat(dataMatch[2]).toFixed(6)),
    };
  }

  return null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  label = "Location & Map Coordinates",
  latitude,
  longitude,
  mapsUrl,
  onChange,
  helperText,
  required,
  disabled,
  className,
}) => {
  const [mapsInput, setMapsInput] = useState<string>(mapsUrl || "");
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const hasCoords = (latitude !== 0 || longitude !== 0) && !isNaN(latitude) && !isNaN(longitude);

  useEffect(() => {
    if (mapsUrl && !mapsInput) {
      setMapsInput(mapsUrl);
    } else if (hasCoords && !mapsInput) {
      setMapsInput(`https://www.google.com/maps?q=${latitude},${longitude}`);
    }
  }, [mapsUrl, latitude, longitude, hasCoords]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMapsInput(val);
    setInputError(null);

    if (!val.trim()) {
      onChange({ latitude: 0, longitude: 0, mapsUrl: "" });
      return;
    }

    const parsed = extractLatLngFromMapsUrl(val);
    if (parsed) {
      onChange({ ...parsed, mapsUrl: val.trim() });
    } else {
      if (val.trim().startsWith("http://") || val.trim().startsWith("https://")) {
        onChange({ latitude: latitude || 0, longitude: longitude || 0, mapsUrl: val.trim() });
      }
      if (val.length > 10 && !val.includes("http") && !val.includes(",")) {
        setInputError("Enter coordinates like '12.9716, 77.5946' or paste a Google Maps link");
      }
    }
  };

  const handleInputBlur = () => {
    if (mapsInput.trim() && !extractLatLngFromMapsUrl(mapsInput)) {
      setInputError("Couldn't extract coordinates from this link. Try pasting the URL from Google Maps or using 'Detect Location'.");
    } else {
      setInputError(null);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    setInputError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetecting(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const link = `https://www.google.com/maps?q=${lat},${lng}`;
        setMapsInput(link);
        onChange({ latitude: lat, longitude: lng, mapsUrl: link });
        toast.success(`Location detected: ${lat}, ${lng}`);
      },
      (error) => {
        setIsDetecting(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission denied. Please allow location access or paste a Google Maps link.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            toast.error("Location detection request timed out.");
            break;
          default:
            toast.error("Couldn't retrieve your current location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleClear = () => {
    setMapsInput("");
    setInputError(null);
    onChange({ latitude: 0, longitude: 0, mapsUrl: "" });
  };

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {hasCoords && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-field-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            <Check size={11} /> {latitude}, {longitude}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Compass size={15} />
          </div>
          <input
            type="text"
            value={mapsInput}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            placeholder="Paste Google Maps link or 'lat, lng' coordinates"
            className={clsx(
              "w-full pl-9 pr-8 py-2 text-xs rounded-lg border transition-colors",
              "bg-white dark:bg-pitch-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500",
              inputError
                ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
                : "border-slate-200 dark:border-white/10 focus:border-volt-400 focus:ring-1 focus:ring-volt-400"
            )}
          />
          {mapsInput && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              title="Clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={disabled || isDetecting}
          className={clsx(
            "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
            "border border-slate-200 dark:border-white/10 shadow-xs",
            "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-pitch-700 dark:hover:bg-pitch-600 dark:text-slate-200",
            isDetecting && "opacity-75 cursor-not-allowed"
          )}
          title="Detect location automatically via device GPS"
        >
          {isDetecting ? (
            <Loader2 size={13} className="animate-spin text-volt-500" />
          ) : (
            <Navigation size={13} className="text-volt-500 dark:text-volt-400" />
          )}
          <span>{isDetecting ? "Detecting..." : "Detect Location"}</span>
        </button>
      </div>

      {inputError ? (
        <p className="text-2xs text-red-500 dark:text-red-400">{inputError}</p>
      ) : helperText ? (
        <p className="text-2xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : (
        <p className="text-2xs text-slate-500 dark:text-slate-400">
          Paste a link from Google Maps (e.g. from share menu) or click &ldquo;Detect Location&rdquo; to set coordinates.
        </p>
      )}

      {(hasCoords || (mapsUrl && mapsUrl.startsWith("http")) || (mapsInput && mapsInput.startsWith("http"))) && (
        <div className="flex items-center gap-2 pt-1 text-2xs text-slate-500 dark:text-slate-400">
          {hasCoords && (
            <>
              <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                <MapPin size={11} className="text-volt-500 dark:text-volt-400" />
                Lat: {latitude}, Lng: {longitude}
              </span>
              <span>·</span>
            </>
          )}
          <a
            href={
              mapsInput?.startsWith("http")
                ? mapsInput
                : mapsUrl?.startsWith("http")
                  ? mapsUrl
                  : `https://www.google.com/maps?q=${latitude},${longitude}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-volt-600 dark:text-volt-400 hover:underline font-semibold"
          >
            <span>View on Google Maps</span>
            <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  );
};
