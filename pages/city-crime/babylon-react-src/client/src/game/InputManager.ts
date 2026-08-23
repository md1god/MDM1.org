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

  // === Touch / Mobile ===
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private touchCurrentY = 0;
  private touchActive = false;
  private touchId: number | null = null;
  private isMobile = false;

  // === On-screen buttons ===
  private btnW = false;
  private btnA = false;
  private btnS = false;
  private btnD = false;
  private btnShift = false;
  private btnE = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }
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
    this.yaw += event.movementX * 0.0022;
    this.pitch = Math.max(-0.55, Math.min(0.24, this.pitch - event.movementY * 0.0015));
  };

  private readonly onCanvasClick = () => {
    if (!this.pointerLocked && !this.isMobile) {
      this.canvas.requestPointerLock?.();
    }
  };

  // === Touch handlers for virtual joystick (left side) ===
  private readonly onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    const touch = event.changedTouches[0];
    // Left half = movement joystick
    if (touch.clientX < window.innerWidth * 0.5) {
      this.touchActive = true;
      this.touchId = touch.identifier;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchCurrentX = touch.clientX;
      this.touchCurrentY = touch.clientY;
    }
  };

  private readonly onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.touchCurrentX = touch.clientX;
        this.touchCurrentY = touch.clientY;
      }
    }
  };

  private readonly onTouchEnd = (event: TouchEvent) => {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.touchId) {
        this.touchActive = false;
        this.touchId = null;
      }
    }
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onPointerMove);
    canvas.addEventListener("click", this.onCanvasClick);

    // Touch
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  // === On-screen button API ===
  setButton(key: "w" | "a" | "s" | "d" | "shift" | "e", pressed: boolean) {
    switch (key) {
      case "w": this.btnW = pressed; break;
      case "a": this.btnA = pressed; break;
      case "s": this.btnS = pressed; break;
      case "d": this.btnD = pressed; break;
      case "shift": this.btnShift = pressed; break;
      case "e":
        if (pressed && !this.btnE) {
          this.player?.interact();
          this.interactQueued = true;
        }
        this.btnE = pressed;
        break;
    }
  }

  consume(): InputSnapshot {
    // Keyboard input
    let moveX = Number(this.heldKeys.has("d") || this.heldKeys.has("arrowright")) - Number(this.heldKeys.has("a") || this.heldKeys.has("arrowleft"));
    let moveZ = Number(this.heldKeys.has("w") || this.heldKeys.has("arrowup")) - Number(this.heldKeys.has("s") || this.heldKeys.has("arrowdown"));
    let running = this.heldKeys.has("shift");

    // Merge on-screen buttons
    moveX += Number(this.btnD) - Number(this.btnA);
    moveZ += Number(this.btnW) - Number(this.btnS);
    running = running || this.btnShift;

    // Merge virtual joystick
    if (this.touchActive) {
      const dx = this.touchCurrentX - this.touchStartX;
      const dy = this.touchCurrentY - this.touchStartY;
      const maxDist = 60;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dx, dy); // dy is forward/backward

      if (clampedDist > 10) {
        moveX += Math.sin(angle) * (clampedDist / maxDist);
        moveZ += Math.cos(angle) * (clampedDist / maxDist);
      }
    }

    // Clamp to [-1, 1]
    moveX = Math.max(-1, Math.min(1, moveX));
    moveZ = Math.max(-1, Math.min(1, moveZ));

    const interactPressed = this.interactQueued;
    this.interactQueued = false;

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
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.player = null;
  }
}
