import type { LogLevel, LogRecord } from "@logtape/logtape";
import { describe, expect, it } from "vitest";

import { bufferUntil } from "./buffer";

function record(level: LogLevel, message: string): LogRecord {
  return { category: ["tabherd"], level, message: [message], rawMessage: message, timestamp: 0, properties: {} };
}

function setup(maxBufferSize = 3) {
  const received: string[] = [];
  const sink = bufferUntil(
    (logRecord) => {
      received.push(String(logRecord.message[0]));
    },
    {
      triggerLevel: "warning",
      maxBufferSize,
    },
  );
  return { received, sink };
}

describe("きっかけのレベルまでログを溜める sink", () => {
  it("きっかけのレベルより下のログは流さない", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("info", "b"));
    expect(received).toStrictEqual([]);
  });

  it("きっかけのレベル以上のログが来たら、溜めたログと一緒に流す", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("info", "b"));
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["a", "b", "c"]);
  });

  it("上限を超えて溜めたログは古いものから捨てる", () => {
    const { received, sink } = setup(2);
    sink(record("debug", "a"));
    sink(record("debug", "b"));
    sink(record("debug", "c"));
    sink(record("error", "d"));
    expect(received).toStrictEqual(["b", "c", "d"]);
  });

  it("流した後は、次のきっかけまで流さない", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("error", "b"));
    sink(record("debug", "c"));
    expect(received).toStrictEqual(["a", "b"]);
    sink(record("fatal", "d"));
    expect(received).toStrictEqual(["a", "b", "c", "d"]);
  });

  it("捨てたログは、次のきっかけで流さない", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink.clear();
    sink(record("debug", "b"));
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["b", "c"]);
  });
});
