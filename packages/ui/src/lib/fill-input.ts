export const TOOL_PRESENT_FILL_MS = 32;
export const TOOL_PRESENT_FILL_REF_CHARS = 8;
export const TOOL_PRESENT_FILL_MIN_MS = 8;
export const TOOL_PRESENT_PREVIEW_MS = 400;

export function fillPaceMs(length: number) {
  if (length <= TOOL_PRESENT_FILL_REF_CHARS) {
    return TOOL_PRESENT_FILL_MS;
  }
  return Math.max(
    TOOL_PRESENT_FILL_MIN_MS,
    Math.round((TOOL_PRESENT_FILL_MS * TOOL_PRESENT_FILL_REF_CHARS) / length),
  );
}

export type FillInputNode = Pick<HTMLInputElement, "dispatchEvent"> &
  Partial<Pick<HTMLInputElement, "value">>;

export type FillPresentedInput = {
  text: string;
  setValue: (value: string) => void;
  input: FillInputNode | null;
  signal?: AbortSignal;
  instant: boolean;
  paceMs?: number;
};

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof DOMException) {
    return signal.reason;
  }
  return new DOMException("Aborted", "AbortError");
}

export function waitPresent(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function waitForChoice(options: {
  signal?: AbortSignal;
  bind: (choose: (id: string) => void) => () => void;
}) {
  return new Promise<string>((resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    let unbind = () => {};
    const onAbort = () => {
      unbind();
      signal?.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };
    unbind = options.bind((id) => {
      unbind();
      signal?.removeEventListener("abort", onAbort);
      resolve(id);
    });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function writeInput(input: FillInputNode | null, value: string) {
  if (input && "value" in input) {
    input.value = value;
  }
}

function dispatchInput(input: FillInputNode | null, data: string) {
  if (!input) {
    return;
  }
  const event =
    typeof InputEvent === "function"
      ? new InputEvent("input", {
          bubbles: true,
          data,
          inputType: "insertText",
        })
      : new Event("input", { bubbles: true });
  input.dispatchEvent(event);
}

export type FillPresentResult = {
  text: string;
  yielded: boolean;
};

export async function fillPresentedInput(
  options: FillPresentedInput,
): Promise<FillPresentResult> {
  const paceMs = options.paceMs ?? fillPaceMs(options.text.length);
  options.signal?.throwIfAborted();
  if (options.instant || options.text.length <= 1) {
    writeInput(options.input, options.text);
    options.setValue(options.text);
    dispatchInput(options.input, options.text.slice(-1));
    return { text: options.text, yielded: false };
  }
  for (let index = 1; index <= options.text.length; index += 1) {
    options.signal?.throwIfAborted();
    if (index > 1) {
      const expected = options.text.slice(0, index - 1);
      const live = liveValue(options.input, expected);
      if (live !== expected) {
        return { text: live, yielded: true };
      }
    }
    const prefix = options.text.slice(0, index);
    writeInput(options.input, prefix);
    options.setValue(prefix);
    dispatchInput(options.input, prefix.slice(-1));
    if (index < options.text.length) {
      await waitPresent(paceMs, options.signal);
    }
  }
  return { text: options.text, yielded: false };
}

function liveValue(input: FillInputNode | null, fallback: string) {
  if (input && "value" in input && typeof input.value === "string") {
    return input.value;
  }
  return fallback;
}
