// Concrete Meridian: واجهة تكتيكية شفافة، تقرأ كطبقة ميدانية فوق إسفلت واقعي بدل لوحة تحكم مركزية.
import { Gauge, LocateFixed, Navigation, Radio, Shield, Zap } from "lucide-react";
import type { HudState } from "@/game/types";

const publishHudAsset = (fileName: string, developmentPath: string) => (
  import.meta.env.DEV ? developmentPath : new URL(`game-assets/${fileName}`, document.baseURI).toString()
);
const hudSymbol = publishHudAsset("city-crime-symbol.png", "/manus-storage/city-crime-symbol_a10b0634.png");
const hudSplash = publishHudAsset("city-crime-splash.png", "/manus-storage/city-crime-splash_e22e98ec.png");

function Meter({ label, value, tone }: { label: string; value: number; tone: "health" | "stamina" }) {
  return (
    <div className="meter">
      <div className="meter-label"><span>{label}</span><strong>{Math.round(value)}%</strong></div>
      <div className={`meter-track ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

export function Hud({ state }: { state: HudState }) {
  const mapX = Math.max(9, Math.min(91, 50 + state.player.x * 2.2));
  const mapY = Math.max(9, Math.min(91, 50 + state.player.z * 2.2));
  const targetX = Math.max(9, Math.min(91, 50 + state.mission.target.x * 2.2));
  const targetY = Math.max(9, Math.min(91, 50 + state.mission.target.z * 2.2));

  return (
    <div className="hud" dir="rtl">
      <header className="hud-brand panel-surface">
        <img src={hudSymbol} alt="رمز City Crime" />
        <div><p>CC / CITY CRIME</p><span>CONCRETE MERIDIAN</span></div>
      </header>

      <section className="mission-card panel-surface" aria-label="نظام المهام">
        <div className="mission-topline"><span className="signal-dot" /><span>مهمة نشطة</span><Radio size={14} /></div>
        <h1>{state.mission.title}</h1>
        <p>{state.mission.objective}</p>
        <div className="mission-progress"><span style={{ width: `${state.mission.progress * 100}%` }} /></div>
      </section>

      <section className="mini-map panel-surface" aria-label="الخريطة المصغرة">
        <div className="map-head"><LocateFixed size={16} /><span>المنطقة 01 / التقاطع</span></div>
        <div className="map-field">
          <i className="map-road vertical" /><i className="map-road horizontal" />
          <span className="target-marker" style={{ left: `${targetX}%`, top: `${targetY}%` }} />
          <span className="player-marker" style={{ left: `${mapX}%`, top: `${mapY}%` }}><Navigation size={13} fill="currentColor" /></span>
        </div>
      </section>

      <section className="player-readout panel-surface" aria-label="حالة الشخصية">
        <div className="readout-label"><Shield size={15} /> حالة العميلة</div>
        <Meter label="الصحة" value={state.player.health} tone="health" />
        <Meter label="التحمل" value={state.player.stamina} tone="stamina" />
        <div className="coordinates"><span>X {state.player.x.toFixed(1)}</span><span>Z {state.player.z.toFixed(1)}</span></div>
      </section>

      <aside className="telemetry panel-surface">
        <div><Gauge size={15} /><span>{state.fps || "—"} FPS</span></div>
        <div><Zap size={15} /><span>{state.engine}</span></div>
        <div><span className="tier-dot" /><span>{state.tier}</span></div>
      </aside>

      <div className="control-hint panel-surface">
        <span><b>WASD</b> حركة</span><span><b>SHIFT</b> ركض</span><span><b>E</b> {state.player.inVehicle ? "خروج من السيارة" : "تفاعل / قيادة"}</span>
      </div>

      {state.loading.active && (
        <section className="loading-overlay" aria-live="polite">
          <img className="loading-backdrop" src={hudSplash} alt="" />
          <div className="loading-copy panel-surface">
            <span>نظام المدينة / قيد التهيئة</span>
            <h2>{state.loading.label}</h2>
            <div className="loading-progress"><i style={{ width: `${state.loading.progress}%` }} /></div>
            <strong>{Math.round(state.loading.progress)}%</strong>
          </div>
        </section>
      )}
    </div>
  );
}
