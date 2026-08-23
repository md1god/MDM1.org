import type { Player } from "./Player";

export type InputSnapshot = {
  moveX: number;
  moveZ: number;
  running: boolean;
  interactPressed: boolean;
  yaw: number;
  pitch: number;
};

export class InputManager {
  private readonly heldKeys = new Set<string>();
  private interactQueued = false;
  private yaw = 0;
  private pitch = -0.08;
  private pointerLocked = false;
  private player: Player | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "e"].includes(key)) event.preventDefault();
    this.heldKeys.add(key);
    if (key === "e" && !event.repeat) {
      // استدعاء interact مباشرة عند ضغطة E (بدون تكرار)
      this.player?.interact();
      // الاحتفاظ بالعلم للتوافق مع الكود القديم (يمكن إزالته لاحقاً بعد الدمج الكامل)
      this.interactQueued = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.key.toLowerCase());
  };

  private readonly onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly onPointerMove = (event: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch = Math.max(-0.55, Math.min(0.24, this.pitch - event.movementY * 0.0015));
  };

  private readonly onCanvasClick = () => {
    if (!this.pointerLocked) this.canvas.requestPointerLock?.();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onPointerMove);
    canvas.addEventListener("click", this.onCanvasClick);
  }

  // ربط اللاعب (يُستدعى بعد إنشاء Player في GameWorld)
  setPlayer(player: Player) {
    this.player = player;
  }

  consume(): InputSnapshot {
    const moveX = Number(this.heldKeys.has("d")) - Number(this.heldKeys.has("a"));
    const moveZ = Number(this.heldKeys.has("w")) - Number(this.heldKeys.has("s"));
    const interactPressed = this.interactQueued;
    this.interactQueued = false;
    return {
      moveX,
      moveZ,
      running: this.heldKeys.has("shift"),
      interactPressed,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onPointerMove);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.player = null;
  }
}
