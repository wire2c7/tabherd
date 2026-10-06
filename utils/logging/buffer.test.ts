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
    // 前提/検証: きっかけ warning に対し debug・info だけを渡すと、1件も流れない
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("info", "b"));
    expect(received).toStrictEqual([]);
  });

  it("きっかけのレベル以上のログが来たら、溜めたログと一緒に流す", () => {
    // 前提/検証: debug・info を溜めた後に warning を渡すと、溜めた2件ときっかけの1件が受け取った順に流れる
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("info", "b"));
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["a", "b", "c"]);
  });

  it("上限を超えて溜めたログは古いものから捨てる", () => {
    // 前提/検証: 上限2件で debug を3件溜めて error を渡すと、最も古い1件が捨てられ残り2件と合わせて流れる
    const { received, sink } = setup(2);
    sink(record("debug", "a"));
    sink(record("debug", "b"));
    sink(record("debug", "c"));
    sink(record("error", "d"));
    expect(received).toStrictEqual(["b", "c", "d"]);
  });

  it("流した後は、次のきっかけまで流さない", () => {
    // 前提/検証: 1回目のきっかけの後に debug を渡しても増えず、2回目のきっかけで初めて一緒に流れる
    const { received, sink } = setup();
    sink(record("debug", "a"));
    sink(record("error", "b"));
    sink(record("debug", "c"));
    expect(received).toStrictEqual(["a", "b"]);
    sink(record("fatal", "d"));
    expect(received).toStrictEqual(["a", "b", "c", "d"]);
  });

  it("捨てたログは、次のきっかけで流さない", () => {
    // 前提/検証: debug を溜めて clear で捨てた後に別の debug を溜めて warning を渡すと、捨てた分は流れない
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
    // 前提/検証: clear の戻り値（溜め直す関数）を別のログを溜めた後に呼ぶと、捨てた分がその前の順番で復元される
    const { received, sink } = setup();
    sink(record("debug", "a"));
    const restore = sink.clear();
    sink(record("debug", "b"));
    restore();
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["a", "b", "c"]);
  });

  it("溜め直して上限を超えた分は、古いものから捨てる", () => {
    // 前提/検証: 上限2件で溜め直しにより合計3件が溜まると、超えた最も古い1件が捨てられる
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
    // 前提/検証: clear の後、復元前に warning で1度流すと、復元を呼んでも捨てた分は戻らない
    const { received, sink } = setup();
    sink(record("debug", "a"));
    const restore = sink.clear();
    sink(record("warning", "b"));
    restore();
    sink(record("warning", "c"));
    expect(received).toStrictEqual(["b", "c"]);
  });

  it("捨てた後に別の消去で捨てていたら、溜め直さない", () => {
    // 前提/検証: 1回目の clear の後に2回目の clear で捨て1回目の復元を呼んでも、1回目の分は戻らない
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
    // 前提: properties に渡した配列・オブジェクトを、溜めた後に書き換える
    // 検証: 溜めた内容は書き換え前の値のまま変わらない
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
