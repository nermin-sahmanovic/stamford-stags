import type { ComponentType } from "react";
import {
  CloudIcon,
  FogIcon,
  PartlyCloudyIcon,
  RainIcon,
  SnowIcon,
  StormIcon,
  SunIcon,
  type IconProps,
} from "@/components/shell/icons";
import { getMatchForecast, type WeatherKind } from "@/lib/weather";

const ICONS: Record<WeatherKind, ComponentType<IconProps>> = {
  sun: SunIcon,
  partly: PartlyCloudyIcon,
  cloud: CloudIcon,
  fog: FogIcon,
  rain: RainIcon,
  snow: SnowIcon,
  storm: StormIcon,
};

const tile = "mt-2.5 flex items-center gap-2.5 rounded-[10px] bg-navy-2 px-3 py-2.5";

/** Match-day forecast tile for the navy hero. Render inside <Suspense>; it never throws. */
export async function MatchForecast(props: { lat: number | null; lon: number | null; startsAt: string }) {
  const forecast = await getMatchForecast(props);
  if (forecast.kind === "past") return null;

  if (forecast.kind !== "ok") {
    return (
      <div className={`${tile} border border-dashed border-slate-600`}>
        <SunIcon size={22} className="shrink-0 text-ball" />
        <p className="text-[13px] font-semibold text-white">
          {forecast.kind === "too-far" ? "Forecast available closer to match day" : "Forecast unavailable right now"}
        </p>
      </div>
    );
  }

  const Icon = ICONS[forecast.icon];
  const details = [
    `${forecast.tempF}°F`,
    forecast.precipPct === null ? null : `${forecast.precipPct}% rain`,
    forecast.windMph === null ? null : `${forecast.windMph} mph wind`,
  ].filter(Boolean);
  return (
    <div className={tile}>
      <Icon size={26} className="shrink-0 text-ball" />
      <div className="min-w-0 text-[13px] text-slate-300">
        <p>
          <span className="font-semibold text-white">{forecast.label}</span> at start · {details.join(" · ")}
        </p>
        {forecast.hiF !== null && forecast.loF !== null ? (
          <p>
            High {forecast.hiF}° · Low {forecast.loF}°
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MatchForecastFallback() {
  return <div className={`${tile} h-[46px] animate-pulse motion-reduce:animate-none`} aria-hidden="true" />;
}
