import type { LogLevel, LogRecord } from "@logtape/logtape";
import { describe, expect, it } from "vitest";

import { bufferUntil } from "./buffer";
import type { StoredLogEntry } from "./storage";

function record(level: LogLevel, message: string): LogRecord {
  return { category: ["tabherd"], level, message: [message], rawMessage: message, timestamp: 0, properties: {} };
}

function setup(maxBufferSize = 3) {
  const received: string[] = [];
  const sink = bufferUntil(
    (entry) => {
      received.push(entry.message);
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

describe("捨てたログの溜め直し", () => {
  it("捨てたログを溜め直すと、捨てた後に溜めたログより前に戻す", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    const restore = sink.clear();
    sink(record("debug", "b"));
    restore();
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["a", "b", "c"]);
  });

  it("溜め直して上限を超えた分は、古いものから捨てる", () => {
    const { received, sink } = setup(2);
    sink(record("debug", "a"));
    sink(record("debug", "b"));
    const restore = sink.clear();
    sink(record("debug", "c"));
    restore();
    sink(record("warning", "d"));
    expect(received).toStrictEqual(["b", "c", "d"]);
  });

  it("捨てた後にログを流していたら、溜め直さない", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    const restore = sink.clear();
    sink(record("warning", "b"));
    restore();
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["b", "c"]);
  });

  it("捨てた後に別の消去で捨てていたら、溜め直さない", () => {
    const { received, sink } = setup();
    sink(record("debug", "a"));
    const restoreFirst = sink.clear();
    sink(record("debug", "b"));
    const restoreSecond = sink.clear();
    restoreFirst();
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["c"]);
    restoreSecond();
  });
});

describe("溜めるログの写し", () => {
  it("溜めた後に、ログに渡した配列・オブジェクトが書き換えられても、溜めた内容は変わらない", () => {
    const written: StoredLogEntry[] = [];
    const sink = bufferUntil(
      (entry) => {
        written.push(entry);
      },
      { triggerLevel: "warning", maxBufferSize: 3 },
    );
    const tabIds = [1, 2];
    const operation = { type: "ungroup", tabIds };
    sink({ ...record("debug", "a"), properties: { tabIds, operation } });

    tabIds.push(3);
    operation.type = "move-group";
    sink(record("warning", "b"));

    expect(written[0]?.properties).toStrictEqual({ tabIds: [1, 2], operation: { type: "ungroup", tabIds: [1, 2] } });
  });
});
