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

  // دعم اللمس
  private readonly isTouchDevice = "ontouchstart" in window;
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchRunning = false;
  private touchInteractQueued = false;

  private moveTouchId: number | null = null;
  private lookTouchId: number | null = null;
  private moveTouchStart = { x: 0, y: 0 };
  private lookTouchStart = { x: 0, y: 0 };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "e"].includes(key)) event.preventDefault();
    this.heldKeys.add(key);
    if (key === "e" && !event.repeat) {
      this.player?.interact();
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
    this.yaw += event.movementX * 0.0022; // ✅ عكس الإشارة لتصحيح الاتجاه
    this.pitch = Math.max(-0.55, Math.min(0.24, this.pitch + event.movementY * 0.0015));
  };

  private readonly onCanvasClick = () => {
    if (!this.pointerLocked && !this.isTouchDevice) {
      this.canvas.requestPointerLock?.();
    }
  };

  private readonly onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const halfWidth = this.canvas.clientWidth / 2;

      if (this.moveTouchId === null && touch.clientX < halfWidth) {
        this.moveTouchId = touch.identifier;
        this.moveTouchStart = { x: touch.clientX, y: touch.clientY };
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
      } else if (this.lookTouchId === null && touch.clientX >= halfWidth) {
        this.lookTouchId = touch.identifier;
        this.lookTouchStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  private readonly onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];

      if (touch.identifier === this.moveTouchId) {
        const dx = (touch.clientX - this.moveTouchStart.x) / 50;
        const dy = (touch.clientY - this.moveTouchStart.y) / 50;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) {
          this.touchMoveX = dx / len;
          this.touchMoveZ = -dy / len;
        } else {
          this.touchMoveX = dx;
          this.touchMoveZ = -dy;
        }
      }

      if (touch.identifier === this.lookTouchId) {
        const dx = touch.clientX - this.lookTouchStart.x;
        const dy = touch.clientY - this.lookTouchStart.y;
        this.yaw += dx * 0.0022;
        this.pitch = Math.max(-0.55, Math.min(0.24, this.pitch + dy * 0.0015));
        this.lookTouchStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  private readonly onTouchEnd = (event: TouchEvent) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.touchMoveX = 0;
        this.touchMoveZ = 0;
      }
      if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      }
    }
  };

  setTouchRunning(running: boolean) {
    this.touchRunning = running;
  }

  queueTouchInteract() {
    this.touchInteractQueued = true;
    this.player?.interact();
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onPointerMove);
    canvas.addEventListener("click", this.onCanvasClick);

    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd);
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  consume(): InputSnapshot {
    const keyboardMoveX = Number(this.heldKeys.has("d")) - Number(this.heldKeys.has("a"));
    const keyboardMoveZ = Number(this.heldKeys.has("w")) - Number(this.heldKeys.has("s"));

    const moveX = Math.max(-1, Math.min(1, keyboardMoveX + this.touchMoveX));
    const moveZ = Math.max(-1, Math.min(1, keyboardMoveZ + this.touchMoveZ));

    const running = this.heldKeys.has("shift") || this.touchRunning;
    const interactPressed = this.interactQueued || this.touchInteractQueued;

    this.interactQueued = false;
    this.touchInteractQueued = false;

    return {
      moveX,
      moveZ,
      running,
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
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.player = null;
  }
}
