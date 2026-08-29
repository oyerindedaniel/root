export type InputInteraction = "keyboard" | "pointer";

export type MotionIntent = "animate" | "instant";

export function classifyClick(event: Pick<MouseEvent, "detail">): InputInteraction {
  return event.detail === 0 ? "keyboard" : "pointer";
}

export function motionForInteraction(
  interaction: InputInteraction,
): MotionIntent {
  return interaction === "pointer" ? "animate" : "instant";
}
