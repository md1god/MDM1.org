# هيكل City Crime

تمثل React الإطار وواجهة الحالة فقط، بينما Babylon.js هو مساحة العرض، وتبقى قواعد اللعب في TypeScript مستقل تحت `client/src/game`.

| الوحدة | المسؤولية | لا تملك |
|---|---|---|
| `GameCanvas.tsx` | دورة حياة canvas، تهيئة المحرك، تحجيم النافذة، تمرير أحداث الحالة إلى React | منطق حركة أو فيزياء أو DOM HUD |
| `game/engine.ts` | WebGPU ثم fallback WebGL2 وbenchmark والـ tier | رسم عناصر React |
| `game/scene.ts` | إنشاء المشهد وGameHandle وتنظيف الموارد | حالة عناصر واجهة React |
| `game/GameWorld.ts` | ملكية البيئة، الإنارة، الـ post-processing، وloop العالم | تأثيرات واجهة مباشرة |
| `game/Player.ts` | نقطة تحكم منطقية غير مرئية للحركة والتفاعل، من دون تمثيل مرئي للشخصية | تفاصيل الـ HUD |
| `game/Vehicle.ts` | جسم السيارة والقيادة والدخول/الخروج | اختيار الأصول أو HUD |
| `game/Environment.ts` | أرضية/شارع/مبانٍ/خامات وإضاءة وfallback إجرائي | منطق اللاعب |
| `game/InputManager.ts` | تحويل المفاتيح والماوس إلى أفعال دلالية | كائنات Babylon أو React بشكل مباشر |
| `game/PerformanceManager.ts` | FPS متحرك، dynamic resolution، حالة الأداء | ترتيب أحداث المهمة |
| `game/GameEvents.ts` | عقد أحداث صغير بين world وReact | ملكية المشهد |
| `components/Hud.tsx` | الخريطة المصغرة والمهمة والعدّادات والتحميل | تشغيل حلقة Babylon |

## نماذج البيانات

```ts
type QualityTier = "Ultra" | "High" | "Medium" | "Low";
type EngineKind = "WebGPU" | "WebGL2";
type MissionState = { id: string; title: string; objective: string; progress: number; target: { x: number; z: number } };
type HudState = { loading: { label: string; progress: number }; fps: number; tier: QualityTier; engine: EngineKind; player: { health: number; stamina: number; x: number; z: number; inVehicle: boolean }; mission: MissionState };
```

يتصل world بـ React عبر callbacks ذات payloadات صغيرة غير قابلة لإجبار إعادة تهيئة المشهد، ويحدث HUD على وتيرة مقيدة لتجنب render لكل إطار.
