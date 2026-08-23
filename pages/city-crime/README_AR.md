# CityCrime Browser

**Open-source browser-based open-world game built with React + Babylon.js.**

CityCrime Browser is an evolving 3D open-world project designed for **desktop and mobile browsers**, combining free roaming, story missions, multiplayer, vehicles, racing, aircraft, parachuting, police pursuits, combat, challenges, rewards, and customization.

The project is designed to be a reusable foundation that other developers can study, fork, modify, and build upon.

---

## 🎮 Vision

The goal is to create an original open-world experience combining:

* 🌍 Open World
* 🎬 Story Mode
* 👥 Multiplayer — up to 10 players
* 🚗 Cars
* 🏍️ Motorcycles
* 🚤 Boats & Yachts
* ✈️ Aircraft
* 🪂 Parachuting
* 🚔 Police & Wanted System
* 🔫 Combat
* 🎯 Missions
* 🏁 Car Racing
* 🏍️ Motorcycle Racing
* ⏱️ Time Trials
* 🏆 Challenges
* 🎁 Loot & Rewards
* 👕 Character Customization
* 🚘 Vehicle Customization
* 📱 Mobile Controls

The game takes inspiration from successful mechanics across open-world, racing, action, and multiplayer games while maintaining its own implementation, world, characters, assets, missions, and identity.

---

# 🧱 Technology

The current project is built with:

* **React**
* **TypeScript**
* **Babylon.js**
* **Vitest**
* **WebGL / WebGPU-compatible browser technologies**

Babylon.js is responsible for the 3D world, rendering, cameras, materials, lighting, vehicles, interactions, and other gameplay systems.

The project is designed specifically for browser deployment rather than requiring a traditional desktop game installation.

---

# 📌 Current Reference

The current development reference is:

```text
5bdc23ef
```

The original reference foundation is:

```text
CityGame_fixed_realistic.zip
```

`CityGame_tested.zip` is **not** the foundation of the current implementation.

The project should be extended from the existing working code rather than replaced with a separate prototype.

---

# 🌆 Open World

The current world contains a procedural environment including:

* Roads
* Sidewalks
* Buildings
* Towers
* Vendor stalls
* Airport
* Runway
* Water
* Marina
* Yacht
* Civilian aircraft
* Military aircraft
* Police vehicles
* Traffic
* Player
* Interactive vehicles

The world is designed to expand with:

* Residential areas
* Commercial areas
* Industrial areas
* Race tracks
* Mission locations
* Police pursuit areas
* Airports
* Marinas
* Parachute landing zones
* Challenge locations

The visual environment should use real 3D objects rather than replacing the world with images or screen-covering billboards.

---

# 🧍 Player

The player system is designed to support:

* Walking
* Running
* Jumping
* Camera control
* Health
* Damage
* Death
* Respawn
* Interaction
* Vehicle entry
* Vehicle exit
* Weapons
* Parachuting

Desktop controls should support keyboard and mouse.

Mobile controls should use touch controls designed for the game.

---

# 🤝 Interaction System

Interactions should be handled through a reusable system instead of individual hard-coded implementations.

Possible interactions include:

* Enter vehicle
* Exit vehicle
* Talk to NPC
* Pick up item
* Open door
* Start mission
* Complete mission
* Start race
* Interact with objects
* Enter aircraft
* Jump from aircraft
* Start challenges

Gameplay interactions must depend on actual game state.

---

# 🚗 Vehicles

## Cars

Cars should support:

* Acceleration
* Braking
* Steering
* Collision
* Vehicle health
* Damage
* Disable state
* Entering
* Exiting
* Theft
* Racing

## 🏍️ Motorcycles

Motorcycles are intended to be fully playable vehicles rather than static decorations.

They should support:

* Riding
* Acceleration
* Steering
* Braking
* Collision
* Damage
* Crash/fall behavior
* Racing

## 🚤 Boats & Yachts

Water vehicles should become playable where appropriate and support movement over water, interaction, and future missions or races.

## ✈️ Aircraft

Aircraft should eventually be fully playable.

The target is an **arcade flight system**, not a professional flight simulator.

Aircraft should support:

* Entering
* Starting
* Acceleration
* Takeoff
* Climbing
* Descending
* Steering
* Altitude control
* Flying
* Landing
* Exiting

Aircraft must be usable for missions and parachuting.

---

# 🪂 Parachute

The parachute system should provide an actual gameplay loop:

```text
Enter Aircraft
      ↓
Fly
      ↓
Jump
      ↓
Free Fall
      ↓
Deploy Parachute
      ↓
Glide
      ↓
Control Direction
      ↓
Land
```

The player should be able to:

* Jump from aircraft
* Free fall
* Control direction
* Open the parachute
* Glide
* Choose a landing location
* Land safely

Dangerous impact without proper parachute deployment should cause appropriate damage or death.

---

# 🚔 Police & Wanted System

The current police system is preserved and can be expanded.

Existing behavior includes:

* Distant gunfire does not automatically begin a chase.
* Close directed shots can damage police.
* Disabled police vehicles can be approached and stolen.
* Wanted level can decrease when the player stops or gets away.

The police system can support:

* Free Roam
* Story Missions
* Vehicle Chases
* Escapes
* Challenges
* Wanted levels
* Police pursuit
* Police vehicle theft

The project should maintain **one central police system**, not multiple competing implementations.

---

# 🔫 Combat

Combat should be based on real gameplay state.

The architecture should support:

* Weapons
* Projectiles
* Hit detection
* Damage
* Health
* Enemy health
* Police health
* Vehicle damage
* Future weapon types
* Weapon customization

The game should not fake combat through UI-only events.

---

# 🎬 Mission System

The mission system should be **data-driven and extensible**.

A mission consists of sequential objectives.

Supported objective concepts can include:

```text
GoToLocation
Interact
EnterVehicle
DriveTo
Follow
EscapePolice
StealVehicle
DisableVehicle
Collect
Talk
Protect
Eliminate
Checkpoint
WinRace
Survive
ParachuteToLocation
Land
```

Each objective must depend on actual gameplay state.

For example:

> A `DriveTo` objective is completed only when the player is actually driving the required vehicle and the vehicle reaches the required location.

A button that simply declares an objective completed is not a real mission system.

---

# 🎬 Story Mode

Story Mode is designed primarily for solo players.

Missions may eventually:

* Unlock other missions
* Give rewards
* Change wanted level
* Unlock vehicles
* Unlock races
* Unlock locations
* Change world state
* Introduce characters
* Start new activities

The mission architecture should allow a large story campaign to be added without rewriting the core engine.

---

# 👥 Multiplayer

The current multiplayer foundation supports rooms of up to:

**10 players**

The system already supports:

* Authentication
* Joining rooms
* Leaving rooms
* Individual player states
* Movement synchronization
* Player reuse
* 10-player limit

The architecture should eventually support:

* Multiplayer races
* Multiplayer challenges
* Cooperative missions
* Competitive activities

Story Mode should remain playable without other players.

The current synchronization is polling-based. A future WebSocket implementation can provide better real-time synchronization without requiring the existing multiplayer system to be discarded.

---

# 🏁 Racing

## Car Racing

The racing system should support:

* Starting grid
* Countdown
* Checkpoints
* Finish line
* Timer
* Laps
* Player ranking
* Winner
* Loser
* Rewards
* Restart

Race completion must depend on actual vehicle position and checkpoint progress.

## 🏍️ Motorcycle Racing

Motorcycle races should reuse the same race architecture while supporting:

* Motorcycle-only races
* Checkpoints
* Laps
* Timers
* Rankings
* Rewards

## 👥 Multiplayer Racing

The architecture should support:

* Multiple players
* Player positions
* Race progress
* Checkpoints
* Rankings
* Finish state
* Winner

---

# 🏆 Challenges

The game can contain short activities for solo players or friends.

Examples:

* Car Racing
* Motorcycle Racing
* Police Escape
* Longest Jump
* Parachute Landing
* Time Trial
* Vehicle Destruction
* Checkpoint Challenge
* Survival
* Target Shooting

Each challenge should have:

* Start
* Objective
* Timer when needed
* Score
* Ranking
* Reward
* End state

---

# 🎁 Economy, Loot & Rewards

The game may use an original in-game currency inspired by common multiplayer game economy systems.

For example:

**Credits**

Possible rewards:

* Credits
* Cosmetic items
* Character customization
* Vehicle customization
* Weapon skins
* Unlocks
* Seasonal rewards

## 📦 Loot Boxes

The game may include original reward containers such as:

* Weapon Crate
* Vehicle Crate
* Clothing Crate
* Resource Crate
* Seasonal Crate

Loot systems should not create unfair pay-to-win advantages in competitive multiplayer.

Random reward systems must be designed responsibly, including appropriate disclosure of probabilities and compliance with applicable laws and platform policies where required.

---

# 🎨 Graphics Direction

The target visual style is:

> **Realistic-stylized open world + PBR materials + cinematic lighting + coherent characters + coherent vehicles + coherent weapons.**

The goal is to approach a console-inspired visual presentation while remaining practical for browsers, ordinary computers, and mobile devices.

Assets should have consistent:

* Scale
* Materials
* Lighting response
* Polygon density
* Texture resolution
* Art direction

Avoid mixing unrelated styles.

---

# 🧰 Free Asset & Creation Resources

The following resources can be useful for development. Always verify the license of every asset before redistribution.

## Poly Haven

Useful for:

* HDRIs
* Materials
* Textures
* 3D assets

https://polyhaven.com/

Poly Haven provides many CC0 assets.

## Quaternius

Useful for:

* Characters
* Vehicles
* Props
* Weapons
* Environment assets

https://quaternius.com/

Many Quaternius packs are CC0.

## Kenney

Useful for:

* UI
* Props
* Game assets
* Prototype assets
* Weapons

https://kenney.nl/

Many Kenney assets are CC0.

## Mixamo

Useful for character animation:

* Walking
* Running
* Jumping
* Combat
* Other humanoid animations

https://www.mixamo.com/

Always verify the applicable Mixamo/Adobe license before redistribution.

## Blender

Useful for:

* Modeling
* Editing
* Retopology
* Optimization
* LOD creation
* Material editing
* Asset conversion
* GLB/glTF preparation
* Creating original assets

https://www.blender.org/

---

# ⚙️ Performance

Performance is a core requirement.

Possible optimization techniques include:

* Object pooling
* Efficient update loops
* Distance-based updates
* LOD
* Texture compression
* Asset optimization
* Reduced distant AI updates
* Avoiding unnecessary per-frame allocations
* Adaptive graphics quality

Suggested quality levels:

```text
Low
Medium
High
Ultra
```

The game should select an appropriate quality level according to device capabilities when practical.

Priority:

> **Playable > Stable > Visual Quality > Extra Features**

---

# 📱 Mobile Support

The game should support mobile browsers with touch controls for:

* Movement
* Camera
* Jump
* Interaction
* Vehicle controls
* Acceleration
* Braking
* Steering
* Shooting
* Aircraft controls
* Parachute controls

Controls should remain accessible without covering the main gameplay area.

---

# 🧪 Testing

The project uses Vitest for automated tests.

Existing tests cover areas including:

* Authentication
* Multiplayer rooms
* 10-player limit
* Empty missions
* Wanted system
* Police damage
* Police vehicle theft
* Motorcycle behavior
* World boundaries

New gameplay systems should include tests for:

* Mission start
* Objective progression
* Vehicle objectives
* Police escape
* Mission completion
* Rewards
* Race countdown
* Checkpoints
* Finish state
* Ranking
* Aircraft states
* Parachute states
* Landing
* Multiplayer race state

TypeScript checks should pass.

Automated tests are not a replacement for browser testing.

---

# 🧪 Browser Verification

The current prototype has been verified in a browser for:

* Babylon canvas
* Player
* World
* Traffic
* Vehicles
* Vendor stalls
* HUD
* Multiplayer room
* Map with `M`
* Car entry with `E`

The project remains a prototype and is not presented as a finished AAA game.

---

# 🔐 Development Rules

Contributors should:

* Extend the existing architecture.
* Prefer reusable systems.
* Keep gameplay data-driven.
* Add tests for new gameplay logic.
* Keep dependencies reasonable.
* Optimize assets.
* Verify third-party licenses.
* Fix regressions before merging.

Do not:

* Replace the project with a new prototype.
* Delete working systems without a documented reason.
* Create duplicate implementations.
* Replace gameplay logic with fake UI.
* Ignore TypeScript errors.
* Ignore runtime errors.
* Break multiplayer to add a feature.
* Add copyrighted commercial game assets.

---

# 🗺️ Roadmap

## Foundation

* Open world
* Player
* Vehicles
* Police
* Map
* HUD
* Multiplayer

## Gameplay

* Interaction system
* Vehicle framework
* Motorcycle driving
* Boat gameplay
* Aircraft
* Parachute

## Activities

* Car racing
* Motorcycle racing
* Time trials
* Challenges
* Police escapes

## Story

* Mission framework
* NPC framework
* Story missions
* Rewards
* Unlocks

## Multiplayer

* Multiplayer racing
* Multiplayer challenges
* Cooperative missions
* Competitive activities
* Future realtime synchronization

## Polish

* Mobile controls
* Adaptive graphics
* Lighting
* LOD
* Asset optimization
* Audio
* UI
* Performance

---

# 🧠 Inspiration

CityCrime Browser may take gameplay inspiration from different genres and games, including open-world crime games, battle royale games, racing games, action games, survival games, and multiplayer challenge games.

Examples of games whose mechanics may be studied include:

* Grand Theft Auto
* PUBG
* Racing games
* Open-world games
* Survival games
* Multiplayer action games

This means studying **gameplay concepts**, not copying protected content.

The project does not aim to reproduce another game's:

* Characters
* Map
* Missions
* Story
* UI
* Music
* Sounds
* Models
* Textures
* Logos
* Source code
* Brand identity

The objective is to create an original game.

---

# 📜 License

The source code of this repository should be distributed under the open-source license specified in the root `LICENSE` file.

If no license has been selected yet, contributors should add an appropriate open-source license before treating the repository as formally licensed for unrestricted reuse.

**Important:** the repository's software license does not automatically change the licenses of third-party assets.

Every external model, texture, sound, font, animation, library, or other resource remains subject to its own license.

---

# ⚠️ Third-Party Content

Before adding external content:

1. Check its license.
2. Confirm redistribution is permitted.
3. Keep required attribution.
4. Keep license information.
5. Do not upload copyrighted commercial-game assets.
6. Do not assume that something is free merely because it is downloadable.

---

# ⚖️ Disclaimer

CityCrime Browser is an independent open-source project.

It is not affiliated with, endorsed by, or sponsored by:

* Rockstar Games
* Grand Theft Auto
* PUBG
* Epic Games
* Krafton
* or any other referenced commercial game or company.

All trademarks belong to their respective owners.

References to other games describe gameplay inspiration only and do not imply ownership, partnership, or affiliation.

---

# 🤝 Contributions

Contributions, forks, improvements, assets, optimizations, gameplay systems, bug fixes, documentation, and ideas are welcome.

When contributing:

* Keep changes focused.
* Preserve existing functionality.
* Prefer reusable architecture.
* Test new gameplay systems.
* Document important technical decisions.
* Verify asset licenses.
* Avoid unnecessary rewrites.

The long-term goal is to build a high-quality open-source browser game that other developers can learn from, fork, extend, and turn into their own projects.

---

## ⭐ Project Principle

**Build original.
Reuse legally.
Learn from the industry.
Keep the game playable.
Optimize for the browser.
And make every system actually work.**


# وريث الهرم — Heir of the Pyramid

> يُبنى هذا المستند فوق الحجر الأساسي الموجود فعلاً في `pages/city-crime/babylon-react-src`
> (محرك Babylon.js + React + Havok Physics + WebGPU/WebGL2 fallback جاهز وشغّال).
> لا نبدأ من الصفر. نغيّر **الاتجاه الفني والقصصي** فوق نفس المحرك، ونعيد استخدام:
> - `GameWorld.ts` / `Player.ts` / `Vehicle.ts` / `InputManager.ts` / `Environment.ts` كما هي في البداية
> - نموذج الفيلا وشخصية المرأة (`woman_standing_v8.glb`) والسيارة (`porsche_992_gt3`) كأصول أولية مؤقتة
> - نظام الـ 7 فصول (chapters) المتصوَّر أصلاً في الصور: Giza Villa → Facility → Valley → Sumer → Temple → Timeline → Mars
>   نعيد تسميته وتوجيهه ليطابق قصة "وريث الهرم" بدل ثيم الجريمة الحضرية

---

## 0) قرار أساسي قبل أي سطر كود: **البلوك-آوت أولاً*
**قاعدة صارمة للمرحلة 1:** كل شيء أشكال هندسية بسيطة (صناديق، كبسولات، أسطوانات) بألوان مسطحة. صفر GLB جديد. صفر حركات Mixamo. صفر خامات PBR. اللاعب كبسولة زرقاء، الزوجة كبسولة وردية، الابن كبسولة صغيرة صفراء، البئر أسطوانة سوداء، السرداب مجرد ممر صناديق. هذا يشتغل فورًا في أي متصفح بدون تحميل أي حاجة تقيلة.

الجرافيكس (الفيلا الحقيقية، الشخصية الحقيقية) بييجوا **بعد** ما اللوب يكون ممتع وشغال — بالظبط زي ما قلت لابنك: "شغلها الأول". هذا القرار وحده هيوفر عليك أسابيع الإحباط اللي حصلت مع مانوس.

---

## 1) القصة الكاملة

### الشخصيات

| الشخصية | الوصف |
|---|---|
| **يوسف** (اللاعب) | مصري، 35 سنة، غني، عايش قرب الهرم. خايف من حاجات بسيطة (الظلام، المرتفعات)، مش رياضي، بيحب مراته وابنه أكتر من نفسه. مش بطل خارق — وده بالظبط سبب حبنا له. |
| **مايا** (الزوجة) | باحثة آثار أجنبية فضولية. هي اللي بتكتشف البئر. شجاعة أكتر من يوسف، وده بيدّي تفاعل لطيف بينهم. تلعب أونلاين أو NPC في وضع الفردي. |
| **نور** (الابن، 7 سنين) | بيشوف حاجات مايشوفهاش الكبار (نقوش متوهجة، كائنات صغيرة). بيفتح أبواب معينة ببراءته فقط. |
| **الظل** | مش وحش خارجي — تجسيد لخوف يوسف نفسه. بيتصاعد قوة مع كل مرحلة، ومواجهته الأخيرة مش بالسلاح، بل بتذكّر لحظات حب حقيقية. |

### الفكرة المحورية اللي بتفرّقنا عن أي لعبة تانية

بدل "7 عوالم موازية منفصلة تمامًا" (زي ما كانت الفكرة الأولى)، اللعبة كلها بتحصل في **مكان واحد يتعمّق**: تحت الهرم. كل ما تنزل طبقة أعمق، الزمن يتقشّر وتلاقي حقبة مختلفة اتطمرت هناك (ماضي بعيد، حاضر مشوّه، مستقبل). ده معناه:
- نفس الأصول الأساسية (صخر الهرم، السرداب) بتتلوّن بدل ما تتبنى من الصفر لكل مرحلة
- القصة عندها منطق مكاني واحد ومترابط، مش بوابات عشوائية
- تقدر تحقق نفس الطموح (ماضي/مستقبل/فقر/مرايا) من غير ما تبني 7 ألعاب منفصلة

---

## 2) المراحل السبع

كل مرحلة مبنية على نفس اللوب: **استكشاف → لغز → مفاجأة (رعب خفيف بدون قُبح) → كنز → فتح قدرة/طريق جديد**.

### المرحلة 1 — السقوط
**المكان:** حديقة فيلا يوسف، بئر أثري قديم
مايا بتكتشف بئر مغطى، الغطاء بينهار وهي بتقع. يوسف يجري ينزل وراها بحبل. نور بينزل وراهم سرًا.

- **اللعب:** تعليم الحركة، التسلق، أول لغز بسيط (تحريك حجر يفتح ممر)
- **مفاجأة:** خفاش يطير فجأة من الظلام — مش مخيف، سريع ومضحك
- **نهاية المرحلة:** باب حجري ضخم لا يفتح. نور: "بابا قول افتح". يوسف يقولها. الباب يستجيب لصوته فقط.

**حالة البناء:** ✅ هذا الجزء يمكن بناؤه الآن فوق `GameWorld.ts` الموجود — استبدال الشارع الحضري بحديقة فيلا + بئر أسطواني + ممر صناديق بلوك-آوت.

---

### المرحلة 2 — غرفة الأسرار
**المكان:** قاعة تحت الهرم، بوابة حجرية دائرية

النقوش تحكي حكاية "الوريث". تظهر كائنات ضوئية صغيرة لطيفة تساعد. أول ظهور بعيد لـ"الظل" (كتلة دخان بترصد فقط).

- **اللغز الرئيسي:** جمع 7 مفاتيح حجرية موزعة في القاعة (استكشاف أفقي وعمودي)
- **نهاية المرحلة:** البوابة تُفهم على أنها **مصعد عبر طبقات الأرض تحت الهرم** — مش بوابة زمن سحرية عشوائية، بل انتقال منطقي لطبقة أعمق تاريخيًا

---

### المرحلة 3 — طبقة القرية المطمورة (الماضي)
قرية مصرية قديمة حقيقية اتطمرت تحت الهرم، أهلها عالقين بلعنة قديمة. عائلة فقيرة حقيقية — مش "نسخة فقيرة منك" بل ناس حقيقيين محتاجين مساعدة.

- **المهام:** إصلاح قناة مياه، حماية الطفل من الظل، فك اللعنة بلغز هيروغليفي
- **الدرس المغلف:** الشكر بييجي من المقارنة الحقيقية اللي بتعيشها، مش من محاضرة مكتوبة
- **الكنز:** أول "قطعة أثرية نادرة" تفتح الطبقة التالية

---

### المرحلة 4 — طبقة المرايا
مساحة تحت الأرض فيها مياه جوفية عاكسة. **آلية لعب جديدة:** انعكاسك في المرآة بيعمل حركة زيادة عن اللي انت عملتها فعلاً، وبعض الألغاز محتاجة تفكير عكسي.

- **الرعب هنا:** بصري بحت — الانعكاس بيتحرك لوحده لثانية وبعدين يرجع طبيعي. مفيش خطر حقيقي، بس إحساس "إيه ده؟"

---

### المرحلة 5 — طبقة المستقبل
طبقة فيها آثار مستقبلية اتدفنت هنا (تلميح إن الزمن تحت الهرم مش خطي). مدينة مصغّرة مهجورة. "الفيروس" هنا رمزي: **فيروس نسيان** — الناس نسيوا بعض، مفيش زومبي أو دم.

- **المهمة:** جمع "ذكريات" مبعثرة لإيقاظ سكان المدينة المصغّرة

---

### المرحلة 6 — طبقة الظل (المواجهة)
الظل يتجسّد بالكامل — خوف يوسف نفسه. المعركة مش بالسلاح، هي حل ألغاز الشجاعة (تذكّر لحظات حب حقيقية من حياته مع مايا ونور).

---

### المرحلة 7 — العودة
يوصلوا لأعمق نقطة، يكتشفوا إن "الإرث" مش كنز أو قوة، بل **مسؤولية حماية الهرم من الظل للأبد**. يرجعوا للسطح. الظل يهمس إنه هيرجع. يتفتح **وضع الأرض** (لعب يومي مستمر).

---

## 3) وضع الأونلاين (منفصل تمامًا عن الستوري)

| الوضع | الوصف |
|---|---|
| **سباق الطبقات** | 2-4 لاعبين يتنافسوا مين يوصل لأعمق طبقة في نسخة عشوائية يومية |
| **صيد الكنوز التعاوني** | فريق يدخل سرداب جديد يوميًا، لازم يتقسموا الأدوار |
| **هجوم الظل** | دفاع جماعي عن "قلب الهرم" ضد موجات |
| **السوق** | تبادل كنوز، إرسال هدايا (ذهب/جواهر/أسلحة) مباشرة لصديق |

---

## 4) نظام الكنوز

- **ذهب** → أدوات مساعدة يومية
- **جواهر زرقاء** → معدات غير قاتلة (شبكة، ضوء يطرد الظل)
- **قطع أثرية نادرة** → لا تُشترى، تُهدى أو تفتح محتوى حصري

كل ده قابل للإرسال المباشر لصديق — أهم عنصر اجتماعي بيخلي اللاعبين يرجعوا يوميًا.

---

## 5) فكرة "مود البناء" (زي روبلوكس/ليجو) — ملاحظة صريحة

سألت عن ده وهو سؤال ذكي، لكن لازم أكون صريح معاك: هذا **نظام منفصل تمامًا** عن اللعبة اللي بنينها فوق. Roblox بينجح لأن اللاعب بيبني حاجته هو، وده يعني:
- محرر مستويات (level editor) كامل داخل اللعبة
- سيرفر يحفظ إبداعات كل لاعب
- نظام مشاركة/تقييم بين اللاعبين

ده مشروع ضخم لوحده ومحتاج بنية تحتية (باك إند + قاعدة بيانات) غير اللي عندك دلوقتي. **توصيتي:** سيبها فكرة مستقبلية بعد ما تخلص المراحل السبع وتشتغل فعليًا. ممكن نرجعلها كـ "وضع 8: ورشة الوريث" لاحقًا، حيث اللاعبين يقدروا يبنوا "طبقات" خاصة بيهم تحت الهرم ويشاركوها. لكن دلوقتي: خليها بعيدة عن نطاق العمل.

---

## 6) خطة التنفيذ الفعلية (الأولوية بالترتيب)

### الأسبوع 1: بلوك-آوت المرحلة 1 فقط
1. عدّل `GameWorld.ts` — احذف مشهد التقاطع الحضري، حط حديقة فيلا بسيطة (أرضية + بئر أسطواني + سياج)
2. `Player.ts` يفضل كبسولة بسيطة (موجود بالفعل كـ fallback إجرائي — استخدمه، متحملش GLB جديد دلوقتي)
3. أضف منطق نزول البئر (انتقال بسيط من حديقة لممر تحت الأرض)
4. لغز واحد بسيط: صندوق يتحرك بالدفع يفتح باب
5. جرّب مع ابنك في هذه المرحلة بالذات — لو استمتع، كمّل. لو لأ، عدّل قبل ما تزود حاجة

### الأسبوع 2-3: نهاية المرحلة 1 + بداية المرحلة 2
- باب صوتي (بسيط: زرار تفاعل E بدل تعرف صوت حقيقي مبدئيًا)
- قاعة غرفة الأسرار ببلوك-آوت + 7 مفاتيح تُجمع

### بعد كده فقط
- الجرافيكس الحقيقية (الفيلا، الشخصية) من `ASSETS.md` الموجود
- الحركات (Mixamo) فقط بعد ما اللوب يبقى ممتع بالبلوك-آوت

---

## 7) ليه القرار ده صح تقنيًا

بحثت في أكتر الألعاب انتشارًا الفترة دي (2026) قبل الكتابة: Roblox وMinecraft بينجحوا بسبب البناء والاستكشاف والتواصل الاجتماعي المستمر، مش بسبب جرافيكس فائقة. بالعكس، جرافيكس Minecraft بسيطة جدًا وده مايمنعش الإدمان. الدرس: **اللوب المتعة يسبق الجرافيكس دايمًا.*


# تطبيق تحديث المرحلة الأولى (البئر والسرداب)

## الملفات

```
game/WellSite.ts    → جديد كلياً. انسخه إلى: babylon-react-src/client/src/game/WellSite.ts
game/GameWorld.ts   → استبدال كامل لملفك الحالي بنفس المسار
game/Player.ts      → استبدال كامل لملفك الحالي بنفس المسار
components/Hud.tsx  → استبدال كامل لملفك الحالي بنفس المسار
```

`Environment.ts` و`Vehicle.ts` لم يُحذفا — لم يعودا مستخدَمين حاليًا لكنهما سيفيدان لاحقًا (المدينة المستقبلية والسيارة).

## ماذا يفعل هذا التحديث فعليًا

- كل شيء بلوك-آوت: صناديق وأسطوانات وألوان مسطحة، صفر GLB وصفر HDRI وصفر خامات ثقيلة → تحميل فوري
- يوسف كبسولة زرقاء مرئية، كاميرا third-person تتبعه (بدل first-person سابقاً)
- **WASD** حركة، **Shift** ركض، **الماوس بعد نقرة** يدير الكاميرا، **E** يتفاعل مع الباب — كل هذا موجود بالفعل في `InputManager.ts` ولم يتغير
- تسلسل اللعب الفعلي:
  1. تمشي من الفيلا نحو فوهة البئر (الحلقة البنية)
  2. عند الاقتراب منها، ينقلك الكود مباشرة لقاع البئر (محاكاة نزول بسيطة، بدون فيزياء سقوط معقدة الآن)
  3. تمشي عبر السرداب، تتخطى الحجر (يدفعه جسمك تلقائياً بفضل الفيزياء الموجودة أصلاً في PhysicsAggregate)
  4. تصل للباب الحجري، تضغط **E** أمامه → الباب ينزلق لأسفل ببطء (يمثل الانفتاح)
- الـ HUD يعرض هدف المرحلة الحالي تلقائياً (نص عربي يتغير مع كل خطوة)

## البناء والتشغيل محلياً

```bash
cd babylon-react-src
npm install --legacy-peer-deps
npm run dev
```

افتح الرابط المحلي، انقر على الشاشة (لتفعيل قفل الماوس)، وابدأ باللعب.

## البناء للنشر على mdm1.org

```bash
npm run build
```

الناتج في `dist/public/` — ينسخ إلى المسار الذي يخدم منه `https://mdm1.org/pages/city-crime/` حسب نفس آلية النشر المستخدمة حالياً في الريبو (`README_AR.md` الأصلي يوضح هيكلة الرفع لنسخة Godot Web؛ نسخة Babylon/React الحالية تُخدَّم كملفات `dist/public` ثابتة عبر نفس استضافة GitHub Pages أو الاستضافة المستخدمة).

## الخطوة التالية المقترحة بعد تجربة ابنك لها

بعد ما يجرّب ويديك فيدباك، ممكن نضيف بالترتيب:
1. صوت فعلي عند نطق "افتح" (Web Speech API) بدل ضغطة E — لو حبيت الميكانيكية دي فعلاً
2. مايا كشخصية NPC (كبسولة وردية) تظهر عالقة في نهاية السرداب قبل الباب
3. تأثير بصري بسيط على الباب عند الفتح (توهج + جسيمات) بدل الانزلاق البسيط
